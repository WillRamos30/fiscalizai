import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { listJobs } from "@/modules/jobs/runner";

export const GET = handle(async (req) => {
  await requireRole(prisma, req, ["ADMIN", "MODERATOR"]);
  return json({ jobs: listJobs() });
});
