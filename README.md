# custom-gpt

A document-based AI chat assistant built with Next.js, Tailwind CSS, LangChain, and DataStax Astra DB.

This repository contains a self-hosted application that lets you ingest documents and websites, store semantic embeddings in Astra DB, and chat with your content using OpenRouter AI.

## Project Overview

- **Web UI**: A modern Next.js interface for uploading documents, ingesting websites, selecting content sources, and asking questions.
- **Document ingestion**: Supports PDF, DOC, DOCX, TXT, and Markdown input via upload or URL ingestion.
- **Vector DB**: Uses DataStax Astra DB to store embeddings and query relevant text chunks.
- **RAG-style chat**: Queries your knowledge base first, then falls back to web search using Tavily if needed.
- **Source filtering**: Users can choose the latest available sources to scope queries to specific documents.

## Repository Layout

```
/workspaces/custom-gpt
├── README.md                 # Root README
├── custom-gpt/               # Next.js application folder
│   ├── app/                  # Next.js app routes and pages
│   ├── components/           # UI components
│   ├── lib/                  # Backend helpers and business logic
│   ├── public/               # Static assets
│   ├── package.json          # App dependencies and scripts
│   └── README.md             # App-specific README
└── package-lock.json
```

## Getting Started

The application is located in `custom-gpt/custom-gpt`. Run commands from that directory.

### Prerequisites

- Node.js 18+ (recommended)
- npm
- DataStax Astra DB account and API credentials
- OpenRouter AI API key
- Optional: Tavily API key for fallback web search

### Install Dependencies

```bash
cd custom-gpt/custom-gpt
npm install
```

### Configure Environment

Create a `.env` file in `custom-gpt/custom-gpt` with the following values:

```env
ASTRA_DB_API_ENDPOINT=<your_astra_db_endpoint>
ASTRA_DB_APPLICATION_TOKEN=<your_astra_db_token>
ASTRA_DB_COLLECTION_NAME=custom_gpt_collection
OPEN_ROUTER_API_KEY=<your_openrouter_api_key>
OPEN_ROUTER_CHAT_MODEL=<your_openrouter_chat_model>
OPEN_ROUTER_EMBED_MODEL=<your_openrouter_embedding_model>
OPEN_ROUTER_BASE_URL=https://openrouter.ai/api/v1
TAVILY_API_KEY=<your_tavily_api_key> # optional
```

> Note: The repository defines an `ingest` script in `package.json`, but this checkout does not include the referenced `scripts/loaddb.js` file.

### Run the App

```bash
cd custom-gpt/custom-gpt
npm run dev
```

Open http://localhost:3000 in your browser.

## What This App Does

### Frontend

- `app/page.tsx` renders the main `Chat` component.
- `components/Chat.tsx` handles source selection, file upload, URL ingestion, and chat interactions.
- The UI fetches available sources from `/api/sources` and displays the latest five sources.

### Backend

- `/api/upload` accepts document uploads, extracts text, generates embeddings, and stores chunks in Astra DB.
- `/api/ingest-url` ingests webpage text via Cheerio, embeds it, and stores it in Astra DB.
- `/api/chat` sends user queries to OpenRouter and returns assistant responses with optional document sources.
- `/api/sources` returns source names stored in the Astra DB collection.

### Ingestion Pipeline

- `lib/upload.ts` extracts text from files and connects to Astra DB.
- `lib/ingest.ts` splits long text into chunks using LangChain's `RecursiveCharacterTextSplitter`.
- Embeddings are generated via OpenRouter and stored as `$vector` fields in Astra DB.

### Chat Logic

- `lib/chat.ts` constructs a strict RAG prompt and enforces tool usage.
- It uses `search_knowledge_base` for semantic retrieval and `search_google` as a fallback.
- Tool execution is performed in `lib/toolExecutors.ts`.

## Supported Content Types

- `.txt`, `.md`, `.pdf`, `.doc`, `.docx`
- File uploads are limited to 10MB
- Ingested URLs must use `https://`
- Internal/private network URLs are blocked for SSRF protection

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

- `ASTRA_DB_API_ENDPOINT` - Astra DB REST endpoint
- `ASTRA_DB_APPLICATION_TOKEN` - Astra DB token
- `ASTRA_DB_COLLECTION_NAME` - Vector collection name
- `OPEN_ROUTER_API_KEY` - OpenRouter API key
- `OPEN_ROUTER_CHAT_MODEL` - Chat completion model
- `OPEN_ROUTER_EMBED_MODEL` - Embedding model
- `OPEN_ROUTER_BASE_URL` - OpenRouter API base URL
- `TAVILY_API_KEY` - Optional Tavily key for web search fallback

## Notes

- The app shows the latest five sources in the source picker.
- Source names and UI text wrap to avoid horizontal overflow on mobile.
- Do not upload sensitive personal documents unless you trust the deployment.

## Troubleshooting

### Connection Errors

- Verify `ASTRA_DB_API_ENDPOINT` and `ASTRA_DB_APPLICATION_TOKEN`.
- Confirm `OPEN_ROUTER_API_KEY` and model settings.

### Embedding Dimension Mismatch

If your Astra DB collection uses a different vector dimension than the selected embedding model, recreate the collection or match the model dimension.

## Technology Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- TypeScript
- LangChain
- OpenRouter AI
- DataStax Astra DB
- Tavily search API

## License

Use this project for development and experimentation.
