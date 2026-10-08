import Link from "next/link";

export default function MetodologiaPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-surface-200">
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold text-ink-900 tracking-tight">Metodologia de Avaliação</h1>
        <p className="text-xl text-ink-500">
          Entenda como calculamos as notas dos políticos de forma objetiva, transparente e sem viés ideológico.
        </p>
      </div>

      <div className="prose prose-brand max-w-none text-ink-700">
        <h2>Princípios Fundamentais</h2>
        <p>
          O <strong>FiscalizaI</strong> foi construído sobre três pilares inegociáveis:
        </p>
        <ul>
          <li><strong>Dados Públicos Oficiais:</strong> Nenhuma informação é gerada ou presumida por nós. Todos os dados são extraídos diretamente das APIs da Câmara dos Deputados, Senado Federal, TSE e Portal da Transparência.</li>
          <li><strong>Comparação Justa (Peer-to-Peer):</strong> Políticos são comparados exclusivamente com seus pares. Um Senador é comparado com a média dos Senadores; um Deputado Federal com a média dos Deputados Federais.</li>
          <li><strong>Transparência Radical:</strong> O algoritmo de cálculo, os pesos de cada indicador e o histórico de mudanças estão disponíveis para auditoria pública.</li>
        </ul>

        <h2>Os Pilares da Avaliação</h2>
        <p>
          A Nota Técnica (de 0 a 100) é composta pela média ponderada de quatro grandes pilares:
        </p>

        <div className="grid md:grid-cols-2 gap-6 not-prose my-8">
          <div className="bg-surface-50 p-6 rounded-xl border border-surface-200">
            <h3 className="text-lg font-bold text-ink-900 mb-2">1. Produção Legislativa (35%)</h3>
            <p className="text-sm text-ink-700">
              Mede a atividade principal do parlamentar: autoria de projetos de lei, relatorias, emendas aprovadas e relevância das matérias relatadas.
            </p>
          </div>
          <div className="bg-surface-50 p-6 rounded-xl border border-surface-200">
            <h3 className="text-lg font-bold text-ink-900 mb-2">2. Presença e Assiduidade (25%)</h3>
            <p className="text-sm text-ink-700">
              Avalia a presença do parlamentar nas sessões deliberativas do plenário e nas comissões. Ausências justificadas (como licenças médicas) não penalizam o político.
            </p>
          </div>
          <div className="bg-surface-50 p-6 rounded-xl border border-surface-200">
            <h3 className="text-lg font-bold text-ink-900 mb-2">3. Uso Eficiente de Verbas (20%)</h3>
            <p className="text-sm text-ink-700">
              Não avaliamos apenas "quem gasta menos", mas sim o desvio padrão em relação à média da casa, focando na cota para exercício da atividade parlamentar (CEAP).
            </p>
          </div>
          <div className="bg-surface-50 p-6 rounded-xl border border-surface-200">
            <h3 className="text-lg font-bold text-ink-900 mb-2">4. Transparência e Integridade (20%)</h3>
            <p className="text-sm text-ink-700">
              Penaliza envolvimento documentado em investigações formais ou condenações judiciais, e premia a contratação de equipe via processos seletivos públicos e clareza de gastos.
            </p>
          </div>
        </div>

        <h2>Como a nota é normalizada?</h2>
        <p>
          Para evitar distorções, os valores brutos (ex: 45 projetos apresentados) passam por uma função de normalização que utiliza <strong>Z-Score e Limites Assintóticos</strong>.
        </p>
        <p>
          Isso significa que um político não pode obter uma nota infinita se protocolar 10.000 projetos irrelevantes. O sistema compara o valor bruto com a <em>mediana</em> dos pares. Estar muito acima da média garante a nota máxima (100) no indicador, mas não ultrapassa esse teto, garantindo que nenhum indicador isolado carregue a pontuação inteira.
        </p>

        <h2>Fatos e Acontecimentos (Avaliação Popular)</h2>
        <p>
          Além da Nota Técnica, mantemos uma linha do tempo de <strong>Fatos Relevantes</strong> sobre cada parlamentar. Estes fatos (como votos em pautas polêmicas, declarações, ou projetos de alto impacto) recebem a avaliação direta do público através de Aprovações (👍) e Reprovações (👎). 
          <strong>Importante:</strong> A aprovação popular não interfere no cálculo da Nota Técnica matemática.
        </p>
        
      </div>
    </div>
  );
}
