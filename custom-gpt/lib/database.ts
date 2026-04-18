import { DataAPIClient, Db } from '@datastax/astra-db-ts';

const {
  ASTRA_DB_API_ENDPOINT: endpoint,
  ASTRA_DB_COLLECTION_NAME,
  ASTRA_DB_APPLICATION_TOKEN: token,
  OPEN_ROUTER_API_KEY,
  OPEN_ROUTER_EMBED_MODEL,
  OPEN_ROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
} = process.env;

let dbInstance: Db | null = null;

export async function getDatabase(): Promise<Db> {
  if (!dbInstance) {
    if (!token || !endpoint) {
      throw new Error('Database environment variables not configured');
    }
    const client = new DataAPIClient();
    dbInstance = client.db(endpoint, { token, keyspace: 'default_keyspace' });
  }
  return dbInstance;
}

// Convert the question into vector embeddings using the same embedding model used for ingesting documents
export async function getEmbeddings(text: string) {
  const response = await fetch(OPEN_ROUTER_BASE_URL + '/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPEN_ROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPEN_ROUTER_EMBED_MODEL,
      input: [text],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Embedding API error: ${JSON.stringify(json)}`);
  }
  return json.data[0].embedding;
}

// Retrieve relevant documents from Astra DB using vector similarity search
export async function retrieveRelevantDocuments(query: string, limit = 5) {
  const db = await getDatabase();
  const collection = db.collection(ASTRA_DB_COLLECTION_NAME || 'custom_gpt_collection');

  const queryEmbedding = await getEmbeddings(query);

  const results = await collection.find({}, {
    sort: { $vector: queryEmbedding },
    limit,
    includeSimilarity: true,
    projection: { text: 1, source: 1, $vector: 0 }, // Exclude the embedding vector from results
  });

  const docs = await results.toArray();

  // filter out documents with low similarity (e.g., below 0.7) and format the results
  const filteredDocs = docs.filter(doc => doc.$similarity ?? 0 > 0.7);

  return filteredDocs.map(doc => ({
    text: doc.text,
    source: doc.source,
    similarity: doc.$similarity,
  }));
}