import { useEffect, useState } from "react";
import type { JobDetail } from "@/types/api";
import { api } from "@/lib/api";

export function useJobStream(jobId: string | null) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    // 1. Fetch current snapshot - supports page refresh mid-processing
    api.get<JobDetail>(`/jobs/${jobId}`).then(
      (r) => !cancelled && setJob(r.data),
      (e) => !cancelled && setError(e.message)
    );

    // 2. Subscribe to live updates via SSE.
    // EventSource can't send custom headers, so token goes in the query string.
    const token = localStorage.getItem("token");
    const es = new EventSource(`/api/jobs/${jobId}/stream?token=${token}`);

    es.onmessage = (evt) => {
      try {
        const data: JobDetail = JSON.parse(evt.data);
        setJob(data);
        if (data.status === "COMPLETED" || data.status === "FAILED") es.close();
      } catch {
        /* ignore malformed payloads */
      }
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setError("Stream disconnected");
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [jobId]);

  return { job, error };
}