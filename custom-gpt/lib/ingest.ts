import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createCollection, getEmbeddings } from "./upload";
import { Document } from "@langchain/core/documents";

export async function ingestText(text: string, source: string) {
    // Connect to database and get collection   
    const collection = await createCollection();

    // Initialize text splitter
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 150,
    });

    // Prepare document
    const docs = [
      new Document({
        pageContent: text,
        metadata: {
          source,
          ingestedAt: new Date().toISOString(),
        },
      }),
    ];

    // Split into chunks
    const splitDocuments = await splitter.splitDocuments(docs);
    const texts = splitDocuments.map((d) => d?.pageContent);

    // Get embeddings
    const vectors = await getEmbeddings(texts);

    
    // Prepare records for insertion
    const records = splitDocuments.map((d, i) => ({
      $vector: vectors[i],
      text: d.pageContent,
      ...d.metadata,
    }));

    // Insert into vector database
    if (records.length > 0) {
      await collection.insertMany(records);
    }

    return { chunks: splitDocuments.length };
}