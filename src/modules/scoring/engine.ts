// Motor de pontuação do FiscalizaI — PURO (sem banco, sem rede, sem Date.now implícito).
//
// Regras de ouro implementadas aqui:
//  • Comparação SEMPRE entre pares do mesmo cargo (agrupamento por officeSlug).
//  • Ausência de dado ≠ zero: o indicador é excluído e o peso é redistribuído no pilar.
//  • Sem dados suficientes → status INSUFFICIENT, sem nota artificial.
//  • Faltas justificadas, gasto alto e investigação NÃO são penalizados automaticamente
//    (isso é definido pelas regras da configuração, não por ifs escondidos aqui).
//  • A avaliação popular entra apenas como pilar separado (peso máximo configurável).

import { clamp, round } from "@/lib/utils";
import type {
  AlgorithmConfig,
  ConfidenceLevel,
  IndicatorDef,
  IndicatorResult,
  PillarResult,
  PoliticianInput,
  ScoreResult,
} from "./types";

const EPS = 1e-9;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Percentil 0..1 de x entre `values` (que inclui x). Topo = 1, base = 0, todos iguais = 0,5. */
export function percentileRank(x: number, values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < x - EPS) below++;
    else if (Math.abs(v - x) <= EPS) equal++;
  }
  return (below + 0.5 * (equal - 1)) / (n - 1);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function fmt(v: number, display: IndicatorDef["display"], unit?: string): string {
  let body: string;
  if (display === "percent") body = `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  else if (display === "currency")
    body = v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  else body = v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (display === "number" && unit) body += ` ${unit}`;
  else if (display === "currency" && unit && !unit.startsWith("R$")) body += ` ${unit}`;
  else if (display === "currency") body += unit?.replace("R$", "") ?? "";
  return body;
}

function monthValue(input: PoliticianInput, ind: IndicatorDef, key: string): number | null {
  const raw = input.metrics[key];
  if (!isFiniteNumber(raw)) return null;
  if (ind.perMonth) return input.months > EPS ? raw / input.months : null;
  return raw;
}

/** Valor base de cada indicador para cada político (aplica por-mês e a métrica popular). */
function baseValues(inputs: PoliticianInput[], ind: IndicatorDef, config: AlgorithmConfig): (number | null)[] {
  return inputs.map((p) => {
    if (ind.metric === "popular_approval") {
      const total = p.popular.up + p.popular.down;
      return total >= config.params.minPopularVotes && total > 0 ? p.popular.up / total : null;
    }
    return monthValue(p, ind, ind.metric);
  });
}

type Scored = { normalized: number | null; raw: number | null; peerAvg: number | null; note?: string };

function scoreIndicator(
  ind: IndicatorDef,
  idx: number,
  group: PoliticianInput[],
  groupIdxInAll: number[],
  values: (number | null)[],
  config: AlgorithmConfig,
): Scored {
  const self = group[idx];
  const x = values[groupIdxInAll[idx]];
  const { minPeers } = config.params;
  const groupVals = groupIdxInAll.map((i) => values[i]).filter(isFiniteNumber);
  const rule = ind.rule;

  if (rule.kind === "categoryAnomaly") {
    const keys = new Set<string>();
    for (const p of group) for (const k of Object.keys(p.metrics)) if (k.startsWith(rule.prefix)) keys.add(k);
    let comparable = 0;
    let anomalous = 0;
    let any = false;
    for (const k of keys) {
      const mine = self.metrics[k];
      if (!isFiniteNumber(mine) || self.months <= EPS) continue;
      any = true;
      const peers = group
        .map((p) => (isFiniteNumber(p.metrics[k]) && p.months > EPS ? (p.metrics[k] as number) / p.months : null))
        .filter(isFiniteNumber);
      if (peers.length < minPeers) continue;
      const med = median(peers);
      if (med == null || med <= EPS) continue;
      comparable++;
      if (mine / self.months > rule.factor * med) anomalous++;
    }
    if (!any || comparable === 0) return { normalized: null, raw: null, peerAvg: null, note: "Sem categorias comparáveis." };
    const share = anomalous / comparable;
    return { normalized: 1 - share, raw: share, peerAvg: null, note: `${anomalous} de ${comparable} categorias acima de ${rule.factor}× a mediana dos pares` };
  }

  if (x == null) return { normalized: null, raw: null, peerAvg: null };

  const peerOthers = groupVals.length > 0 ? mean(groupVals) : null;

  switch (rule.kind) {
    case "percentile": {
      if (groupVals.length < Math.max(minPeers, 2)) return { normalized: null, raw: x, peerAvg: peerOthers, note: "Pares insuficientes para comparação." };
      const pr = percentileRank(x, groupVals);
      if (pr == null) return { normalized: null, raw: x, peerAvg: peerOthers };
      return { normalized: rule.invert ? 1 - pr : pr, raw: x, peerAvg: peerOthers };
    }
    case "ratio": {
      const r = clamp(x, 0, 1);
      return { normalized: rule.invert ? 1 - r : r, raw: x, peerAvg: peerOthers };
    }
    case "linear": {
      const span = rule.max - rule.min;
      const t = span === 0 ? (x >= rule.max ? 1 : 0) : clamp((x - rule.min) / span, 0, 1);
      return { normalized: rule.invert ? 1 - t : t, raw: x, peerAvg: peerOthers };
    }
    case "spendBand": {
      if (groupVals.length < Math.max(minPeers, 2)) return { normalized: null, raw: x, peerAvg: peerOthers, note: "Pares insuficientes para comparação." };
      const med = median(groupVals);
      if (med == null || med <= EPS) return { normalized: x <= EPS ? 1 : null, raw: x, peerAvg: peerOthers };
      const ratio = x / med;
      const s = ratio <= rule.okUntil ? 1 : ratio >= rule.zeroAt ? 0 : 1 - (ratio - rule.okUntil) / (rule.zeroAt - rule.okUntil);
      return { normalized: s, raw: x, peerAvg: peerOthers, note: `${ratio.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}× a mediana dos pares` };
    }
    case "countPenalty": {
      return { normalized: Math.max(0, 1 - rule.perUnit * x), raw: x, peerAvg: peerOthers };
    }
    case "info":
      return { normalized: null, raw: x, peerAvg: peerOthers };
  }
}

function confidenceLevel(score: number, c: AlgorithmConfig["params"]["confidence"]): ConfidenceLevel {
  if (score >= c.highAt) return "ALTA";
  if (score >= c.mediumAt) return "MEDIA";
  return "BAIXA";
}

/** Calcula a nota de TODOS os políticos informados. Cada um é comparado apenas aos pares do mesmo cargo. */
export function scoreAll(inputs: PoliticianInput[], config: AlgorithmConfig): ScoreResult[] {
  const results = new Map<string, ScoreResult>();
  const indicators = config.indicators.filter((i) => i.status !== "INACTIVE");
  const popularPillars = new Set(config.pillars.filter((p) => p.popular).map((p) => p.code));

  // Agrupa por cargo.
  const byOffice = new Map<string, number[]>();
  inputs.forEach((p, i) => {
    const arr = byOffice.get(p.officeSlug) ?? [];
    arr.push(i);
    byOffice.set(p.officeSlug, arr);
  });

  // Valores base por indicador (para todos).
  const valuesByInd = new Map<string, (number | null)[]>();
  for (const ind of indicators) valuesByInd.set(ind.id, baseValues(inputs, ind, config));

  for (const [, idxs] of byOffice) {
    const group = idxs.map((i) => inputs[i]);
    group.forEach((self, gi) => {
      const indResults: IndicatorResult[] = [];

      for (const ind of indicators) {
        const values = valuesByInd.get(ind.id)!;
        const s = scoreIndicator(ind, gi, group, idxs, values, config);
        const informative = ind.status === "INFORMATIVE";
        let normalized = s.normalized;
        let available = normalized != null;
        let info = "";

        if (informative) {
          available = s.raw != null;
          normalized = null;
          info = s.raw != null ? `${fmt(s.raw, ind.display, ind.unit)} (informativo, não pontua)` : "Dado não disponível";
        } else if (s.raw == null && s.normalized == null && ind.rule.kind !== "categoryAnomaly") {
          if (ind.missing === "SCORE_ZERO") {
            normalized = 0;
            available = true;
            info = "Dado ausente — pontuação zero neste indicador, conforme a regra de ausência.";
          } else {
            info = "Dado não disponível";
          }
        } else if (normalized == null) {
          info = s.note ?? "Dado não disponível";
        } else {
          const val = s.raw != null && ind.rule.kind !== "categoryAnomaly" ? fmt(s.raw, ind.display, ind.unit) : "";
          const peer = s.peerAvg != null && ["percentile", "spendBand"].includes(ind.rule.kind) ? `; média dos pares: ${fmt(s.peerAvg, ind.display, ind.unit)}` : "";
          const note = s.note ? `; ${s.note}` : "";
          info = `${val}${peer}${note}`.replace(/^;\s*/, "");
        }

        const weight = informative ? 0 : ind.weight;
        indResults.push({
          id: ind.id,
          pillar: ind.pillar,
          name: ind.name,
          weight,
          status: ind.status,
          available,
          rawValue: s.raw,
          normalized: normalized,
          points: !informative && normalized != null ? round(normalized * weight, 3) : null,
          peerAverage: s.peerAvg,
          info,
        });
      }

      // Pilares
      const warnings: string[] = [];
      const pillarResults: PillarResult[] = config.pillars.map((p) => {
        const inds = indResults.filter((r) => r.pillar === p.code && r.status === "ACTIVE");
        const totalW = inds.reduce((s, r) => s + r.weight, 0);
        const avail = inds.filter((r) => r.available && r.normalized != null);
        const availW = avail.reduce((s, r) => s + r.weight, 0);
        const coverage = totalW > 0 ? availW / totalW : 0;
        const isAvail = totalW > 0 && availW > 0 && coverage + EPS >= config.params.minPillarCoverage;
        const value = isAvail ? avail.reduce((s, r) => s + (r.normalized as number) * r.weight, 0) / availW : null;
        if (!isAvail && totalW > 0) warnings.push(`Pilar "${p.name}" sem dados suficientes — excluído do cálculo.`);
        return {
          code: p.code,
          name: p.name,
          weight: p.weight,
          available: isAvail,
          points: value != null ? round(value * p.weight, 3) : null,
          value: value != null ? round(value, 4) : null,
          coverage: round(coverage, 4),
          popular: popularPillars.has(p.code),
        };
      });

      const tech = pillarResults.filter((p) => !p.popular && p.weight > 0);
      const techTotalW = tech.reduce((s, p) => s + p.weight, 0);
      const techAvail = tech.filter((p) => p.available);
      const techAvailW = techAvail.reduce((s, p) => s + p.weight, 0);
      const techCoverage = techTotalW > 0 ? techAvailW / techTotalW : 0;

      // Cobertura de indicadores técnicos (para confiabilidade).
      const techInds = indResults.filter((r) => r.status === "ACTIVE" && !popularPillars.has(r.pillar));
      const techIndW = techInds.reduce((s, r) => s + r.weight, 0);
      const techIndAvailW = techInds.filter((r) => r.available).reduce((s, r) => s + r.weight, 0);
      const completeness = techIndW > 0 ? techIndAvailW / techIndW : 0;

      // Confiabilidade
      const domains = Object.values(self.coverage).filter((c) => c.available);
      const sourceQ = domains.length ? domains.reduce((s, c) => s + clamp(c.reliability, 0, 1), 0) / domains.length : 0;
      const fresh = domains.length
        ? domains.reduce((s, c) => s + clamp(1 - c.ageDays / config.params.confidence.freshnessDays, 0, 1), 0) / domains.length
        : 0;
      const period = clamp(self.months / config.params.confidence.fullPeriodMonths, 0, 1);
      const cw = config.params.confidence;
      const confidenceScore = round(cw.wCompleteness * completeness + cw.wSource * sourceQ + cw.wFreshness * fresh + cw.wPeriod * period, 4);

      const enoughMonths = self.months + EPS >= config.params.minMonths;
      if (!enoughMonths) warnings.push(`Período curto (${round(self.months, 1)} meses): mínimo de ${config.params.minMonths} meses.`);

      const sufficient =
        enoughMonths &&
        techCoverage + EPS >= config.params.minTechnicalCoverage &&
        techAvail.length >= config.params.minTechnicalPillars;

      const pop = self.popular;
      const popTotal = pop.up + pop.down;
      const popularApproval = popTotal >= config.params.minPopularVotes && popTotal > 0 ? pop.up / popTotal : null;

      let total: number | null = null;
      let technical: number | null = null;
      if (sufficient) {
        const allAvail = pillarResults.filter((p) => p.available && p.weight > 0);
        const aw = allAvail.reduce((s, p) => s + p.weight, 0);
        total = round((allAvail.reduce((s, p) => s + (p.points as number), 0) / aw) * 100, 2);
        technical = round((techAvail.reduce((s, p) => s + (p.points as number), 0) / techAvailW) * 100, 2);
      } else {
        warnings.push("Dados insuficientes para avaliação.");
      }

      results.set(self.id, {
        politicianId: self.id,
        status: sufficient ? "OK" : "INSUFFICIENT",
        total,
        technical,
        popularApproval: popularApproval != null ? round(popularApproval, 4) : null,
        popularVotes: popTotal,
        confidence: sufficient ? confidenceLevel(confidenceScore, cw) : "BAIXA",
        confidenceScore,
        coverage: round(completeness, 4),
        pillars: pillarResults,
        indicators: indResults,
        warnings,
      });
    });
  }

  return inputs.map((p) => results.get(p.id)!).filter(Boolean);
}
