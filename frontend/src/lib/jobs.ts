import { api } from "@/lib/api";
import type { JobListItem } from "@/types/api";

export async function fetchUserJobs(): Promise<JobListItem[]> {
  const { data } = await api.get<JobListItem[]>("/jobs");
  return data;
}
