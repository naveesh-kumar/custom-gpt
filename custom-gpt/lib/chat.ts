const {
  OPEN_ROUTER_API_KEY,
  OPEN_ROUTER_CHAT_MODEL,
  OPEN_ROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
} = process.env;

export async function generateResponse(query: string, context: string[]) {
  const systemPrompt =
  'You are a document Q&A assistant. Rules:\n' +
  '1. Answer ONLY using the provided context. Never use outside knowledge.\n' +
  '2. Cite document numbers used, e.g., [Doc 1, Doc 3].\n' +
  '3. If the context is insufficient, say: "The provided documents do not contain this information."\n' +
  '4. Be concise and direct. Do not repeat the question.';

const userMessage =
  `Context:\n${context.map((doc, i) => `[Doc ${i + 1}]: ${doc}`).join('\n\n')}` +
  `\n\nQuestion: ${query}`;

  const response = await fetch(OPEN_ROUTER_BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPEN_ROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPEN_ROUTER_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },{
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Chat API error: ${JSON.stringify(json)}`);
  }

  return json.choices[0].message.content;
}