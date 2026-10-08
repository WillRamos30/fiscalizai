// ─────────────────────────────────────────────────────────────────────────────
// METODOLOGIA FiscalizaI — Algorithm v1.0 (configuração CENTRAL).
//
// TODOS os pesos, indicadores e parâmetros do algoritmo vivem aqui (e, em runtime, na tabela
// AlgorithmVersion). Nenhum peso é codificado fora deste arquivo. Para evoluir a metodologia
// (ex.: 40–60 indicadores) basta adicionar entradas em `indicators` — o motor não muda.
//
//   LEG01 = 5, LEG02 = 4, PRE01 = 5 ...
//
// Regra de consistência: a soma dos pesos dos indicadores ATIVOS de cada pilar deve ser igual
// ao peso do pilar, e a soma dos pesos dos pilares deve ser 100 (ver validateConfig).
// ─────────────────────────────────────────────────────────────────────────────

import type { AlgorithmConfig, IndicatorDef, PillarDef } from "./types";

export const ALGORITHM_VERSION = "v1.0";

const V = ALGORITHM_VERSION;
const SRC_LEG = "Câmara dos Deputados / Senado Federal (dados abertos)";

export const PILLARS_V1: PillarDef[] = [
  {
    code: "LEG",
    name: "Atuação Legislativa",
    icon: "🏛️",
    weight: 25,
    description: "Produção legislativa: projetos, relatorias, comissões, debates e participação em votações.",
  },
  {
    code: "PRE",
    name: "Presença e Participação",
    icon: "📅",
    weight: 15,
    description: "Presença em sessões e participação em votações. Faltas com justificativa legal não são penalizadas.",
  },
  {
    code: "EFE",
    name: "Efetividade",
    icon: "🎯",
    weight: 20,
    description: "Resultados verificáveis: projetos aprovados, transformados em norma, relatorias com resultado e emendas executadas.",
  },
  {
    code: "GAS",
    name: "Uso de Recursos Públicos",
    icon: "💰",
    weight: 15,
    description: "Gastos comparados aos pares do mesmo cargo, por categoria, evolução e eficiência relativa. Gastar mais não é automaticamente pior.",
  },
  {
    code: "TRA",
    name: "Transparência",
    icon: "🔎",
    weight: 10,
    description: "Disponibilidade, atualização e consistência das informações públicas, incluindo patrimônio e dados eleitorais.",
  },
  {
    code: "INT",
    name: "Histórico e Integridade Pública",
    icon: "📚",
    weight: 10,
    description: "Situação processual registrada em fontes oficiais, com cada etapa tratada separadamente. Investigação não é condenação.",
  },
  {
    code: "POP",
    name: "Avaliação Popular",
    icon: "👥",
    weight: 5,
    popular: true,
    description: "Votos 👍/👎 dos cidadãos nos acontecimentos. Peso máximo de 5%; nunca altera indicadores técnicos.",
  },
];

type IndInput = Omit<IndicatorDef, "version" | "pillar" | "status"> & {
  status?: IndicatorDef["status"];
};

function ind(i: IndInput): IndicatorDef {
  return { ...i, pillar: i.id.slice(0, 3), status: i.status ?? "ACTIVE", version: V };
}

