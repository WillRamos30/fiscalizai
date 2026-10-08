"use client";

import { useTransition } from "react";
import { submitVote } from "@/app/actions/vote";

interface VoteButtonsProps {
  factId: string;
  votesUp: number;
  votesDown: number;
  userVote?: 1 | -1 | null; // futuramente: indicar se o usuário logado já votou
}

export function VoteButtons({ factId, votesUp, votesDown, userVote }: VoteButtonsProps) {
  const [isPending, startTransition] = useTransition();

  const handleVote = (value: 1 | -1) => {
    startTransition(async () => {
      try {
        const res = await submitVote(factId, value);
        if (res && !res.success) {
          alert("Erro do Servidor: " + res.error);
        }
      } catch (err) {
        console.error("Erro ao votar", err);
        alert("Erro ao votar. Verifique o console.");
      }
    });
  };

  return (
    <div className="flex flex-row md:flex-col items-center justify-center gap-4 border-t md:border-t-0 md:border-l border-surface-200 pt-4 md:pt-0 md:pl-6 min-w-[80px]">
      <button 
        onClick={() => handleVote(1)}
        disabled={isPending}
        className={`flex items-center gap-1 transition-colors ${
          userVote === 1 ? 'text-good-600' : 'text-ink-500 hover:text-good-600'
        } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Apoiar este fato"
      >
        <span className="text-xl">👍</span>
        <span className="font-bold">{votesUp}</span>
      </button>

      <button 
        onClick={() => handleVote(-1)}
        disabled={isPending}
        className={`flex items-center gap-1 transition-colors ${
          userVote === -1 ? 'text-bad-600' : 'text-ink-500 hover:text-bad-600'
        } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Desaprovar este fato"
      >
        <span className="text-xl">👎</span>
        <span className="font-bold">{votesDown}</span>
      </button>
    </div>
  );
}

