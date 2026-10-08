import type { Db } from "@/lib/db";
import { notFound } from "@/lib/http";

/** Aceita id (cuid) ou slug. */
export async function findPoliticianRef(db: Db, idOrSlug: string) {
  const p = await db.politician.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, slug: true, politicalName: true },
  });
  if (!p) throw notFound("Político não encontrado.");
  return p;
}
