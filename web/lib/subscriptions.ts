import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { z } from 'zod';

export const subscriptionRequestSchema = z.object({
  email: z.string().email(),
  plan: z.enum(['starter', 'growth', 'pro']).default('starter')
});

export type SubscriptionRequest = z.infer<typeof subscriptionRequestSchema>;

export type RewardRecord = {
  rewardId: string;
  customerEmail: string;
  plan: SubscriptionRequest['plan'];
  rewardType: 'api_credits' | 'priority_access' | 'strategy_pack';
  rewardValue: string;
  message: string;
  createdAt: string;
};

const rewardsFilePath = join(process.cwd(), '.data', 'rewards.json');

const rewardByPlan: Record<SubscriptionRequest['plan'], Omit<RewardRecord, 'rewardId' | 'customerEmail' | 'plan' | 'createdAt'>> = {
  starter: {
    rewardType: 'api_credits',
    rewardValue: '500 bonus profit calculations',
    message: 'Starter subscribers receive 500 bonus API profit calculations on activation.'
  },
  growth: {
    rewardType: 'priority_access',
    rewardValue: 'Priority execution queue for 30 days',
    message: 'Growth subscribers receive 30 days of priority execution access.'
  },
  pro: {
    rewardType: 'strategy_pack',
    rewardValue: 'Premium strategy template pack + 2,000 API credits',
    message: 'Pro subscribers receive premium strategy templates plus 2,000 bonus API credits.'
  }
};

async function readRewards(): Promise<Record<string, RewardRecord>> {
  try {
    const content = await readFile(rewardsFilePath, 'utf8');
    return JSON.parse(content) as Record<string, RewardRecord>;
  } catch {
    return {};
  }
}

async function writeRewards(rewards: Record<string, RewardRecord>) {
  await mkdir(dirname(rewardsFilePath), { recursive: true });
  await writeFile(rewardsFilePath, JSON.stringify(rewards, null, 2), 'utf8');
}

export async function createSubscriptionReward(input: SubscriptionRequest) {
  const rewardTemplate = rewardByPlan[input.plan];
  const rewardId = randomUUID();
  const reward: RewardRecord = {
    rewardId,
    customerEmail: input.email,
    plan: input.plan,
    rewardType: rewardTemplate.rewardType,
    rewardValue: rewardTemplate.rewardValue,
    message: rewardTemplate.message,
    createdAt: new Date().toISOString()
  };

  const rewards = await readRewards();
  rewards[rewardId] = reward;
  await writeRewards(rewards);

  return {
    subscription: {
      email: input.email,
      plan: input.plan,
      status: 'active'
    },
    reward
  };
}

export async function getReward(rewardId: string) {
  const rewards = await readRewards();
  return rewards[rewardId] ?? null;
}
