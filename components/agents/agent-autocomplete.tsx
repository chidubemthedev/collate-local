"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { useAvailableAgents } from "@/lib/hooks/use-agents";
import type { AvailableAgentItem } from "@/types/api";
import { Search, X, ChevronDown } from "lucide-react";

interface AgentAutocompleteProps {
  /** The picked person's id, or "" when nobody is picked. */
  value: string;
  onChange: (personId: string, person?: AvailableAgentItem) => void;
  disabled?: boolean;
}

/** Waits until typing pauses before searching, so each keystroke doesn't call the API. */
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Picks the person to assign as an agent, searching GET /api/agents/available by name.
 * Only people who are not yet agents (and not admins) are listed.
 */
export function AgentAutocomplete({ value, onChange, disabled = false }: AgentAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AvailableAgentItem | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useDebouncedValue(query.trim(), 300);
  const { data, isFetching, error } = useAvailableAgents(search, isOpen && !selected);
  const people = data?.items ?? [];
  const total = data?.total ?? 0;
  const typing = query.trim() !== search;

  // Cleared from outside (e.g. Cancel): forget the picked person. Adjusting state during render
  // avoids an extra pass: https://react.dev/learn/you-might-not-need-an-effect
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (!value) setSelected(null);
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (person: AvailableAgentItem) => {
    setSelected(person);
    setQuery("");
    setIsOpen(false);
    onChange(person.personId, person);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    onChange("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsOpen(true);
      return;
    }
    const count = Math.max(1, people.length);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? count - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const person = people[highlightedIndex];
      if (person) handleSelect(person);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const loading = isFetching || typing;

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {selected ? (
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {initials(selected.fullName)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground truncate">{selected.fullName}</span>
                {selected.isCandidate && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    Candidate
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
                <span>{selected.phone ?? "No phone"}</span>
                <span>•</span>
                <span>{selected.telegramLinked ? "Telegram linked" : "SMS only"}</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Change</span>
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="agent-autocomplete-listbox"
            placeholder="Type a name..."
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="h-8.5 text-xs bg-background pl-8 pr-8 w-full"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Show people"
            onClick={() => setIsOpen((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isOpen && !selected && (
        <div
          id="agent-autocomplete-listbox"
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border/80 rounded-lg shadow-md max-h-60 overflow-y-auto divide-y divide-border/40 text-xs"
        >
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/40 uppercase tracking-wider">
            <span>Not yet agents</span>
            <FieldSpinner loading={loading} />
          </div>

          {error ? (
            <div className="p-3 text-center text-destructive text-xs">Couldn&rsquo;t load people. Try again.</div>
          ) : people.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-xs">
              {loading
                ? "Searching…"
                : search
                  ? <>Nobody who isn&rsquo;t already an agent matches &ldquo;{search}&rdquo;.</>
                  : "Nobody is available to assign."}
            </div>
          ) : (
            people.map((person, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <div
                  key={person.personId}
                  role="option"
                  aria-selected={isHighlighted}
                  onClick={() => handleSelect(person)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`p-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                    isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                      {initials(person.fullName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground text-xs truncate">{person.fullName}</span>
                        {person.isCandidate && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                            Candidate
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{person.phone ?? "No phone"}</div>
                    </div>
                  </div>
                  <span className="shrink-0 pl-2 text-[10px] text-muted-foreground">
                    {person.telegramLinked ? "Telegram" : "SMS only"}
                  </span>
                </div>
              );
            })
          )}

          {!error && total > people.length && (
            <div className="px-2.5 py-1.5 text-[11px] text-muted-foreground bg-muted/20">
              Showing {people.length} of {total.toLocaleString()}. Keep typing to narrow.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
