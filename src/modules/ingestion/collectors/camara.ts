// Coletor oficial da Câmara dos Deputados — API de Dados Abertos v2.
// Documentação: https://dadosabertos.camara.leg.br/swagger/api.html
//
// Coleta dados 100% REAIS e PÚBLICOS:
//  • Deputados federais em exercício
//  • Cota Parlamentar (CEAP / Despesas)
//  • Proposições de autoria (PL, PEC, PLP, PDL, REQ)
//  • Comissões e órgãos de atuação

import type { Collector, CollectorContext, RawBundle, RawPoliticianInput } from "../types";
import { prisma } from "@/lib/db";

export interface CamaraCollectorOptions {
  /** Limite de deputados a importar (default: 50; use 0 ou Infinity para todos os 513) */
  limit?: number;
  /** Filtro opcional por UFs (ex: ["SP", "RJ", "MG"]) */
  ufs?: string[];
  /** Requisições concorrentes simultâneas (default: 5) */
  concurrency?: number;
}

const BASE_URL = "https://dadosabertos.camara.leg.br/api/v2";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FiscalizaI-Plataforma/1.0 (+https://dadosabertos.camara.leg.br)",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function mapConcurrent<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 5): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function mapCamaraExpenseCategory(tipo: string): string {
  const t = tipo.toUpperCase();
  if (t.includes("COMBUSTÍVEIS") || t.includes("COMBUSTIVEL")) return "COMBUSTIVEL";
  if (t.includes("PASSAGEM") || t.includes("PASSAGENS") || t.includes("LOCOMOÇÃO") || t.includes("FRETAMENTO")) return "PASSAGENS";
  if (t.includes("DIVULGAÇÃO") || t.includes("DIVULGACAO")) return "DIVULGACAO";
  if (t.includes("ESCRITÓRIO") || t.includes("ESCRITORIO") || t.includes("TELEFONIA") || t.includes("POSTAIS")) return "ESCRITORIO";
  if (t.includes("ALIMENTAÇÃO") || t.includes("ALIMENTACAO") || t.includes("HOSPEDAGEM")) return "ALIMENTACAO";
  return "COTA_PARLAMENTAR";
}

function mapCamaraProjectType(sigla: string): "PL" | "PEC" | "PLP" | "PDL" | "REQ" | "OUTRO" {
  const s = sigla.toUpperCase();
  if (s === "PL") return "PL";
  if (s === "PEC") return "PEC";
  if (s === "PLP") return "PLP";
  if (s === "PDL" || s === "PDS") return "PDL";
  if (s === "REQ" || s === "RIC") return "REQ";
  return "OUTRO";
}

function mapCommitteeRole(titulo?: string): "TITULAR" | "SUPLENTE" | "PRESIDENTE" | "VICE_PRESIDENTE" | "RELATOR" {
  const t = (titulo || "").toUpperCase();
  if (t.includes("PRESIDENTE") && !t.includes("VICE")) return "PRESIDENTE";
  if (t.includes("VICE")) return "VICE_PRESIDENTE";
  if (t.includes("RELATOR")) return "RELATOR";
  if (t.includes("SUPLENTE")) return "SUPLENTE";
  return "TITULAR";
}

type DeputadoListItem = {
  id: number;
  uri: string;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  idLegislatura: number;
  urlFoto: string;
  email: string;
};

type DespesaItem = {
  ano: number;
  mes: number;
  tipoDespesa: string;
  dataDocumento: string;
  valorLiquido: number;
  valorDocumento: number;
  nomeFornecedor: string;
  cnpjCpfFornecedor: string;
};

type ProposicaoItem = {
  id: number;
  uri: string;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  dataApresentacao: string;
};

type OrgaoItem = {
  idOrgao: number;
  siglaOrgao: string;
  nomeOrgao: string;
  titulo: string;
  dataInicio: string;
  dataFim: string | null;
};

export class CamaraCollector implements Collector {
  id = "camara";
  label = "Câmara dos Deputados (Dados Abertos)";
  sourceSlugs = ["camara"];

  constructor(private options: CamaraCollectorOptions = {}) {}

