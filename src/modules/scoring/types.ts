// Tipos do motor de pontuação. O motor é PURO (sem I/O): recebe métricas e configuração,
// devolve notas. Isso o torna testável e separável como serviço no futuro.

export type Metrics = Record<string, number | null>;

export type ScoringRule =
  /** Percentil do valor entre os pares (maior = melhor, ou menor = melhor com invert). */
  | { kind: "percentile"; invert?: boolean }
  /** Valor já em 0..1 (ex.: taxa de presença). invert: 1 - valor. */
  | { kind: "ratio"; invert?: boolean }
  /** Interpolação linear entre min (0) e max (1). invert: 1 - resultado. */
  | { kind: "linear"; min: number; max: number; invert?: boolean }
  /** Gasto relativo à mediana dos pares: até okUntil×mediana = nota cheia; zeroAt×mediana = zero. */
  | { kind: "spendBand"; okUntil: number; zeroAt: number }
  /** Anomalia por categoria: fração de categorias acima de factor×mediana dos pares. */
  | { kind: "categoryAnomaly"; prefix: string; factor: number }
  /** 1 - perUnit×contagem (mínimo 0). */
  | { kind: "countPenalty"; perUnit: number }
  /** Apenas informativo: exibe o valor, não pontua. */
  | { kind: "info" };

export type IndicatorStatus = "ACTIVE" | "INACTIVE" | "INFORMATIVE";

export type MissingDataRule = "EXCLUDE" | "SCORE_ZERO";

export type IndicatorDef = {
  id: string; // LEG01
  pillar: string; // LEG
  name: string;
  description: string;
  weight: number; // pontos máximos do indicador na nota final (somam o peso do pilar)
  formula: string; // texto legível
  source: string;
  period: string;
  scoringRule: string; // texto legível da regra
  missingDataRule: string; // texto legível
  status: IndicatorStatus;
  version: string;
  // — parte executável —
  metric: string; // chave em Metrics
  perMonth?: boolean; // divide o valor pelos meses de mandato no período
  rule: ScoringRule;
  missing: MissingDataRule;
  unit?: string; // exibição: "projetos/mês", "%", "R$/mês"
  display?: "percent" | "number" | "currency";
};

export type PillarDef = {
  code: string;
  name: string;
  icon: string;
  weight: number;
  description: string;
  popular?: boolean; // pilar de avaliação popular (separado do desempenho técnico)
};

export type AlgorithmParams = {
  minPeers: number; // mínimo de pares para comparar (percentis/medianas)
  minPillarCoverage: number; // fração mínima do peso do pilar com dados para pontuar o pilar
  minTechnicalCoverage: number; // fração mínima do peso técnico com dados para emitir nota
  minTechnicalPillars: number;
  minMonths: number; // meses mínimos de mandato no período
  minPopularVotes: number; // votos mínimos para considerar avaliação popular
  popularMaxWeight: number; // teto do peso popular (metodologia: 5)
  confidence: {
    wCompleteness: number;
    wSource: number;
    wFreshness: number;
    wPeriod: number;
    highAt: number;
    mediumAt: number;
    freshnessDays: number; // idade (dias) em que o frescor chega a zero
    fullPeriodMonths: number;
  };
};

export type AlgorithmConfig = {
  version: string;
  name: string;
  pillars: PillarDef[];
  indicators: IndicatorDef[];
  params: AlgorithmParams;
};

export type CoverageInfo = {
  available: boolean;
  completeness: number; // 0..1
  ageDays: number; // dias desde a última atualização da fonte
  reliability: number; // 0..1
};

export type PoliticianInput = {
  id: string;
  officeSlug: string;
  stateUf: string | null;
  months: number; // meses de mandato dentro do período avaliado
  metrics: Metrics;
  coverage: Record<string, CoverageInfo>;
  popular: { up: number; down: number };
};

export type IndicatorResult = {
  id: string;
  pillar: string;
  name: string;
  weight: number;
  status: IndicatorStatus;
  available: boolean;
  rawValue: number | null; // valor usado no cálculo (já por mês, se aplicável)
  normalized: number | null; // 0..1
  points: number | null;
  peerAverage: number | null;
  info: string;
};

export type PillarResult = {
  code: string;
  name: string;
  weight: number;
  available: boolean;
  points: number | null;
  value: number | null; // 0..1
  coverage: number; // 0..1 do peso dos indicadores
  popular: boolean;
};

export type ConfidenceLevel = "ALTA" | "MEDIA" | "BAIXA";

export type ScoreResult = {
  politicianId: string;
  status: "OK" | "INSUFFICIENT";
  total: number | null;
  technical: number | null;
  popularApproval: number | null;
  popularVotes: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  coverage: number;
  pillars: PillarResult[];
  indicators: IndicatorResult[];
  warnings: string[];
};
