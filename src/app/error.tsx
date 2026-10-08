"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em produção, aqui nós enviaríamos o erro para o Sentry/Datadog
    console.error("Erro capturado no ErrorBoundary:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 text-center px-4">
      <div className="w-20 h-20 bg-bad-100 text-bad-600 rounded-full flex items-center justify-center text-4xl mb-4 shadow-sm border border-bad-200">
        ⚠️
      </div>
      <h1 className="text-4xl font-extrabold text-ink-900 tracking-tight">Ocorreu um problema inesperado</h1>
      <p className="text-lg text-ink-500 max-w-xl">
        Nossos sistemas registraram o erro e nossa equipe já foi notificada. 
        Você pode tentar recarregar a página ou voltar para o início.
      </p>
      
      <div className="flex gap-4 pt-4">
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-500 transition-colors shadow-sm"
        >
          Tentar novamente
        </button>
        <Link 
          href="/" 
          className="px-6 py-3 bg-surface-100 text-ink-700 font-medium rounded-lg hover:bg-surface-200 transition-colors border border-surface-200 shadow-sm"
        >
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}
