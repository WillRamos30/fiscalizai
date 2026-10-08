// Geração de Fatos a partir dos dados coletados. Os textos são FACTUAIS e verificáveis
// (número + período + comparação com pares). Nunca viram opinião editorial:
//   ✗ "Fulano fez um excelente trabalho."
//   ✓ "Fulano apresentou 87 projetos no período, acima da média de 62 projetos entre seus pares."

import type { Db } from "@/lib/db";
import { COVERAGE_DOMAINS, LEGAL_STAGE_LABEL, LEGAL_STAGE_NOTE, type FactCategory, type LegalStage } from "@/lib/constants";
import { formatBRL, formatDateBR, formatNumber } from "@/lib/utils";
import { loadInputs } from "@/modules/scoring/metrics";
import { CURRENT_TERM_START } from "@/modules/scoring/run";
import { mean } from "@/modules/scoring/engine";

type Draft = {
  title: string;
  description: string;
  category: FactCategory;
  impact: "BAIXO" | "MEDIO" | "ALTO";
  sourceSlug: string;
  daysAgo: number;
};

function vsPeers(value: number, avg: number | null, fmt: (n: number) => string, noun: string): string {
  if (avg == null) return "";
  const rel = Math.abs(value - avg) / Math.max(Math.abs(avg), 1e-9);
  if (rel < 0.05) return `, em linha com a média de ${fmt(avg)} ${noun} entre seus pares`;
  return `, ${value > avg ? "acima" : "abaixo"} da média de ${fmt(avg)} ${noun} entre seus pares`;
}

