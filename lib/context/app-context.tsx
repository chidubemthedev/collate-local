"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Persona, BroadcastData, RecipientPerson, AccessGroup } from "@/lib/types";
import { PERSONAS, getEffectivePersona } from "@/lib/tree-permissions";
import { BROADCASTS_DATA } from "@/lib/data/broadcasts-data";
import { RECIPIENTS_DATA } from "@/lib/data/recipients-data";
import { ACCESS_GROUPS_DATA } from "@/lib/data/settings-data";

interface AppContextType {
  activePersona: Persona;
  setPersonaId: (id: string) => void;
  broadcasts: BroadcastData[];
  addBroadcast: (broadcast: Omit<BroadcastData, "id" | "timestamp">) => BroadcastData;
  updateBroadcast: (id: string, updates: Partial<BroadcastData>) => void;
  recipients: RecipientPerson[];
  addRecipient: (person: Omit<RecipientPerson, "id">) => void;
  importRecipients: (newPersons: Omit<RecipientPerson, "id">[]) => void;
  accessGroups: AccessGroup[];
  addAccessGroup: (group: Omit<AccessGroup, "id">) => void;
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
  const [broadcasts, setBroadcasts] = useState<BroadcastData[]>(BROADCASTS_DATA);
  const [recipients, setRecipients] = useState<RecipientPerson[]>(RECIPIENTS_DATA);
  const [accessGroups, setAccessGroups] = useState<AccessGroup[]>(ACCESS_GROUPS_DATA);

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

  const addBroadcast = (data: Omit<BroadcastData, "id" | "timestamp">): BroadcastData => {
    const newBroadcast: BroadcastData = {
      ...data,
      id: `bc-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setBroadcasts((prev) => [newBroadcast, ...prev]);
    return newBroadcast;
  };

  const updateBroadcast = (id: string, updates: Partial<BroadcastData>) => {
    setBroadcasts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const addRecipient = (person: Omit<RecipientPerson, "id">) => {
    const newPerson: RecipientPerson = {
      ...person,
      id: `rec-${Date.now()}`,
    };
    setRecipients((prev) => [newPerson, ...prev]);
  };

  const importRecipients = (newPersons: Omit<RecipientPerson, "id">[]) => {
    const prepared = newPersons.map((p, idx) => ({
      ...p,
      id: `rec-imp-${Date.now()}-${idx}`,
    }));
    setRecipients((prev) => [...prepared, ...prev]);
  };

  const addAccessGroup = (group: Omit<AccessGroup, "id">) => {
    const newGroup: AccessGroup = {
      ...group,
      id: `grp-${Date.now()}`,
    };
    setAccessGroups((prev) => [...prev, newGroup]);
  };

  return (
    <AppContext.Provider
      value={{
        activePersona,
        setPersonaId,
        broadcasts,
        addBroadcast,
        updateBroadcast,
        recipients,
        addRecipient,
        importRecipients,
        accessGroups,
        addAccessGroup,
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
