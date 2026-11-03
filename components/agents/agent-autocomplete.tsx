"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  AVAILABLE_AGENTS_POOL,
  AvailableAgent,
} from "@/lib/data/available-agents-pool";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  CheckCircle2,
  X,
  User,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

interface AgentAutocompleteProps {
  value: string;
  onChange: (personId: string, agent?: AvailableAgent) => void;
  preferredState?: string;
  disabled?: boolean;
}

export function AgentAutocomplete({
  value,
  onChange,
  preferredState,
  disabled = false,
}: AgentAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AvailableAgent | null>(() => {
    if (!value) return null;
    return AVAILABLE_AGENTS_POOL.find((a) => a.id === value) || null;
  });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if value changed externally
  useEffect(() => {
    if (!value) {
      setSelectedAgent(null);
    } else {
      const match = AVAILABLE_AGENTS_POOL.find((a) => a.id === value);
      if (match) setSelectedAgent(match);
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter available agents pool
  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Prioritize agents from the same state if given
      if (preferredState) {
        const matchingState = AVAILABLE_AGENTS_POOL.filter(
          (a) => a.state.toLowerCase() === preferredState.toLowerCase()
        );
        const others = AVAILABLE_AGENTS_POOL.filter(
          (a) => a.state.toLowerCase() !== preferredState.toLowerCase()
        );
        return [...matchingState, ...others].slice(0, 6);
      }
      return AVAILABLE_AGENTS_POOL.slice(0, 6);
    }

    return AVAILABLE_AGENTS_POOL.filter((agent) => {
      const matchName = agent.name.toLowerCase().includes(q);
      const matchPhone = agent.phone.toLowerCase().includes(q);
      const matchId = agent.id.toLowerCase().includes(q);
      const matchLoc =
        agent.state.toLowerCase().includes(q) ||
        agent.lga.toLowerCase().includes(q);
      return matchName || matchPhone || matchId || matchLoc;
    });
  }, [query, preferredState]);

  const handleSelect = (agent: AvailableAgent) => {
    setSelectedAgent(agent);
    setQuery("");
    setIsOpen(false);
    onChange(agent.id, agent);
  };

  const handleCustomUuidSelect = (customId: string) => {
    const syntheticAgent: AvailableAgent = {
      id: customId,
      name: "Custom Designated Agent",
      phone: "—",
      role: "Official Party Agent",
      status: "Available",
      state: preferredState || "Designated",
      lga: "Direct Assignment",
      verificationStatus: "verified",
    };
    setSelectedAgent(syntheticAgent);
    setQuery("");
    setIsOpen(false);
    onChange(customId, syntheticAgent);
  };

  const handleClear = () => {
    setSelectedAgent(null);
    setQuery("");
    onChange("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    const totalItems = filteredAgents.length + (query.trim().length > 8 ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev <= 0 ? Math.max(0, totalItems - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredAgents[highlightedIndex]) {
        handleSelect(filteredAgents[highlightedIndex]);
      } else if (query.trim()) {
        handleCustomUuidSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {/* Selected Agent Preview */}
      {selectedAgent ? (
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {getInitials(selectedAgent.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground truncate">
                  {selectedAgent.name}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 gap-0.5"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                  Verified
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
                <span>{selectedAgent.phone}</span>
                <span>•</span>
                <span className="font-mono text-[10px] text-foreground/80 truncate">
                  UUID: {selectedAgent.id.slice(0, 8)}…
                </span>
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
        /* Autocomplete Search Input */
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="agent-autocomplete-listbox"
            placeholder="Type agent name, phone, or UUID..."
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
            onClick={() => setIsOpen((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Autocomplete Dropdown Listbox */}
      {isOpen && !selectedAgent && (
        <div
          id="agent-autocomplete-listbox"
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border/80 rounded-lg shadow-md max-h-60 overflow-y-auto divide-y divide-border/40 text-xs"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/40 uppercase tracking-wider">
            {query.trim()
              ? `Suggested Agents (${filteredAgents.length})`
              : "Available Verified Agents"}
          </div>

          {filteredAgents.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-xs space-y-2">
              <p>No verified agents found matching &ldquo;{query}&rdquo;.</p>
              {query.trim().length >= 8 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCustomUuidSelect(query.trim())}
                  className="h-7 text-xs border-dashed gap-1"
                >
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span>Assign Custom UUID: {query.trim().slice(0, 12)}…</span>
                </Button>
              )}
            </div>
          ) : (
            filteredAgents.map((agent, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <div
                  key={agent.id}
                  role="option"
                  aria-selected={isHighlighted}
                  onClick={() => handleSelect(agent)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`p-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                    isHighlighted
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                      {getInitials(agent.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground text-xs truncate">
                          {agent.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                        >
                          Verified
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                        <span>{agent.phone}</span>
                        <span>•</span>
                        <span>
                          {agent.lga}, {agent.state}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span className="font-mono text-[10px] text-muted-foreground block">
                      {agent.id.slice(0, 8)}…
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Available
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Quick manual entry helper */}
          {query.trim().length >= 8 && filteredAgents.length > 0 && (
            <div
              role="option"
              aria-selected={highlightedIndex === filteredAgents.length}
              onClick={() => handleCustomUuidSelect(query.trim())}
              className="p-2 cursor-pointer bg-muted/20 hover:bg-muted text-muted-foreground text-[11px] flex items-center gap-1.5"
            >
              <User className="w-3 h-3" />
              <span>Or use custom UUID: <strong className="font-mono text-foreground">{query.trim()}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
