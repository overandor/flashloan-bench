import { z } from 'zod';

const configSchema = z.object({
  BERACHAIN_RPC_URL: z.string().url(),
  BERACHAIN_BRIDGE_ADDRESS: z.string().min(1),
  RELAYER_PRIVATE_KEY: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_BRIDGE_PROGRAM_ID: z.string().min(1),
  VALIDATOR_ADDRESSES: z.string().min(1),
  VALIDATOR_THRESHOLD: z.string().transform(Number),
  DRY_RUN: z.string().optional().transform((val: string | undefined) => val === 'true')
});

export type RelayerConfig = z.infer<typeof configSchema>;

export function loadConfig(): RelayerConfig {
  return configSchema.parse(process.env);
}
