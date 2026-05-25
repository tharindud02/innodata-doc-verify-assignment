import { Entity, FlagStatus } from '@prisma/client';
import { VerifyStage } from './verify.stage';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { RetrievalService, RetrievedChunk } from '../../rag/retrieval.service';
import { PipelineContext } from '../pipeline.context';

interface PrismaMock {
  entity: { findMany: jest.Mock<Promise<Array<Entity & { flag: null }>>, []> };
  flag: { create: jest.Mock<Promise<void>, [unknown]> };
}

interface LlmMock {
  completeJson: jest.Mock<
    Promise<{
      status: 'SUPPORTED' | 'CONTRADICTED' | 'UNSUPPORTED';
      explanation: string;
      citation_quote: string | null;
    }>,
    [unknown]
  >;
}

interface RetrievalMock {
  retrieve: jest.Mock<Promise<RetrievedChunk[]>, [unknown]>;
}

const ctx: PipelineContext = {
  jobId: 'job-verify-1',
  userId: 'user-1',
  primaryDocumentId: 'primary-1',
  referenceDocumentId: 'reference-1',
};

function buildEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'entity-1',
    jobId: ctx.jobId,
    drugName: 'Clonazepam',
    dose: '1',
    unit: 'mg',
    route: 'PO',
    frequency: 'twice daily',
    duration: '8 weeks',
    indication: 'anxiety',
    sourcePage: 1,
    createdAt: new Date('2026-05-25T00:00:00.000Z'),
    ...overrides,
  };
}

function buildChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: 'chunk-1',
    documentId: ctx.referenceDocumentId,
    ordinal: 10,
    monograph: 'Clonazepam',
    section: 'Dosing',
    page: 4,
    text: 'Institutional policy: Clonazepam must not exceed 4 weeks for anxiety.',
    distance: 0.18,
    ...overrides,
  };
}

describe('VerifyStage', () => {
  let service: VerifyStage;
  let prisma: PrismaMock;
  let llm: LlmMock;
  let retrieval: RetrievalMock;

  beforeEach(() => {
    prisma = {
      entity: { findMany: jest.fn() },
      flag: { create: jest.fn().mockResolvedValue(undefined) },
    };
    llm = { completeJson: jest.fn() };
    retrieval = { retrieve: jest.fn() };
    service = new VerifyStage(
      prisma as unknown as PrismaService,
      llm as unknown as LlmService,
      retrieval as unknown as RetrievalService,
    );
  });

  it('flags a known contradicted medication as CONTRADICTED', async () => {
    prisma.entity.findMany.mockResolvedValue([buildEntity({ id: 'entity-contradicted' })]);
    retrieval.retrieve.mockResolvedValue([buildChunk()]);
    llm.completeJson.mockResolvedValue({
      status: 'CONTRADICTED',
      explanation: 'Duration conflicts with formulary maximum.',
      citation_quote: 'Clonazepam must not exceed 4 weeks for anxiety.',
    });

    await service.run(ctx);

    expect(prisma.flag.create).toHaveBeenCalledTimes(1);
    expect(prisma.flag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: 'entity-contradicted',
        status: FlagStatus.CONTRADICTED,
        explanation: 'Duration conflicts with formulary maximum.',
        citationText: 'Clonazepam must not exceed 4 weeks for anxiety.',
        citationChunkId: 'chunk-1',
      }),
    });
  });

  it('marks medication as UNSUPPORTED when retrieval relevance is too weak', async () => {
    prisma.entity.findMany.mockResolvedValue([buildEntity({ id: 'entity-unsupported' })]);
    retrieval.retrieve.mockResolvedValue([buildChunk({ distance: 0.62, monograph: 'Unrelated Drug' })]);

    await service.run(ctx);

    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(prisma.flag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: 'entity-unsupported',
        status: FlagStatus.UNSUPPORTED,
        citationChunkId: null,
      }),
    });
  });
});
