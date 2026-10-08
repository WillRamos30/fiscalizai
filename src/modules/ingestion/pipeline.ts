// Pipeline ETL: COLETOR → VALIDAÇÃO → NORMALIZAÇÃO → BANCO.
// Idempotente (upsert por externalKey), isola falhas por registro e registra tudo em DataImport + AuditLog.

import type { Db } from "@/lib/db";
import { audit } from "@/modules/audit/audit";
import { normalizeText, slugify } from "@/lib/utils";
import { ensureReferenceData } from "./reference";
import { rawPolitician, type Collector, type RawPolitician } from "./types";

export type ImportError = { stage: "FETCH" | "VALIDATION" | "PERSIST"; message: string; record?: string };

export type ImportSummary = {
  importId: string;
  collector: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  recordsRead: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsFailed: number;
  durationMs: number;
  errors: ImportError[];
};

async function uniqueSlug(db: Db, base: string, uf: string | null | undefined, selfId?: string): Promise<string> {
  const candidates = [base, uf ? `${base}-${uf.toLowerCase()}` : null].filter(Boolean) as string[];
  for (const c of candidates) {
    const hit = await db.politician.findUnique({ where: { slug: c }, select: { id: true } });
    if (!hit || hit.id === selfId) return c;
  }
  for (let n = 2; n < 1000; n++) {
    const c = `${candidates[candidates.length - 1]}-${n}`;
    const hit = await db.politician.findUnique({ where: { slug: c }, select: { id: true } });
    if (!hit || hit.id === selfId) return c;
  }
  throw new Error("Não foi possível gerar slug único.");
}

/** Normaliza e grava UM político (e seus dados) numa transação. Retorna "created" | "updated". */
export async function upsertPolitician(db: Db, p: RawPolitician): Promise<"created" | "updated"> {
  const office = await db.office.findUnique({ where: { slug: p.officeSlug } });
  if (!office) throw new Error(`Cargo desconhecido: ${p.officeSlug}`);
  const state = p.stateUf ? await db.state.findUnique({ where: { uf: p.stateUf } }) : null;
  if (p.stateUf && !state) throw new Error(`UF desconhecida: ${p.stateUf}`);

  const sources = new Map((await db.source.findMany({ select: { id: true, slug: true } })).map((s) => [s.slug, s.id]));
  const src = (slug: string) => {
    const id = sources.get(slug);
    if (!id) throw new Error(`Fonte desconhecida: ${slug}`);
    return id;
  };

  let partyId: string | null = null;
  if (p.partyAcronym) {
    const party = await db.party.upsert({
      where: { acronym: p.partyAcronym },
      update: p.partyName ? { name: p.partyName } : {},
      create: { acronym: p.partyAcronym, name: p.partyName ?? p.partyAcronym, isDemo: p.isDemo },
    });
    partyId = party.id;
  }

  const existing = await db.politician.findUnique({ where: { externalKey: p.externalKey } });
  const slug = existing?.slug ?? (await uniqueSlug(db, slugify(p.politicalName), p.stateUf));
  const searchText = normalizeText(
    [p.fullName, p.politicalName, p.partyAcronym, p.partyName, office.name, p.stateUf, state?.name].filter(Boolean).join(" "),
  );

  const legSrc = src(p.mandate.sourceSlug);
  const trSrc = src("transparencia");
  const tseSrc = src("tse");
  const trbSrc = src("tribunais");

  await db.$transaction(
    async (tx) => {
      const data = {
        fullName: p.fullName,
        politicalName: p.politicalName,
        searchText,
        officeId: office.id,
        partyId,
        stateUf: p.stateUf ?? null,
        status: p.status,
        bio: p.bio ?? null,
        photoUrl: p.photoUrl ?? null,
        isDemo: p.isDemo,
        externalKey: p.externalKey,
      };
      const pol = existing
        ? await tx.politician.update({ where: { id: existing.id }, data })
        : await tx.politician.create({ data: { ...data, slug } });
      const pid = pol.id;

      // Estratégia de atualização: substitui os dados coletados do político (fonte é a verdade).
      await Promise.all([
        tx.mandate.deleteMany({ where: { politicianId: pid } }),
        tx.project.deleteMany({ where: { politicianId: pid } }),
        tx.committee.deleteMany({ where: { politicianId: pid } }),
        tx.attendance.deleteMany({ where: { politicianId: pid } }),
        tx.expense.deleteMany({ where: { politicianId: pid } }),
        tx.amendment.deleteMany({ where: { politicianId: pid } }),
        tx.asset.deleteMany({ where: { politicianId: pid } }),
        tx.election.deleteMany({ where: { politicianId: pid } }),
        tx.legalCase.deleteMany({ where: { politicianId: pid } }),
        tx.dataCoverage.deleteMany({ where: { politicianId: pid } }),
      ]);

      await tx.mandate.create({
        data: {
          politicianId: pid,
          officeId: office.id,
          stateUf: p.stateUf ?? null,
          partyId,
          legislature: p.mandate.legislature ?? null,
          startDate: p.mandate.startDate,
          endDate: p.mandate.endDate ?? null,
          isCurrent: !p.mandate.endDate || p.mandate.endDate > new Date(),
          status: p.status,
          sourceId: legSrc,
        },
      });
      if (p.projects.length)
        await tx.project.createMany({
          data: p.projects.map((x) => ({ ...x, resolvedAt: x.resolvedAt ?? null, url: x.url ?? null, externalId: x.externalId ?? null, politicianId: pid, sourceId: legSrc })),
        });
      if (p.committees.length)
        await tx.committee.createMany({
          data: p.committees.map((x) => ({ ...x, endDate: x.endDate ?? null, politicianId: pid, sourceId: legSrc })),
        });
      if (p.attendances.length)
        await tx.attendance.createMany({ data: p.attendances.map((x) => ({ ...x, politicianId: pid, sourceId: legSrc })) });
      if (p.expenses.length)
        await tx.expense.createMany({
          data: p.expenses.map((x) => ({ ...x, description: x.description ?? null, politicianId: pid, sourceId: legSrc })),
        });
      if (p.amendments.length)
        await tx.amendment.createMany({
          data: p.amendments.map((x) => ({ ...x, description: x.description ?? null, politicianId: pid, sourceId: trSrc })),
        });
      if (p.assets.length)
        await tx.asset.createMany({ data: p.assets.map((x) => ({ ...x, politicianId: pid, sourceId: tseSrc })) });
      if (p.elections.length)
        await tx.election.createMany({
          data: p.elections.map((x) => ({ ...x, stateUf: x.stateUf ?? null, votes: x.votes ?? null, politicianId: pid, sourceId: tseSrc })),
        });
      if (p.legalCases.length)
        await tx.legalCase.createMany({
          data: p.legalCases.map((x) => ({ ...x, description: x.description ?? null, politicianId: pid, sourceId: trbSrc, updatedAt: new Date() })),
        });
      if (p.coverage.length)
        await tx.dataCoverage.createMany({
          data: p.coverage.map((x) => ({
            politicianId: pid,
            domain: x.domain,
            available: x.available,
            completeness: x.completeness,
            lastUpdatedAt: x.lastUpdatedAt,
            sourceId: src(x.sourceSlug),
          })),
        });
    },
    { timeout: 60_000, maxWait: 20_000 },
  );

  return existing ? "updated" : "created";
}

