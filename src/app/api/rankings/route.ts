import { z } from "zod";
import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { getRanking } from "@/modules/ranking/queries";

const schema = z.object({
  office: z.string().max(40).optional(),
  state: z.string().length(2).optional(),
  party: z.string().max(10).optional(),
  period: z.enum(["mandato", "12m", "12m-1", "12m-2"]).optional(),
  sort: z.enum(["geral", "tecnico", "popular"]).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

// GET /api/rankings?office=deputado-federal&state=MG&sort=tecnico
export const GET = handle(async (req) => {
  const q = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const data = await getRanking(prisma, q);
  return json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
});
