"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Swords, Trash2 } from "lucide-react";
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

export function TurnTracker({ campaignId, turns, availablePlayers, availableNpcs }: Props) {
  const [newType, setNewType] = useState<"player" | "npc">("player");
  const [newEntityId, setNewEntityId] = useState("");
  const [newInitiative, setNewInitiative] = useState(10);
  const [busy, setBusy] = useState(false);

  const sorted = [...turns].sort((a, b) => a.position - b.position);
  const activeIdx = sorted.findIndex((t) => t.is_active);

  async function postTurns(url: string, body: object) {
    setBusy(true);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      emitLiveRefresh("turns");
    } finally {
      setBusy(false);
    }
  }

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

  async function addEntry() {
    const entityList = newType === "player" ? availablePlayers : availableNpcs;
    const entity = entityList.find((e) => e.id === newEntityId);
    if (!entity) return;

    const newEntry: TurnEntry = {
      id: crypto.randomUUID(),
      entity_type: newType,
      entity_id: entity.id,
      entity_name: entity.name,
      initiative: newInitiative,
      position: sorted.length,
      is_active: sorted.length === 0,
    };

    const allByInitiative = [...sorted, newEntry].sort((a, b) => b.initiative - a.initiative);
    await putTurns(allByInitiative);
    setNewEntityId("");
    setNewInitiative(10);
  }

  async function removeEntry(id: string) {
    const remaining = sorted.filter((t) => t.id !== id);
    await putTurns(remaining);
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
          <Button variant="ghost" onClick={clearAll} disabled={busy}>
            <Trash2 className="mr-1 h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Turn list */}
      {sorted.length > 0 ? (
        <div className="space-y-1.5">
          {sorted.map((turn, idx) => (
            <div
              key={turn.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                turn.is_active
                  ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10"
                  : "border border-white/6 bg-white/4"
              }`}
            >
              <span className="w-5 text-center text-xs font-bold text-white/40">{idx + 1}</span>
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: turn.entity_type === "npc" ? "#ef4444" : "#3b82f6" }}
              >
                {turn.entity_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-white">{turn.entity_name}</p>
                <p className="text-[10px] text-white/40">
                  {turn.entity_type === "player" ? "Jogador" : "NPC"} · Init {turn.initiative}
                </p>
              </div>
              {turn.is_active && (
                <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                  Ativo
                </span>
              )}
              <button
                className="text-white/30 hover:text-rose-400 transition-colors"
                onClick={() => removeEntry(turn.id)}
                disabled={busy}
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/40">Nenhum combatente na ordem de turno.</p>
      )}

      {/* Navigation */}
      {sorted.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="gap-1"
            onClick={() => postTurns(`/api/master/campaigns/${campaignId}/turns`, { action: "prev" })}
            disabled={busy}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button
            className="flex-1 gap-1"
            onClick={() => postTurns(`/api/master/campaigns/${campaignId}/turns`, { action: "next" })}
            disabled={busy}
          >
            Próximo turno <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Add entry */}
      <div className="rounded-xl border border-white/8 bg-black/20 p-3 space-y-3">
        <p className="text-xs font-semibold text-white/60">Adicionar à ordem</p>
        <div className="grid gap-2 sm:grid-cols-[auto_1fr_80px_auto]">
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
            {(newType === "player" ? availablePlayers : availableNpcs).map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <input
            type="number"
            className="field text-sm"
            placeholder="Init"
            value={newInitiative}
            onChange={(e) => setNewInitiative(Number(e.target.value))}
          />
          <Button variant="secondary" onClick={addEntry} disabled={busy || !newEntityId}>
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}
