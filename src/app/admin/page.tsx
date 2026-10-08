"use client";

import { useState } from "react";

export default function AdminDashboardPage() {
  const [syncing, setSyncing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState("");

  const forceSync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collector: "camara" }) // Importa câmara como teste base
      });
      if (res.ok) {
        setMessage("✅ Sincronização da Câmara iniciada em segundo plano! Demora alguns minutos.");
      } else {
        setMessage("❌ Erro ao iniciar sincronização.");
      }
    } catch (e) {
      setMessage("❌ Erro ao iniciar sincronização.");
    } finally {
      setSyncing(false);
    }
  };

  const recalculate = async () => {
    setRecalculating(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/scores/recalculate", { method: "POST" });
      if (res.ok) {
        setMessage("✅ Recálculo de notas iniciado em segundo plano!");
      } else {
        setMessage("❌ Erro ao recalcular notas.");
      }
    } catch (e) {
      setMessage("❌ Erro ao recalcular notas.");
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-ink-900 tracking-tight">Painel Administrativo</h1>
        <p className="text-ink-500 mt-1">Gerencie a plataforma, importações e avaliações.</p>
      </div>

      {message && (
        <div className="p-4 bg-brand-50 text-brand-900 rounded-md border border-brand-200">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Sincronização (ETL)</h2>
          <p className="text-sm text-ink-500 mb-4">Execute a coleta de dados e importação de fontes oficiais (Câmara).</p>
          <button 
            onClick={forceSync}
            disabled={syncing}
            className="w-full py-2 bg-brand-600 text-white rounded-md font-medium text-sm hover:bg-brand-500 transition-colors disabled:opacity-50"
          >
            {syncing ? "Iniciando..." : "Forçar Sincronização"}
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Motor de Pontuação</h2>
          <p className="text-sm text-ink-500 mb-4">Recalcule as notas de todos os políticos com a versão atual.</p>
          <button 
            onClick={recalculate}
            disabled={recalculating}
            className="w-full py-2 bg-brand-600 text-white rounded-md font-medium text-sm hover:bg-brand-500 transition-colors disabled:opacity-50"
          >
            {recalculating ? "Iniciando..." : "Recalcular Notas"}
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200 opacity-50">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Auditoria</h2>
          <p className="text-sm text-ink-500 mb-4">Visualize os logs do sistema e alterações manuais.</p>
          <button disabled className="w-full py-2 border border-surface-200 text-ink-700 rounded-md font-medium text-sm hover:bg-surface-50 transition-colors cursor-not-allowed">
            Em breve
          </button>
        </div>
      </div>
    </div>
  );
}
