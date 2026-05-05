#pragma once

#include <cstdint>
#include <string>

namespace bridge {

enum class TransferStatus {
    Locked,
    Minted,
    Burned,
    Released,
};

struct BridgeTransfer {
    std::string transferId;
    std::string sourceChain;
    std::string destinationChain;
    std::string sourceToken;
    std::string destinationToken;
    std::string sender;
    std::string recipient;
    std::string amount;
    std::uint64_t nonce;
    TransferStatus status;
};

struct LockRequest {
    std::string token;
    std::string amount;
    std::string solanaRecipient;
    std::uint64_t destinationChainId;
};

struct MintRequest {
    std::string transferId;
    std::string recipient;
    std::string wrappedMint;
    std::uint64_t amount;
    std::uint64_t sourceChain;
};

struct BurnRequest {
    std::string owner;
    std::string wrappedMint;
    std::uint64_t amount;
    std::uint64_t destinationChain;
    std::string destinationRecipient;
};

struct ReleaseRequest {
    std::string recipient;
    std::string token;
    std::string amount;
    std::string transferId;
};

struct Config {
    std::string berachainRpcUrl;
    std::string berachainBridgeAddress;
    std::string solanaRpcUrl;
    std::string solanaBridgeProgramId;
};

class BridgeClient {
  public:
    explicit BridgeClient(Config config);

    std::string describe() const;
    std::string buildLockPayload(const LockRequest& request) const;
    std::string buildMintPayload(const MintRequest& request) const;
    std::string buildBurnPayload(const BurnRequest& request) const;
    std::string buildReleasePayload(const ReleaseRequest& request) const;

  private:
    Config config_;
};

} // namespace bridge
