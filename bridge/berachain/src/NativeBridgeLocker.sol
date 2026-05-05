// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NativeBridgeLocker is Ownable {
    using SafeERC20 for IERC20;

    bytes32 public constant RELEASE_TYPEHASH = keccak256(
        "ReleaseRequest(address recipient,bytes32 sourceMint,uint256 amount,bytes32 transferId,uint64 sourceChainId,bool isNative)"
    );

    bytes32 public constant NATIVE_SOL_MINT_ID = keccak256("NATIVE_SOL");

    struct DepositIntent {
        address depositor;
        address token;
        uint256 amount;
        bytes32 solanaRecipient;
        uint64 destinationChainId;
        uint64 nonce;
    }

    struct ReleaseRequest {
        address recipient;
        bytes32 sourceMint;
        uint256 amount;
        bytes32 transferId;
        uint64 sourceChainId;
        bool isNative;
    }

    uint256 public validatorThreshold;
    uint256 public activeValidatorCount;
    mapping(address => bool) public validators;
    mapping(bytes32 => bool) public lockedTransfers;
    mapping(bytes32 => bool) public releasedTransfers;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => address) public berachainTokenBySolanaMint;

    event ValidatorUpdated(address indexed validator, bool active);
    event ValidatorThresholdUpdated(uint256 threshold);
    event TokenMappingUpdated(bytes32 indexed solanaMint, address indexed berachainToken);
    event DepositLocked(
        bytes32 indexed transferId,
        address indexed depositor,
        address indexed token,
        uint256 amount,
        bytes32 solanaRecipient,
        uint64 destinationChainId,
        uint64 nonce
    );
    event FundsReleased(bytes32 indexed transferId, address indexed recipient, address indexed token, uint256 amount, bool isNative);

    receive() external payable {}

    function fundNative() external payable {}

    constructor(address[] memory initialValidators, uint256 initialThreshold) Ownable(msg.sender) {
        for (uint256 i = 0; i < initialValidators.length; i++) {
            validators[initialValidators[i]] = true;
            emit ValidatorUpdated(initialValidators[i], true);
        }
        activeValidatorCount = initialValidators.length;
        require(initialThreshold > 0 && initialThreshold <= activeValidatorCount, "invalid_threshold");
        validatorThreshold = initialThreshold;
        emit ValidatorThresholdUpdated(initialThreshold);
    }

    function setValidator(address validator, bool active) external onlyOwner {
        require(validators[validator] != active, "no_change");
        validators[validator] = active;
        if (active) {
            activeValidatorCount++;
        } else {
            activeValidatorCount--;
        }
        require(validatorThreshold <= activeValidatorCount, "threshold_exceeds_validators");
        emit ValidatorUpdated(validator, active);
    }

    function setValidatorThreshold(uint256 threshold) external onlyOwner {
        require(threshold > 0, "threshold_zero");
        require(threshold <= activeValidatorCount, "threshold_exceeds_validators");
        validatorThreshold = threshold;
        emit ValidatorThresholdUpdated(threshold);
    }

    function setTokenMapping(bytes32 solanaMint, address berachainToken) external onlyOwner {
        require(berachainToken != address(0), "token_zero");
        berachainTokenBySolanaMint[solanaMint] = berachainToken;
        emit TokenMappingUpdated(solanaMint, berachainToken);
    }

    function lock(address token, uint256 amount, bytes32 solanaRecipient, uint64 destinationChainId)
        external
        returns (bytes32 transferId)
    {
        require(amount > 0, "amount_zero");
        uint64 nonce = uint64(++nonces[msg.sender]);
        DepositIntent memory intent = DepositIntent({
            depositor: msg.sender,
            token: token,
            amount: amount,
            solanaRecipient: solanaRecipient,
            destinationChainId: destinationChainId,
            nonce: nonce
        });
        transferId = keccak256(
            abi.encodePacked(
                block.chainid,
                intent.depositor,
                intent.token,
                intent.amount,
                intent.solanaRecipient,
                intent.destinationChainId,
                intent.nonce
            )
        );
        require(!lockedTransfers[transferId], "transfer_exists");
        lockedTransfers[transferId] = true;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit DepositLocked(
            transferId,
            intent.depositor,
            intent.token,
            intent.amount,
            intent.solanaRecipient,
            intent.destinationChainId,
            intent.nonce
        );
    }

    function release(ReleaseRequest calldata request, bytes[] calldata signatures) external {
        require(!releasedTransfers[request.transferId], "transfer_processed");
        require(signatures.length >= validatorThreshold, "insufficient_signatures");

        bytes32 digest = getReleaseDigest(request);
        address previousSigner = address(0);
        uint256 validSignatures = 0;

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = recoverSigner(digest, signatures[i]);
            require(validators[signer], "invalid_signer");
            require(signer > previousSigner, "duplicate_or_unsorted_signers");
            previousSigner = signer;
            validSignatures++;
        }

        require(validSignatures >= validatorThreshold, "threshold_not_met");
        releasedTransfers[request.transferId] = true;

        if (request.isNative && request.sourceMint == NATIVE_SOL_MINT_ID) {
            require(address(this).balance >= request.amount, "insufficient_native_balance");
            (bool ok, ) = payable(request.recipient).call{value: request.amount}("");
            require(ok, "native_transfer_failed");
            emit FundsReleased(request.transferId, request.recipient, address(0), request.amount, true);
        } else {
            address token = berachainTokenBySolanaMint[request.sourceMint];
            require(token != address(0), "token_mapping_missing");
            IERC20(token).safeTransfer(request.recipient, request.amount);
            emit FundsReleased(request.transferId, request.recipient, token, request.amount, false);
        }
    }

    function getReleaseDigest(ReleaseRequest calldata request) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                block.chainid,
                address(this),
                keccak256(
                    abi.encode(
                        RELEASE_TYPEHASH,
                        request.recipient,
                        request.sourceMint,
                        request.amount,
                        request.transferId,
                        request.sourceChainId,
                        request.isNative
                    )
                )
            )
        );
    }

    function recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "invalid_signature_length");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "invalid_signature_v");

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "invalid_signature");
        return signer;
    }
}
