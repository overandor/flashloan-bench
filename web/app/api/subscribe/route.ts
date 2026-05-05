import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { createSubscriptionReward, subscriptionRequestSchema } from '@/lib/subscriptions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = subscriptionRequestSchema.parse(body);
    const result = await createSubscriptionReward(input);

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid subscription payload',
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create subscription reward'
      },
      { status: 500 }
    );
  }
}
