import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { NativeBridge } from '../target/types/native_bridge';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NativeBridge as Program<NativeBridge>;
  const authority = provider.wallet as anchor.Wallet;

  const validators = process.env.VALIDATORS?.split(',').map((v) => new PublicKey(v.trim())) || [];
  const validatorThreshold = parseInt(process.env.VALIDATOR_THRESHOLD || '1');

  if (validators.length === 0) {
    throw new Error('VALIDATORS env var required (comma-separated Pubkeys)');
  }
  if (validatorThreshold < 1 || validatorThreshold > validators.length) {
    throw new Error('VALIDATOR_THRESHOLD must be between 1 and number of validators');
  }

  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    program.programId
  );

  console.log('Deploying Solana Native Bridge...');
  console.log('Authority:', authority.publicKey.toString());
  console.log('Validators:', validators.map((v) => v.toString()));
  console.log('Validator threshold:', validatorThreshold);
  console.log('State PDA:', statePda.toString());

  try {
    const tx = await program.methods
      .initialize(validators, new anchor.BN(validatorThreshold))
      .accounts({
        authority: authority.publicKey,
        state: statePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('Deployment transaction:', tx);

    const state = await program.account.bridgeState.fetch(statePda);
    console.log('State authority:', state.authority.toString());
    console.log('State validator threshold:', state.validator_threshold.toString());
    console.log('State validators:', state.validators.map((v: PublicKey) => v.toString()));
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
