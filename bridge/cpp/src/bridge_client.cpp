#include "bridge/bridge_client.hpp"

#include <sstream>

#include <utility>

namespace bridge {

namespace {
std::string quote(const std::string& value) {
    return "\"" + value + "\"";
}
}

BridgeClient::BridgeClient(Config config) : config_(std::move(config)) {}

std::string BridgeClient::describe() const {
    return "berachain=" + config_.berachainBridgeAddress + " solana=" + config_.solanaBridgeProgramId;
}

std::string BridgeClient::buildLockPayload(const LockRequest& request) const {
    std::ostringstream stream;
    stream << "{";
    stream << quote("token") << ":" << quote(request.token) << ",";
    stream << quote("amount") << ":" << quote(request.amount) << ",";
    stream << quote("solanaRecipient") << ":" << quote(request.solanaRecipient) << ",";
    stream << quote("destinationChainId") << ":" << request.destinationChainId;
    stream << "}";
    return stream.str();
}

std::string BridgeClient::buildMintPayload(const MintRequest& request) const {
    std::ostringstream stream;
    stream << "{";
    stream << quote("transferId") << ":" << quote(request.transferId) << ",";
    stream << quote("recipient") << ":" << quote(request.recipient) << ",";
    stream << quote("wrappedMint") << ":" << quote(request.wrappedMint) << ",";
    stream << quote("amount") << ":" << request.amount << ",";
    stream << quote("sourceChain") << ":" << request.sourceChain;
    stream << "}";
    return stream.str();
}

std::string BridgeClient::buildBurnPayload(const BurnRequest& request) const {
    std::ostringstream stream;
    stream << "{";
    stream << quote("owner") << ":" << quote(request.owner) << ",";
    stream << quote("wrappedMint") << ":" << quote(request.wrappedMint) << ",";
    stream << quote("amount") << ":" << request.amount << ",";
    stream << quote("destinationChain") << ":" << request.destinationChain << ",";
    stream << quote("destinationRecipient") << ":" << quote(request.destinationRecipient);
    stream << "}";
    return stream.str();
}

std::string BridgeClient::buildReleasePayload(const ReleaseRequest& request) const {
    std::ostringstream stream;
    stream << "{";
    stream << quote("recipient") << ":" << quote(request.recipient) << ",";
    stream << quote("token") << ":" << quote(request.token) << ",";
    stream << quote("amount") << ":" << quote(request.amount) << ",";
    stream << quote("transferId") << ":" << quote(request.transferId);
    stream << "}";
    return stream.str();
}

} // namespace bridge
