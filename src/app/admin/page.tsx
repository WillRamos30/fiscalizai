"use client";

import { useState, useEffect, useRef } from "react";

export default function AdminDashboardPage() {
  const [syncing, setSyncing] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState("");
  
  const [status, setStatus] = useState<any>(null);
  const abortAutoSync = useRef(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/admin/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        return data;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  useEffect(() => {
    fetchStatus();
    return () => {
      abortAutoSync.current = true;
    };
  }, []);

  const runSingleSync = async () => {
    const res = await fetch("/api/admin/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collector: "camara" })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }
  };

  const runRecalculate = async () => {
    const res = await fetch("/api/admin/scores/recalculate", { method: "POST" });
    if (!res.ok) throw new Error("Erro na API");
  };

  const forceSync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      await runSingleSync();
      setMessage("✅ Sincronização da Câmara concluída!");
      await fetchStatus();
    } catch (e: any) {
      setMessage(`❌ Erro ao iniciar sincronização: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const startAutoSync = async () => {
    if (!status) return;
    
    setAutoSyncing(true);
    setSyncing(true);
    abortAutoSync.current = false;
    setMessage("⏳ Iniciando Auto-Sync. Por favor, não feche esta aba...");

    try {
      let currentStatus = status;
      let lastErrorStr = "";

      while (!currentStatus.camara.completo && !abortAutoSync.current) {
        setMessage(`⏳ Sincronizando lote... Faltam ${currentStatus.camara.faltam} inéditos.`);
        
        let attempts = 0;
        let success = false;
        while (attempts < 3 && !success && !abortAutoSync.current) {
          try {
            await runSingleSync();
            success = true;
          } catch (err: any) {
            attempts++;
            lastErrorStr = err.message;
            console.error("Erro no lote, tentativa " + attempts, err);
            if (attempts >= 3) throw err; // Lança o erro real
            setMessage(`⚠️ Falha (${err.message}). Tentando novamente (${attempts}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
        currentStatus = await fetchStatus();
        if (!currentStatus) throw new Error("Falha ao obter status");
      }

      if (abortAutoSync.current) {
        setMessage("⚠️ Auto-Sync pausado.");
      } else {
        setMessage("✅ Todos os deputados importados! Iniciando recalculo automático das notas...");
        setRecalculating(true);
        await runRecalculate();
        setMessage("🏆 TUDO PRONTO! Banco 100% populado e notas recalculadas com sucesso!");
      }

    } catch (e) {
      setMessage("❌ Erro durante o Auto-Sync (API instável ou timeout). Tente novamente.");
    } finally {
      setAutoSyncing(false);
      setSyncing(false);
      setRecalculating(false);
    }
  };

  const stopAutoSync = () => {
    abortAutoSync.current = true;
    setMessage("⚠️ Pausando Auto-Sync ao final do lote atual...");
  };

  const recalculate = async () => {
    setRecalculating(true);
    setMessage("");
    try {
      await runRecalculate();
      setMessage("✅ Recálculo de notas concluído com sucesso!");
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
        <div className="p-4 bg-brand-50 text-brand-900 rounded-md border border-brand-200 font-medium">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Sincronização (Auto)</h2>
          <p className="text-sm text-ink-500 mb-4">Importe automaticamente todos os 513 até o fim.</p>
          
          <div className="space-y-2">
            {!autoSyncing ? (
              <>
                <button 
                  onClick={startAutoSync}
                  disabled={syncing || recalculating}
                  className="w-full py-2 bg-brand-600 text-white rounded-md font-medium text-sm hover:bg-brand-500 transition-colors disabled:opacity-50"
                >
                  {status?.camara?.completo ? "Atualizar Banco" : "Sincronizar Tudo (Auto)"}
                </button>
                {!status?.camara?.completo && (
                  <button 
                    onClick={forceSync}
                    disabled={syncing || autoSyncing}
                    className="w-full py-2 border border-brand-200 text-brand-700 rounded-md font-medium text-sm hover:bg-brand-50 transition-colors disabled:opacity-50"
                  >
                    Baixar apenas 1 lote (50)
                  </button>
                )}
              </>
            ) : (
              <button 
                onClick={stopAutoSync}
                className="w-full py-2 bg-red-600 text-white rounded-md font-medium text-sm hover:bg-red-500 transition-colors animate-pulse"
              >
                Parar Sincronização
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Motor de Pontuação</h2>
          <p className="text-sm text-ink-500 mb-4">Recalcule as notas de todos os políticos com a versão atual.</p>
          <button 
            onClick={recalculate}
            disabled={recalculating || autoSyncing}
            className="w-full py-2 bg-brand-600 text-white rounded-md font-medium text-sm hover:bg-brand-500 transition-colors disabled:opacity-50"
          >
            {recalculating ? "Recalculando..." : "Recalcular Notas Manuais"}
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Progresso do Banco</h2>
          <div className="text-sm text-ink-600 mb-4 space-y-3">
            {status ? (
              <>
                <div>
                  <div className="flex justify-between font-semibold text-ink-800 mb-1">
                    <span>Câmara dos Deputados</span>
                    <span className={status.camara.completo ? "text-good-600" : ""}>
                      {status.camara.importados} / {status.camara.total}
                    </span>
                  </div>
                  <div className="w-full bg-surface-200 rounded-full h-2">
                    <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${(status.camara.importados / status.camara.total) * 100}%`, transition: 'width 0.5s ease-in-out' }}></div>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    {status.camara.completo ? "Todos importados!" : `Faltam ${status.camara.faltam} inéditos.`}
                  </p>
                </div>
              </>
            ) : (
              <p>Carregando status...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

