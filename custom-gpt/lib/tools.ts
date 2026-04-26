export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_knowledge_base',
      description:
        'Search the vector database for relevant documents. ALWAYS call this first before any other tool.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query.' },
          limit: { type: 'number', description: 'Number of results. Default 5.' },
          source: { type: 'string', description: 'Optional source name to restrict results to a specific source.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_google',
      description:
        'Search Google for information. ONLY use this as a fallback when search_knowledge_base returns no relevant results. Results are NOT from the uploaded documents.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to look up on Google.' },
        },
        required: ['query'],
      },
    },
  },
];