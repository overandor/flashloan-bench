import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { NativeBridgeLocker } from '../typechain-types';

describe('NativeBridgeLocker', function () {
  let bridge: NativeBridgeLocker;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let validator1: SignerWithAddress;
  let validator2: SignerWithAddress;
  let validator3: SignerWithAddress;
  let mockToken: any;

  const NATIVE_SOL_MINT_ID = ethers.keccak256(ethers.toUtf8Bytes('NATIVE_SOL'));

  beforeEach(async function () {
    [owner, user, validator1, validator2, validator3] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory('MockERC20');
    mockToken = await MockToken.deploy('Mock Token', 'MTK', ethers.parseEther('1000000'));
    await mockToken.waitForDeployment();

    // Deploy bridge
    const Bridge = await ethers.getContractFactory('NativeBridgeLocker');
    bridge = await Bridge.deploy(
      [validator1.address, validator2.address, validator3.address],
      2 // threshold
    );
    await bridge.waitForDeployment();

    // Set token mapping
    await bridge.setTokenMapping(ethers.ZeroHash, await mockToken.getAddress());
  });

  describe('Deployment', function () {
    it('Should set correct owner', async function () {
      expect(await bridge.owner()).to.equal(owner.address);
    });

    it('Should set validators', async function () {
      expect(await bridge.validators(validator1.address)).to.be.true;
      expect(await bridge.validators(validator2.address)).to.be.true;
      expect(await bridge.validators(validator3.address)).to.be.true;
    });

    it('Should set correct threshold', async function () {
      expect(await bridge.validatorThreshold()).to.equal(2);
    });

    it('Should set correct active validator count', async function () {
      expect(await bridge.activeValidatorCount()).to.equal(3);
    });

    it('Should reject invalid threshold', async function () {
      const Bridge = await ethers.getContractFactory('NativeBridgeLocker');
      await expect(
        Bridge.deploy([validator1.address, validator2.address], 3)
      ).to.be.revertedWith('invalid_threshold');
    });
  });

  describe('Validator Management', function () {
    it('Should allow owner to add validator', async function () {
      await bridge.setValidator(user.address, true);
      expect(await bridge.validators(user.address)).to.be.true;
      expect(await bridge.activeValidatorCount()).to.equal(4);
    });

    it('Should allow owner to remove validator', async function () {
      await bridge.setValidator(validator1.address, false);
      expect(await bridge.validators(validator1.address)).to.be.false;
      expect(await bridge.activeValidatorCount()).to.equal(2);
    });

    it('Should reject non-owner validator changes', async function () {
      await expect(
        bridge.connect(user).setValidator(user.address, true)
      ).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });

    it('Should prevent threshold exceeding active validators', async function () {
      await bridge.setValidator(validator1.address, false);
      await expect(
        bridge.setValidatorThreshold(3)
      ).to.be.revertedWith('threshold_exceeds_validators');
    });

    it('Should reject setting threshold higher than active validators', async function () {
      await bridge.setValidator(validator1.address, false);
      await expect(
        bridge.setValidatorThreshold(3)
      ).to.be.revertedWith('threshold_exceeds_validators');
    });
  });

  describe('Token Locking', function () {
    it('Should lock tokens successfully', async function () {
      const amount = ethers.parseEther('100');
      await mockToken.connect(user).approve(await bridge.getAddress(), amount);
      
      const tx = await bridge.connect(user).lock(
        await mockToken.getAddress(),
        amount,
        ethers.hexlify(ethers.randomBytes(32)),
        1 // destination chain
      );
      
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => log.fragment?.name === 'DepositLocked');
      expect(event).to.not.be.undefined;
    });

    it('Should prevent replay attacks', async function () {
      const amount = ethers.parseEther('100');
      await mockToken.connect(user).approve(await bridge.getAddress(), amount);
      
      const solanaRecipient = ethers.hexlify(ethers.randomBytes(32));
      
      await bridge.connect(user).lock(
        await mockToken.getAddress(),
        amount,
        solanaRecipient,
        1
      );

      await expect(
        bridge.connect(user).lock(
          await mockToken.getAddress(),
          amount,
          solanaRecipient,
          1
        )
      ).to.be.revertedWith('transfer_exists');
    });

    it('Should require approval', async function () {
      const amount = ethers.parseEther('100');
      await expect(
        bridge.connect(user).lock(
          await mockToken.getAddress(),
          amount,
          ethers.hexlify(ethers.randomBytes(32)),
          1
        )
      ).to.be.reverted;
    });
  });

  describe('Native Release', function () {
    beforeEach(async function () {
      // Fund bridge with native BERA
      await owner.sendTransaction({
        to: await bridge.getAddress(),
        value: ethers.parseEther('10')
      });
    });

    it('Should release native tokens with valid signatures', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('1');
      const transferId = ethers.hexlify(ethers.randomBytes(32));

      const request = {
        recipient,
        sourceMint: NATIVE_SOL_MINT_ID,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: true
      };

      const digest = await bridge.getReleaseDigest(request);
      
      // Sign with 2 validators (threshold)
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));
      const sig2 = await validator2.signMessage(ethers.getBytes(digest));

      const tx = await bridge.release(request, [sig1, sig2]);
      await expect(tx).to.changeEtherBalance(recipient, amount);
    });

    it('Should use safe call pattern for native transfer', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('1');
      const transferId = ethers.hexlify(ethers.randomBytes(32));

      const request = {
        recipient,
        sourceMint: NATIVE_SOL_MINT_ID,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: true
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));
      const sig2 = await validator2.signMessage(ethers.getBytes(digest));

      await bridge.release(request, [sig1, sig2]);
      
      // Check that the event was emitted with isNative: true
      const releaseFilter = bridge.filters.FundsReleased(undefined, undefined, undefined, undefined, true);
      const events = await bridge.queryFilter(releaseFilter);
      expect(events.length).to.be.greaterThan(0);
    });

    it('Should prevent replay of native release', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('1');
      const transferId = ethers.hexlify(ethers.randomBytes(32));

      const request = {
        recipient,
        sourceMint: NATIVE_SOL_MINT_ID,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: true
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));
      const sig2 = await validator2.signMessage(ethers.getBytes(digest));

      await bridge.release(request, [sig1, sig2]);

      await expect(
        bridge.release(request, [sig1, sig2])
      ).to.be.revertedWith('transfer_processed');
    });

    it('Should require sufficient native balance', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('100'); // More than funded
      const transferId = ethers.hexlify(ethers.randomBytes(32));

      const request = {
        recipient,
        sourceMint: NATIVE_SOL_MINT_ID,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: true
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));
      const sig2 = await validator2.signMessage(ethers.getBytes(digest));

      await expect(
        bridge.release(request, [sig1, sig2])
      ).to.be.revertedWith('insufficient_native_balance');
    });
  });

  describe('ERC-20 Release', function () {
    beforeEach(async function () {
      // Fund bridge with tokens
      await mockToken.transfer(await bridge.getAddress(), ethers.parseEther('1000'));
    });

    it('Should release ERC-20 tokens with valid signatures', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('100');
      const transferId = ethers.hexlify(ethers.randomBytes(32));
      const sourceMint = ethers.ZeroHash;

      const request = {
        recipient,
        sourceMint,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: false
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));
      const sig2 = await validator2.signMessage(ethers.getBytes(digest));

      await bridge.release(request, [sig1, sig2]);
      
      expect(await mockToken.balanceOf(recipient)).to.equal(amount);
    });

    it('Should prevent replay of ERC-20 release', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('100');
      const transferId = ethers.hexlify(ethers.randomBytes(32));
      const sourceMint = ethers.ZeroHash;

      const request = {
        recipient,
        sourceMint,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: false
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));
      const sig2 = await validator2.signMessage(ethers.getBytes(digest));

      await bridge.release(request, [sig1, sig2]);

      await expect(
        bridge.release(request, [sig1, sig2])
      ).to.be.revertedWith('transfer_processed');
    });

    it('Should reject release without token mapping', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('100');
      const transferId = ethers.hexlify(ethers.randomBytes(32));
      const sourceMint = ethers.hexlify(ethers.randomBytes(32)); // Unmapped

      const request = {
        recipient,
        sourceMint,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: false
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));
      const sig2 = await validator2.signMessage(ethers.getBytes(digest));

      await expect(
        bridge.release(request, [sig1, sig2])
      ).to.be.revertedWith('token_mapping_missing');
    });
  });

  describe('Threshold Signatures', function () {
    it('Should reject insufficient signatures', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('1');
      const transferId = ethers.hexlify(ethers.randomBytes(32));

      const request = {
        recipient,
        sourceMint: NATIVE_SOL_MINT_ID,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: true
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));

      await expect(
        bridge.release(request, [sig1])
      ).to.be.revertedWith('threshold_not_met');
    });

    it('Should reject invalid signer', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('1');
      const transferId = ethers.hexlify(ethers.randomBytes(32));

      const request = {
        recipient,
        sourceMint: NATIVE_SOL_MINT_ID,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: true
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));
      const sig2 = await user.signMessage(ethers.getBytes(digest)); // Not a validator

      await expect(
        bridge.release(request, [sig1, sig2])
      ).to.be.revertedWith('invalid_signer');
    });

    it('Should reject duplicate signatures', async function () {
      const recipient = user.address;
      const amount = ethers.parseEther('1');
      const transferId = ethers.hexlify(ethers.randomBytes(32));

      const request = {
        recipient,
        sourceMint: NATIVE_SOL_MINT_ID,
        amount,
        transferId,
        sourceChainId: 1399811149,
        isNative: true
      };

      const digest = await bridge.getReleaseDigest(request);
      const sig1 = await validator1.signMessage(ethers.getBytes(digest));

      await expect(
        bridge.release(request, [sig1, sig1])
      ).to.be.revertedWith('duplicate_or_unsorted_signers');
    });
  });

  describe('Token Mapping', function () {
    it('Should allow owner to set token mapping', async function () {
      const solanaMint = ethers.hexlify(ethers.randomBytes(32));
      await bridge.setTokenMapping(solanaMint, await mockToken.getAddress());
      expect(await bridge.berachainTokenBySolanaMint(solanaMint)).to.equal(await mockToken.getAddress());
    });

    it('Should reject zero address token', async function () {
      const solanaMint = ethers.hexlify(ethers.randomBytes(32));
      await expect(
        bridge.setTokenMapping(solanaMint, ethers.ZeroAddress)
      ).to.be.revertedWith('token_zero');
    });

    it('Should reject non-owner token mapping', async function () {
      const solanaMint = ethers.hexlify(ethers.randomBytes(32));
      await expect(
        bridge.connect(user).setTokenMapping(solanaMint, await mockToken.getAddress())
      ).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Native Funding', function () {
    it('Should accept native funding via fundNative', async function () {
      const amount = ethers.parseEther('5');
      await expect(
        bridge.fundNative({ value: amount })
      ).to.changeEtherBalance(bridge, amount);
    });

    it('Should accept native funding via receive', async function () {
      const amount = ethers.parseEther('5');
      await expect(
        owner.sendTransaction({ to: await bridge.getAddress(), value: amount })
      ).to.changeEtherBalance(bridge, amount);
    });
  });
});
