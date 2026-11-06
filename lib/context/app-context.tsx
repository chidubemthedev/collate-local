"use client";

import React, { createContext, useContext, useState } from "react";
import { BroadcastData, AccessGroup } from "@/lib/types";
import { BROADCASTS_DATA } from "@/lib/data/broadcasts-data";
import { ACCESS_GROUPS_DATA } from "@/lib/data/settings-data";
import { usePermissions } from "@/lib/hooks/use-auth";

interface AppContextType {
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
  const [broadcasts] = useState<BroadcastData[]>(BROADCASTS_DATA);
  const [accessGroups] = useState<AccessGroup[]>(ACCESS_GROUPS_DATA);

  // Global area navigation state
  const [selectedStateCode, setSelectedStateCode] = useState<string>("all");
  const [selectedLgaCode, setSelectedLgaCode] = useState<string>("all");
  const [selectedWardCode, setSelectedWardCode] = useState<string>("all");

  // The area the current access (own, or previewed with "View as") lies in. Pages open there,
  // and move there again whenever the access changes, so a Governor view starts on its state.
  const { data: permissions } = usePermissions();
  const home = permissions?.homeArea ?? null;
  const homeState = home?.stateCode ?? "all";
  const homeLga = home?.lgaCode ?? "all";
  const homeWard = home?.wardCode ?? "all";
  const homeKey = permissions ? `${permissions.viewAs ?? ""}|${homeState}|${homeLga}|${homeWard}` : null;
  const [appliedHomeKey, setAppliedHomeKey] = useState<string | null>(null);
  if (homeKey !== null && homeKey !== appliedHomeKey) {
    // Adjusting state while rendering (not in an effect), so there is no frame showing the old area.
    setAppliedHomeKey(homeKey);
    setSelectedStateCode(homeState);
    setSelectedLgaCode(homeLga);
    setSelectedWardCode(homeWard);
  }

  const resetAreaFilters = () => {
    setSelectedStateCode(homeState);
    setSelectedLgaCode(homeLga);
    setSelectedWardCode(homeWard);
  };

  return (
    <AppContext.Provider
      value={{
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
