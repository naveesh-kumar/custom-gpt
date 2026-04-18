import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '../../../lib/chat';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Generate response using Nemotron model
    const { finalResponse, relevantDocssources } = await generateResponse(message);

    return NextResponse.json({
      response: finalResponse,
      sources: relevantDocssources,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}