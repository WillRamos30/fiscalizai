"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";

interface SearchResult {
  id: string;
  politicalName: string;
  stateUf: string | null;
  party: { acronym: string } | null;
  office: { slug: string } | null;
}

export function CompareSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    let active = true;
    setIsSearching(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`)
      .then(res => res.json())
      .then(data => {
        if (active && data.results) {
          setResults(data.results);
        }
      })
      .finally(() => {
        if (active) setIsSearching(false);
      });

    return () => { active = false; };
  }, [debouncedQuery]);

  const addPolitician = (id: string) => {
    const currentIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];
    if (currentIds.includes(id)) {
      setQuery("");
      return;
    }
    if (currentIds.length >= 4) {
      alert("Você pode comparar no máximo 4 políticos por vez.");
      return;
    }
    
    currentIds.push(id);
    router.push(`/comparar?ids=${currentIds.join(",")}`);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Adicione um político para comparar..."
        className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
      />
      {isSearching && (
        <div className="absolute right-4 top-3 text-sm text-ink-500">Buscando...</div>
      )}
      
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-surface-200 rounded-xl shadow-lg max-h-80 overflow-auto">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => addPolitician(p.id)}
              className="w-full text-left px-4 py-3 hover:bg-surface-50 border-b border-surface-100 last:border-0 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-ink-900">{p.politicalName}</div>
                <div className="text-xs text-ink-500">
                  {p.office?.slug === "senador" ? "Senador" : "Deputado"} • {p.party?.acronym} / {p.stateUf}
                </div>
              </div>
              <span className="text-brand-600 font-medium text-sm border border-brand-200 px-2 py-1 rounded bg-brand-50">+ Adicionar</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
