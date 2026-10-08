import { z } from "zod";
import { badRequest, handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { findPoliticianRef } from "@/modules/politicians/lookup";
import { getComparison } from "@/modules/politicians/queries";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ with: z.string().min(1).max(300) });

// GET /api/politicians/:id/compare?with=slug-b,slug-c
export const GET = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ref = await findPoliticianRef(prisma, id);
  const q = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) throw badRequest("Informe ?with=slug1,slug2");
  const others = q.data.with.split(",").map((s) => s.trim()).filter(Boolean);
  const data = await getComparison(prisma, [ref.slug, ...others]);
  return json({ comparison: data }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
});
