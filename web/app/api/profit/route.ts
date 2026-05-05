import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { calculateProfit, profitRequestSchema } from '@/lib/profit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = profitRequestSchema.parse(body);
    const result = calculateProfit(input);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to calculate profit'
      },
      { status: 500 }
    );
  }
}
