import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { randomUUID } from "node:crypto";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  advanceStages,
  buildCompletedJob,
  createPendingStages,
  demoDocumentPreview,
} from "./demo.js";
import type { AuthUser, JobDetail, JobRecord } from "./types.js";

const PORT = Number(process.env.PORT ?? 3001);
const JWT_SECRET = process.env.JWT_SECRET ?? "doc-verify-demo-secret";
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const jobs = new Map<string, JobRecord>();
const streamIntervals = new Map<string, ReturnType<typeof setInterval>>();

app.use(cors());
app.use(express.json());

interface AuthPayload {
  sub: string;
  email: string;
}

function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function authFromRequest(req: Request): AuthPayload | null {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token =
    bearer ?? (typeof req.query.token === "string" ? req.query.token : null);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const payload = authFromRequest(req);
  if (!payload) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  res.locals.auth = payload;
  next();
}

function issueAuthResponse(email: string, res: Response): void {
  const user: AuthUser = {
    id: email === DEMO_EMAIL ? "demo-user" : randomUUID(),
    email,
  };
  res.json({ token: signToken(user), user });
}

function isDemoCredentials(email: string, password: string): boolean {
  return email === DEMO_EMAIL && password === DEMO_PASSWORD;
}

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email ?? "");
  const password = String(req.body?.password ?? "");

  if (!isDemoCredentials(email, password)) {
    res.status(401).json({
      message: `Use demo credentials: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
    });
    return;
  }

  issueAuthResponse(email, res);
});

app.post("/api/auth/signup", (req, res) => {
  const email = String(req.body?.email ?? "");
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  if (!isDemoCredentials(email, password)) {
    res.status(400).json({
      message: `Demo mode: sign up with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
    });
    return;
  }

  issueAuthResponse(email, res);
});

app.post(
  "/api/documents/upload",
  requireAuth,
  upload.single("file"),
  (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const jobId = randomUUID();
    const documentId = randomUUID();
    const createdAt = new Date().toISOString();
    const filename = file.originalname;

    const job: JobDetail = {
      id: jobId,
      documentId,
      status: "RUNNING",
      filename,
      stages: createPendingStages(),
      summary: null,
      criticalPoints: [],
      flagged: [],
      createdAt,
      completedAt: null,
    };

    jobs.set(jobId, { job, filename });
    startJobSimulation(jobId);
    res.status(201).json({ jobId });
  }
);

app.get("/api/jobs/:jobId", requireAuth, (req, res) => {
  const record = jobs.get(req.params.jobId);
  if (!record) {
    res.status(404).json({ message: "Job not found" });
    return;
  }
  res.json(record.job);
});

app.get("/api/jobs/:jobId/stream", requireAuth, (req, res) => {
  const record = jobs.get(req.params.jobId);
  if (!record) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = () => {
    res.write(`data: ${JSON.stringify(record.job)}\n\n`);
  };

  send();
  const interval = setInterval(send, 400);

  req.on("close", () => {
    clearInterval(interval);
  });
});

app.get("/api/documents/:documentId/preview", requireAuth, (req, res) => {
  const record = [...jobs.values()].find(
    (entry) => entry.job.documentId === req.params.documentId
  );

  if (!record) {
    res.status(404).json({ message: "Document not found" });
    return;
  }

  res.json({ html: demoDocumentPreview(record.filename) });
});

function startJobSimulation(jobId: string): void {
  const record = jobs.get(jobId);
  if (!record) return;

  let step = 0;
  const existing = streamIntervals.get(jobId);
  if (existing) clearInterval(existing);

  const interval = setInterval(() => {
    const current = jobs.get(jobId);
    if (!current) {
      clearInterval(interval);
      streamIntervals.delete(jobId);
      return;
    }

    if (step < 7) {
      current.job.stages = advanceStages(current.job.stages, step);
      current.job.status = "RUNNING";
      step += 1;
      jobs.set(jobId, current);
      return;
    }

    const completed = buildCompletedJob(
      current.job.id,
      current.job.documentId,
      current.filename,
      current.job.createdAt
    );
    jobs.set(jobId, { job: completed, filename: current.filename });
    clearInterval(interval);
    streamIntervals.delete(jobId);
  }, 700);

  streamIntervals.set(jobId, interval);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
});
