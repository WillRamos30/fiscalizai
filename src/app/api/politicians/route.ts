import { z } from "zod";
import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { listPoliticians } from "@/modules/politicians/queries";

const schema = z.object({
  q: z.string().max(80).optional(),
  office: z.string().max(40).optional(),
  state: z.string().length(2).optional(),
  party: z.string().max(10).optional(),
  sort: z.enum(["nome", "nota"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = handle(async (req) => {
  const q = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const data = await listPoliticians(prisma, q);
  return json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
});
