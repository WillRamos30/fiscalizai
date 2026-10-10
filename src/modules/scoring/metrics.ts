// Extração de métricas: banco → Metrics/PoliticianInput para o motor de pontuação.
// Esta é a camada que sabe de onde cada dado vem. O motor em si é puro.
// Regra: domínio sem cobertura (DataCoverage.available = false ou ausente) ⇒ métrica NULL
// (nunca zero). "Sem dado" e "dado zero" são coisas diferentes.

import type { Db } from "@/lib/db";
import { COVERAGE_DOMAINS, type CoverageDomain } from "@/lib/constants";
import { clamp, monthsBetween } from "@/lib/utils";
import type { CoverageInfo, Metrics, PoliticianInput } from "./types";

export const SPEND_CATEGORIES = [
  "COTA_PARLAMENTAR",
  "PASSAGENS",
  "COMBUSTIVEL",
  "DIVULGACAO",
  "ESCRITORIO",
  "ALIMENTACAO",
] as const;

export type Period = { start: Date; end: Date };

const APPROVED = new Set(["APROVADO", "TRANSFORMADO_EM_NORMA"]);
const ENACTED = new Set(["TRANSFORMADO_EM_NORMA"]);
const LEADERSHIP = new Set(["PRESIDENTE", "VICE_PRESIDENTE", "RELATOR"]);
const FINAL_STAGES = new Set(["CONDENACAO_DEFINITIVA", "CASSACAO", "INELEGIBILIDADE"]);
const ONGOING_STAGES = new Set(["INVESTIGACAO", "INQUERITO", "PROCESSO", "DECISAO"]);
const FAVORABLE_STAGES = new Set(["ABSOLVICAO", "ARQUIVAMENTO"]);

function inRange(d: Date, p: Period): boolean {
  return d.getTime() >= p.start.getTime() && d.getTime() <= p.end.getTime();
}

function group<T extends { politicianId: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const a = m.get(r.politicianId);
    if (a) a.push(r);
    else m.set(r.politicianId, [r]);
  }
  return m;
}

export type LoadOptions = {
  now?: Date;
  /** Restringe a políticos de cargos ativos (padrão) ou a ids específicos. */
  politicianIds?: string[];
};

