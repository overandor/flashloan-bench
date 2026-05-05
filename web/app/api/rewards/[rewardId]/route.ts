import { NextResponse } from 'next/server';

import { getReward } from '@/lib/subscriptions';

type RewardRouteContext = {
  params: {
    rewardId: string;
  };
};

export async function GET(_: Request, context: RewardRouteContext) {
  const reward = await getReward(context.params.rewardId);

  if (!reward) {
    return NextResponse.json(
      {
        error: 'Reward not found'
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ reward }, { status: 200 });
}
