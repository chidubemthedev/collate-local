"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Persona, BroadcastData, AccessGroup } from "@/lib/types";
import { PERSONAS, getEffectivePersona } from "@/lib/tree-permissions";
import { BROADCASTS_DATA } from "@/lib/data/broadcasts-data";
import { ACCESS_GROUPS_DATA } from "@/lib/data/settings-data";

interface AppContextType {
  activePersona: Persona;
  setPersonaId: (id: string) => void;
  broadcasts: BroadcastData[];
  accessGroups: AccessGroup[];
  // Selected area filter shortcuts across pages
  selectedStateCode: string;
  setSelectedStateCode: (code: string) => void;
  selectedLgaCode: string;
  setSelectedLgaCode: (code: string) => void;
  selectedWardCode: string;
  setSelectedWardCode: (code: string) => void;
  resetAreaFilters: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [personaId, setPersonaIdState] = useState<string>("persona-party-national");
  const [broadcasts] = useState<BroadcastData[]>(BROADCASTS_DATA);
  const [accessGroups] = useState<AccessGroup[]>(ACCESS_GROUPS_DATA);

  // Global area navigation state
  const [selectedStateCode, setSelectedStateCode] = useState<string>("all");
  const [selectedLgaCode, setSelectedLgaCode] = useState<string>("all");
  const [selectedWardCode, setSelectedWardCode] = useState<string>("all");

  const activePersona = getEffectivePersona(personaId);

  // When persona changes, adjust default area filters if persona is locked to a constituency
  const setPersonaId = (id: string) => {
    setPersonaIdState(id);
    const p = getEffectivePersona(id);
    if (p.stateCode) {
      setSelectedStateCode(p.stateCode);
    } else {
      setSelectedStateCode("all");
    }
    if (p.lgaCode) {
      setSelectedLgaCode(p.lgaCode);
    } else {
      setSelectedLgaCode("all");
    }
    setSelectedWardCode("all");
  };

  const resetAreaFilters = () => {
    if (activePersona.stateCode) {
      setSelectedStateCode(activePersona.stateCode);
    } else {
      setSelectedStateCode("all");
    }
    if (activePersona.lgaCode) {
      setSelectedLgaCode(activePersona.lgaCode);
    } else {
      setSelectedLgaCode("all");
    }
    setSelectedWardCode("all");
  };

  return (
    <AppContext.Provider
      value={{
        activePersona,
        setPersonaId,
        broadcasts,
        accessGroups,
        selectedStateCode,
        setSelectedStateCode,
        selectedLgaCode,
        setSelectedLgaCode,
        selectedWardCode,
        setSelectedWardCode,
        resetAreaFilters,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
