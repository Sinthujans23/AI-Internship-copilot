import { z } from "zod";
import type { Database } from "@/types/database";
import { jobSchema } from "@/lib/job-schema";

// Share allowed statuses between the form and API validation.
export const applicationStatuses = ["Applied", "Interview", "Rejected", "Offer"] as const;
export const applicationSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(200),
  role: z.string().trim().min(1, "Role is required.").max(200),
  status: z.enum(applicationStatuses).default("Applied"),
  job_text: z.string().trim().max(20000).default(""),
  job_analysis: jobSchema.optional(),
});
export const statusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(applicationStatuses),
});
export type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
