import { z } from 'zod';

export const bridgeTransferSchema = z.object({
  transferId: z.string().min(1),
  sourceChain: z.string().min(1),
  destinationChain: z.string().min(1),
  sourceToken: z.string().min(1),
  destinationToken: z.string().min(1),
  sourceMint: z.string().min(1).optional(),
  sender: z.string().min(1),
  recipient: z.string().min(1),
  amount: z.string().min(1),
  nonce: z.number().int().nonnegative(),
  releaseId: z.string().min(1).optional(),
  status: z.enum(["locked", "minted", "burned", "released"])
});

export type BridgeTransfer = z.infer<typeof bridgeTransferSchema>;
