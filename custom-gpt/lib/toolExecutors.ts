import { tavily } from '@tavily/core';
import { retrieveRelevantDocuments } from './database';

async function searchGoogle(query: string): Promise<string> {
 const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const result = await client.search(query, { maxResults: 5 });

  return 'WEB_SEARCH_RESULTS:\n' + result.results
    .map((r, i) => `[Web Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
    .join('\n\n');
}

async function searchKnowledgeBase(
  query: string,
  limit = 5,
  source?: string
): Promise<string> {
  const docs = await retrieveRelevantDocuments(query, limit, source);

  if (docs.length === 0) {
    return 'No relevant documents found.';
  }

  // Format results for the LLM to read
  return docs
    .map(
      (doc, i) =>
        `[Result ${i + 1}] (source: ${doc.source}, similarity: ${((doc.similarity ?? 0) * 100).toFixed(1)}%)\n${doc.text}`
    )
    .join('\n\n');
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  source?: string
): Promise<string> {
  switch (name) {
    case 'search_knowledge_base':
      return await searchKnowledgeBase(
        args.query as string,
        (args.limit as number) || 5,
        (args.source as string) || source
      );
    case 'search_google':
      return await searchGoogle(args.query as string);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}