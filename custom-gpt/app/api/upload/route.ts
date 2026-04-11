import { NextRequest, NextResponse } from 'next/server';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getEmbeddings, extractTextFromFile, MAX_FILE_SIZE, ALLOWED_TYPES, ALLOWED_EXTENSIONS, createCollection } from '../../../lib/upload';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file size (10MB limit)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'File size exceeds 10MB limit'
      }, { status: 400 });
    }

    // Validate file type
    const isAllowedType = ALLOWED_TYPES.includes(file.type);
    const isAllowedExtension = ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isAllowedType && !isAllowedExtension) {
      return NextResponse.json({
        error: 'Unsupported file type. Supported formats: .txt, .md, .pdf, .doc, .docx'
      }, { status: 400 });
    }

    // Extract text from file
    const content = await extractTextFromFile(file);

    if (!content.trim()) {
      return NextResponse.json({ error: 'No readable text found in file' }, { status: 400 });
    }
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
        pageContent: content,
        metadata: {
          source: file.name,
          ingestedAt: new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
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

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded and embedded ${file.name}`,
      chunks: splitDocuments.length,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload and process file' },
      { status: 500 }
    );
  }
}