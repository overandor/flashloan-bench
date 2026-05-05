import { Interface, JsonRpcProvider, Wallet, type Log } from 'ethers';

import { loadConfig } from './config.js';
import { berachainReleaseRequestSchema, burnEventSchema, lockEventSchema } from './messages.js';

const lockerAbi = [
  'event DepositLocked(bytes32 indexed transferId, address indexed depositor, address indexed token, uint256 amount, bytes32 solanaRecipient, uint64 destinationChainId, uint64 nonce)',
  'function getReleaseDigest((address recipient,bytes32 sourceMint,uint256 amount,bytes32 transferId,uint64 sourceChainId) request) view returns (bytes32)',
  'function release((address recipient,bytes32 sourceMint,uint256 amount,bytes32 transferId,uint64 sourceChainId) request, bytes[] signatures) external'
];

function buildBerachainReleaseRequest(input: {
  releaseId: string;
  destinationRecipient: string;
  mint: string;
  amount: string;
  sourceChainId: number;
}) {
  return berachainReleaseRequestSchema.parse({
    recipient: input.destinationRecipient,
    sourceMint: input.mint,
    amount: input.amount,
    transferId: input.releaseId,
    sourceChainId: input.sourceChainId
  });
}

async function signReleaseRequest(
  wallet: Wallet,
  bridgeAddress: string,
  provider: JsonRpcProvider,
  request: ReturnType<typeof buildBerachainReleaseRequest>
) {
  const bridge = new Interface(lockerAbi);
  const contract = new Wallet(wallet.privateKey, provider);
  const callData = bridge.encodeFunctionData('getReleaseDigest', [request]);
  const result = await provider.call({ to: bridgeAddress, data: callData });
  const [digest] = bridge.decodeFunctionResult('getReleaseDigest', result);
  return contract.signingKey.sign(digest).serialized;
}

async function main() {
  const config = loadConfig();
  const provider = new JsonRpcProvider(config.BERACHAIN_RPC_URL);
  const wallet = new Wallet(config.RELAYER_PRIVATE_KEY, provider);
  const iface = new Interface(lockerAbi);

  console.log(
    JSON.stringify(
      {
        status: 'relayer_ready',
        berachainBridgeAddress: config.BERACHAIN_BRIDGE_ADDRESS,
        solanaBridgeProgramId: config.SOLANA_BRIDGE_PROGRAM_ID,
        relayerAddress: wallet.address
      },
      null,
      2
    )
  );

  provider.on(
    {
      address: config.BERACHAIN_BRIDGE_ADDRESS,
      topics: [iface.getEvent('DepositLocked').topicHash]
    },
    async (log: Log) => {
      const parsed = iface.parseLog(log);
      if (!parsed) {
        return;
      }

      const event = lockEventSchema.parse({
        transferId: parsed.args.transferId,
        depositor: parsed.args.depositor,
        token: parsed.args.token,
        amount: parsed.args.amount.toString(),
        solanaRecipient: parsed.args.solanaRecipient,
        destinationChainId: Number(parsed.args.destinationChainId),
        nonce: Number(parsed.args.nonce)
      });

      console.log(JSON.stringify({ action: 'observed_lock', event }, null, 2));
      console.log(
        JSON.stringify(
          {
            action: 'next_step_required',
            transferId: event.transferId,
            target: 'solana_mint',
            note: 'Submit the corresponding mint_wrapped instruction with validator authority.'
          },
          null,
          2
        )
      );
    }
  );

  const exampleBurn = burnEventSchema.parse({
    releaseId: '0x' + '11'.repeat(32),
    burnRecord: 'BurnRecord1111111111111111111111111111111111',
    owner: 'Owner111111111111111111111111111111111111111',
    mint: '0x' + '22'.repeat(32),
    amount: '1000000',
    destinationChain: 80094,
    destinationRecipient: wallet.address
  });

  const releaseRequest = buildBerachainReleaseRequest({
    releaseId: exampleBurn.releaseId,
    destinationRecipient: exampleBurn.destinationRecipient,
    mint: exampleBurn.mint,
    amount: exampleBurn.amount,
    sourceChainId: 1399811149
  });

  const releaseSignature = await signReleaseRequest(
    wallet,
    config.BERACHAIN_BRIDGE_ADDRESS,
    provider,
    releaseRequest
  );

  console.log(
    JSON.stringify(
      {
        action: 'example_solana_burn_to_bera_release',
        burn: exampleBurn,
        releaseRequest,
        releaseSignature,
        note: 'Collect threshold validator signatures, then call release(request, signatures) on Berachain.'
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