export async function runImport(
  db: Db,
  collector: Collector,
  opts: { now?: Date; triggeredBy?: string; actorLabel?: string } = {},
): Promise<ImportSummary> {
  const t0 = Date.now();
  const now = opts.now ?? new Date();
  await ensureReferenceData(db, { demoSources: collector.id === "mock" });
  const primary = await db.source.findUnique({ where: { slug: collector.sourceSlugs[0] } });

  const imp = await db.dataImport.create({
    data: { collector: collector.id, sourceId: primary?.id ?? null, status: "RUNNING", triggeredBy: opts.triggeredBy ?? "system" },
  });

  const errors: ImportError[] = [];
  let read = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;

  try {
    const bundle = await collector.fetch({ now });
    read = bundle.politicians.length;
    for (const raw of bundle.politicians) {
      const label = String((raw as { externalKey?: string })?.externalKey ?? "?");
      const parsed = rawPolitician.safeParse(raw);
      if (!parsed.success) {
        failed++;
        errors.push({ stage: "VALIDATION", message: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), record: label });
        continue;
      }
      try {
        const r = await upsertPolitician(db, parsed.data);
        if (r === "created") created++;
        else updated++;
      } catch (e) {
        failed++;
        errors.push({ stage: "PERSIST", message: e instanceof Error ? e.message : String(e), record: label });
      }
    }
  } catch (e) {
    errors.push({ stage: "FETCH", message: e instanceof Error ? e.message : String(e) });
    failed = Math.max(failed, 1);
  }

  const status: ImportSummary["status"] =
    created + updated === 0 && failed > 0 ? "FAILED" : failed > 0 ? "PARTIAL" : "SUCCESS";
  const durationMs = Date.now() - t0;

  await db.dataImport.update({
    where: { id: imp.id },
    data: {
      status,
      finishedAt: new Date(),
      durationMs,
      recordsRead: read,
      recordsImported: created,
      recordsUpdated: updated,
      recordsFailed: failed,
      errors: JSON.stringify(errors.slice(0, 200)),
    },
  });

  if (status !== "FAILED") {
    await db.source.updateMany({
      where: { slug: { in: collector.sourceSlugs } },
      data: { lastConsultedAt: now, lastUpdatedAt: now, ...(collector.id === "mock" ? { connection: "DEMO" } : { connection: "ATIVA" }) },
    });
  }

  await audit(db, {
    actorId: opts.triggeredBy && opts.triggeredBy !== "system" ? opts.triggeredBy : null,
    actorLabel: opts.actorLabel ?? "sistema",
    action: "DATA_IMPORTED",
    entity: "DataImport",
    entityId: imp.id,
    after: { collector: collector.id, status, read, created, updated, failed },
  });

  return { importId: imp.id, collector: collector.id, status, recordsRead: read, recordsImported: created, recordsUpdated: updated, recordsFailed: failed, durationMs, errors };
}