export async function loadInputs(db: Db, period: Period, opts: LoadOptions = {}): Promise<PoliticianInput[]> {
  const now = opts.now ?? new Date();

  const politicians = await db.politician.findMany({
    where: {
      office: { active: true },
      ...(opts.politicianIds ? { id: { in: opts.politicianIds } } : {}),
    },
    include: { office: true, mandates: true },
  });
  const ids = politicians.map((p) => p.id);
  if (ids.length === 0) return [];

  const idFilter = { politicianId: { in: ids } };
  const [projects, committees, attendances, expenses, amendments, assets, elections, legals, coverages, facts] =
    await Promise.all([
      db.project.findMany({ where: idFilter }),
      db.committee.findMany({ where: idFilter }),
      db.attendance.findMany({ where: { ...idFilter, periodStart: { gte: period.start, lte: period.end } } }),
      db.expense.findMany({ where: idFilter }),
      db.amendment.findMany({
        where: { ...idFilter, year: { gte: period.start.getUTCFullYear(), lte: period.end.getUTCFullYear() } },
      }),
      db.asset.findMany({ where: idFilter }),
      db.election.findMany({ where: idFilter }),
      db.legalCase.findMany({ where: idFilter }),
      db.dataCoverage.findMany({ where: idFilter, include: { source: true } }),
      db.fact.findMany({
        where: { ...idFilter, status: "PUBLICADO", date: { gte: period.start, lte: period.end } },
        select: { politicianId: true, votesUp: true, votesDown: true },
      }),
    ]);

  const gProjects = group(projects);
  const gCommittees = group(committees);
  const gAtt = group(attendances);
  const gExp = group(expenses);
  const gAmd = group(amendments);
  const gAssets = group(assets);
  const gElec = group(elections);
  const gLegal = group(legals);
  const gCov = group(coverages);
  const gFacts = group(facts);

  const inputs: PoliticianInput[] = [];

  for (const pol of politicians) {
    // meses de mandato dentro do período
    let months = 0;
    for (const m of pol.mandates) {
      const s = new Date(Math.max(m.startDate.getTime(), period.start.getTime()));
      const e = new Date(Math.min((m.endDate ?? period.end).getTime(), period.end.getTime()));
      if (e > s) months += monthsBetween(s, e);
    }

    // cobertura por domínio
    const coverage: Record<string, CoverageInfo> = {};
    const covRows = gCov.get(pol.id) ?? [];
    for (const d of COVERAGE_DOMAINS) {
      const row = covRows.find((c) => c.domain === d);
      coverage[d] = row
        ? {
            available: row.available,
            completeness: row.completeness,
            ageDays: Math.max(0, (now.getTime() - row.lastUpdatedAt.getTime()) / 86_400_000),
            reliability: row.source?.reliability ?? 0.5,
          }
        : { available: false, completeness: 0, ageDays: 9999, reliability: 0 };
    }
    const has = (d: CoverageDomain) => coverage[d].available;

    const metrics: Metrics = {};

    // ── Projetos ──
    const projs = gProjects.get(pol.id) ?? [];
    if (has("PROJETOS")) {
      const authored = projs.filter((p) => p.role === "AUTOR" && inRange(p.presentedAt, period));
      const reports = projs.filter((p) => p.role === "RELATOR" && inRange(p.presentedAt, period));
      const resolvedIn = (p: (typeof projs)[number]) => inRange(p.resolvedAt ?? p.presentedAt, period);
      const authoredAll = projs.filter((p) => p.role === "AUTOR");
      metrics.projects_authored = authored.length;
      metrics.projects_weighted = authored.reduce((s, p) => s + p.relevance, 0);
      metrics.projects_approved = authoredAll.filter((p) => APPROVED.has(p.status) && resolvedIn(p)).length;
      metrics.projects_enacted = authoredAll.filter((p) => ENACTED.has(p.status) && resolvedIn(p)).length;
      metrics.reports_count = reports.length;
      metrics.reports_result_rate = reports.length
        ? reports.filter((p) => APPROVED.has(p.status)).length / reports.length
        : null;
    }

    // ── Comissões ──
    if (has("COMISSOES")) {
      const act = (gCommittees.get(pol.id) ?? []).filter(
        (c) => c.startDate <= period.end && (c.endDate ?? period.end) >= period.start,
      );
      metrics.committee_score = act.length + act.filter((c) => LEADERSHIP.has(c.role)).length;
    }

    // ── Presença / votações ──
    const att = gAtt.get(pol.id) ?? [];
    const sum = (f: (a: (typeof att)[number]) => number) => att.reduce((s, a) => s + f(a), 0);
    const sessions = sum((a) => a.sessionsTotal);
    if (has("PRESENCA") && sessions > 0) {
      metrics.attendance_rate = sum((a) => a.sessionsPresent) / sessions;
      metrics.unjustified_absence_rate = sum((a) => a.absencesUnjustified) / sessions;
      metrics.justified_absence_rate = sum((a) => a.absencesJustified) / sessions;
      metrics.debates = sum((a) => a.debates);
    }
    const votesTotal = sum((a) => a.votesTotal);
    if (has("VOTACOES") && votesTotal > 0) {
      metrics.votes_participation = sum((a) => a.votesParticipated) / votesTotal;
    }

    // ── Gastos ──
    const exps = (gExp.get(pol.id) ?? []).filter((e) => inRange(e.date, period));
    if (has("GASTOS")) {
      const total = exps.reduce((s, e) => s + e.amount, 0);
      metrics.spend_total = total;
      for (const c of SPEND_CATEGORIES) {
        metrics[`spend_cat:${c}`] = exps.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0);
      }
      if (months >= 12) {
        const mid = new Date(period.end.getTime() - 6 * 30.4375 * 86_400_000);
        const prevStart = new Date(period.end.getTime() - 12 * 30.4375 * 86_400_000);
        const last6 = exps.filter((e) => e.date > mid).reduce((s, e) => s + e.amount, 0);
        const prev6 = exps.filter((e) => e.date > prevStart && e.date <= mid).reduce((s, e) => s + e.amount, 0);
        metrics.spend_trend = prev6 > 0 ? last6 / prev6 : null;
      }
      if (has("PROJETOS") && total > 0 && metrics.projects_weighted != null) {
        const out =
          (metrics.projects_weighted ?? 0) +
          2 * (metrics.projects_approved ?? 0) +
          3 * (metrics.projects_enacted ?? 0) +
          (metrics.reports_count ?? 0);
        metrics.efficiency = out / (total / 100_000);
      }
    }

    // ── Emendas ──
    if (has("EMENDAS")) {
      const am = (gAmd.get(pol.id) ?? []).filter((a) => a.status !== "CANCELADA");
      const committed = am.reduce((s, a) => s + a.amountCommitted, 0);
      metrics.amendment_execution_rate = committed > 0 ? clamp(am.reduce((s, a) => s + a.amountPaid, 0) / committed, 0, 1) : null;
    }

    // ── Transparência ──
    const availableDomains = COVERAGE_DOMAINS.filter((d) => coverage[d].available).length;
    metrics.domain_availability = availableDomains / COVERAGE_DOMAINS.length;
    metrics.data_freshness =
      COVERAGE_DOMAINS.reduce((s, d) => s + (coverage[d].available ? clamp(1 - coverage[d].ageDays / 180, 0, 1) : 0), 0) /
      COVERAGE_DOMAINS.length;
    metrics.assets_declared = has("PATRIMONIO") && (gAssets.get(pol.id) ?? []).length > 0 ? 1 : 0;
    const elec = gElec.get(pol.id) ?? [];
    const latestElec = elec.sort((a, b) => b.year - a.year)[0];
    metrics.electoral_info = latestElec
      ? 0.5 + (["APROVADAS", "APROVADAS_RESSALVAS"].includes(latestElec.accountsStatus) ? 0.5 : 0)
      : 0;
    // consistência interna
    let checked = 0;
    let bad = 0;
    for (const a of att) {
      checked++;
      if (
        a.sessionsPresent > a.sessionsTotal ||
        a.votesParticipated > a.votesTotal ||
        a.absencesJustified + a.absencesUnjustified > a.sessionsTotal ||
        a.sessionsPresent < 0 ||
        a.sessionsTotal < 0
      )
        bad++;
    }
    for (const e of exps) {
      checked++;
      if (e.amount < 0) bad++;
    }
    metrics.inconsistency_rate = checked > 0 ? bad / checked : null;

    // ── Histórico e integridade ── (só se houve consulta processual)
    if (has("PROCESSOS")) {
      const cases = gLegal.get(pol.id) ?? [];
      const active = cases.filter((c) => c.isActive);
      metrics.legal_final_sanctions = active.filter((c) => FINAL_STAGES.has(c.stage)).length;
      metrics.legal_nonfinal_convictions = active.filter((c) => c.stage === "CONDENACAO").length;
      metrics.legal_ongoing = active.filter((c) => ONGOING_STAGES.has(c.stage)).length;
      metrics.legal_favorable = cases.filter((c) => FAVORABLE_STAGES.has(c.stage)).length;
    }

    // ── Popular ──
    const f = gFacts.get(pol.id) ?? [];
    const popular = { up: f.reduce((s, x) => s + x.votesUp, 0), down: f.reduce((s, x) => s + x.votesDown, 0) };

    inputs.push({
      id: pol.id,
      officeSlug: pol.office.slug,
      stateUf: pol.stateUf,
      months,
      metrics,
      coverage,
      popular,
    });
  }
  return inputs;
}

