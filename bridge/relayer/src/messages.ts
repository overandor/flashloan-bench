import { z } from 'zod';

export const lockEventSchema = z.object({
  transferId: z.string(),
  depositor: z.string(),
  token: z.string(),
  amount: z.string(),
  solanaRecipient: z.string(),
  destinationChainId: z.number().int().nonnegative(),
  nonce: z.number().int().nonnegative()
});

export const burnEventSchema = z.object({
  releaseId: z.string(),
  burnRecord: z.string(),
  owner: z.string(),
  mint: z.string(),
  amount: z.string(),
  destinationChain: z.number().int().nonnegative(),
  destinationRecipient: z.string()
});

export const berachainReleaseRequestSchema = z.object({
  recipient: z.string(),
  sourceMint: z.string(),
  amount: z.string(),
  transferId: z.string(),
  sourceChainId: z.number().int().nonnegative()
});

export type LockEvent = z.infer<typeof lockEventSchema>;
export type BurnEvent = z.infer<typeof burnEventSchema>;
export type BerachainReleaseRequest = z.infer<typeof berachainReleaseRequestSchema>;