  async fetch(ctx: CollectorContext): Promise<RawBundle> {
    console.log("▶ [CamaraCollector] Consultando API de Dados Abertos da Câmara dos Deputados...");

    // 1. Busca deputados em exercício na legislatura atual
    const listRes = await fetchJson<{ dados: DeputadoListItem[] }>(
      `${BASE_URL}/deputados?idLegislatura=57&ordem=ASC&ordenarPor=nome&itens=1000`
    );

    if (!listRes || !Array.isArray(listRes.dados) || listRes.dados.length === 0) {
      throw new Error("Não foi possível obter a lista de deputados da Câmara dos Deputados.");
    }

    let deputados = listRes.dados;

    if (this.options.ufs && this.options.ufs.length > 0) {
      const ufs = new Set(this.options.ufs.map((u) => u.toUpperCase()));
      deputados = deputados.filter((d) => ufs.has(d.siglaUf));
    }

    let limit =
      this.options.limit !== undefined
        ? this.options.limit
        : process.env.CAMARA_LIMIT
        ? parseInt(process.env.CAMARA_LIMIT, 10)
        : 50;

    if (limit > 0 && limit < deputados.length) {
      // Busca no banco os políticos já existentes para não repetir e sim preencher todos aos poucos
      const existing = await prisma.politician.findMany({
        where: { externalKey: { startsWith: "camara:" } },
        select: { externalKey: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' }
      });
      
      const existingKeys = new Set(existing.map((p) => p.externalKey));
      
      // Filtra os que AINDA NÃO ESTÃO no banco
      const faltantes = deputados.filter((d) => !existingKeys.has(`camara:${d.id}`));
      
      if (faltantes.length > 0) {
        // Se ainda tem deputados faltando, pega o próximo lote de inéditos
        deputados = faltantes.slice(0, limit);
      } else {
        // Se já puxou os 513, atualiza os 50 mais antigos (menor updatedAt)
        const oldestKeys = new Set(existing.slice(0, limit).map(p => p.externalKey));
        deputados = deputados.filter(d => oldestKeys.has(`camara:${d.id}`)).slice(0, limit);
      }
    }

    console.log(`▶ [CamaraCollector] Processando ${deputados.length} deputados reais...`);

    const concurrency = this.options.concurrency ?? 6;

    const politicians = await mapConcurrent(
      deputados,
      async (dep): Promise<RawPoliticianInput> => {
        // Busca paralela de despesas, proposições e órgãos para cada parlamentar
        const [despRes, propRes, orgRes] = await Promise.all([
          fetchJson<{ dados: DespesaItem[] }>(
            `${BASE_URL}/deputados/${dep.id}/despesas?idLegislatura=57&itens=100`
          ),
          fetchJson<{ dados: ProposicaoItem[] }>(
            `${BASE_URL}/proposicoes?idDeputadoAutor=${dep.id}&itens=50`
          ),
          fetchJson<{ dados: OrgaoItem[] }>(
            `${BASE_URL}/deputados/${dep.id}/orgaos`
          ),
        ]);

        // Mapeia despesas reais
        const expenses = (despRes?.dados ?? [])
          .map((d) => {
            const amount = Number(d.valorLiquido ?? d.valorDocumento ?? 0);
            if (amount <= 0 || isNaN(amount)) return null;
            const dateStr = d.dataDocumento || `${d.ano}-${String(d.mes || 1).padStart(2, "0")}-01`;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;

            return {
              category: mapCamaraExpenseCategory(d.tipoDespesa || "Outros"),
              description: [d.tipoDespesa, d.nomeFornecedor].filter(Boolean).join(" - ").slice(0, 400),
              amount,
              date,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);

        // Mapeia proposições reais
        const projects = (propRes?.dados ?? [])
          .map((p) => {
            const rawTitle = (p.ementa || `${p.siglaTipo} ${p.numero}/${p.ano}`).trim();
            const title = (rawTitle.length < 3 ? `Proposição ${rawTitle}` : rawTitle).slice(0, 300);
            const date = p.dataApresentacao ? new Date(p.dataApresentacao) : new Date(`${p.ano}-01-01`);
            const pType = mapCamaraProjectType(p.siglaTipo || "OUTRO");

            return {
              externalId: String(p.id),
              title,
              type: pType,
              role: "AUTOR" as const,
              status: "EM_TRAMITACAO" as const,
              relevance: pType === "PEC" ? 3 : pType === "PL" || pType === "PLP" ? 2 : 1,
              presentedAt: isNaN(date.getTime()) ? new Date("2023-02-01") : date,
              url: p.uri || null,
            };
          })
          .filter((p) => p.title.length >= 3);

        // Mapeia órgãos / comissões reais
        const committees = (orgRes?.dados ?? [])
          .map((o) => {
            const name = (o.nomeOrgao || o.siglaOrgao || "Comissão Parlamentar").trim().slice(0, 200);
            if (name.length < 2) return null;
            const sDate = o.dataInicio ? new Date(o.dataInicio) : new Date("2023-02-01");
            const eDate = o.dataFim ? new Date(o.dataFim) : null;

            return {
              name,
              role: mapCommitteeRole(o.titulo),
              startDate: isNaN(sDate.getTime()) ? new Date("2023-02-01") : sDate,
              endDate: eDate && !isNaN(eDate.getTime()) ? eDate : null,
            };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        // Cobertura de domínios públicos
        const coverage = [
          { domain: "PROJETOS" as const, available: projects.length > 0, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
          { domain: "GASTOS" as const, available: expenses.length > 0, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
          { domain: "COMISSOES" as const, available: committees.length > 0, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
          { domain: "PRESENCA" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
          { domain: "VOTACOES" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
          { domain: "EMENDAS" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
          { domain: "PATRIMONIO" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
          { domain: "ELEICAO" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
          { domain: "PROCESSOS" as const, available: true, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "camara" },
        ];

        return {
          externalKey: `camara:${dep.id}`,
          fullName: dep.nome,
          politicalName: dep.nome,
          officeSlug: "deputado-federal",
          partyAcronym: dep.siglaPartido || null,
          stateUf: dep.siglaUf || null,
          status: "EM_EXERCICIO",
          photoUrl: dep.urlFoto || null,
          isDemo: false,
          mandate: {
            legislature: "57",
            startDate: new Date("2023-02-01"),
            endDate: new Date("2027-01-31"),
            sourceSlug: "camara",
          },
          projects,
          committees,
          attendances: [],
          expenses,
          amendments: [],
          assets: [],
          elections: [],
          legalCases: [],
          coverage,
        };
      },
      concurrency
    );

    console.log(`✔ [CamaraCollector] ${politicians.length} deputados reais prontos para importação.`);
    return { politicians };
  }
}

