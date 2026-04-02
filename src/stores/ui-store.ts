"use client";

import { create } from "zustand";

type PlayerTab = "criados" | "novo";
type ImportTab = "pdf" | "json" | "manual";

type UiState = {
  playerTab: PlayerTab;
  importTab: ImportTab;
  masterCharacterId: string | null;
  setPlayerTab: (tab: PlayerTab) => void;
  setImportTab: (tab: ImportTab) => void;
  setMasterCharacterId: (characterId: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  playerTab: "criados",
  importTab: "pdf",
  masterCharacterId: null,
  setPlayerTab: (playerTab) => set({ playerTab }),
  setImportTab: (importTab) => set({ importTab }),
  setMasterCharacterId: (masterCharacterId) => set({ masterCharacterId }),
}));
