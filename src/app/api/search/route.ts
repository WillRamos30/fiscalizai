import { z } from "zod";
import { handle, json, getClientIp } from "@/lib/http";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { tooMany } from "@/lib/http";
import { searchPoliticians } from "@/modules/politicians/queries";

const schema = z.object({ q: z.string().max(80), limit: z.coerce.number().int().min(1).max(20).optional() });

// GET /api/search?q=romeu — autocomplete (nome completo, nome político, partido, cargo, UF)
export const GET = handle(async (req) => {
  const ip = getClientIp(req);
  const rl = rateLimit(`search:${ip}`, 120, 60_000);
  if (!rl.allowed) throw tooMany(rl.retryAfterSec);
  const q = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const results = await searchPoliticians(prisma, q.q, q.limit ?? 8);
  return json({ results }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
});
