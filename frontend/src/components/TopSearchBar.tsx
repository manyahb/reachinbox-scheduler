"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SearchHit } from "@/lib/types";
import { Icon } from "./Sidebar";

export function TopSearchBar({
  onResults,
  onClear,
  onRefresh,
}: {
  onResults: (hits: SearchHit[], query: string) => void;
  onClear: () => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      onClear();
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const hits = await api.searchEmails(q);
        onResults(hits, q);
      } catch {
        onResults([], q);
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
      <div className="relative flex-1 max-w-xl">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="w-full rounded-md border border-border bg-surface-hover/60 pl-9 pr-3 py-1.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-green focus:bg-surface transition-colors"
        />
      </div>
      <button className="p-1.5 rounded-md text-text-dim hover:bg-surface-hover transition-colors" aria-label="filter">
        <Icon name="filter" className="h-4 w-4" />
      </button>
      <button
        onClick={onRefresh}
        className="p-1.5 rounded-md text-text-dim hover:bg-surface-hover transition-colors"
        aria-label="refresh"
      >
        <Icon name="refresh" className="h-4 w-4" />
      </button>
    </div>
  );
}
