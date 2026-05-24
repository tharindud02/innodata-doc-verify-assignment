import { isAxiosError } from "axios";

interface NestErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError<NestErrorBody>(err)) return fallback;
  const msg = err.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return fallback;
}

export function getApiErrorStatus(err: unknown): number | undefined {
  if (!isAxiosError<NestErrorBody>(err)) return undefined;
  return err.response?.status;
}
