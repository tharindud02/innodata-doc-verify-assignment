/**
 * Temporary minimal seed: just creates the reference Document row so the
 * upload endpoint has something to point at. The full seed (chunks +
 * embeddings + demo user) lands in Commit 7.
 *
 * Run from backend/: npx dotenv-cli -e .env -- ts-node src/prisma/seed-reference-only.ts
 * (or: npm run seed:reference)
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, DocumentKind } from '@prisma/client';
import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is missing or empty. Run with dotenv-cli -e .env (see script header).',
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

async function main() {
  const refPath = path.resolve(__dirname, '../../assets/reference_document.docx');
  const buffer = await fs.readFile(refPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  const existing = await prisma.document.findFirst({
    where: { kind: DocumentKind.REFERENCE, contentHash: hash },
  });
  if (existing) {
    console.log(`Reference already seeded: ${existing.id}`);
    return;
  }

  const [text, html] = await Promise.all([
    mammoth.extractRawText({ buffer }).then((r) => r.value),
    mammoth.convertToHtml({ buffer }).then((r) => r.value),
  ]);
  const safeHtml = sanitizeHtml(html);

  // Mirror the storage scheme used by FileStorage so the reference lives in
  // the same uploads/ tree
  const uploadsDir = path.resolve(__dirname, '..', 'uploads', hash.slice(0, 2), hash.slice(2, 4));
  await fs.mkdir(uploadsDir, { recursive: true });
  const storageAbs = path.join(uploadsDir, `${hash}.docx`);
  await fs.writeFile(storageAbs, buffer);
  const storagePath = path.relative(path.resolve(__dirname, '..'), storageAbs);

  const doc = await prisma.document.create({
    data: {
      userId: null,
      kind: DocumentKind.REFERENCE,
      filename: 'reference_document.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storagePath,
      contentHash: hash,
      parsedText: text,
      previewHtml: safeHtml,
    },
  });

  console.log(`Seeded reference document: ${doc.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());