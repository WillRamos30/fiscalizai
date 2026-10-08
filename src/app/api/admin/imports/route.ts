import { z } from "zod";
import { badRequest, handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { getCollector } from "@/modules/ingestion/collectors";
import { runFullSync } from "@/modules/ingestion/sync";
import { NotConnectedError } from "@/modules/ingestion/types";
import { enqueueJob } from "@/modules/jobs/runner";

const schema = z.object({ collector: z.string().max(30).default("mock") });

// Dispara importação + fatos + recálculo em segundo plano (202).
export const POST = handle(async (req) => {
  const admin = await requireRole(prisma, req, ["ADMIN"]);
  const { collector: id } = await readJson(req, schema, 1_000);
  const collector = getCollector(id);
  if (!collector) throw badRequest(`Coletor desconhecido: ${id}`);
  const job = enqueueJob(`import:${id}`, async () => {
    try {
      return await runFullSync(prisma, collector, { triggeredBy: admin.id, actorLabel: admin.email });
    } catch (e) {
      if (e instanceof NotConnectedError) return { error: e.message };
      throw e;
    }
  });
  return json({ job }, { status: 202 });
});
