package bridge

type TransferStatus string

const (
	StatusLocked   TransferStatus = "locked"
	StatusMinted   TransferStatus = "minted"
	StatusBurned   TransferStatus = "burned"
	StatusReleased TransferStatus = "released"
)

type BridgeTransfer struct {
	TransferID       string         `json:"transferId"`
	SourceChain      string         `json:"sourceChain"`
	DestinationChain string         `json:"destinationChain"`
	SourceToken      string         `json:"sourceToken"`
	DestinationToken string         `json:"destinationToken"`
	Sender           string         `json:"sender"`
	Recipient        string         `json:"recipient"`
	Amount           string         `json:"amount"`
	Nonce            uint64         `json:"nonce"`
	Status           TransferStatus `json:"status"`
}

type LockRequest struct {
	Token              string `json:"token"`
	Amount             string `json:"amount"`
	SolanaRecipient    string `json:"solanaRecipient"`
	DestinationChainID uint64 `json:"destinationChainId"`
}

type MintRequest struct {
	TransferID   string `json:"transferId"`
	Recipient    string `json:"recipient"`
	WrappedMint  string `json:"wrappedMint"`
	Amount       uint64 `json:"amount"`
	SourceChain  uint64 `json:"sourceChain"`
}

type BurnRequest struct {
	Owner                string `json:"owner"`
	WrappedMint          string `json:"wrappedMint"`
	Amount               uint64 `json:"amount"`
	DestinationChain     uint64 `json:"destinationChain"`
	DestinationRecipient string `json:"destinationRecipient"`
}

type ReleaseRequest struct {
	Recipient  string `json:"recipient"`
	Token      string `json:"token"`
	Amount     string `json:"amount"`
	TransferID string `json:"transferId"`
}
