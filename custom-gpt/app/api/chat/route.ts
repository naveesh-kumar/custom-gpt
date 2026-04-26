import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '../../../lib/chat';

export async function POST(request: NextRequest) {
  try {
    const { message, source } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Generate response using Nemotron model
    const { finalResponse, relevantDocssources } = await generateResponse(
      message,
      typeof source === 'string' && source.trim() ? source.trim() : undefined
    );

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