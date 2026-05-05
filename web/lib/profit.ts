import { z } from 'zod';

export const profitRequestSchema = z.object({
  principalUsd: z.number().positive(),
  edgeBps: z.number(),
  flashLoanFeeBps: z.number().min(0),
  slippageBps: z.number().min(0),
  gasUnits: z.number().int().nonnegative(),
  gasPriceGwei: z.number().nonnegative(),
  ethUsd: z.number().positive(),
  successProb: z.number().min(0).max(1).optional()
});

export type ProfitRequest = z.infer<typeof profitRequestSchema>;

export function calculateProfit(input: ProfitRequest) {
  const grossUsd = input.principalUsd * (input.edgeBps / 10000);
  const borrowFeeUsd = input.principalUsd * (input.flashLoanFeeBps / 10000);
  const slippageCostUsd = input.principalUsd * (input.slippageBps / 10000);
  const gasCostUsd = input.gasUnits * input.gasPriceGwei * 1e-9 * input.ethUsd;
  const netProfitUsd = grossUsd - borrowFeeUsd - slippageCostUsd - gasCostUsd;
  const expectedValueUsd = input.successProb === undefined ? null : netProfitUsd * input.successProb;

  return {
    inputs: input,
    breakdown: {
      grossUsd,
      borrowFeeUsd,
      slippageCostUsd,
      gasCostUsd
    },
    outputs: {
      netProfitUsd,
      expectedValueUsd,
      profitable: netProfitUsd > 0
    }
  };
}
