import { NextRequest, NextResponse } from 'next/server';
import { retrieveRelevantDocuments } from '../../../lib/database';
import { generateResponse } from '../../../lib/chat';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Retrieve relevant documents
    const relevantDocs = await retrieveRelevantDocuments(message);
    const context = relevantDocs.map(doc => doc.text);

    // Generate response using Nemotron model
    const response = await generateResponse(message, context);

    return NextResponse.json({
      response,
      sources: relevantDocs.map(doc => ({
        source: doc.source,
        similarity: doc.similarity,
      })),
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}