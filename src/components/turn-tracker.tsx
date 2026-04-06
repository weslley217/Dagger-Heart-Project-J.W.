"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Swords, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitLiveRefresh } from "@/hooks/use-live-refresh";

export type TurnEntry = {
  id: string;
  entity_type: "player" | "npc";
  entity_id: string;
  entity_name: string;
  initiative: number;
  position: number;
  is_active: boolean;
};

type Props = {
  campaignId: string;
  turns: TurnEntry[];
  availablePlayers: Array<{ id: string; name: string }>;
  availableNpcs: Array<{ id: string; name: string }>;
};

// Class/entity color helpers
const ENTITY_COLORS: Record<string, string> = {
  player: "#3b82f6",
  npc: "#ef4444",
  boss: "#f97316",
};

export function TurnTracker({ campaignId, turns, availablePlayers, availableNpcs }: Props) {
  const [newType, setNewType] = useState<"player" | "npc">("player");
  const [newEntityId, setNewEntityId] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = [...turns].sort((a, b) => a.position - b.position);

  async function putTurns(entries: TurnEntry[]) {
    setBusy(true);
    try {
      await fetch(`/api/master/campaigns/${campaignId}/turns`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: entries.map((t) => ({
            entity_type: t.entity_type,
            entity_id: t.entity_id,
            entity_name: t.entity_name,
            initiative: t.initiative,
          })),
        }),
      });
      emitLiveRefresh("turns");
    } finally {
      setBusy(false);
    }
  }

  async function advanceTurn(action: "next" | "prev") {
    setBusy(true);
    try {
      await fetch(`/api/master/campaigns/${campaignId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      emitLiveRefresh("turns");
    } finally {
      setBusy(false);
    }
  }

  async function addEntry() {
    const entityList = newType === "player" ? availablePlayers : availableNpcs;
    const entity = entityList.find((e) => e.id === newEntityId);
    if (!entity) return;

    // Check not already added
    if (sorted.find((t) => t.entity_id === entity.id)) return;

    const newEntry: TurnEntry = {
      id: crypto.randomUUID(),
      entity_type: newType,
      entity_id: entity.id,
      entity_name: entity.name,
      initiative: 0,
      position: sorted.length,
      is_active: sorted.length === 0,
    };

    await putTurns([...sorted, newEntry]);
    setNewEntityId("");
  }

  async function moveEntry(idx: number, direction: "up" | "down") {
    const newList = [...sorted];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newList.length) return;
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    await putTurns(newList);
  }

  async function removeEntry(idx: number) {
    const newList = sorted.filter((_, i) => i !== idx);
    await putTurns(newList);
  }

  async function clearAll() {
    await putTurns([]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-[var(--accent)]" />
          <p className="text-sm font-semibold text-white">Ordem de turnos</p>
        </div>
        {sorted.length > 0 && (
          <Button variant="ghost" onClick={clearAll} disabled={busy} className="text-xs gap-1">
            <Trash2 className="h-3 w-3" /> Limpar tudo
          </Button>
        )}
      </div>

      {/* Turn list */}
      {sorted.length > 0 ? (
        <div className="space-y-1.5">
          {sorted.map((turn, idx) => (
            <div
              key={turn.id}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all ${
                turn.is_active
                  ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10 shadow-[0_0_12px_rgba(213,177,106,0.15)]"
                  : "border border-white/6 bg-white/4"
              }`}
            >
              {/* Position badge */}
              <span className="w-5 shrink-0 text-center text-xs font-bold text-white/30">{idx + 1}</span>

              {/* Entity token */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow"
                style={{ background: ENTITY_COLORS[turn.entity_type] ?? "#6b7280" }}
              >
                {turn.entity_name.charAt(0).toUpperCase()}
              </div>

              {/* Name + type */}
              <div className="flex-1 min-w-0">
                <p className={`truncate text-sm font-semibold ${turn.is_active ? "text-[var(--accent)]" : "text-white"}`}>
                  {turn.entity_name}
                </p>
                <p className="text-[10px] text-white/35">
                  {turn.entity_type === "player" ? "Jogador" : "NPC"}
                </p>
              </div>

              {turn.is_active && (
                <span className="shrink-0 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                  ⚔️ Ativo
                </span>
              )}

              {/* Reorder buttons */}
              <div className="flex gap-0.5">
                <button
                  onClick={() => moveEntry(idx, "up")}
                  disabled={busy || idx === 0}
                  className="h-6 w-6 rounded-lg bg-white/6 text-white/40 hover:bg-white/12 hover:text-white disabled:opacity-20 transition-colors flex items-center justify-center"
                  title="Mover para cima"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveEntry(idx, "down")}
                  disabled={busy || idx === sorted.length - 1}
                  className="h-6 w-6 rounded-lg bg-white/6 text-white/40 hover:bg-white/12 hover:text-white disabled:opacity-20 transition-colors flex items-center justify-center"
                  title="Mover para baixo"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => removeEntry(idx)}
                  disabled={busy}
                  className="h-6 w-6 rounded-lg text-white/20 hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-20 transition-colors flex items-center justify-center"
                  title="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
          <p className="text-sm text-white/35">Nenhum combatente na ordem de turno.</p>
          <p className="mt-1 text-xs text-white/20">Adicione jogadores e NPCs abaixo.</p>
        </div>
      )}

      {/* Navigation */}
      {sorted.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => advanceTurn("prev")} disabled={busy}>
            ← Turno anterior
          </Button>
          <Button onClick={() => advanceTurn("next")} disabled={busy} className="gap-1">
            Próximo turno <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Add entry */}
      <div className="rounded-xl border border-white/8 bg-black/20 p-3 space-y-2">
        <p className="text-xs font-semibold text-white/50">Adicionar combatente</p>
        <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
          <select
            className="field text-sm"
            value={newType}
            onChange={(e) => { setNewType(e.target.value as "player" | "npc"); setNewEntityId(""); }}
          >
            <option value="player">Jogador</option>
            <option value="npc">NPC</option>
          </select>
          <select
            className="field text-sm"
            value={newEntityId}
            onChange={(e) => setNewEntityId(e.target.value)}
          >
            <option value="">Selecionar...</option>
            {(newType === "player" ? availablePlayers : availableNpcs)
              .filter((e) => !sorted.find((t) => t.entity_id === e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
          </select>
          <Button variant="secondary" onClick={addEntry} disabled={busy || !newEntityId}>
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}
