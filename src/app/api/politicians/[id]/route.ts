import { handle, json, notFound } from "@/lib/http";
import { prisma } from "@/lib/db";
import { findPoliticianRef } from "@/modules/politicians/lookup";
import { getPoliticianProfile } from "@/modules/politicians/queries";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const ref = await findPoliticianRef(prisma, id);
  const profile = await getPoliticianProfile(prisma, ref.slug);
  if (!profile) throw notFound("Político não encontrado.");
  return json(profile, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
});
