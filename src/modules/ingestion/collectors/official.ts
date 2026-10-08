// Esqueletos dos coletores das fontes OFICIAIS. NÃO estão conectados nesta entrega:
// chamar `fetch()` lança NotConnectedError e o pipeline registra a falha em DataImport.
// Nenhum dado é inventado. Cada classe documenta os endpoints públicos a serem usados.
//
// Para conectar uma fonte: implemente `fetch()` devolvendo políticos no formato RawPolitician
// (ver ../types.ts). O pipeline cuida de validação, normalização, upsert, auditoria e do
// recálculo das notas — nada mais precisa mudar.

import { NotConnectedError, type Collector, type CollectorContext, type RawBundle } from "../types";

abstract class OfficialCollector implements Collector {
  abstract id: string;
  abstract label: string;
  abstract sourceSlugs: string[];
  async fetch(_ctx: CollectorContext): Promise<RawBundle> {
    throw new NotConnectedError(this.id);
  }
}

/**
 * Câmara dos Deputados — API de Dados Abertos v2.
 *  GET /deputados                      → lista de deputados em exercício
 *  GET /deputados/{id}                 → dados cadastrais
 *  GET /deputados/{id}/despesas        → cota parlamentar (CEAP)
 *  GET /deputados/{id}/orgaos          → comissões
 *  GET /proposicoes?idDeputadoAutor=…  → projetos de autoria
 *  GET /votacoes/{id}/votos            → votos nominais
 *  GET /eventos / presenças            → presença em sessões
 * https://dadosabertos.camara.leg.br/swagger/api.html
 */
export { CamaraCollector } from "./camara";
export { SenadoCollector } from "./senado";

/**
 * TSE — Dados Abertos / DivulgaCandContas.
 *  Candidaturas, resultados, bens declarados e prestação de contas por eleição.
 * https://dadosabertos.tse.jus.br
 */
export class TSECollector extends OfficialCollector {
  id = "tse";
  label = "Tribunal Superior Eleitoral";
  sourceSlugs = ["tse"];
}

/**
 * Portal da Transparência (emendas) e DataJud/CNJ (processos públicos).
 *  Emendas parlamentares: /emendas (API do Portal da Transparência — requer chave gratuita)
 *  Processos: API Pública do DataJud — requer chave pública do CNJ.
 *  ATENÇÃO LGPD/editorial: associar processo a pessoa exige correspondência inequívoca de
 *  identidade (nome + CPF/ID oficial); homônimos NÃO devem ser vinculados.
 */
export class TransparenciaCollector extends OfficialCollector {
  id = "transparencia";
  label = "Portal da Transparência e DataJud";
  sourceSlugs = ["transparencia", "tribunais"];
}
