import { executeTool } from "./toolExecutors";
import { tools } from "./tools";

const {
  OPEN_ROUTER_API_KEY,
  OPEN_ROUTER_CHAT_MODEL,
  OPEN_ROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
} = process.env;

type LLMMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export async function generateResponse(query: string, source?: string) {
  const MAX_TOOL_ROUNDS = 3;

  const SYSTEM_PROMPT = `You are a helpful RAG assistant that answers questions from uploaded documents and websites.

  STRICT RULES — follow in this exact order:
  1. ALWAYS call search_knowledge_base first for any factual question.
  2. If search_knowledge_base returns results → answer using ONLY those results. Start your answer with "📄 [From documents]".
  3. If search_knowledge_base returns no results → call search_google as a fallback.
  4. If you used Google results → start your answer with "🌐 [Not from your documents — web result]" and end with: "⚠️ This answer was not found in your uploaded documents. It was retrieved from a general web search."
  5. For greetings or casual conversation → respond directly, no tools needed.
  6. NEVER make up information. If neither tool returns results, say you don't know.`;

  const SOURCE_HINT = source
    ? `If a source filter is provided, only search documents from the source named "${source}" when calling search_knowledge_base. Do not use other uploaded sources unless the user explicitly asks for them.`
    : '';

  const messages: LLMMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${SOURCE_HINT}` },
    { role: 'user', content: query.trim() }
  ];


  let finalResponse = '';
  let emptyKnowledgeBaseCount = 0;
  let toolRound = 0;

  while (toolRound < MAX_TOOL_ROUNDS) {
    toolRound++;

    const llmresponse = await fetch(OPEN_ROUTER_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {    
        'Authorization': `Bearer ${OPEN_ROUTER_API_KEY}`, 
        'Content-Type': 'application/json' 
      },     
      body: JSON.stringify({
        model: OPEN_ROUTER_CHAT_MODEL,
        messages,
        tools,
        tool_choice: 'auto',  
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const json = await llmresponse.json();

    if (!llmresponse.ok) {
      throw new Error(`Chat API error: ${JSON.stringify(json)}`);
    }

    const assistantMessage = json.choices[0].message;

    messages.push(assistantMessage);

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const toolCall of assistantMessage.tool_calls) {
        const { name, arguments: argsString } = toolCall.function;

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(argsString);
          } catch {
            args = {};
          }

          console.log(`[Tool call] ${name}(${JSON.stringify(args)})`);

          const result = await executeTool(name, args, source);

          if (name === 'search_knowledge_base') {
          const noResults =
            result === 'No relevant documents found.' ||
            result.trim().length === 0;

          if (noResults) {
            emptyKnowledgeBaseCount++;

            if (emptyKnowledgeBaseCount >= 1) {
              // Force Google search — inject a system instruction
              // so the LLM knows why and what to do next
              messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
              messages.push({
                role: 'system',
                content:
                  'The knowledge base returned no results after 2 attempts. You MUST now call search_google to find an answer from the web.',
              });
              continue; // skip the normal tool result push below
            }
          }
        }

          // Feed the tool result back into the conversation
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }
    } else {
      finalResponse = assistantMessage.content || '';
      break;
    }
  }

  // Safety: if loop exhausted without a final answer
    if (!finalResponse) {
      finalResponse = 'I was unable to generate a response. Please try again.';
    }
    const relevantDocssources = extractDocumentSources(messages);
    return {finalResponse, relevantDocssources};
}

function extractDocumentSources(
  messages: LLMMessage[]
): Array<{ source: string; similarity: number }> {
  const seen = new Set<string>();
  const sources: Array<{ source: string; similarity: number }> = [];

  for (const msg of messages) {
    if (msg.role === 'tool' && typeof msg.content === 'string') {
      // Skip web search results
      if (msg.content.startsWith('WEB_SEARCH')) continue;

      const matches = msg.content.matchAll(
        /\(source: (.+?), similarity: ([\d.]+)%\)/g
      );
      for (const match of matches) {
        const source = match[1];
        const similarity = parseFloat(match[2]) / 100;
        if (!seen.has(source)) {
          seen.add(source);
          sources.push({ source, similarity });
        }
      }
    }
  }

  return sources;
}