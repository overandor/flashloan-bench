import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NativeBridge } from "../target/types/native_bridge";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("native_bridge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NativeBridge as Program<NativeBridge>;
  const authority = provider.wallet as anchor.Wallet;

  let statePda: PublicKey;
  let validator1: Keypair;
  let validator2: Keypair;
  let validator3: Keypair;

  before(async () => {
    [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    validator1 = Keypair.generate();
    validator2 = Keypair.generate();
    validator3 = Keypair.generate();

    // Airdrop to validators
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(validator1.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(validator2.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(validator3.publicKey, 2 * LAMPORTS_PER_SOL)
    );
  });

  describe("initialize", () => {
    it("Should initialize bridge state", async () => {
      const validators = [validator1.publicKey, validator2.publicKey, validator3.publicKey];
      const threshold = new anchor.BN(2);

      await program.methods
        .initialize(validators, threshold)
        .accounts({
          authority: authority.publicKey,
          state: statePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const state = await program.account.bridgeState.fetch(statePda);
      assert.equal(state.authority.toString(), authority.publicKey.toString());
      assert.equal(state.validator_threshold.toNumber(), 2);
      assert.equal(state.validators.length, 3);
    });

    it("Should reject invalid threshold", async () => {
      const validators = [validator1.publicKey, validator2.publicKey];
      const threshold = new anchor.BN(3); // Higher than validator count

      try {
        await program.methods
          .initialize(validators, threshold)
          .accounts({
            authority: authority.publicKey,
            state: statePda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "InvalidThreshold");
      }
    });
  });

  describe("set_validators", () => {
    it("Should allow authority to update validators", async () => {
      const newValidators = [validator1.publicKey, validator2.publicKey];
      const newThreshold = new anchor.BN(1);

      await program.methods
        .set_validators(newValidators, newThreshold)
        .accounts({
          authority: authority.publicKey,
          state: statePda,
        })
        .rpc();

      const state = await program.account.bridgeState.fetch(statePda);
      assert.equal(state.validators.length, 2);
      assert.equal(state.validator_threshold.toNumber(), 1);
    });

    it("Should reject non-authority validator updates", async () => {
      const newValidators = [validator1.publicKey];
      const newThreshold = new anchor.BN(1);

      try {
        await program.methods
          .set_validators(newValidators, newThreshold)
          .accounts({
            authority: validator1.publicKey,
            state: statePda,
          })
          .signers([validator1])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "Unauthorized");
      }
    });

    it("Should reject threshold exceeding validator count", async () => {
      const newValidators = [validator1.publicKey];
      const newThreshold = new anchor.BN(2); // Higher than validator count

      try {
        await program.methods
          .set_validators(newValidators, newThreshold)
          .accounts({
            authority: authority.publicKey,
            state: statePda,
          })
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "InvalidThreshold");
      }
    });
  });

  describe("burn_native", () => {
    let burnRecordPda: PublicKey;
    const releaseId = Buffer.from(Array(32).fill(1));
    const destinationRecipient = Buffer.from(Array(32).fill(2));
    const amount = new anchor.BN(1_000_000);
    const destinationChain = new anchor.BN(80094);

    before(async () => {
      [burnRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("burn-record"), releaseId],
        program.programId
      );
    });

    it("Should burn native SOL", async () => {
      const initialBalance = await provider.connection.getBalance(statePda);

      await program.methods
        .burn_native(
          Array.from(releaseId),
          Array.from(destinationRecipient),
          amount,
          destinationChain
        )
        .accounts({
          owner: authority.publicKey,
          burnRecord: burnRecordPda,
          state: statePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const finalBalance = await provider.connection.getBalance(statePda);
      assert.equal(finalBalance - initialBalance, amount.toNumber());
    });

    it("Should emit WrappedBurned event with is_native: true", async () => {
      const listener = program.addEventListener("WrappedBurned", (event) => {
        assert.equal(event.is_native, true);
      });

      await program.methods
        .burn_native(
          Array.from(Buffer.from(Array(32).fill(3))),
          Array.from(destinationRecipient),
          amount,
          destinationChain
        )
        .accounts({
          owner: authority.publicKey,
          burnRecord: PublicKey.findProgramAddressSync(
            [Buffer.from("burn-record"), Buffer.from(Array(32).fill(3))],
            program.programId
          )[0],
          state: statePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.removeEventListener(listener);
    });

    it("Should prevent duplicate release IDs", async () => {
      try {
        await program.methods
          .burn_native(
            Array.from(releaseId),
            Array.from(destinationRecipient),
            amount,
            destinationChain
          )
          .accounts({
            owner: authority.publicKey,
            burnRecord: burnRecordPda,
            state: statePda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        // Account already exists error
        assert.include(err.toString(), "already in use");
      }
    });
  });
});
