import { useEffect, useState } from "react";
import type { JobDetail } from "@/types/api";
import { api } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-session";
import { getApiErrorMessage } from "@/lib/api-error";

export function useJobStream(jobId: string | null) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    api.get<JobDetail>(`/jobs/${jobId}`).then(
      (r) => {
        if (!cancelled) setJob(r.data);
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Failed to load job"));
        }
      }
    );

    const token = getAuthToken();
    if (!token) return;

    const es = new EventSource(
      `/api/jobs/${jobId}/stream?token=${encodeURIComponent(token)}`
    );

    es.onmessage = (evt) => {
      try {
        const data: JobDetail = JSON.parse(evt.data);
        setJob(data);
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          es.close();
        }
      } catch {
        /* ignore malformed payloads */
      }
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED && !cancelled) {
        setError((prev) => prev ?? "Stream disconnected");
      }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [jobId]);

  return { job, error };
}
