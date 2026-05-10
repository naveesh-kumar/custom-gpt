import { DataAPIClient, Db } from '@datastax/astra-db-ts';

let dbInstance: Db | null = null;

export async function getDatabase(): Promise<Db> {
  if (!dbInstance) {
    const {
      ASTRA_DB_API_ENDPOINT: endpoint,
      ASTRA_DB_APPLICATION_TOKEN: token
    } = process.env;

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
  const {
    OPEN_ROUTER_API_KEY,
    OPEN_ROUTER_EMBED_MODEL,
    OPEN_ROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
  } = process.env;

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
export async function retrieveRelevantDocuments(query: string, limit = 5, source?: string) {
  const db = await getDatabase();
  const collection = db.collection(ASTRA_DB_COLLECTION_NAME || 'custom_gpt_collection');

  const queryEmbedding = await getEmbeddings(query);

  const filter: Record<string, unknown> = {};
  if (source) {
    filter.source = source;
  }

  const results = await collection.find(filter, {
    sort: { $vector: queryEmbedding },
    limit,
    includeSimilarity: true,
    projection: { text: 1, source: 1, $vector: 0 }, // Exclude the embedding vector from results
  });

  const docs = await results.toArray();

  // filter out documents with low similarity (e.g., below 0.7) and format the results
  const filteredDocs = docs.filter(doc => (doc.$similarity ?? 0) > 0.7);

  return filteredDocs.map(doc => ({
    text: doc.text,
    source: doc.source,
    similarity: doc.$similarity,
  }));
}

export async function getSources() {
  const { ASTRA_DB_COLLECTION_NAME } = process.env;
  const db = await getDatabase();
  const collection = db.collection(ASTRA_DB_COLLECTION_NAME || 'custom_gpt_collection');

  const results = await collection.find({}, {
    projection: { source: 1 },
    limit: 1000,
  });

  const docs = await results.toArray() as Array<{ source?: unknown }>;
  const sources = Array.from(
    new Set(
      docs
        .map((doc) => (typeof doc.source === 'string' ? doc.source.trim() : ''))
        .filter(Boolean)
    )
  );

  return sources;
}