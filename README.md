## Document Verification System

Full-stack medical document verification app with async pipeline stages:
`PARSE -> CHUNK -> EMBED -> SUMMARIZE -> CRITICAL_POINTS -> EXTRACT -> VERIFY`.

### What is implemented for review

- Structured pipeline logs for ingestion, extraction, retrieval, and verification with stable fields (`jobId`, `userId`, `documentId`, `entityId`, `drugName`, `stage`).
- Targeted tests around verification correctness and authorization boundaries.
- Single `docker-compose.yml` for database, cache, backend, and frontend.
- Seeded demo user + reference document so reviewer can log in immediately.

## 10-minute setup

### 1) Prerequisites

- Docker Desktop
- One LLM API key (Anthropic or OpenAI)

### 2) Create `.env` in repository root

Use this as a minimum:

```env
POSTGRES_USER=docverify
POSTGRES_PASSWORD=docverify_dev
POSTGRES_DB=docverify
JWT_SECRET=change-me-min-16-chars
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-real-key
```

If using OpenAI instead:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-real-key
```

### 3) Start the full stack

```bash
docker compose up --build
```

This stack automatically:

1. starts Postgres (`pgvector`) and Redis,
2. runs backend migrations (`prisma migrate deploy`),
3. runs seed script (demo user + reference document + reference embeddings),
4. starts backend API and frontend app.

### 4) Login immediately (seed credentials)

- Email: `demo@meridianbay.test`
- Password: `demo1234`

### 5) Open app

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API base: [http://localhost:3001/api](http://localhost:3001/api)

## Tests added for this pass

Run from `backend/`:

```bash
npm test -- verify.stage.spec.ts
npm test -- documents.service.spec.ts
```

Coverage intent for these targeted tests:

- Verification logic: known contradicted medication is flagged as `CONTRADICTED`; weak retrieval is gated to `UNSUPPORTED`.
- Authorization checks: document preview is owner-only for primary docs and allowed for institutional reference docs.

## Logging and traceability

The backend now emits structured JSON logs for the key paths reviewers care about:

- `pipeline.ingestion.accepted` / `pipeline.ingestion.failed`
- `pipeline.extraction.completed`
- `pipeline.retrieval.completed`
- `pipeline.verification.entity_completed`
- stage lifecycle logs (`pipeline.stage.started|completed|failed`)

Each event includes enough context to trace one document end-to-end by `jobId` and pinpoint failures quickly.

## Architecture notes

- **Asynchronous pipeline:** BullMQ worker (`PipelineProcessor`) processes jobs without blocking upload HTTP requests.
- **Realtime status:** frontend consumes job status from SSE and can refresh mid-run without losing stage state.
- **Atomic ingest writes:** `DocumentsService.ingestUpload()` wraps `Document + Job + Stage[]` creation in one transaction.
- **RAG verification:** extracted entities are retrieved against reference chunks in pgvector and classified as `SUPPORTED | CONTRADICTED | UNSUPPORTED` with citation grounding checks.

## Tradeoffs and known limitations

- Enqueue after DB commit is a deliberate dual-write tradeoff: if queue write fails, job stays `QUEUED` and can be retried.
- Single backend process hosts both API and queue worker; no separate worker container is required for this submission.
