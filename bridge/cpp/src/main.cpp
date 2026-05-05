#include "bridge/bridge_client.hpp"

#include <iostream>

int main() {
    bridge::BridgeClient client({
        "http://localhost:8545",
        "0xBridgeLocker",
        "http://localhost:8899",
        "Br1dgE1111111111111111111111111111111111111",
    });

    bridge::LockRequest request{
        "0xToken",
        "1000000",
        "So1anaRecipient1111111111111111111111111111111",
        1,
    };

    std::cout << client.describe() << std::endl;
    std::cout << client.buildLockPayload(request) << std::endl;
    return 0;
}