export const INDICATORS_V1: IndicatorDef[] = [
  // ───────── Pilar 1 — Atuação Legislativa (25) ─────────
  ind({
    id: "LEG01",
    name: "Projetos apresentados por mês",
    description: "Quantidade de proposições de autoria do parlamentar no período, por mês de mandato.",
    weight: 5,
    formula: "projetos_autoria ÷ meses_de_mandato_no_período",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Percentil entre pares do mesmo cargo (maior = melhor).",
    missingDataRule: "Sem dado de projetos: indicador excluído e peso redistribuído no pilar.",
    metric: "projects_authored",
    perMonth: true,
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "projetos/mês",
    display: "number",
  }),
  ind({
    id: "LEG02",
    name: "Relatorias por mês",
    description: "Proposições em que o parlamentar atuou como relator.",
    weight: 4,
    formula: "relatorias ÷ meses_de_mandato_no_período",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Percentil entre pares do mesmo cargo.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "reports_count",
    perMonth: true,
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "relatorias/mês",
    display: "number",
  }),
  ind({
    id: "LEG03",
    name: "Participação em comissões",
    description: "Comissões das quais participou, com bônus para funções de liderança (presidência, vice, relatoria).",
    weight: 4,
    formula: "comissões_ativas + comissões_com_liderança",
    source: SRC_LEG,
    period: "Comissões ativas no período",
    scoringRule: "Percentil entre pares do mesmo cargo.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "committee_score",
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "pontos",
    display: "number",
  }),
  ind({
    id: "LEG04",
    name: "Participação em debates por mês",
    description: "Pronunciamentos e intervenções registrados em sessões e comissões.",
    weight: 3,
    formula: "debates ÷ meses_de_mandato_no_período",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Percentil entre pares do mesmo cargo.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "debates",
    perMonth: true,
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "debates/mês",
    display: "number",
  }),
  ind({
    id: "LEG05",
    name: "Participação em votações (entre pares)",
    description: "Taxa de participação em votações nominais, comparada aos pares.",
    weight: 4,
    formula: "votações_participadas ÷ votações_realizadas",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Percentil entre pares do mesmo cargo.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "votes_participation",
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),
  ind({
    id: "LEG06",
    name: "Projetos ponderados pela relevância",
    description: "Projetos de autoria ponderados por relevância (1 = local/pontual, 2 = regional/setorial, 3 = nacional/estrutural).",
    weight: 5,
    formula: "Σ(relevância dos projetos de autoria) ÷ meses_de_mandato_no_período",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Percentil entre pares do mesmo cargo. Critério de relevância descrito na metodologia.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "projects_weighted",
    perMonth: true,
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "pontos/mês",
    display: "number",
  }),

  // ───────── Pilar 2 — Presença e Participação (15) ─────────
  ind({
    id: "PRE01",
    name: "Presença em sessões",
    description: "Proporção de sessões deliberativas com presença registrada.",
    weight: 5,
    formula: "sessões_presentes ÷ sessões_realizadas",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Linear: 60% de presença = 0; 100% = nota máxima.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "attendance_rate",
    rule: { kind: "linear", min: 0.6, max: 1 },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),
  ind({
    id: "PRE02",
    name: "Faltas injustificadas",
    description: "Proporção de sessões com falta SEM justificativa legal. Faltas justificadas nunca são penalizadas.",
    weight: 5,
    formula: "faltas_injustificadas ÷ sessões_realizadas",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Linear invertido: 0% = nota máxima; 15% ou mais = 0.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "unjustified_absence_rate",
    rule: { kind: "linear", min: 0, max: 0.15, invert: true },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),
  ind({
    id: "PRE03",
    name: "Faltas justificadas (informativo)",
    description: "Proporção de sessões com falta justificada. Exibido para transparência; NÃO pontua.",
    weight: 0,
    formula: "faltas_justificadas ÷ sessões_realizadas",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Apenas informativo (peso 0).",
    missingDataRule: "Sem dado: exibido como indisponível.",
    status: "INFORMATIVE",
    metric: "justified_absence_rate",
    rule: { kind: "info" },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),
  ind({
    id: "PRE04",
    name: "Participação efetiva em votações",
    description: "Proporção das votações nominais em que o parlamentar registrou voto.",
    weight: 5,
    formula: "votações_participadas ÷ votações_realizadas",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Linear: 60% = 0; 100% = nota máxima.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "votes_participation",
    rule: { kind: "linear", min: 0.6, max: 1 },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),

  // ───────── Pilar 3 — Efetividade (20) ─────────
  ind({
    id: "EFE01",
    name: "Projetos aprovados por mês",
    description: "Projetos de autoria aprovados em alguma casa legislativa ou comissão terminativa.",
    weight: 5,
    formula: "projetos_aprovados ÷ meses_de_mandato_no_período",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Percentil entre pares do mesmo cargo.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "projects_approved",
    perMonth: true,
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "aprovados/mês",
    display: "number",
  }),
  ind({
    id: "EFE02",
    name: "Projetos transformados em norma",
    description: "Projetos de autoria que viraram lei, emenda constitucional ou outra norma.",
    weight: 6,
    formula: "projetos_transformados_em_norma ÷ meses_de_mandato_no_período",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Percentil entre pares do mesmo cargo.",
    missingDataRule: "Sem dado: excluído e peso redistribuído.",
    metric: "projects_enacted",
    perMonth: true,
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "normas/mês",
    display: "number",
  }),
  ind({
    id: "EFE03",
    name: "Relatorias com resultado",
    description: "Proporção das relatorias que tiveram parecer concluído ou proposição aprovada.",
    weight: 4,
    formula: "relatorias_com_resultado ÷ relatorias",
    source: SRC_LEG,
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Taxa direta (0–100%).",
    missingDataRule: "Sem relatorias no período: indicador excluído (não é penalizado).",
    metric: "reports_result_rate",
    rule: { kind: "ratio" },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),
  ind({
    id: "EFE04",
    name: "Execução de emendas",
    description: "Proporção do valor de emendas empenhadas que foi efetivamente pago.",
    weight: 5,
    formula: "valor_pago ÷ valor_empenhado",
    source: "Portal da Transparência / SIOP",
    period: "Emendas do período",
    scoringRule: "Taxa direta (0–100%).",
    missingDataRule: "Sem emendas no período: indicador excluído.",
    metric: "amendment_execution_rate",
    rule: { kind: "ratio" },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),

  // ───────── Pilar 4 — Uso de Recursos Públicos (15) ─────────
  ind({
    id: "GAS01",
    name: "Gasto mensal frente aos pares",
    description: "Gasto mensal com cota/verbas comparado à mediana dos pares do mesmo cargo. Gasto abaixo ou na faixa dos pares não é penalizado.",
    weight: 5,
    formula: "gasto_total ÷ meses  vs  mediana(gasto_mensal dos pares)",
    source: "Câmara dos Deputados (CEAP) / Senado (CEAPS)",
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Até 1,25× a mediana = nota máxima; 2,5× ou mais = 0; interpolação linear entre os dois.",
    missingDataRule: "Sem dado de gastos: excluído e peso redistribuído.",
    metric: "spend_total",
    perMonth: true,
    rule: { kind: "spendBand", okUntil: 1.25, zeroAt: 2.5 },
    missing: "EXCLUDE",
    unit: "R$/mês",
    display: "currency",
  }),
  ind({
    id: "GAS02",
    name: "Gastos anormais por categoria",
    description: "Fração das categorias de gasto muito acima do padrão dos pares (> 2× a mediana da categoria).",
    weight: 4,
    formula: "categorias_acima_de_2×mediana ÷ categorias_comparáveis",
    source: "Câmara dos Deputados (CEAP) / Senado (CEAPS)",
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "1 − fração de categorias anormais.",
    missingDataRule: "Sem dado de gastos: excluído e peso redistribuído.",
    metric: "spend_category",
    rule: { kind: "categoryAnomaly", prefix: "spend_cat:", factor: 2 },
    missing: "EXCLUDE",
    unit: "% de categorias",
    display: "percent",
  }),
  ind({
    id: "GAS03",
    name: "Evolução dos gastos",
    description: "Variação do gasto nos últimos 6 meses frente aos 6 anteriores. Só pontua com 12 meses ou mais de dados.",
    weight: 2,
    formula: "gasto_últimos_6_meses ÷ gasto_6_meses_anteriores",
    source: "Câmara dos Deputados (CEAP) / Senado (CEAPS)",
    period: "Últimos 12 meses do período",
    scoringRule: "Até 1,2× = nota máxima; 2× ou mais = 0.",
    missingDataRule: "Menos de 12 meses de dados: excluído.",
    metric: "spend_trend",
    rule: { kind: "linear", min: 1.2, max: 2, invert: true },
    missing: "EXCLUDE",
    unit: "×",
    display: "number",
  }),
  ind({
    id: "GAS04",
    name: "Eficiência relativa",
    description: "Resultado legislativo (projetos ponderados, aprovações, normas e relatorias) por R$ 100 mil gastos, comparado aos pares.",
    weight: 4,
    formula: "(projetos_ponderados + 2×aprovados + 3×normas + relatorias) ÷ (gasto_total ÷ 100.000)",
    source: "Câmara/Senado (produção e CEAP/CEAPS)",
    period: "Mandato atual (acumulado) ou ano de referência",
    scoringRule: "Percentil entre pares do mesmo cargo.",
    missingDataRule: "Sem dado de gasto ou produção: excluído.",
    metric: "efficiency",
    rule: { kind: "percentile" },
    missing: "EXCLUDE",
    unit: "pontos/R$100 mil",
    display: "number",
  }),

  // ───────── Pilar 5 — Transparência (10) ─────────
  ind({
    id: "TRA01",
    name: "Disponibilidade de informações",
    description: "Fração dos domínios de dados públicos (projetos, votações, presença, comissões, gastos, emendas, patrimônio, eleição, processos) disponíveis nas fontes oficiais.",
    weight: 3,
    formula: "domínios_disponíveis ÷ 9",
    source: "Todas as fontes do FiscalizaI",
    period: "Situação na data da última coleta",
    scoringRule: "Taxa direta.",
    missingDataRule: "Sempre calculável.",
    metric: "domain_availability",
    rule: { kind: "ratio" },
    missing: "SCORE_ZERO",
    unit: "%",
    display: "percent",
  }),
  ind({
    id: "TRA02",
    name: "Atualização dos dados",
    description: "Frescor médio das fontes. 100% = atualizado hoje; 0% = sem atualização há 180 dias ou mais.",
    weight: 2,
    formula: "média(1 − idade_em_dias ÷ 180) por domínio",
    source: "Todas as fontes do FiscalizaI",
    period: "Situação na data da última coleta",
    scoringRule: "Taxa direta.",
    missingDataRule: "Sem registro de atualização: nota zero neste indicador.",
    metric: "data_freshness",
    rule: { kind: "ratio" },
    missing: "SCORE_ZERO",
    unit: "%",
    display: "percent",
  }),
  ind({
    id: "TRA03",
    name: "Informações patrimoniais",
    description: "Existência de declaração de bens publicada na fonte eleitoral oficial (TSE).",
    weight: 2,
    formula: "1 se há declaração de bens publicada; 0 caso contrário",
    source: "TSE (DivulgaCand)",
    period: "Última eleição disputada",
    scoringRule: "Binário (1 ou 0).",
    missingDataRule: "Sem declaração publicada: nota zero neste indicador.",
    metric: "assets_declared",
    rule: { kind: "ratio" },
    missing: "SCORE_ZERO",
    unit: "",
    display: "percent",
  }),
  ind({
    id: "TRA04",
    name: "Informações eleitorais e prestação de contas",
    description: "Existência de registro eleitoral público e situação da prestação de contas de campanha.",
    weight: 1,
    formula: "0,5 (registro eleitoral) + 0,5 (contas aprovadas, com ou sem ressalvas)",
    source: "TSE",
    period: "Última eleição disputada",
    scoringRule: "Soma direta (0–1).",
    missingDataRule: "Sem registro: nota zero neste indicador.",
    metric: "electoral_info",
    rule: { kind: "ratio" },
    missing: "SCORE_ZERO",
    unit: "",
    display: "percent",
  }),
  ind({
    id: "TRA05",
    name: "Consistência dos dados públicos",
    description: "Proporção de registros públicos com inconsistências internas (ex.: presenças maiores que sessões).",
    weight: 2,
    formula: "registros_inconsistentes ÷ registros_verificados",
    source: "Verificações internas do FiscalizaI sobre as fontes",
    period: "Registros do período",
    scoringRule: "1 − taxa de inconsistência.",
    missingDataRule: "Sem registros verificáveis: excluído.",
    metric: "inconsistency_rate",
    rule: { kind: "ratio", invert: true },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),

  // ───────── Pilar 6 — Histórico e Integridade Pública (10) ─────────
  ind({
    id: "INT01",
    name: "Condenação definitiva, cassação ou inelegibilidade vigente",
    description: "Situações vigentes com trânsito em julgado ou efeito jurídico definitivo, conforme fonte oficial.",
    weight: 6,
    formula: "1 − 0,5 × quantidade de situações definitivas vigentes (mín. 0)",
    source: "Tribunais / TSE",
    period: "Situação vigente na data da coleta",
    scoringRule: "Cada situação definitiva vigente reduz 0,5 da nota do indicador.",
    missingDataRule: "Sem consulta processual disponível: indicador excluído (ausência de consulta NÃO é tratada como ausência de processos).",
    metric: "legal_final_sanctions",
    rule: { kind: "countPenalty", perUnit: 0.5 },
    missing: "EXCLUDE",
    unit: "situações",
    display: "number",
  }),
  ind({
    id: "INT02",
    name: "Condenação não definitiva",
    description: "Decisões condenatórias ainda sujeitas a recurso. Tratadas separadamente das condenações definitivas.",
    weight: 4,
    formula: "1 − 0,25 × quantidade de condenações não definitivas vigentes (mín. 0)",
    source: "Tribunais",
    period: "Situação vigente na data da coleta",
    scoringRule: "Cada condenação não definitiva vigente reduz 0,25 da nota do indicador.",
    missingDataRule: "Sem consulta processual disponível: indicador excluído.",
    metric: "legal_nonfinal_convictions",
    rule: { kind: "countPenalty", perUnit: 0.25 },
    missing: "EXCLUDE",
    unit: "decisões",
    display: "number",
  }),
  ind({
    id: "INT03",
    name: "Investigações, inquéritos e processos em andamento (informativo)",
    description: "Contagem exibida para transparência. Investigação, inquérito e processo em andamento NÃO equivalem a condenação e NÃO pontuam.",
    weight: 0,
    formula: "contagem de registros vigentes nas etapas: investigação, inquérito, processo, decisão",
    source: "Tribunais / TSE",
    period: "Situação vigente na data da coleta",
    scoringRule: "Apenas informativo (peso 0).",
    missingDataRule: "Sem consulta processual: exibido como indisponível.",
    status: "INFORMATIVE",
    metric: "legal_ongoing",
    rule: { kind: "info" },
    missing: "EXCLUDE",
    unit: "registros",
    display: "number",
  }),
  ind({
    id: "INT04",
    name: "Absolvições e arquivamentos (informativo)",
    description: "Contagem exibida para transparência. Não pontua.",
    weight: 0,
    formula: "contagem de absolvições + arquivamentos registrados",
    source: "Tribunais",
    period: "Histórico disponível",
    scoringRule: "Apenas informativo (peso 0).",
    missingDataRule: "Sem consulta processual: exibido como indisponível.",
    status: "INFORMATIVE",
    metric: "legal_favorable",
    rule: { kind: "info" },
    missing: "EXCLUDE",
    unit: "registros",
    display: "number",
  }),

  // ───────── Pilar 7 — Avaliação Popular (5) ─────────
  ind({
    id: "POP01",
    name: "Aprovação popular dos acontecimentos",
    description: "Percentual de votos 👍 entre todos os votos 👍/👎 nos acontecimentos do político. Exibida separadamente do desempenho técnico.",
    weight: 5,
    formula: "votos_positivos ÷ (votos_positivos + votos_negativos)",
    source: "Votos de usuários autenticados do FiscalizaI",
    period: "Todos os acontecimentos no período",
    scoringRule: "Taxa direta (0–100%). Peso máximo de 5% da nota total.",
    missingDataRule: "Menos votos que o mínimo configurado: indicador excluído (não é tratado como 0).",
    metric: "popular_approval",
    rule: { kind: "ratio" },
    missing: "EXCLUDE",
    unit: "%",
    display: "percent",
  }),
];

export const PARAMS_V1 = {
  minPeers: 3,
  minPillarCoverage: 0.5,
  minTechnicalCoverage: 0.6,
  minTechnicalPillars: 4,
  minMonths: 3,
  minPopularVotes: 5,
  popularMaxWeight: 5,
  confidence: {
    wCompleteness: 0.35,
    wSource: 0.15,
    wFreshness: 0.3,
    wPeriod: 0.2,
    highAt: 0.85,
    mediumAt: 0.6,
    freshnessDays: 180,
    fullPeriodMonths: 12,
  },
};

export function defaultConfig(): AlgorithmConfig {
  return {
    version: ALGORITHM_VERSION,
    name: "Metodologia FiscalizaI v1.0",
    pillars: PILLARS_V1.map((p) => ({ ...p })),
    indicators: INDICATORS_V1.map((i) => ({ ...i, rule: { ...i.rule } })),
    params: { ...PARAMS_V1, confidence: { ...PARAMS_V1.confidence } },
  };
}

export type ConfigIssue = { level: "error" | "warning"; message: string };

// Valida consistência de pesos e regras antes de aceitar uma nova versão.
export function validateConfig(config: AlgorithmConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const pillarTotal = config.pillars.reduce((s, p) => s + p.weight, 0);
  if (Math.abs(pillarTotal - 100) > 0.001) {
    issues.push({ level: "error", message: `A soma dos pesos dos pilares deve ser 100 (atual: ${pillarTotal}).` });
  }
  for (const p of config.pillars) {
    if (p.popular && p.weight > config.params.popularMaxWeight) {
      issues.push({
        level: "error",
        message: `A avaliação popular não pode exceder ${config.params.popularMaxWeight}% da nota (atual: ${p.weight}).`,
      });
    }
    const active = config.indicators.filter((i) => i.pillar === p.code && i.status === "ACTIVE");
    const sum = active.reduce((s, i) => s + i.weight, 0);
    if (active.length > 0 && Math.abs(sum - p.weight) > 0.001) {
      issues.push({
        level: "error",
        message: `Pilar ${p.code}: a soma dos pesos dos indicadores ativos (${sum}) deve ser igual ao peso do pilar (${p.weight}).`,
      });
    }
    if (active.length === 0 && p.weight > 0) {
      issues.push({ level: "error", message: `Pilar ${p.code} tem peso ${p.weight} mas nenhum indicador ativo.` });
    }
  }
  const ids = new Set<string>();
  for (const i of config.indicators) {
    if (ids.has(i.id)) issues.push({ level: "error", message: `Indicador duplicado: ${i.id}.` });
    ids.add(i.id);
    if (i.weight < 0) issues.push({ level: "error", message: `${i.id}: peso negativo.` });
    if (!config.pillars.some((p) => p.code === i.pillar)) {
      issues.push({ level: "error", message: `${i.id}: pilar ${i.pillar} inexistente.` });
    }
    if (i.status === "INFORMATIVE" && i.weight !== 0) {
      issues.push({ level: "error", message: `${i.id}: indicador informativo deve ter peso 0.` });
    }
  }
  return issues;
}
