
import { DataAPIClient, Db } from '@datastax/astra-db-ts';
import mammoth from 'mammoth';
export const runtime = 'nodejs';

interface EmbeddingItem {
  index: number;
  embedding: number[];
}

const {
  OPEN_ROUTER_API_KEY,
  OPEN_ROUTER_EMBED_MODEL,
  OPEN_ROUTER_BASE_URL = 'https://openrouter.ai/api/v1',
  ASTRA_DB_API_ENDPOINT: endpoint,
  ASTRA_DB_COLLECTION_NAME,
  ASTRA_DB_APPLICATION_TOKEN: token
} = process.env;

export async function getEmbeddings(texts: string[]) {
  const response = await fetch(OPEN_ROUTER_BASE_URL + '/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPEN_ROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPEN_ROUTER_EMBED_MODEL,
      input: texts,
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`Embedding API error: ${JSON.stringify(json)}`);
  }

  if (!json.data || !Array.isArray(json.data)) {
    throw new Error(`Unexpected response format: ${JSON.stringify(json).slice(0, 500)}`);
  }

  // Sort by index to ensure correct order, then extract embeddings
  return (json.data as EmbeddingItem[])
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdfjs-dist legacy build works in Node without canvas
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str);
    pageTexts.push(strings.join(' '));
  }

  return pageTexts.join('\n');
}

export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfText(buffer);
  } else if (
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.doc') ||
    file.name.toLowerCase().endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    return await file.text();
  }
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

export const ALLOWED_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const ALLOWED_EXTENSIONS = ['.txt', '.md', '.pdf', '.doc', '.docx'];

/**
 * Connects to a DataStax Astra database.
 * This function retrieves the database endpoint and application token from the
 * environment variables `ASTRA_DB_API_ENDPOINT` and `ASTRA_DB_APPLICATION_TOKEN`.
 *
 * @returns An instance of the connected database.
 * @throws Will throw an error if the environment variables
 * `API_ENDPOINT` or `APPLICATION_TOKEN` are not defined.
 */
export function connectToDatabase() {
  if (!token || !endpoint) {
    throw new Error(
      'Environment variables ASTRA_DB_API_ENDPOINT and ASTRA_DB_APPLICATION_TOKEN must be defined.'
    );
  }

  // Create an instance of the `DataAPIClient` class
  const client = new DataAPIClient();
  // Get the database specified by your endpoint and provide the token
  const database = client.db(endpoint, { token, keyspace: 'default_keyspace' });
  console.log(`Connected to database ${database.id}`);
  return database;
}

export async function createCollection() {
  const database = connectToDatabase();
  const collection_name = ASTRA_DB_COLLECTION_NAME || 'custom_gpt_collection';
  const dimension = 2048;

  try {
    const collections = await database.listCollections();
    const exists = collections.some(col => col.name === collection_name);

    if (exists) {
      console.log(`Collection '${collection_name}' already exists. Skipping creation.`);
      return database.collection(collection_name);
    }

    const collection = await database.createCollection(collection_name, {
      vector: {
        dimension,
        metric: 'cosine',
      },
    });
    console.log(`Created collection ${collection.keyspace}.${collection.name} (dimension=${dimension})`);
    return collection;
  } catch (error) {
    console.error(`Error creating collection '${collection_name}':`, error);
    throw error;
  }
}