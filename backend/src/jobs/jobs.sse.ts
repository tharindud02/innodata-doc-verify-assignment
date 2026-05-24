import { Logger } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { JobStatus } from '@prisma/client';
import { JobsService } from './jobs.service';
import { JobDetailDto } from './dto/job-detail.dto';

interface SseMessage {
  data: string;
}

/**
 * Build an Observable<SseMessage> that polls the DB and emits a job snapshot
 * whenever the JSON has changed. Closes when the job reaches a terminal state.
 *
 * Polling interval is a deliberate choice for simplicity — see Commit 6
 * design doc in the README.
 */
export function buildJobStream(args: {
  jobs: JobsService;
  userId: string;
  jobId: string;
  logger: Logger;
  intervalMs?: number;
  maxDurationMs?: number;
}): Observable<SseMessage> {
  const interval = args.intervalMs ?? 500;
  const maxDuration = args.maxDurationMs ?? 10 * 60 * 1000; // safety cap: 10 min

  return new Observable<SseMessage>((subscriber: Subscriber<SseMessage>) => {
    let lastPayload = '';
    let stopped = false;
    const start = Date.now();

    const emit = async () => {
      if (stopped) return;
      try {
        const detail = await args.jobs.getJobDetail({
          userId: args.userId,
          jobId: args.jobId,
        });
        const payload = JSON.stringify(detail);
        if (payload !== lastPayload) {
          subscriber.next({ data: payload });
          lastPayload = payload;
        }
        if (
          detail.status === JobStatus.COMPLETED ||
          detail.status === JobStatus.FAILED
        ) {
          subscriber.complete();
          return;
        }
        if (Date.now() - start > maxDuration) {
          args.logger.warn(
            `SSE stream for job ${args.jobId} hit max duration; closing`,
          );
          subscriber.complete();
          return;
        }
      } catch (e) {
        args.logger.error(`SSE stream error for job ${args.jobId}: ${e}`);
        subscriber.error(e);
        return;
      }
      timer = setTimeout(emit, interval);
    };

    let timer = setTimeout(emit, 0); // emit initial snapshot ASAP

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  });
}