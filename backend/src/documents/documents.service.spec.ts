import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentKind } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorage } from '../common/file-storage';
import { DocumentParser } from './document-parser.service';
import { ConfigService } from '@nestjs/config';

interface PrismaMock {
  document: {
    findUnique: jest.Mock<
      Promise<{
        id: string;
        userId: string | null;
        kind: DocumentKind;
        previewHtml: string | null;
      } | null>,
      [unknown]
    >;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
}

describe('DocumentsService authorization', () => {
  let service: DocumentsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      document: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    service = new DocumentsService(
      prisma as unknown as PrismaService,
      {} as FileStorage,
      {} as DocumentParser,
      { get: jest.fn() } as unknown as ConfigService,
    );
  });

  it('returns preview when requester owns the document', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-owned',
      userId: 'user-1',
      kind: DocumentKind.PRIMARY,
      previewHtml: '<p>Owner preview</p>',
    });

    const result = await service.getPreviewHtml({
      userId: 'user-1',
      documentId: 'doc-owned',
    });

    expect(result).toEqual({ html: '<p>Owner preview</p>' });
  });

  it('throws ForbiddenException when a user requests another user primary document', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-foreign',
      userId: 'user-owner',
      kind: DocumentKind.PRIMARY,
      previewHtml: '<p>Private</p>',
    });

    await expect(
      service.getPreviewHtml({
        userId: 'user-intruder',
        documentId: 'doc-foreign',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows reference document preview for any authenticated user', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-reference',
      userId: null,
      kind: DocumentKind.REFERENCE,
      previewHtml: '<p>Reference preview</p>',
    });

    const result = await service.getPreviewHtml({
      userId: 'user-2',
      documentId: 'doc-reference',
    });

    expect(result).toEqual({ html: '<p>Reference preview</p>' });
  });

  it('throws NotFoundException when document does not exist', async () => {
    prisma.document.findUnique.mockResolvedValue(null);

    await expect(
      service.getPreviewHtml({
        userId: 'user-1',
        documentId: 'missing-doc',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists reference documents with chunk counts', async () => {
    prisma.document.findMany.mockResolvedValue([
      {
        id: 'ref-1',
        filename: 'reference_document.docx',
        createdAt: new Date('2026-05-24T00:00:00.000Z'),
        _count: { chunks: 42 },
      },
    ]);

    const refs = await service.listReferences();

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      id: 'ref-1',
      filename: 'reference_document.docx',
      chunkCount: 42,
    });
  });
});
