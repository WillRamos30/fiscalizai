import { z } from "zod";
import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { authenticate } from "@/modules/auth/service";
import { FACT_CATEGORIES } from "@/lib/constants";
import { listFacts } from "@/modules/facts/queries";

const schema = z.object({
  politician: z.string().max(120).optional(),
  category: z.enum(FACT_CATEGORIES).optional(),
  sort: z.enum(["recentes", "votados"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const GET = handle(async (req) => {
  const q = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const user = await authenticate(prisma, req);
  const data = await listFacts(prisma, { politicianSlug: q.politician, category: q.category, sort: q.sort, page: q.page, pageSize: q.pageSize }, user?.id);
  return json(data); // inclui voto do usuário: não cacheável em CDN
});
