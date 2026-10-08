// Constantes e vocabulários controlados. Strings validadas aqui (em vez de enums do banco)
// para manter o schema portável entre SQLite e PostgreSQL.

export const DEMO_BANNER = "MODO DEMONSTRAÇÃO — DADOS FICTÍCIOS";
export const DEMO_LABEL = "DADOS DE DEMONSTRAÇÃO";
export const NO_DATA = "Dado não disponível";
export const AWAITING_SOURCE = "Aguardando atualização da fonte oficial.";
export const INSUFFICIENT_LABEL = "Dados insuficientes para avaliação.";

export const ROLES = ["USER", "MODERATOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const FACT_CATEGORIES = [
  "VOTACAO",
  "PROJETO",
  "GASTO",
  "PRESENCA",
  "EMENDA",
  "COMISSAO",
  "PATRIMONIO",
  "ELEICAO",
  "PROCESSO",
  "TRANSPARENCIA",
  "OUTROS",
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

export const FACT_CATEGORY_LABEL: Record<FactCategory, string> = {
  VOTACAO: "Participação em votação",
  PROJETO: "Projetos",
  GASTO: "Gastos públicos",
  PRESENCA: "Presença",
  EMENDA: "Emendas",
  COMISSAO: "Comissões",
  PATRIMONIO: "Patrimônio",
  ELEICAO: "Informações eleitorais",
  PROCESSO: "Processos e situações públicas",
  TRANSPARENCIA: "Transparência",
  OUTROS: "Outros",
};

export const FACT_CATEGORY_ICON: Record<FactCategory, string> = {
  VOTACAO: "🗳️",
  PROJETO: "📄",
  GASTO: "💰",
  PRESENCA: "📅",
  EMENDA: "🏗️",
  COMISSAO: "🏛️",
  PATRIMONIO: "🏠",
  ELEICAO: "📊",
  PROCESSO: "⚖️",
  TRANSPARENCIA: "🔎",
  OUTROS: "📌",
};

// Etapas de processos tratadas SEPARADAMENTE. Investigação nunca é condenação.
export const LEGAL_STAGES = [
  "INVESTIGACAO",
  "INQUERITO",
  "PROCESSO",
  "DECISAO",
  "CONDENACAO",
  "CONDENACAO_DEFINITIVA",
  "ABSOLVICAO",
  "ARQUIVAMENTO",
  "CASSACAO",
  "INELEGIBILIDADE",
] as const;
export type LegalStage = (typeof LEGAL_STAGES)[number];

export const LEGAL_STAGE_LABEL: Record<LegalStage, string> = {
  INVESTIGACAO: "Investigação",
  INQUERITO: "Inquérito",
  PROCESSO: "Processo em andamento",
  DECISAO: "Decisão",
  CONDENACAO: "Condenação (não definitiva)",
  CONDENACAO_DEFINITIVA: "Condenação definitiva",
  ABSOLVICAO: "Absolvição",
  ARQUIVAMENTO: "Arquivamento",
  CASSACAO: "Cassação",
  INELEGIBILIDADE: "Inelegibilidade",
};

export const LEGAL_STAGE_NOTE: Record<LegalStage, string> = {
  INVESTIGACAO: "Apuração em curso. Não representa culpa nem condenação.",
  INQUERITO: "Fase de investigação formal. Não representa culpa nem condenação.",
  PROCESSO: "Ação em andamento. Não há decisão final.",
  DECISAO: "Decisão registrada na fonte; consulte o teor.",
  CONDENACAO: "Decisão condenatória ainda sujeita a recurso.",
  CONDENACAO_DEFINITIVA: "Decisão condenatória com trânsito em julgado.",
  ABSOLVICAO: "Decisão absolutória registrada na fonte.",
  ARQUIVAMENTO: "Procedimento arquivado, conforme a fonte.",
  CASSACAO: "Perda de mandato registrada na fonte.",
  INELEGIBILIDADE: "Restrição de elegibilidade registrada na fonte.",
};

export const COVERAGE_DOMAINS = [
  "PROJETOS",
  "VOTACOES",
  "PRESENCA",
  "COMISSOES",
  "GASTOS",
  "EMENDAS",
  "PATRIMONIO",
  "ELEICAO",
  "PROCESSOS",
] as const;
export type CoverageDomain = (typeof COVERAGE_DOMAINS)[number];

export const COVERAGE_DOMAIN_LABEL: Record<CoverageDomain, string> = {
  PROJETOS: "Projetos",
  VOTACOES: "Votações",
  PRESENCA: "Presença",
  COMISSOES: "Comissões",
  GASTOS: "Gastos",
  EMENDAS: "Emendas",
  PATRIMONIO: "Patrimônio",
  ELEICAO: "Informações eleitorais",
  PROCESSOS: "Processos",
};

export const POLITICIAN_STATUS_LABEL: Record<string, string> = {
  EM_EXERCICIO: "Em exercício",
  LICENCIADO: "Licenciado",
  AFASTADO: "Afastado",
  SUPLENTE: "Suplente",
  ENCERRADO: "Mandato encerrado",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};
export const CONFIDENCE_EMOJI: Record<string, string> = {
  ALTA: "🟢",
  MEDIA: "🟡",
  BAIXA: "🔴",
};

export const TICKET_STATUSES = ["ABERTO", "EM_ANALISE", "RESOLVIDO", "REJEITADO"] as const;

// Limites de votação popular / anti-abuso
export const VOTE_LIMITS = {
  maxChangesPerVote: 2, // quantas vezes um voto pode ser alterado
  maxVotesPerDay: 60,
  burstWindowMs: 60_000,
  burstMaxVotes: 15,
  minVotesForApproval: 5, // mínimo de votos para exibir percentual (demo); metodologia permite elevar
} as const;

export function scoreLabel(total: number | null | undefined): string {
  if (total == null) return "Sem nota";
  if (total >= 90) return "Excelente";
  if (total >= 80) return "Muito bom";
  if (total >= 65) return "Bom";
  if (total >= 50) return "Regular";
  if (total >= 35) return "Abaixo do esperado";
  return "Crítico";
}

// Cor semântica por faixa (não partidária): verde bom, amarelo atenção, vermelho baixo.
export function scoreTone(total: number | null | undefined): "good" | "warn" | "bad" | "none" {
  if (total == null) return "none";
  if (total >= 70) return "good";
  if (total >= 50) return "warn";
  return "bad";
}
