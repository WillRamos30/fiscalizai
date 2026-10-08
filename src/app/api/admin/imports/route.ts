import { z } from "zod";
import { badRequest, handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { getCollector } from "@/modules/ingestion/collectors";
import { runImport } from "@/modules/ingestion/pipeline";
import { NotConnectedError } from "@/modules/ingestion/types";

export const maxDuration = 60;

const schema = z.object({ collector: z.string().max(30).default("mock") });

export const POST = handle(async (req) => {
  const admin = await requireRole(prisma, req, ["ADMIN"]);
  const { collector: id } = await readJson(req, schema, 1_000);
  const collector = getCollector(id);
  if (!collector) throw badRequest(`Coletor desconhecido: ${id}`);
  
  try {
    const result = await runImport(prisma, collector, { now: new Date(), triggeredBy: admin.id, actorLabel: admin.email });
    return json({ success: true, result }, { status: 200 });
  } catch (e) {
    if (e instanceof NotConnectedError) return json({ error: e.message }, { status: 500 });
    throw e;
  }
});

