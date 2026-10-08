// Coletor oficial do Senado Federal — API de Dados Abertos.
// Documentação: https://legis.senado.leg.br/dadosabertos/docs/
//
// Coleta dados 100% REAIS e PÚBLICOS:
//  • Senadores em exercício na legislatura atual
//  • Proposições de autoria (PLS, PL, PEC, PLP, PDS/PDL, RQS/REQ)
//  • Votações nominais e presença em plenário
//  • Comissões permanentes e temporárias de atuação

import type { Collector, CollectorContext, RawBundle, RawPoliticianInput } from "../types";

export interface SenadoCollectorOptions {
  /** Limite de senadores a importar (default: 30; use 0 ou Infinity para todos os 81) */
  limit?: number;
  /** Filtro opcional por UFs */
  ufs?: string[];
  /** Requisições concorrentes simultâneas (default: 5) */
  concurrency?: number;
}

const BASE_URL = "https://legis.senado.leg.br/dadosabertos";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FiscalizaI-Plataforma/1.0 (+https://legis.senado.leg.br)",
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

function mapSenadoProjectType(sigla: string): "PL" | "PEC" | "PLP" | "PDL" | "REQ" | "OUTRO" {
  const s = sigla.toUpperCase();
  if (s === "PL" || s === "PLS") return "PL";
  if (s === "PEC") return "PEC";
  if (s === "PLP") return "PLP";
  if (s === "PDL" || s === "PDS") return "PDL";
  if (s === "REQ" || s === "RQS") return "REQ";
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

type SenatorItem = {
  IdentificacaoParlamentar: {
    CodigoParlamentar: string;
    NomeParlamentar: string;
    NomeCompletoParlamentar: string;
    SiglaPartidoParlamentar: string;
    UfParlamentar: string;
    UrlFotoParlamentar: string;
    EmailParlamentar?: string;
  };
};

type AutoriaRaw = {
  Materia?: {
    Codigo?: string;
    Sigla?: string;
    Numero?: string;
    Ano?: string;
    Ementa?: string;
    Data?: string;
  };
  IndicadorAutorPrincipal?: string;
};

type ComissaoRaw = {
  IdentificacaoComissao?: {
    CodigoComissao?: string;
    SiglaComissao?: string;
    NomeComissao?: string;
  };
  DescricaoParticipacao?: string;
  DataInicio?: string;
  DataFim?: string | null;
};

type VotacaoRaw = {
  DescricaoVoto?: string;
  DescricaoVotacao?: string;
  SessaoPlenaria?: {
    DataSessao?: string;
  };
};

export class SenadoCollector implements Collector {
  id = "senado";
  label = "Senado Federal (Dados Abertos)";
  sourceSlugs = ["senado"];

  constructor(private options: SenadoCollectorOptions = {}) {}

  async fetch(ctx: CollectorContext): Promise<RawBundle> {
    console.log("▶ [SenadoCollector] Consultando API de Dados Abertos do Senado Federal...");

    // 1. Busca senadores em exercício
    const listRes = await fetchJson<{
      ListaParlamentarEmExercicio?: {
        Parlamentares?: {
          Parlamentar?: SenatorItem[];
        };
      };
    }>(`${BASE_URL}/senador/lista/atual`);

    const rawList = listRes?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar;
    if (!rawList || !Array.isArray(rawList) || rawList.length === 0) {
      throw new Error("Não foi possível obter a lista de senadores do Senado Federal.");
    }

    let senadores = rawList;

    if (this.options.ufs && this.options.ufs.length > 0) {
      const ufs = new Set(this.options.ufs.map((u) => u.toUpperCase()));
      senadores = senadores.filter((s) => ufs.has(s.IdentificacaoParlamentar.UfParlamentar));
    }

    const limit =
      this.options.limit !== undefined
        ? this.options.limit
        : process.env.SENADO_LIMIT
        ? parseInt(process.env.SENADO_LIMIT, 10)
        : 30;

    if (limit > 0 && limit < senadores.length) {
      senadores = senadores.slice(0, limit);
    }

    console.log(`▶ [SenadoCollector] Processando ${senadores.length} senadores reais...`);

    const concurrency = this.options.concurrency ?? 6;

    const politicians = await mapConcurrent(
      senadores,
      async (sen): Promise<RawPoliticianInput> => {
        const id = sen.IdentificacaoParlamentar.CodigoParlamentar;
        const nomeParlamentar = sen.IdentificacaoParlamentar.NomeParlamentar;
        const nomeCompleto = sen.IdentificacaoParlamentar.NomeCompletoParlamentar || nomeParlamentar;
        const partido = sen.IdentificacaoParlamentar.SiglaPartidoParlamentar;
        const uf = sen.IdentificacaoParlamentar.UfParlamentar;
        const foto = sen.IdentificacaoParlamentar.UrlFotoParlamentar;

        // Busca autorias, comissões e votações do senador
        const [autRes, comRes, votRes] = await Promise.all([
          fetchJson<{
            MateriasAutoriaParlamentar?: {
              Parlamentar?: {
                Autorias?: {
                  Autoria?: AutoriaRaw | AutoriaRaw[];
                };
              };
            };
          }>(`${BASE_URL}/senador/${id}/autorias`),
          fetchJson<{
            MembroComissaoParlamentar?: {
              Parlamentar?: {
                MembroComissoes?: {
                  Comissao?: ComissaoRaw | ComissaoRaw[];
                };
              };
            };
          }>(`${BASE_URL}/senador/${id}/comissoes`),
          fetchJson<{
            VotacaoParlamentar?: {
              Parlamentar?: {
                Votacoes?: {
                  Votacao?: VotacaoRaw | VotacaoRaw[];
                };
              };
            };
          }>(`${BASE_URL}/senador/${id}/votacoes`),
        ]);

        // Trata autoria (pode ser objeto único ou array na API do Senado)
        const rawAut = autRes?.MateriasAutoriaParlamentar?.Parlamentar?.Autorias?.Autoria;
        const autoriasList: AutoriaRaw[] = Array.isArray(rawAut) ? rawAut : rawAut ? [rawAut] : [];

        const projects = autoriasList
          .map((a) => {
            const m = a.Materia;
            if (!m) return null;
            const sigla = m.Sigla || "PL";
            const rawTitle = (m.Ementa || `${sigla} ${m.Numero}/${m.Ano}`).trim();
            const title = (rawTitle.length < 3 ? `Proposição ${rawTitle}` : rawTitle).slice(0, 300);
            const date = m.Data ? new Date(m.Data) : m.Ano ? new Date(`${m.Ano}-01-01`) : new Date("2023-02-01");
            const pType = mapSenadoProjectType(sigla);

            return {
              externalId: m.Codigo ? String(m.Codigo) : undefined,
              title,
              type: pType,
              role: a.IndicadorAutorPrincipal === "Não" ? ("RELATOR" as const) : ("AUTOR" as const),
              status: "EM_TRAMITACAO" as const,
              relevance: pType === "PEC" ? 3 : pType === "PL" || pType === "PLP" ? 2 : 1,
              presentedAt: isNaN(date.getTime()) ? new Date("2023-02-01") : date,
              url: m.Codigo ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${m.Codigo}` : null,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null && p.title.length >= 3);

        // Trata comissões
        const rawCom = comRes?.MembroComissaoParlamentar?.Parlamentar?.MembroComissoes?.Comissao;
        const comissoesList: ComissaoRaw[] = Array.isArray(rawCom) ? rawCom : rawCom ? [rawCom] : [];

        const committees = comissoesList
          .map((c) => {
            const name = (c.IdentificacaoComissao?.NomeComissao || c.IdentificacaoComissao?.SiglaComissao || "Comissão do Senado").trim().slice(0, 200);
            if (name.length < 2) return null;
            const sDate = c.DataInicio ? new Date(c.DataInicio) : new Date("2023-02-01");
            const eDate = c.DataFim ? new Date(c.DataFim) : null;

            return {
              name,
              role: mapCommitteeRole(c.DescricaoParticipacao),
              startDate: isNaN(sDate.getTime()) ? new Date("2023-02-01") : sDate,
              endDate: eDate && !isNaN(eDate.getTime()) ? eDate : null,
            };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        // Trata votações e participação
        const rawVot = votRes?.VotacaoParlamentar?.Parlamentar?.Votacoes?.Votacao;
        const votacoesList: VotacaoRaw[] = Array.isArray(rawVot) ? rawVot : rawVot ? [rawVot] : [];
        const votesTotal = votacoesList.length;
        const votesParticipated = votacoesList.filter((v) =>
          ["Sim", "Não", "Abstenção", "Presidente", "Votou"].some((s) => (v.DescricaoVoto || "").includes(s))
        ).length;

        const attendances =
          votesTotal > 0
            ? [
                {
                  periodStart: new Date("2023-02-01"),
                  sessionsTotal: votesTotal,
                  sessionsPresent: votesParticipated,
                  absencesJustified: 0,
                  absencesUnjustified: Math.max(0, votesTotal - votesParticipated),
                  votesTotal,
                  votesParticipated,
                  debates: 0,
                },
              ]
            : [];

        // Cobertura de domínios públicos
        const coverage = [
          { domain: "PROJETOS" as const, available: projects.length > 0, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
          { domain: "COMISSOES" as const, available: committees.length > 0, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
          { domain: "PRESENCA" as const, available: attendances.length > 0, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
          { domain: "VOTACOES" as const, available: votesTotal > 0, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
          { domain: "PROCESSOS" as const, available: true, completeness: 1, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
          { domain: "GASTOS" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
          { domain: "EMENDAS" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
          { domain: "PATRIMONIO" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
          { domain: "ELEICAO" as const, available: false, completeness: 0, lastUpdatedAt: ctx.now, sourceSlug: "senado" },
        ];

        return {
          externalKey: `senado:${id}`,
          fullName: nomeCompleto,
          politicalName: nomeParlamentar,
          officeSlug: "senador",
          partyAcronym: partido || null,
          stateUf: uf || null,
          status: "EM_EXERCICIO",
          photoUrl: foto || null,
          isDemo: false,
          mandate: {
            legislature: "57",
            startDate: new Date("2023-02-01"),
            endDate: new Date("2031-01-31"),
            sourceSlug: "senado",
          },
          projects,
          committees,
          attendances,
          expenses: [],
          amendments: [],
          assets: [],
          elections: [],
          legalCases: [],
          coverage,
        };
      },
      concurrency
    );

    console.log(`✔ [SenadoCollector] ${politicians.length} senadores reais prontos para importação.`);
    return { politicians };
  }
}