export async function generateFacts(db: Db, opts: { now?: Date } = {}): Promise<{ created: number; updated: number }> {
  const now = opts.now ?? new Date();
  const period = { start: CURRENT_TERM_START, end: now };
  const inputs = await loadInputs(db, period, { now });
  const sources = new Map((await db.source.findMany()).map((s) => [s.slug, s]));
  const pols = new Map(
    (
      await db.politician.findMany({
        where: { id: { in: inputs.map((i) => i.id) } },
        include: { office: true, legalCases: true, committees: true, elections: true, assets: true, amendments: true },
      })
    ).map((p) => [p.id, p]),
  );

  const peerAvg = (office: string, key: string, perMonth = false) => {
    const vals = inputs
      .filter((i) => i.officeSlug === office && typeof i.metrics[key] === "number")
      .map((i) => ((i.metrics[key] as number) / (perMonth ? Math.max(i.months, 1) : 1)));
    return mean(vals);
  };

  let created = 0;
  let updated = 0;

  for (const inp of inputs) {
    const pol = pols.get(inp.id)!;
    const m = inp.metrics;
    const legSlug = pol.office.slug === "senador" ? "senado" : "camara";
    const drafts: Draft[] = [];
    const n0 = (v: number) => formatNumber(v, 0);
    const pct = (v: number) => `${formatNumber(v * 100, 1)}%`;
    let day = 4;

    if (typeof m.attendance_rate === "number") {
      drafts.push({
        category: "PRESENCA",
        title: "Presença em sessões",
        description: `Esteve presente em ${pct(m.attendance_rate)} das sessões deliberativas no período${vsPeers(m.attendance_rate, peerAvg(inp.officeSlug, "attendance_rate"), pct, "")}. Faltas justificadas: ${pct((m.justified_absence_rate as number) ?? 0)}; sem justificativa: ${pct((m.unjustified_absence_rate as number) ?? 0)}.`,
        impact: "MEDIO",
        sourceSlug: legSlug,
        daysAgo: (day += 5),
      });
    }
    if (typeof m.votes_participation === "number") {
      drafts.push({
        category: "VOTACAO",
        title: "Participação em votações",
        description: `Participou de ${pct(m.votes_participation)} das votações nominais no período${vsPeers(m.votes_participation, peerAvg(inp.officeSlug, "votes_participation"), pct, "")}.`,
        impact: "MEDIO",
        sourceSlug: legSlug,
        daysAgo: (day += 5),
      });
    }
    if (typeof m.projects_authored === "number") {
      const avg = peerAvg(inp.officeSlug, "projects_authored");
      drafts.push({
        category: "PROJETO",
        title: "Projetos apresentados",
        description: `Apresentou ${n0(m.projects_authored)} projetos no período${vsPeers(m.projects_authored, avg, n0, "projetos")}.`,
        impact: "MEDIO",
        sourceSlug: legSlug,
        daysAgo: (day += 5),
      });
      drafts.push({
        category: "PROJETO",
        title: "Projetos aprovados e transformados em norma",
        description: `${n0((m.projects_approved as number) ?? 0)} projetos de autoria aprovados no período, dos quais ${n0((m.projects_enacted as number) ?? 0)} transformados em norma${vsPeers((m.projects_approved as number) ?? 0, peerAvg(inp.officeSlug, "projects_approved"), n0, "aprovações")}.`,
        impact: "ALTO",
        sourceSlug: legSlug,
        daysAgo: (day += 5),
      });
    }
    if (typeof m.spend_total === "number" && inp.months > 0) {
      const perMonth = m.spend_total / inp.months;
      const avg = peerAvg(inp.officeSlug, "spend_total", true);
      drafts.push({
        category: "GASTO",
        title: "Gasto mensal com cota parlamentar",
        description: `Gasto médio de ${formatBRL(perMonth)} por mês no período${vsPeers(perMonth, avg, formatBRL, "por mês")}. Comparação informativa: gasto maior ou menor não indica, por si só, melhor ou pior uso do recurso.`,
        impact: "ALTO",
        sourceSlug: legSlug,
        daysAgo: (day += 5),
      });
    }
    if (typeof m.amendment_execution_rate === "number") {
      const committed = pol.amendments.filter((a) => a.status !== "CANCELADA").reduce((s, a) => s + a.amountCommitted, 0);
      const paid = pol.amendments.filter((a) => a.status !== "CANCELADA").reduce((s, a) => s + a.amountPaid, 0);
      drafts.push({
        category: "EMENDA",
        title: "Execução de emendas parlamentares",
        description: `Das emendas empenhadas (${formatBRL(committed)}), ${formatBRL(paid)} foram pagas (${pct(m.amendment_execution_rate)})${vsPeers(m.amendment_execution_rate, peerAvg(inp.officeSlug, "amendment_execution_rate"), pct, "")}.`,
        impact: "ALTO",
        sourceSlug: "transparencia",
        daysAgo: (day += 5),
      });
    }
    if (typeof m.committee_score === "number") {
      const act = pol.committees.filter((c) => !c.endDate);
      drafts.push({
        category: "COMISSAO",
        title: "Participação em comissões",
        description: `Integra ${act.length} comissão(ões): ${act.map((c) => `${c.name} (${c.role.toLowerCase().replace("_", " ")})`).join("; ")}.`,
        impact: "BAIXO",
        sourceSlug: legSlug,
        daysAgo: (day += 5),
      });
    }
    for (const c of pol.legalCases) {
      const stage = c.stage as LegalStage;
      drafts.push({
        category: "PROCESSO",
        title: `Registro processual ${c.caseNumber}: ${LEGAL_STAGE_LABEL[stage] ?? c.stage}`,
        description: `Consta ${LEGAL_STAGE_LABEL[stage]?.toLowerCase() ?? c.stage} nº ${c.caseNumber} (${c.court}), com data de ${formatDateBR(c.date)}, ${c.isActive ? "situação vigente" : "situação encerrada"} conforme a fonte. ${LEGAL_STAGE_NOTE[stage] ?? ""}`,
        impact: "ALTO",
        sourceSlug: "tribunais",
        daysAgo: (day += 5),
      });
    }
    if (pol.assets.length > 0) {
      const latest = Math.max(...pol.assets.map((a) => a.year));
      const items = pol.assets.filter((a) => a.year === latest);
      drafts.push({
        category: "PATRIMONIO",
        title: `Declaração de bens (${latest})`,
        description: `Declaração de bens publicada na candidatura de ${latest}: ${items.length} item(ns), total declarado de ${formatBRL(items.reduce((s, a) => s + a.value, 0))}.`,
        impact: "BAIXO",
        sourceSlug: "tse",
        daysAgo: (day += 5),
      });
    }
    for (const e of pol.elections) {
      drafts.push({
        category: "ELEICAO",
        title: `Resultado eleitoral ${e.year}`,
        description: `${e.result === "ELEITO" ? "Eleito" : e.result === "SUPLENTE" ? "Suplente" : "Não eleito"} em ${e.year}${e.votes ? ` com ${formatNumber(e.votes, 0)} votos` : ""}. Prestação de contas de campanha: ${e.accountsStatus.toLowerCase().replace(/_/g, " ")}.`,
        impact: "BAIXO",
        sourceSlug: "tse",
        daysAgo: (day += 5),
      });
    }
    const availDomains = COVERAGE_DOMAINS.filter((d) => inp.coverage[d]?.available).length;
    drafts.push({
      category: "TRANSPARENCIA",
      title: "Disponibilidade de informações públicas",
      description: `${availDomains} de ${COVERAGE_DOMAINS.length} domínios de dados públicos estão disponíveis nas fontes oficiais para este político.${availDomains < COVERAGE_DOMAINS.length ? " Os demais constam como \"Aguardando atualização da fonte oficial\"." : ""}`,
      impact: "MEDIO",
      sourceSlug: legSlug,
      daysAgo: (day += 5),
    });

    for (const d of drafts) {
      const src = sources.get(d.sourceSlug);
      if (!src) continue;
      const date = new Date(now.getTime() - d.daysAgo * 86_400_000);
      const existing = await db.fact.findFirst({ where: { politicianId: inp.id, title: d.title } });
      const data = {
        description: d.description,
        category: d.category,
        impact: d.impact,
        sourceId: src.id,
        sourceUrl: src.officialUrl,
        collectedAt: src.lastUpdatedAt ?? now,
        periodStart: period.start,
        periodEnd: period.end,
        isDemo: pol.isDemo,
      };
      if (existing) {
        await db.fact.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await db.fact.create({ data: { ...data, politicianId: inp.id, title: d.title, date, status: "PUBLICADO" } });
        created++;
      }
    }
  }
  return { created, updated };
}
