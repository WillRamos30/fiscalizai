import { z } from "zod";
import type { AlgorithmConfig } from "./types";

export const algorithmPatchSchema = z.object({
  changeLog: z.string().trim().min(5, "Descreva a alteração.").max(2000),
  reason: z.string().trim().min(5, "Informe o motivo.").max(2000),
  activate: z.boolean().default(false),
  major: z.boolean().optional(),
  /** Reescala proporcionalmente os pesos dos indicadores ativos de cada pilar para fechar o peso do pilar. */
  rebalance: z.boolean().default(true),
  pillars: z.array(z.object({ code: z.string().max(10), weight: z.number().min(0).max(100) })).optional(),
  indicators: z
    .array(
      z.object({
        id: z.string().max(10),
        weight: z.number().min(0).max(100).optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "INFORMATIVE"]).optional(),
      }),
    )
    .optional(),
  params: z
    .object({
      minPeers: z.number().int().min(2).max(50),
      minPillarCoverage: z.number().min(0).max(1),
      minTechnicalCoverage: z.number().min(0).max(1),
      minTechnicalPillars: z.number().int().min(1).max(10),
      minMonths: z.number().min(0).max(48),
      minPopularVotes: z.number().int().min(1).max(10_000),
    })
    .partial()
    .optional(),
});

export type AlgorithmPatch = z.infer<typeof algorithmPatchSchema>;

/** Aplica o patch sobre uma cópia da configuração-base (não muta a original). */
export function patchConfig(base: AlgorithmConfig, patch: AlgorithmPatch): AlgorithmConfig {
  const cfg: AlgorithmConfig = JSON.parse(JSON.stringify(base));
  for (const p of patch.pillars ?? []) {
    const t = cfg.pillars.find((x) => x.code === p.code);
    if (!t) throw new Error(`Pilar inexistente: ${p.code}`);
    t.weight = p.weight;
  }
  for (const i of patch.indicators ?? []) {
    const t = cfg.indicators.find((x) => x.id === i.id);
    if (!t) throw new Error(`Indicador inexistente: ${i.id}`);
    if (i.status) t.status = i.status;
    if (i.weight !== undefined) t.weight = i.weight;
    if (t.status === "INFORMATIVE") t.weight = 0;
  }
  if (patch.params) Object.assign(cfg.params, patch.params);

  if (patch.rebalance) {
    for (const p of cfg.pillars) {
      const active = cfg.indicators.filter((i) => i.pillar === p.code && i.status === "ACTIVE");
      const sum = active.reduce((s, i) => s + i.weight, 0);
      if (active.length === 0 || p.weight === 0) continue;
      if (sum <= 0) {
        const eq = p.weight / active.length;
        for (const i of active) i.weight = eq;
      } else if (Math.abs(sum - p.weight) > 1e-9) {
        const f = p.weight / sum;
        for (const i of active) i.weight = Math.round(i.weight * f * 1000) / 1000;
        // ajuste de arredondamento no maior peso
        const diff = Math.round((p.weight - active.reduce((s, i) => s + i.weight, 0)) * 1000) / 1000;
        if (diff !== 0) active.sort((a, b) => b.weight - a.weight)[0].weight += diff;
      }
    }
  }
  return cfg;
}
