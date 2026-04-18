import { ingestText } from '@/lib/ingest';
import { NextRequest, NextResponse } from 'next/server';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL. Must be https.' }, { status: 400 });
    }

    // Block private/internal IPs to prevent SSRF
    const hostname = parsedUrl.hostname;
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^0\./,
      /^169\.254\./,
      /^\[::1\]$/,
      /^\[fc/,
      /^\[fd/,
      /^\[fe80:/,
    ];
    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      return NextResponse.json(
        { error: 'URLs pointing to internal/private networks are not allowed.' },
        { status: 400 }
      );
    }

    // Load and extract text content from the webpage using CheerioWebBaseLoader
    const loader = new CheerioWebBaseLoader(url, {
      selector: 'body',
    });

    const docs = await loader.load();

    // Strip remaining scripts/styles from cheerio output
    const text = docs
      .map(doc => doc.pageContent)
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length < 50) {
      return NextResponse.json(
        { error: 'Could not extract meaningful content from the URL.' },
        { status: 400 }
      );
    }

    if (text.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Page content exceeds 5MB limit.' }, { status: 400 });
    }

    const result = await ingestText(text, url);

    return NextResponse.json({
      message: `Website ingested successfully: ${result.chunks} chunks from ${url}`,
      chunks: result.chunks,
      source: url,
    });
  } catch (error) {
    console.error('URL ingestion error:', error);
    return NextResponse.json(
      { error: 'Failed to ingest website content.' },
      { status: 500 }
    );
  }
}