# Custom GPT

A Next.js-based AI assistant for document and website chat using vector search, embeddings, and tool-assisted conversation.

## What It Is

This app lets users upload documents or ingest website text, store that content as semantic embeddings in DataStax Astra DB, and ask questions via a chat UI.

Key behaviors:
- Uses document source filtering to scope responses to specific ingested materials
- Runs a first-pass knowledge base search, then falls back to web search only if necessary
- Extracts text from PDF, DOC, DOCX, TXT, and Markdown files
- Enforces browser-safe URL ingestion

## Quick Start

```bash
cd custom-gpt
npm install
cd custom-gpt
npm run dev
```

Then open http://localhost:3000.

## Required Environment Variables

Create `.env` in `custom-gpt/custom-gpt` with:

```env
ASTRA_DB_API_ENDPOINT=<astra_api_endpoint>
ASTRA_DB_APPLICATION_TOKEN=<astra_token>
ASTRA_DB_COLLECTION_NAME=custom_gpt_collection
OPEN_ROUTER_API_KEY=<openrouter_api_key>
OPEN_ROUTER_CHAT_MODEL=<openrouter_chat_model>
OPEN_ROUTER_EMBED_MODEL=<openrouter_embedding_model>
OPEN_ROUTER_BASE_URL=https://openrouter.ai/api/v1
TAVILY_API_KEY=<tavily_api_key> # optional
```

## Application Structure

- `custom-gpt/app/page.tsx` - entry page renders the chat UI
- `custom-gpt/components/Chat.tsx` - main chat interface, source selection, upload, and ingestion logic
- `custom-gpt/app/api/` - backend endpoints for chat, upload, URL ingestion, and source listing
- `custom-gpt/lib/` - core helpers for embeddings, database access, ingestion, and tool execution

## Core API Endpoints

- `POST /api/chat` — sends user messages to OpenRouter and returns AI answers
- `POST /api/upload` — accepts file uploads, extracts text, embeds chunks, and stores them in Astra DB
- `POST /api/ingest-url` — scrapes webpage text, converts it to embeddings, and stores it
- `GET /api/sources` — returns all available source names from the database

## Supported Uploads

- `txt`, `md`, `pdf`, `doc`, `docx`
- 10MB file size limit
- `https://` URL ingestion only
- private network URLs are blocked for security

## Important Notes

- The app currently displays only the last 5 available sources in the source selector.
- Source names wrap in the UI to avoid overflow on mobile.
- Avoid uploading sensitive personal documents to this demo-style application.
- A package script called `npm run ingest` is declared, but the corresponding loader file is not included here.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- LangChain
- OpenRouter AI
- DataStax Astra DB
- Tavily (Google search fallback)

## Troubleshooting

- Validate all environment variables and API keys
- Ensure Astra DB endpoint and token work together
- Match embedding model dimension with any existing Astra collection

## Running Commands

From `custom-gpt/custom-gpt`:

- `npm run dev` — start development server
- `npm run build` — build production app
- `npm start` — run built app
- `npm run lint` — lint the code

## License

Use and modify this project for experimentation and development.

## Support

For issues or questions, please refer to the project documentation or contact the development team.
