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

## Multiple reference documents

The assignment ships one institutional formulary, but the data model and UI are built so you can add more without schema changes.

### How it works today

- Reference documents are rows in `documents` with `kind = REFERENCE` (no owning user).
- Each job stores `referenceDocumentId` — verification retrieval is scoped to that document only.
- Upload page lists available references via `GET /api/documents/references` and sends the chosen id with the primary file.
- If only one reference exists, it is selected automatically; if several exist, the user picks from a dropdown.
- Citations open in a **modal preview** (meets the “clear preview panel” bar). A **Full page** link remains for deep-link navigation (extra-credit style).

### Adding another formulary later

1. Place the new file under `backend/assets/` (e.g. `pediatric_formulary.docx`).
2. Extend `backend/prisma/seeds.ts` to load and index each file (same pattern as `reference_document.docx`):
   - parse → create `Document` with `kind: REFERENCE` (idempotent by `contentHash`)
   - call `ReferenceIndexer.indexReference({ documentId, parsedText })`
3. Re-run seed: `cd backend && npm run prisma:seed` (use `--force` on the indexer call if you need to rebuild embeddings).
4. Restart the app. The new formulary appears in the upload dropdown.

No migration is required — only seed/index work and optional UI copy.

### Alignment with the assignment brief

| Requirement | How we handle it |
|-------------|------------------|
| One reference provided for the assignment | Seeded `reference_document.docx` |
| “Designed so additional references could be added later” | `REFERENCE` documents + per-job `referenceDocumentId` + list/select API |
| Verify entities against **the** reference | Pipeline uses the job’s chosen reference only |
| Citations grounded in reference text | Quote + modal/full-page preview with highlight |
| Under-scoped / judgment on deferrals | Multi-reference **selection** and **modal** are in scope; bulk reference upload UI and admin CRUD are deferred |

## Tradeoffs and known limitations

- Enqueue after DB commit is a deliberate dual-write tradeoff: if queue write fails, job stays `QUEUED` and can be retried.
- Single backend process hosts both API and queue worker; no separate worker container is required for this submission.
- Adding references is operator-driven (seed/assets), not an in-app upload flow for formulary admins.
