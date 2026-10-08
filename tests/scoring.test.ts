import { describe, it, expect } from "vitest";
import { scoreAll } from "@/modules/scoring/engine";
import { defaultConfig } from "@/modules/scoring/config";
import type { PoliticianInput } from "@/modules/scoring/types";

// Helper para criar inputs básicos
function makeInput(id: string, metrics: Record<string, number | null>, options?: Partial<PoliticianInput>): PoliticianInput {
  return {
    id,
    officeSlug: "deputado-federal",
    stateUf: "SP",
    months: 12,
    metrics,
    coverage: {
      "Câmara dos Deputados": { available: true, completeness: 1, ageDays: 1, reliability: 1 },
    },
    popular: { up: 10, down: 2 },
    ...options,
  };
}

describe("Scoring Engine", () => {
  const config = defaultConfig();
  // Precisamos de minPeers para indicadores comparativos (percentil, spendBand).
  // config.params.minPeers = 3;

  it("calculates 100% presence correctly (PRE01 and PRE04)", () => {
    const inputs = [
      makeInput("p1", { attendance_rate: 1, unjustified_absence_rate: 0, votes_participation: 1 }), // Perfeito
      makeInput("p2", { attendance_rate: 0.8, unjustified_absence_rate: 0.05, votes_participation: 0.8 }), // Medio
      makeInput("p3", { attendance_rate: 0.6, unjustified_absence_rate: 0.15, votes_participation: 0.6 }), // Ruim (no limite do zero)
      makeInput("p4", { attendance_rate: 0.5, unjustified_absence_rate: 0.2, votes_participation: 0.5 }), // Pior que o limite (deve ser 0)
    ];

    const results = scoreAll(inputs, config);
    expect(results).toHaveLength(4);

    const r1 = results.find(r => r.politicianId === "p1")!;
    const pre1 = r1.pillars.find(p => p.code === "PRE")!;
    // PRE01 (5), PRE02 (5), PRE04 (5) -> Todos devem ser 1 (nota maxima), valor final = 1
    expect(pre1.value).toBe(1);

    const r3 = results.find(r => r.politicianId === "p3")!;
    const pre3 = r3.pillars.find(p => p.code === "PRE")!;
    // PRE01 e PRE04 tem min=0.6, entao valor 0.6 -> nota 0
    // PRE02 tem max=0.15 (invertido), entao valor 0.15 -> nota 0
    expect(pre3.value).toBe(0);

    const r4 = results.find(r => r.politicianId === "p4")!;
    const pre4 = r4.pillars.find(p => p.code === "PRE")!;
    expect(pre4.value).toBe(0);
  });

  it("handles missing data gracefully by redistributing weight", () => {
    const inputs = [
      // Faltando PRE01 (peso 5)
      makeInput("p1", { attendance_rate: null, unjustified_absence_rate: 0, votes_participation: 1 }),
      makeInput("p2", { attendance_rate: 0.8, unjustified_absence_rate: 0.05, votes_participation: 0.8 }),
      makeInput("p3", { attendance_rate: 0.6, unjustified_absence_rate: 0.15, votes_participation: 0.6 }),
    ];

    const results = scoreAll(inputs, config);
    const r1 = results.find(r => r.politicianId === "p1")!;
    const pre1 = r1.pillars.find(p => p.code === "PRE")!;
    
    // PRE02 (5) = nota 1, PRE04 (5) = nota 1. 
    // Peso disponivel = 10 (cobertura 10/15 = ~0.66, que é >= minPillarCoverage de 0.5).
    // O valor do pilar deve ser (1*5 + 1*5) / 10 = 1.
    expect(pre1.available).toBe(true);
    expect(pre1.value).toBe(1);
    expect(pre1.coverage).toBeCloseTo(10 / 15, 3);
  });

  it("marks pillar as unavailable if coverage is below minPillarCoverage", () => {
    const inputs = [
      // Faltando PRE01 (5) e PRE02 (5). Só tem PRE04 (5).
      // Cobertura = 5/15 = 0.333 < 0.5
      makeInput("p1", { attendance_rate: null, unjustified_absence_rate: null, votes_participation: 1 }),
      makeInput("p2", { attendance_rate: 0.8, unjustified_absence_rate: 0.05, votes_participation: 0.8 }),
      makeInput("p3", { attendance_rate: 0.6, unjustified_absence_rate: 0.15, votes_participation: 0.6 }),
    ];

    const results = scoreAll(inputs, config);
    const r1 = results.find(r => r.politicianId === "p1")!;
    const pre1 = r1.pillars.find(p => p.code === "PRE")!;
    
    expect(pre1.available).toBe(false);
    expect(pre1.points).toBeNull();
  });

  it("handles extreme values in spending correctly (GAS01)", () => {
    const inputs = [
      makeInput("p-1", { spend_total: 1000 }), // ~ mediana
      makeInput("p0", { spend_total: 1000 }), // ~ mediana
      makeInput("p1", { spend_total: 1000 }), // ~ mediana
      makeInput("p2", { spend_total: 1000 }), // ~ mediana
      makeInput("p3", { spend_total: 1250 }), // 1.25x mediana -> ok (nota 1)
      makeInput("p4", { spend_total: 2500 }), // 2.5x mediana -> zero (nota 0)
      makeInput("p5", { spend_total: 3000 }), // > 2.5x mediana -> zero (nota 0)
    ];

    const results = scoreAll(inputs, config);
    
    // GAS01 é o identificador
    const getGas01 = (id: string) => {
      const res = results.find(r => r.politicianId === id)!;
      return res.indicators.find(i => i.id === "GAS01")!;
    };

    expect(getGas01("p1").normalized).toBeCloseTo(1, 5);
    expect(getGas01("p3").normalized).toBeCloseTo(1, 5);
    expect(getGas01("p4").normalized).toBeCloseTo(0, 5);
    expect(getGas01("p5").normalized).toBeCloseTo(0, 5);
  });

  it("handles extreme values in spend_category anomaly (GAS02)", () => {
    const inputs = [
      makeInput("p1", { "spend_cat:voo": 100, "spend_cat:hotel": 100, "spend_cat:taxi": 100 }), // Mediana
      makeInput("p2", { "spend_cat:voo": 100, "spend_cat:hotel": 100, "spend_cat:taxi": 100 }), // Mediana
      makeInput("p3", { "spend_cat:voo": 100, "spend_cat:hotel": 100, "spend_cat:taxi": 100 }), // Mediana
      // 2 categorias > 2x mediana (200). voo=250, hotel=300. taxi=100 (normal). 
      // 2 de 3 categorias sao anormais -> anomalia = 2/3. Nota = 1 - 2/3 = 1/3 = ~0.33
      makeInput("p4", { "spend_cat:voo": 250, "spend_cat:hotel": 300, "spend_cat:taxi": 100 }), 
    ];

    const results = scoreAll(inputs, config);
    
    const r4 = results.find(r => r.politicianId === "p4")!;
    const gas02 = r4.indicators.find(i => i.id === "GAS02")!;
    
    expect(gas02.rawValue).toBeCloseTo(2 / 3);
    expect(gas02.normalized).toBeCloseTo(1 / 3);
  });

  it("handles MISSING rules (SCORE_ZERO)", () => {
    const inputs = [
      // TRA01 (domain_availability) é missing: SCORE_ZERO. 
      makeInput("p1", { domain_availability: null }),
    ];

    // Precisamos desativar verificacoes que dropam p1 por falta de peers, ou garantir que TRA01 funciona sozinho
    const results = scoreAll(inputs, config);
    const r1 = results.find(r => r.politicianId === "p1")!;
    const tra01 = r1.indicators.find(i => i.id === "TRA01")!;
    
    expect(tra01.available).toBe(true); // Está disponível artificialmente
    expect(tra01.normalized).toBe(0); // Regra é SCORE_ZERO
    expect(tra01.points).toBe(0);
  });
});
