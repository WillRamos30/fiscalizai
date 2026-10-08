import { handle, json, notFound } from "@/lib/http";
import { prisma } from "@/lib/db";
import { findPoliticianRef } from "@/modules/politicians/lookup";
import { getPoliticianProfile } from "@/modules/politicians/queries";
import { INSUFFICIENT_LABEL } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const ref = await findPoliticianRef(prisma, id);
  const p = await getPoliticianProfile(prisma, ref.slug);
  if (!p) throw notFound();
  return json(
    {
      politicianId: ref.id,
      slug: ref.slug,
      score: p.score,
      message: p.score?.status === "INSUFFICIENT" || !p.score ? INSUFFICIENT_LABEL : null,
      components: p.components,
      delta12m: p.delta12m,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
});
