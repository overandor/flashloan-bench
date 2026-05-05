import { Connection, PublicKey } from '@solana/web3.js';
import { Interface, JsonRpcProvider, Wallet, type Log, Contract } from 'ethers';

import { loadConfig } from './config.js';
import { berachainReleaseRequestSchema, burnEventSchema, lockEventSchema } from './messages.js';

const lockerAbi = [
  'event DepositLocked(bytes32 indexed transferId, address indexed depositor, address indexed token, uint256 amount, bytes32 solanaRecipient, uint64 destinationChainId, uint64 nonce)',
  'function getReleaseDigest((address recipient,bytes32 sourceMint,uint256 amount,bytes32 transferId,uint64 sourceChainId) request) view returns (bytes32)',
  'function release((address recipient,bytes32 sourceMint,uint256 amount,bytes32 transferId,uint64 sourceChainId) request, bytes[] signatures) external'
];

const SOLANA_WRAPPED_BURNED_EVENT = 'WrappedBurned';

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
  const beraProvider = new JsonRpcProvider(config.BERACHAIN_RPC_URL);
  const wallet = new Wallet(config.RELAYER_PRIVATE_KEY, beraProvider);
  const solanaConnection = new Connection(config.SOLANA_RPC_URL, 'confirmed');
  const programId = new PublicKey(config.SOLANA_BRIDGE_PROGRAM_ID);
  const lockerIface = new Interface(lockerAbi);
  const lockerContract = new Contract(config.BERACHAIN_BRIDGE_ADDRESS, lockerAbi, wallet);

  const validatorAddresses = config.VALIDATOR_ADDRESSES.split(',').map((a: string) => a.trim());
  const validatorThreshold = config.VALIDATOR_THRESHOLD;

  console.log(
    JSON.stringify(
      {
        status: 'relayer_ready',
        berachainBridgeAddress: config.BERACHAIN_BRIDGE_ADDRESS,
        solanaBridgeProgramId: config.SOLANA_BRIDGE_PROGRAM_ID,
        relayerAddress: wallet.address,
        validatorCount: validatorAddresses.length,
        validatorThreshold
      },
      null,
      2
    )
  );

  beraProvider.on(
    {
      address: config.BERACHAIN_BRIDGE_ADDRESS,
      topics: [lockerIface.getEvent('DepositLocked').topicHash]
    },
    async (log: Log) => {
      const parsed = lockerIface.parseLog(log);
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

  solanaConnection.onLogs(programId, async (logInfo: { signature: string; logs?: string[] }) => {
    const logs = logInfo.logs || [];
    for (const log of logs) {
      if (log.includes(SOLANA_WRAPPED_BURNED_EVENT)) {
        console.log(JSON.stringify({ action: 'observed_solana_burn', signature: logInfo.signature, logs }, null, 2));

        const burnEvent = burnEventSchema.parse({
          releaseId: '0x' + Buffer.from(logInfo.signature).toString('hex').padEnd(64, '0').slice(0, 66),
          burnRecord: logInfo.signature,
          owner: logInfo.signature,
          mint: '0x' + '00'.repeat(32),
          amount: '0',
          destinationChain: 80094,
          destinationRecipient: wallet.address
        });

        const releaseRequest = buildBerachainReleaseRequest({
          releaseId: burnEvent.releaseId,
          destinationRecipient: burnEvent.destinationRecipient,
          mint: burnEvent.mint,
          amount: burnEvent.amount,
          sourceChainId: 1399811149
        });

        const signatures: string[] = [];
        for (const validatorAddr of validatorAddresses) {
          const validatorWallet = new Wallet(config.RELAYER_PRIVATE_KEY, beraProvider);
          const sig = await signReleaseRequest(
            validatorWallet,
            config.BERACHAIN_BRIDGE_ADDRESS,
            beraProvider,
            releaseRequest
          );
          signatures.push(sig);
        }

        if (signatures.length >= validatorThreshold) {
          try {
            const tx = await lockerContract.release(releaseRequest, signatures);
            console.log(JSON.stringify({ action: 'berachain_release_submitted', txHash: tx.hash }, null, 2));
            const receipt = await tx.wait();
            console.log(JSON.stringify({ action: 'berachain_release_confirmed', receipt }, null, 2));
          } catch (error) {
            console.error(JSON.stringify({ action: 'berachain_release_failed', error }, null, 2));
          }
        } else {
          console.log(
            JSON.stringify(
              {
                action: 'insufficient_signatures',
                collected: signatures.length,
                required: validatorThreshold
              },
              null,
              2
            )
          );
        }
      }
    }
  });

  console.log(JSON.stringify({ action: 'listening', chains: ['berachain', 'solana'] }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
