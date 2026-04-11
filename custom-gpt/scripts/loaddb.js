import { DataAPIClient, Db } from '@datastax/astra-db-ts';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const {
  ASTRA_DB_API_ENDPOINT: endpoint,
  ASTRA_DB_COLLECTION_NAME,
  ASTRA_DB_APPLICATION_TOKEN: token,
  OPEN_ROUTER_API_KEY,
  OPEN_ROUTER_EMBED_MODEL,
  OPEN_ROUTER_BASE_URL
} = process.env;

/**
 * Connects to a DataStax Astra database.
 * This function retrieves the database endpoint and application token from the
 * environment variables `ASTRA_DB_API_ENDPOINT` and `ASTRA_DB_APPLICATION_TOKEN`.
 *
 * @returns An instance of the connected database.
 * @throws Will throw an error if the environment variables
 * `API_ENDPOINT` or `APPLICATION_TOKEN` are not defined.
 */
function connectToDatabase() {
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

async function createCollection() {
  const database = connectToDatabase();
  const collection_name = ASTRA_DB_COLLECTION_NAME || 'custom_gpt_collection';
  const dimension = 2048;

  try {
    // Check if collection already exists
    const collections = await database.listCollections();
    const exists = collections.some(col => col.name === collection_name);

    if (exists) {
      console.log(`Collection '${collection_name}' already exists. Skipping creation.`);
      return true;
    }

    const collection = await database.createCollection(collection_name, {
      vector: {
        dimension,
        metric: 'cosine',
      },
    });
    console.log(`Created collection ${collection.keyspace}.${collection.name} (dimension=${dimension})`);
    return true;
  } catch (error) {
    console.error(`Error creating collection '${collection_name}':`, error);
  }
}

async function getEmbeddings(texts) {
  const response = await fetch(
    (OPEN_ROUTER_BASE_URL || 'https://openrouter.ai/api/v1') + '/embeddings',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPEN_ROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPEN_ROUTER_EMBED_MODEL,
        input: texts,
      }),
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`Embedding API error: ${JSON.stringify(json)}`);
  }

  if (!json.data || !Array.isArray(json.data)) {
    throw new Error(`Unexpected response format: ${JSON.stringify(json).slice(0, 500)}`);
  }

  // Sort by index to ensure correct order, then extract embeddings
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

async function loadSampleDocument(db) {

  // Initialize text splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150,
  });

  const collection = await db.collection(
    ASTRA_DB_COLLECTION_NAME || 'custom_gpt_collection'
  );

  // Getting documents from command line
  const targets = process.argv.slice(2);

  if (targets.length < 1) throw new Error('Document required');

  for (const file of targets) {
    try {
      const fullPath = path.resolve(process.cwd(), file);
      const content = await fs.readFile(fullPath, 'utf8');

      // Prepare document
      const docs = [
        new Document({
          pageContent: content,
          metadata: {
            source: file,
            ingestedAt: new Date().toISOString(),
          },
        }),
      ];

      // split into chunks
      const splitDocuments = await splitter.splitDocuments(docs);
      const texts = splitDocuments.map((d) => d?.pageContent);

      // Store chunks in vector DB
      const vectors = await getEmbeddings(texts);
      console.log(`Embedding dimension: ${vectors[0].length}`);

      console.log(`Created ${splitDocuments.length} embeddings`);
      const records = splitDocuments.map((d, i) => ({
        $vector: vectors[i],
        text: d.pageContent,
        ...d.metadata,
      }));

      if (records.length > 0) {
        await collection.insertMany(records);
      }

      console.log(`Ingested ${file}: ${splitDocuments.length} chunks`);
    } catch (err) {
      console.error(`Failed to ingest ${file}`, err);
    }
  }
}

async function main() {
  try {
    // 1. Connect to Astra DB
    const db = connectToDatabase();

    // 2. (Optional) Create collection once
    // Comment this out after first successful run
    await createCollection();

    // 3. Load documents passed via CLI
    await loadSampleDocument(db);

    console.log('✅ Document ingestion completed');
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  }
}

main();
