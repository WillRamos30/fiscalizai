// Dados de referência (estados, cargos, fontes). São dados REAIS e estáveis (não são mock):
// a lista de UFs, os cargos eletivos e as instituições-fonte oficiais.

import type { Db } from "@/lib/db";

export const STATES: { uf: string; name: string; region: string }[] = [
  { uf: "AC", name: "Acre", region: "Norte" },
  { uf: "AL", name: "Alagoas", region: "Nordeste" },
  { uf: "AP", name: "Amapá", region: "Norte" },
  { uf: "AM", name: "Amazonas", region: "Norte" },
  { uf: "BA", name: "Bahia", region: "Nordeste" },
  { uf: "CE", name: "Ceará", region: "Nordeste" },
  { uf: "DF", name: "Distrito Federal", region: "Centro-Oeste" },
  { uf: "ES", name: "Espírito Santo", region: "Sudeste" },
  { uf: "GO", name: "Goiás", region: "Centro-Oeste" },
  { uf: "MA", name: "Maranhão", region: "Nordeste" },
  { uf: "MT", name: "Mato Grosso", region: "Centro-Oeste" },
  { uf: "MS", name: "Mato Grosso do Sul", region: "Centro-Oeste" },
  { uf: "MG", name: "Minas Gerais", region: "Sudeste" },
  { uf: "PA", name: "Pará", region: "Norte" },
  { uf: "PB", name: "Paraíba", region: "Nordeste" },
  { uf: "PR", name: "Paraná", region: "Sul" },
  { uf: "PE", name: "Pernambuco", region: "Nordeste" },
  { uf: "PI", name: "Piauí", region: "Nordeste" },
  { uf: "RJ", name: "Rio de Janeiro", region: "Sudeste" },
  { uf: "RN", name: "Rio Grande do Norte", region: "Nordeste" },
  { uf: "RS", name: "Rio Grande do Sul", region: "Sul" },
  { uf: "RO", name: "Rondônia", region: "Norte" },
  { uf: "RR", name: "Roraima", region: "Norte" },
  { uf: "SC", name: "Santa Catarina", region: "Sul" },
  { uf: "SP", name: "São Paulo", region: "Sudeste" },
  { uf: "SE", name: "Sergipe", region: "Nordeste" },
  { uf: "TO", name: "Tocantins", region: "Norte" },
];

// Apenas os cargos do MVP estão `active`. Os demais já existem para a expansão (sem mudar código).
export const OFFICES: { slug: string; name: string; level: string; active: boolean }[] = [
  { slug: "deputado-federal", name: "Deputado Federal", level: "FEDERAL", active: true },
  { slug: "senador", name: "Senador", level: "FEDERAL", active: true },
  { slug: "presidente", name: "Presidente da República", level: "FEDERAL", active: false },
  { slug: "governador", name: "Governador", level: "ESTADUAL", active: false },
  { slug: "deputado-estadual", name: "Deputado Estadual", level: "ESTADUAL", active: false },
  { slug: "prefeito", name: "Prefeito", level: "MUNICIPAL", active: false },
  { slug: "vereador", name: "Vereador", level: "MUNICIPAL", active: false },
];

export const SOURCES: {
  slug: string;
  name: string;
  kind: string;
  description: string;
  officialUrl: string;
  apiUrl: string;
  reliability: number;
}[] = [
  {
    slug: "camara",
    name: "Câmara dos Deputados",
    kind: "CAMARA",
    description: "Proposições, votações, presença, comissões, discursos e cota parlamentar (CEAP) de deputados federais.",
    officialUrl: "https://www.camara.leg.br/transparencia",
    apiUrl: "https://dadosabertos.camara.leg.br/api/v2",
    reliability: 1,
  },
  {
    slug: "senado",
    name: "Senado Federal",
    kind: "SENADO",
    description: "Proposições, votações, presença, comissões e despesas (CEAPS) de senadores.",
    officialUrl: "https://www12.senado.leg.br/transparencia",
    apiUrl: "https://legis.senado.leg.br/dadosabertos",
    reliability: 1,
  },
  {
    slug: "tse",
    name: "Tribunal Superior Eleitoral (TSE)",
    kind: "TSE",
    description: "Candidaturas, resultados eleitorais, declaração de bens, prestação de contas e doações de campanha.",
    officialUrl: "https://dadosabertos.tse.jus.br",
    apiUrl: "https://divulgacandcontas.tse.jus.br/divulga/rest/v1",
    reliability: 1,
  },
  {
    slug: "tribunais",
    name: "Tribunais (STF, STJ, TJs e CNJ)",
    kind: "TRIBUNAIS",
    description: "Situação processual pública, por meio de consultas dos tribunais e da API Pública do DataJud (CNJ).",
    officialUrl: "https://www.cnj.jus.br/sistemas/datajud/",
    apiUrl: "https://api-publica.datajud.cnj.jus.br",
    reliability: 0.9,
  },
  {
    slug: "transparencia",
    name: "Portal da Transparência do Governo Federal",
    kind: "TRANSPARENCIA",
    description: "Execução de emendas parlamentares e demais despesas federais.",
    officialUrl: "https://portaldatransparencia.gov.br",
    apiUrl: "https://api.portaldatransparencia.gov.br",
    reliability: 0.95,
  },
];

export async function ensureReferenceData(db: Db, opts: { demoSources?: boolean } = {}): Promise<void> {
  for (const s of STATES) {
    await db.state.upsert({ where: { uf: s.uf }, update: { name: s.name, region: s.region }, create: s });
  }
  for (const o of OFFICES) {
    await db.office.upsert({ where: { slug: o.slug }, update: { name: o.name, level: o.level }, create: o });
  }
  for (const s of SOURCES) {
    await db.source.upsert({
      where: { slug: s.slug },
      update: { name: s.name, description: s.description, officialUrl: s.officialUrl, apiUrl: s.apiUrl, reliability: s.reliability },
      create: { ...s, connection: opts.demoSources ? "DEMO" : "NAO_CONECTADA" },
    });
  }
}
