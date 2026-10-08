// MockCollector — gera um conjunto DETERMINÍSTICO de políticos FICTÍCIOS para demonstração.
//
// Garantias de segurança editorial:
//  • Todos os nomes são claramente fictícios (Exemplo / Modelo / Simulado/a / Fictício/a / Demonstração).
//  • Partidos também são fictícios (PDX, PEM, PSIM, PFIC, PMOD).
//  • Nenhum dado aqui descreve ou se associa a pessoas, partidos ou processos reais.
//  • Tudo é marcado isDemo=true e exibido como "DADOS DE DEMONSTRAÇÃO" na interface.

import type { Collector, CollectorContext, RawBundle, RawPoliticianInput } from "../types";

// ───── PRNG determinístico ─────
function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

type Trait = "highSpender" | "manyJustified" | "legalNonFinal" | "investigatedOnly" | "absolved" | "insufficient" | "noAssets" | "stale";

type Person = {
  key: string;
  name: string;
  office: "deputado-federal" | "senador";
  uf: string;
  party: string;
  q: number; // perfil de desempenho (0..1) — só para gerar números fictícios
  traits?: Trait[];
};

export const DEMO_PARTIES: Record<string, string> = {
  PDX: "Partido Demonstração X",
  PEM: "Partido Exemplo Modelo",
  PSIM: "Partido Simulado",
  PFIC: "Partido Fictício",
  PMOD: "Partido Modelo",
};

export const DEMO_PEOPLE: Person[] = [
  { key: "joao-exemplo", name: "João Exemplo", office: "deputado-federal", uf: "MG", party: "PDX", q: 0.95 },
  { key: "carlos-exemplo", name: "Carlos Exemplo", office: "deputado-federal", uf: "RJ", party: "PEM", q: 0.62 },
  { key: "ana-modelo", name: "Ana Modelo", office: "deputado-federal", uf: "MG", party: "PSIM", q: 0.84 },
  { key: "paulo-demonstracao", name: "Paulo Demonstração", office: "deputado-federal", uf: "SP", party: "PFIC", q: 0.55, traits: ["noAssets"] },
  { key: "beatriz-simulada", name: "Beatriz Simulada", office: "deputado-federal", uf: "SP", party: "PDX", q: 0.78 },
  { key: "lucas-simulado", name: "Lucas Simulado", office: "deputado-federal", uf: "SP", party: "PEM", q: 0.7, traits: ["absolved"] },
  { key: "roberto-modelo", name: "Roberto Modelo", office: "deputado-federal", uf: "SP", party: "PMOD", q: 0.45, traits: ["highSpender"] },
  { key: "fernanda-simulada", name: "Fernanda Simulada", office: "deputado-federal", uf: "BA", party: "PSIM", q: 0.72, traits: ["manyJustified"] },
  { key: "rafael-ficticio", name: "Rafael Fictício", office: "deputado-federal", uf: "BA", party: "PFIC", q: 0.66 },
  { key: "rita-ficticia", name: "Rita Fictícia", office: "deputado-federal", uf: "BA", party: "PMOD", q: 0.5, traits: ["insufficient"] },
  { key: "eduardo-ficticio", name: "Eduardo Fictício", office: "deputado-federal", uf: "RJ", party: "PDX", q: 0.68, traits: ["legalNonFinal"] },
  { key: "juliana-exemplo", name: "Juliana Exemplo", office: "deputado-federal", uf: "RJ", party: "PEM", q: 0.88 },
  { key: "marcos-modelo", name: "Marcos Modelo", office: "deputado-federal", uf: "MG", party: "PFIC", q: 0.58, traits: ["investigatedOnly"] },
  { key: "camila-demonstracao", name: "Camila Demonstração", office: "deputado-federal", uf: "MG", party: "PMOD", q: 0.4 },
  { key: "gustavo-simulado", name: "Gustavo Simulado", office: "deputado-federal", uf: "RS", party: "PSIM", q: 0.75 },
  { key: "thiago-exemplo", name: "Thiago Exemplo", office: "deputado-federal", uf: "RS", party: "PDX", q: 0.6, traits: ["stale"] },
  { key: "maria-exemplo", name: "Maria Exemplo", office: "senador", uf: "SP", party: "PDX", q: 0.92 },
  { key: "patricia-modelo", name: "Patrícia Modelo", office: "senador", uf: "SP", party: "PEM", q: 0.7 },
  { key: "luciano-simulado", name: "Luciano Simulado", office: "senador", uf: "MG", party: "PFIC", q: 0.6 },
  { key: "renata-ficticia", name: "Renata Fictícia", office: "senador", uf: "MG", party: "PSIM", q: 0.82 },
  { key: "felipe-demonstracao", name: "Felipe Demonstração", office: "senador", uf: "RJ", party: "PMOD", q: 0.52 },
  { key: "vanessa-exemplo", name: "Vanessa Exemplo", office: "senador", uf: "BA", party: "PDX", q: 0.76 },
  { key: "andre-modelo", name: "André Modelo", office: "senador", uf: "RS", party: "PEM", q: 0.46 },
  { key: "helena-simulada", name: "Helena Simulada", office: "senador", uf: "PR", party: "PFIC", q: 0.86 },
];

