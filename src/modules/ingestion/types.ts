// ETL — contrato dos coletores e esquema de validação.
//
//   FONTE OFICIAL → COLETOR → VALIDAÇÃO → NORMALIZAÇÃO → BANCO → CÁLCULO DA NOTA → RANKING → INTERFACE
//
// Um coletor só precisa implementar `fetch()` devolvendo um `RawBundle`. Todo o resto
// (validação Zod, normalização, upsert idempotente, registro em DataImport, auditoria) é do pipeline.

import { z } from "zod";
import { COVERAGE_DOMAINS, LEGAL_STAGES } from "@/lib/constants";

const date = z.coerce.date();
const optDate = z.coerce.date().optional().nullable();

export const rawProject = z.object({
  externalId: z.string().optional(),
  title: z.string().min(3).max(300),
  type: z.enum(["PL", "PEC", "PLP", "PDL", "REQ", "OUTRO"]),
  role: z.enum(["AUTOR", "RELATOR"]).default("AUTOR"),
  status: z.enum(["APRESENTADO", "EM_TRAMITACAO", "APROVADO", "TRANSFORMADO_EM_NORMA", "ARQUIVADO"]),
  relevance: z.number().int().min(1).max(3).default(1),
  presentedAt: date,
  resolvedAt: optDate,
  url: z.string().url().optional().nullable(),
});

export const rawCommittee = z.object({
  name: z.string().min(2),
  role: z.enum(["TITULAR", "SUPLENTE", "PRESIDENTE", "VICE_PRESIDENTE", "RELATOR"]),
  startDate: date,
  endDate: optDate,
});

export const rawAttendance = z.object({
  periodStart: date,
  sessionsTotal: z.number().int().min(0),
  sessionsPresent: z.number().int().min(0),
  absencesJustified: z.number().int().min(0),
  absencesUnjustified: z.number().int().min(0),
  votesTotal: z.number().int().min(0),
  votesParticipated: z.number().int().min(0),
  debates: z.number().int().min(0).default(0),
});

export const rawExpense = z.object({
  category: z.string().min(2),
  description: z.string().optional().nullable(),
  amount: z.number(),
  date,
});

export const rawAmendment = z.object({
  year: z.number().int(),
  code: z.string(),
  description: z.string().optional().nullable(),
  amountCommitted: z.number().min(0),
  amountPaid: z.number().min(0),
  status: z.enum(["PROPOSTA", "EMPENHADA", "PAGA", "CANCELADA"]),
});

export const rawAsset = z.object({ year: z.number().int(), description: z.string(), value: z.number().min(0) });

export const rawElection = z.object({
  year: z.number().int(),
  officeSlug: z.string(),
  stateUf: z.string().length(2).optional().nullable(),
  result: z.enum(["ELEITO", "SUPLENTE", "NAO_ELEITO"]),
  votes: z.number().int().min(0).optional().nullable(),
  accountsStatus: z.enum(["APROVADAS", "APROVADAS_RESSALVAS", "DESAPROVADAS", "NAO_INFORMADO"]).default("NAO_INFORMADO"),
});

export const rawLegalCase = z.object({
  caseNumber: z.string(),
  court: z.string(),
  stage: z.enum(LEGAL_STAGES),
  description: z.string().optional().nullable(),
  date,
  isActive: z.boolean().default(true),
});

export const rawCoverage = z.object({
  domain: z.enum(COVERAGE_DOMAINS),
  available: z.boolean(),
  completeness: z.number().min(0).max(1).default(1),
  lastUpdatedAt: date,
  sourceSlug: z.string(),
});

export const rawPolitician = z.object({
  externalKey: z.string().min(3), // "mock:joao-exemplo"
  fullName: z.string().min(3),
  politicalName: z.string().min(2),
  officeSlug: z.string(),
  partyAcronym: z.string().optional().nullable(),
  partyName: z.string().optional().nullable(),
  stateUf: z.string().length(2).optional().nullable(),
  status: z.enum(["EM_EXERCICIO", "LICENCIADO", "AFASTADO", "SUPLENTE", "ENCERRADO"]).default("EM_EXERCICIO"),
  bio: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  isDemo: z.boolean().default(false),
  mandate: z.object({
    legislature: z.string().optional().nullable(),
    startDate: date,
    endDate: optDate,
    sourceSlug: z.string(),
  }),
  projects: z.array(rawProject).default([]),
  committees: z.array(rawCommittee).default([]),
  attendances: z.array(rawAttendance).default([]),
  expenses: z.array(rawExpense).default([]),
  amendments: z.array(rawAmendment).default([]),
  assets: z.array(rawAsset).default([]),
  elections: z.array(rawElection).default([]),
  legalCases: z.array(rawLegalCase).default([]),
  coverage: z.array(rawCoverage).default([]),
});

export type RawPolitician = z.infer<typeof rawPolitician>;
export type RawPoliticianInput = z.input<typeof rawPolitician>;

export type RawBundle = {
  /** Registros brutos; cada item é validado individualmente (um inválido não derruba o lote). */
  politicians: unknown[];
};

export type CollectorContext = { now: Date };

export interface Collector {
  id: string; // "mock" | "camara" | "senado" | ...
  label: string;
  /** Slugs de Source que este coletor alimenta. */
  sourceSlugs: string[];
  fetch(ctx: CollectorContext): Promise<RawBundle>;
}

export class NotConnectedError extends Error {
  constructor(collector: string) {
    super(`Coletor "${collector}" ainda não conectado à fonte oficial. Aguardando implementação.`);
    this.name = "NotConnectedError";
  }
}
