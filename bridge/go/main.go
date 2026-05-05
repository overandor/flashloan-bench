package main

import (
	"context"
	"fmt"

	bridge "github.com/alep/flashloan-bench/bridge/go/bridge"
)

func main() {
	client := bridge.NewClient(bridge.Config{
		BerachainRPCURL:     "http://localhost:8545",
		BerachainBridgeAddr: "0xBridgeLocker",
		SolanaRPCURL:        "http://localhost:8899",
		SolanaBridgeProgram: "Br1dgE1111111111111111111111111111111111111",
	})

	payload, err := client.BuildLockPayload(context.Background(), bridge.LockRequest{
		Token:              "0xToken",
		Amount:             "1000000",
		SolanaRecipient:    "So1anaRecipient1111111111111111111111111111111",
		DestinationChainID: 1,
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(client.Describe())
	fmt.Println(string(payload))
}
