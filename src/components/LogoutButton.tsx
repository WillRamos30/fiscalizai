"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Erro no servidor");
      // Atualizar o estado global
      window.location.href = "/";
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm font-medium text-ink-500 hover:text-bad-600 transition-colors disabled:opacity-50"
      title="Sair da conta"
    >
      {loading ? "Saindo..." : "Sair"}
    </button>
  );
}


