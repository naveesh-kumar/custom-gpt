# Custom GPT

A Next.js-based application for building custom AI assistants with document ingestion, vector embeddings, and semantic search capabilities.

## Features

- **Next.js Frontend**: Modern React-based web interface
- **Vector Database**: Integration with DataStax Astra DB for storing and querying vector embeddings
- **AI Embeddings**: OpenRouter AI embeddings (text-embedding-3-small by default) for semantic understanding
- **Document Ingestion**: CLI-based document ingestion pipeline that converts text files into vector embeddings
- **Scalable Architecture**: Built for production-grade AI assistant deployments

## Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- DataStax Astra DB account and credentials
- OpenRouter AI API key

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Astra DB Configuration
ASTRA_DB_API_ENDPOINT=<your_astra_db_endpoint>
ASTRA_DB_APPLICATION_TOKEN=<your_astra_db_token>
ASTRA_DB_COLLECTION_NAME=custom_gpt_collection

# OpenRouter AI Configuration
OPEN_ROUTER_API_KEY=<your_openrouter_api_key>
OPEN_ROUTER_EMBED_MODEL=nvidia/Llama-Nemotron-embed-vl-1b-v2
OPEN_ROUTER_BASE_URL=https://openrouter.ai/api/v1
```

See `.env.example` for a template (do not commit actual credentials).

### 3. Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Usage

### Document Ingestion

Ingest documents into the vector database:

```bash
npm run ingest -- <path_to_document>
```

Example:
```bash
npm run ingest -- ./docs/bio.txt
```

The ingestion pipeline will:
1. Read the document
2. Split text into chunks (1000 tokens with 150 token overlap)
3. Generate embeddings using OpenRouter AI
4. Store vectors in Astra DB collection

### Production Build

```bash
npm run build
npm start
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run ingest -- <file>` - Ingest documents into vector database

## Project Structure

```
custom-gpt/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Home page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── scripts/
│   └── loaddb.js          # Document ingestion script
├── docs/                  # Documentation and sample files
├── public/                # Static assets
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Vector DB**: DataStax Astra DB
- **AI/ML**: OpenRouter AI, LangChain
- **Runtime**: Node.js
- **Build Tool**: Next.js with TypeScript

## Key Dependencies

- `@langchain/openai` - LangChain OpenAI embeddings integration
- `@langchain/core` - LangChain core utilities
- `@langchain/textsplitters` - Text chunking for embeddings
- `@datastax/astra-db-ts` - Astra DB TypeScript client
- `next` - React framework

## Configuration

### Embedding Models

The project uses OpenRouter's embedding models. Choose from these options:

**Free Models:**
- `nvidia/Llama-Nemotron-embed-vl-1b-v2` ⭐ **RECOMMENDED** - 4096 dimensions, FREE, excellent quality
- `jina-embeddings-v2-base-en` - 768 dimensions, FREE
- `jina-embeddings-v3-small` - 512 dimensions, FREE

**Paid Models (Low-cost):**
- `text-embedding-3-small` (default) - 1536 dimensions, ~$0.02/1M tokens
- `text-embedding-3-large` - 3072 dimensions, ~$0.13/1M tokens
- `nomic-ai/nomic-embed-text-v1-5` - 768 dimensions, ~$0.02/1M tokens

Update `OPEN_ROUTER_EMBED_MODEL` in `.env` to switch models.

## Troubleshooting

### Collection Dimension Mismatch

If you encounter: `The configured vector dimension is: 768. But you are trying to...`

This means your collection was created with a different embedding model. The solution:
- Update `OPEN_ROUTER_EMBED_MODEL` in `.env` to match the collection dimensions
- Or delete and recreate the collection with the new model

### API Authentication Errors

- Verify your `OPEN_ROUTER_API_KEY` is valid and not expired
- Check that `ASTRA_DB_APPLICATION_TOKEN` and `ASTRA_DB_API_ENDPOINT` are correct

## Development

### ESLint

```bash
npm run lint
```

### TypeScript

The project uses TypeScript for type safety. Configuration is in `tsconfig.json`.

## Deployment

### Vercel (Recommended for Next.js)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Docker

Create a `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [LangChain Documentation](https://js.langchain.com/)
- [DataStax Astra DB](https://www.datastax.com/products/astra-db)
- [OpenRouter Documentation](https://openrouter.ai/docs)

## License

This project is available for use.

## Support

For issues or questions, please refer to the project documentation or contact the development team.
