package bridge

import (
	"context"
	"encoding/json"
	"fmt"
)

type Config struct {
	BerachainRPCURL      string
	BerachainBridgeAddr  string
	SolanaRPCURL         string
	SolanaBridgeProgram  string
}

type Client struct {
	cfg Config
}

func NewClient(cfg Config) *Client {
	return &Client{cfg: cfg}
}

func (c *Client) BuildLockPayload(_ context.Context, req LockRequest) ([]byte, error) {
	return json.Marshal(req)
}

func (c *Client) BuildMintPayload(_ context.Context, req MintRequest) ([]byte, error) {
	return json.Marshal(req)
}

func (c *Client) BuildBurnPayload(_ context.Context, req BurnRequest) ([]byte, error) {
	return json.Marshal(req)
}

func (c *Client) BuildReleasePayload(_ context.Context, req ReleaseRequest) ([]byte, error) {
	return json.Marshal(req)
}

func (c *Client) Describe() string {
	return fmt.Sprintf("berachain=%s solana=%s", c.cfg.BerachainBridgeAddr, c.cfg.SolanaBridgeProgram)
}
