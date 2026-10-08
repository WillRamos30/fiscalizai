import Link from "next/link";

export default function SobrePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-surface-200">
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold text-ink-900 tracking-tight">Sobre o Projeto</h1>
        <p className="text-xl text-ink-500">
          O FiscalizaI é uma iniciativa cívica construída para democratizar o acompanhamento da vida política brasileira.
        </p>
      </div>

      <div className="prose prose-brand max-w-none text-ink-700">
        <h2>Nossa Missão</h2>
        <p>
          Em um mundo de desinformação e narrativas polarizadas, o <strong>FiscalizaI</strong> busca fornecer uma bússola baseada exclusivamente em dados, matemática e registros oficiais. Não dizemos em quem votar; nós fornecemos as métricas para que você tome sua própria decisão.
        </p>

        <h2>Independência e Financiamento</h2>
        <p>
          O projeto é de código aberto e mantido por voluntários. Não aceitamos financiamento de partidos políticos, candidatos, ou de corporações que tenham interesses diretos em legislações específicas.
        </p>

        <h2>Nossas Fontes de Dados</h2>
        <p>
          Toda a base de dados do FiscalizaI é alimentada quase em tempo real pelos seguintes provedores oficiais:
        </p>
        <ul>
          <li><strong>Dados Abertos da Câmara dos Deputados:</strong> Produção legislativa, presenças em plenário e comissões, e Cota para o Exercício da Atividade Parlamentar (CEAP).</li>
          <li><strong>Dados Abertos do Senado Federal:</strong> Matérias, votações, licenças e afastamentos, e verba indenizatória.</li>
          <li><strong>Tribunal Superior Eleitoral (TSE):</strong> Histórico de candidaturas, filiação partidária, declaração de bens e contas eleitorais.</li>
          <li><strong>Portal da Transparência (CGU):</strong> Informações cruzadas do poder executivo e sanções.</li>
        </ul>

        <div className="mt-8 p-6 bg-brand-50 border border-brand-200 rounded-xl text-brand-900">
          <h3 className="text-lg font-bold mb-2">Auditoria Aberta</h3>
          <p className="text-sm">
            Para garantir a integridade dos dados, mantemos um log público de todas as ingestões e recálculos. Se você encontrar qualquer divergência entre nossa plataforma e o Diário Oficial, utilize o sistema de <strong>Correções</strong> integrado à plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}
