import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromFile, MAX_FILE_SIZE, ALLOWED_TYPES, ALLOWED_EXTENSIONS } from '../../../lib/upload';
import { ingestText } from '@/lib/ingest';

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
    
    const chunks = await ingestText(content, file.name);

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded and embedded ${file.name}`,
      chunks,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload and process file' },
      { status: 500 }
    );
  }
}