const TOPICS = [
  "educação básica", "atenção primária à saúde", "mobilidade urbana", "segurança digital", "saneamento",
  "agricultura familiar", "energia renovável", "habitação popular", "cultura e esporte", "ciência e tecnologia",
  "defesa do consumidor", "transparência pública", "acessibilidade", "meio ambiente",
];
const COMMITTEES = [
  "Comissão de Educação", "Comissão de Saúde", "Comissão de Finanças", "Comissão de Constituição e Justiça",
  "Comissão de Meio Ambiente", "Comissão de Infraestrutura", "Comissão de Ciência e Tecnologia", "Comissão de Agricultura",
];
const SPEND_SPLIT: [string, number][] = [
  ["COTA_PARLAMENTAR", 0.3], ["PASSAGENS", 0.24], ["COMBUSTIVEL", 0.12], ["DIVULGACAO", 0.14], ["ESCRITORIO", 0.12], ["ALIMENTACAO", 0.08],
];

function monthStarts(termStart: Date, now: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(Date.UTC(termStart.getUTCFullYear(), termStart.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); // exclui o mês corrente (incompleto)
  while (d < limit) {
    out.push(new Date(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

const domainSource = (domain: string, office: string): string => {
  if (["EMENDAS"].includes(domain)) return "transparencia";
  if (["PATRIMONIO", "ELEICAO"].includes(domain)) return "tse";
  if (domain === "PROCESSOS") return "tribunais";
  return office === "senador" ? "senado" : "camara";
};

export function generatePerson(p: Person, now: Date, termStart: Date): RawPoliticianInput {
  const rnd = mulberry32(hashSeed(p.key));
  const traits = new Set(p.traits ?? []);
  const isSen = p.office === "senador";
  const legSource = isSen ? "senado" : "camara";
  const months = monthStarts(termStart, now);
  const q = p.q;
  const insufficient = traits.has("insufficient");

  // ── Cobertura ──
  const ALL = ["PROJETOS", "VOTACOES", "PRESENCA", "COMISSOES", "GASTOS", "EMENDAS", "PATRIMONIO", "ELEICAO", "PROCESSOS"] as const;
  const ageBase = traits.has("stale") ? 150 : 3;
  const coverage = ALL.map((d) => {
    const available = insufficient ? ["PROJETOS", "COMISSOES"].includes(d) : true;
    return {
      domain: d,
      available,
      completeness: available ? clamp(0.9 + rnd() * 0.1, 0, 1) : 0,
      lastUpdatedAt: new Date(now.getTime() - (ageBase + Math.floor(rnd() * 25)) * 86_400_000),
      sourceSlug: domainSource(d, p.office),
    };
  });

  // ── Projetos ──
  const projects: NonNullable<RawPoliticianInput["projects"]> = [];
  let seq = 1;
  const lam = (0.6 + 3.2 * q) * (isSen ? 0.7 : 1);
  const recentCut = new Date(now.getTime() - 90 * 86_400_000);
  for (const m of months) {
    let n = Math.floor(lam) + (rnd() < lam - Math.floor(lam) ? 1 : 0);
    if (insufficient) n = rnd() < 0.5 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const presentedAt = new Date(m.getTime() + Math.floor(rnd() * 27) * 86_400_000);
      const u = rnd();
      const relU = rnd();
      const relevance = relU < 0.5 - 0.3 * q ? 1 : relU < 0.85 - 0.15 * q ? 2 : 3;
      let status: string = "EM_TRAMITACAO";
      let resolvedAt: Date | null = null;
      if (presentedAt < recentCut) {
        const pEnact = 0.01 + 0.07 * q;
        const pApprove = pEnact + 0.04 + 0.16 * q;
        const pArchive = pApprove + 0.15;
        if (u < pEnact) status = "TRANSFORMADO_EM_NORMA";
        else if (u < pApprove) status = "APROVADO";
        else if (u < pArchive) status = "ARQUIVADO";
        if (status !== "EM_TRAMITACAO") {
          resolvedAt = new Date(Math.min(now.getTime() - 86_400_000, presentedAt.getTime() + (60 + Math.floor(rnd() * 240)) * 86_400_000));
        }
      } else status = rnd() < 0.5 ? "APRESENTADO" : "EM_TRAMITACAO";
      const type = (["PL", "PL", "PL", "PLP", "PDL", "PEC", "REQ"] as const)[Math.floor(rnd() * 7)];
      const topic = TOPICS[Math.floor(rnd() * TOPICS.length)];
      projects.push({
        externalId: `${p.key}-p${seq}`,
        title: `${type} DEMO ${seq}/${presentedAt.getUTCFullYear()} — ${topic} (dados de demonstração)`,
        type,
        role: "AUTOR",
        status: status as "EM_TRAMITACAO",
        relevance,
        presentedAt,
        resolvedAt,
      });
      seq++;
    }
    // relatorias
    const lr = (0.1 + 0.6 * q) * (insufficient ? 0.3 : 1);
    if (rnd() < lr) {
      const presentedAt = new Date(m.getTime() + Math.floor(rnd() * 27) * 86_400_000);
      const approved = presentedAt < recentCut && rnd() < 0.3 + 0.5 * q;
      projects.push({
        externalId: `${p.key}-r${seq}`,
        title: `Relatoria DEMO ${seq}/${presentedAt.getUTCFullYear()} — ${TOPICS[Math.floor(rnd() * TOPICS.length)]} (dados de demonstração)`,
        type: "PL",
        role: "RELATOR",
        status: approved ? "APROVADO" : "EM_TRAMITACAO",
        relevance: 2,
        presentedAt,
        resolvedAt: approved ? new Date(Math.min(now.getTime() - 86_400_000, presentedAt.getTime() + 90 * 86_400_000)) : null,
      });
      seq++;
    }
  }

  // ── Comissões ──
  const nCom = 1 + Math.round(q * 3);
  const committees: NonNullable<RawPoliticianInput["committees"]> = [];
  for (let i = 0; i < nCom; i++) {
    const role = i === 0 && q > 0.8 ? "PRESIDENTE" : i === 1 && q > 0.6 ? "RELATOR" : i === 2 && q > 0.85 ? "VICE_PRESIDENTE" : i % 2 ? "SUPLENTE" : "TITULAR";
    committees.push({ name: `${COMMITTEES[(i + Math.floor(rnd() * 3)) % COMMITTEES.length]} (demo)`, role, startDate: termStart, endDate: null });
  }

  // ── Presença / votações ──
  const attendances: NonNullable<RawPoliticianInput["attendances"]> = [];
  const justShare = traits.has("manyJustified") ? 0.96 : 0.45 + 0.35 * rnd();
  for (const m of months) {
    if (m.getUTCMonth() === 0) continue; // recesso de janeiro
    const total = (isSen ? 8 : 10) + Math.floor(rnd() * 6);
    const rate = clamp(0.7 + 0.29 * q + (rnd() - 0.5) * 0.08, 0.45, 1);
    const present = Math.min(total, Math.round(total * rate));
    const abs = total - present;
    const just = Math.round(abs * justShare);
    const vTotal = 25 + Math.floor(rnd() * 36);
    const vPart = Math.min(vTotal, Math.round(vTotal * clamp(0.72 + 0.27 * q + (rnd() - 0.5) * 0.08, 0.4, 1)));
    attendances.push({
      periodStart: m,
      sessionsTotal: total,
      sessionsPresent: present,
      absencesJustified: just,
      absencesUnjustified: abs - just,
      votesTotal: vTotal,
      votesParticipated: vPart,
      debates: Math.round(q * 5 * rnd() * 1.6),
    });
  }

  // ── Gastos ──
  const expenses: NonNullable<RawPoliticianInput["expenses"]> = [];
  const spendFactor = (traits.has("highSpender") ? 2.7 : 0.75 + 0.45 * rnd()) * (isSen ? 0.85 : 1);
  for (const m of months) {
    const base = 38_000 * spendFactor * (0.9 + 0.2 * rnd());
    for (const [cat, share] of SPEND_SPLIT) {
      const amount = Math.round(base * share * (0.85 + 0.3 * rnd()) * 100) / 100;
      expenses.push({
        category: cat,
        description: "Despesa de demonstração",
        amount,
        date: new Date(m.getTime() + Math.floor(rnd() * 27) * 86_400_000),
      });
    }
  }

  // ── Emendas ──
  const amendments: NonNullable<RawPoliticianInput["amendments"]> = [];
  for (let y = termStart.getUTCFullYear(); y <= now.getUTCFullYear(); y++) {
    const n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const committed = Math.round((400_000 + rnd() * 1_400_000) / 1000) * 1000;
      const exec = clamp(0.25 + 0.65 * q + (rnd() - 0.5) * 0.2, 0.05, 1) * (y === now.getUTCFullYear() ? 0.4 : 1);
      const paid = Math.round(committed * exec);
      amendments.push({
        year: y,
        code: `DEMO-${y}-${p.key.slice(0, 3).toUpperCase()}${i + 1}`,
        description: "Emenda de demonstração",
        amountCommitted: committed,
        amountPaid: paid,
        status: paid >= committed * 0.99 ? "PAGA" : "EMPENHADA",
      });
    }
  }

  // ── Patrimônio / eleição ──
  const assets: NonNullable<RawPoliticianInput["assets"]> = traits.has("noAssets")
    ? []
    : [
        { year: 2022, description: "Bem de demonstração A", value: Math.round(100_000 + rnd() * 900_000) },
        { year: 2022, description: "Bem de demonstração B", value: Math.round(50_000 + rnd() * 1_500_000) },
      ];
  const elections: NonNullable<RawPoliticianInput["elections"]> = [
    {
      year: 2022,
      officeSlug: p.office,
      stateUf: p.uf,
      result: "ELEITO",
      votes: isSen ? Math.round(1_500_000 + rnd() * 4_500_000) : Math.round(80_000 + rnd() * 170_000),
      accountsStatus: rnd() < 0.8 ? "APROVADAS" : "APROVADAS_RESSALVAS",
    },
  ];

  // ── Situação processual (fictícia) ──
  const legalCases: NonNullable<RawPoliticianInput["legalCases"]> = [];
  if (traits.has("legalNonFinal")) {
    legalCases.push(
      { caseNumber: "DEMO-0001/2024", court: "Tribunal de Demonstração", stage: "CONDENACAO", description: "Registro de demonstração: decisão condenatória sujeita a recurso.", date: new Date(Date.UTC(2025, 5, 10)), isActive: true },
      { caseNumber: "DEMO-0002/2025", court: "Tribunal de Demonstração", stage: "INQUERITO", description: "Registro de demonstração: inquérito em andamento.", date: new Date(Date.UTC(2025, 9, 2)), isActive: true },
    );
  }
  if (traits.has("investigatedOnly")) {
    legalCases.push(
      { caseNumber: "DEMO-0003/2025", court: "Tribunal de Demonstração", stage: "INVESTIGACAO", description: "Registro de demonstração: apuração preliminar. Não representa culpa.", date: new Date(Date.UTC(2025, 2, 18)), isActive: true },
      { caseNumber: "DEMO-0004/2026", court: "Tribunal de Demonstração", stage: "INQUERITO", description: "Registro de demonstração: inquérito em andamento. Não representa culpa.", date: new Date(Date.UTC(2026, 1, 9)), isActive: true },
    );
  }
  if (traits.has("absolved")) {
    legalCases.push({ caseNumber: "DEMO-0005/2023", court: "Tribunal de Demonstração", stage: "ABSOLVICAO", description: "Registro de demonstração: absolvição transitada.", date: new Date(Date.UTC(2024, 7, 21)), isActive: false });
  }

  return {
    externalKey: `mock:${p.key}`,
    fullName: `${p.name} de Demonstração`,
    politicalName: p.name,
    officeSlug: p.office,
    partyAcronym: p.party,
    partyName: DEMO_PARTIES[p.party],
    stateUf: p.uf,
    status: "EM_EXERCICIO",
    bio: "DADOS DE DEMONSTRAÇÃO — personagem fictício criado apenas para demonstrar a plataforma. Não representa nenhuma pessoa real.",
    isDemo: true,
    mandate: {
      legislature: isSen ? "57ª Legislatura (2023–2031)" : "57ª Legislatura (2023–2027)",
      startDate: termStart,
      endDate: new Date(Date.UTC(isSen ? 2031 : 2027, 0, 31)),
      sourceSlug: legSource,
    },
    projects: insufficient ? projects.slice(0, 4) : projects,
    committees,
    attendances: insufficient ? [] : attendances,
    expenses: insufficient ? [] : expenses,
    amendments: insufficient ? [] : amendments,
    assets: insufficient ? [] : assets,
    elections: insufficient ? [] : elections,
    legalCases,
    coverage,
  };
}

export const MOCK_TERM_START = new Date(Date.UTC(2023, 1, 1));

export class MockCollector implements Collector {
  id = "mock";
  label = "Dados de demonstração (fictícios)";
  sourceSlugs = ["camara", "senado", "tse", "tribunais", "transparencia"];

  async fetch(ctx: CollectorContext): Promise<RawBundle> {
    return { politicians: DEMO_PEOPLE.map((p) => generatePerson(p, ctx.now, MOCK_TERM_START)) };
  }
}
