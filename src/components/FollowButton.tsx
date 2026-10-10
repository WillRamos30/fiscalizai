"use client";

import { useState } from "react";
import { toggleFollow } from "@/app/actions/follow";
import { useRouter } from "next/navigation";

export function FollowButton({ politicianId, initialIsFollowing }: { politicianId: string; initialIsFollowing: boolean }) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    setLoading(true);
    const res = await toggleFollow(politicianId);
    
    if (!res.success) {
      if (res.error?.includes("logado")) {
        alert(res.error);
        router.push("/cadastro");
      } else {
        alert("Erro ao tentar acompanhar o político.");
      }
    } else {
      setIsFollowing(res.isFollowing!);
    }
    
    setLoading(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-4 py-2 font-bold rounded-lg transition-colors border text-sm ${
        isFollowing 
          ? "bg-surface-100 text-ink-600 border-surface-300 hover:bg-bad-50 hover:text-bad-600 hover:border-bad-200" 
          : "bg-brand-600 text-white border-brand-600 hover:bg-brand-500"
      } disabled:opacity-50`}
    >
      {loading ? "Aguarde..." : isFollowing ? "Deixar de Acompanhar" : "Acompanhar Político"}
    </button>
  );
}
