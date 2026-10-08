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
    // Log para serviços de telemetria
    console.error("Erro fatal capturado:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center space-y-6 text-center px-4 bg-surface-50">
          <div className="w-24 h-24 bg-bad-100 text-bad-600 rounded-full flex items-center justify-center text-5xl mb-4 shadow-sm border border-bad-200">
            🚨
          </div>
          <h1 className="text-4xl font-extrabold text-ink-900 tracking-tight">Falha Crítica</h1>
          <p className="text-lg text-ink-500 max-w-xl">
            A aplicação encontrou um erro irrecuperável. Nossa equipe técnica foi notificada.
          </p>
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => reset()}
              className="px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-500 transition-colors shadow-sm"
            >
              Recarregar Aplicação
            </button>
            <Link 
              href="/" 
              className="px-6 py-3 bg-white text-ink-700 font-medium rounded-lg hover:bg-surface-50 transition-colors border border-surface-200 shadow-sm"
            >
              Início
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
