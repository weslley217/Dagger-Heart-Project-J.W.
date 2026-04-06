"use client";

import { useState } from "react";
import { Activity, Flame, Heart, Shield, Sparkles, Swords, Wind } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";
import { MiniMap, type MapToken } from "@/components/mini-map";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

const HEALTH_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  plena_forma:       { label: "Plena forma",       color: "text-emerald-400", emoji: "💪" },
  ferido:            { label: "Ferido",             color: "text-yellow-400",  emoji: "🩸" },
  gravemente_ferido: { label: "Gravemente ferido",  color: "text-orange-400",  emoji: "⚠️" },
  critico:           { label: "Estado crítico",     color: "text-red-400",     emoji: "💀" },
  desacordado:       { label: "Desacordado",        color: "text-white/40",    emoji: "😵" },
  unknown:           { label: "Desconhecido",       color: "text-white/40",    emoji: "❓" },
};

type Char = {
  id: string; name: string; level: number; class_key: string;
  current_hp: number; total_hp: number; armor_current: number; armor_max: number;
  threshold1: number; threshold2: number; evasion: number;
  conditions: Array<{ label: string; duration?: number }>;
  resources: Record<string, number>; is_downed: boolean;
  equipment: Record<string, unknown>;
};

type Npc = {
  id: string; name: string; npc_type: string; health_indicator: string;
  visible_to_players: boolean; conditions: Array<{ label: string }>;
  token_color: string; token_x: number | null; token_y: number | null;
};

type Turn = {
  id: string; entity_type: string; entity_id: string; entity_name: string;
  initiative: number; position: number; is_active: boolean;
};

function parseChar(raw: Record<string, unknown>): Char {
  return {
    id: String(raw.id), name: String(raw.name), level: Number(raw.level ?? 1),
    class_key: String(raw.class_key ?? ""),
    current_hp: Number(raw.current_hp ?? 0), total_hp: Number(raw.total_hp ?? 1),
    armor_current: Number(raw.armor_current ?? 0), armor_max: Number(raw.armor_max ?? 0),
    threshold1: Number(raw.threshold1 ?? 7), threshold2: Number(raw.threshold2 ?? 14),
    evasion: Number(raw.evasion ?? 10),
    conditions: (Array.isArray(raw.conditions) ? raw.conditions : []) as Char["conditions"],
    resources: (typeof raw.resources === "object" && raw.resources ? raw.resources : {}) as Record<string, number>,
    is_downed: Boolean(raw.is_downed),
    equipment: (typeof raw.equipment === "object" && raw.equipment ? raw.equipment : {}) as Record<string, unknown>,
  };
}

function parseNpc(raw: Record<string, unknown>): Npc {
  return {
    id: String(raw.id), name: String(raw.name),
    npc_type: String(raw.npc_type ?? "monster"),
    health_indicator: String(raw.health_indicator ?? "unknown"),
    visible_to_players: Boolean(raw.visible_to_players),
    conditions: (Array.isArray(raw.conditions) ? raw.conditions : []) as Npc["conditions"],
    token_color: String(raw.token_color ?? "#ef4444"),
    token_x: raw.token_x != null ? Number(raw.token_x) : null,
    token_y: raw.token_y != null ? Number(raw.token_y) : null,
  };
}

function StatBox({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/8 bg-black/20 py-3 px-2">
      <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
      <p className={`text-2xl font-bold ${color ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

function ResourceTrack({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-white/50">
        <span>{label}</span>
        <span className={color}>{current}/{max}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: Math.max(max, 1) }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 flex-1 rounded-full transition-all ${i < current ? `${color.replace("text-", "bg-")}` : "bg-white/10"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function PlayerSessionView({
  campaignId,
  campaignRaw,
  charactersRaw,
  npcsRaw,
  turnsRaw,
}: {
  campaignId: string;
  campaignRaw: Record<string, unknown>;
  charactersRaw: Record<string, unknown>[];
  npcsRaw: Record<string, unknown>[];
  turnsRaw: Record<string, unknown>[];
}) {
  useLiveRefresh(4000);

  const sessionActive = Boolean(campaignRaw.session_active);
  const characters = charactersRaw.map(parseChar);
  const npcs = npcsRaw.map(parseNpc).filter((n) => n.visible_to_players);
  const turns: Turn[] = (turnsRaw as Record<string, unknown>[]).map((t) => ({
    id: String(t.id), entity_type: String(t.entity_type), entity_id: String(t.entity_id),
    entity_name: String(t.entity_name), initiative: Number(t.initiative ?? 0),
    position: Number(t.position ?? 0), is_active: Boolean(t.is_active),
  })).sort((a, b) => a.position - b.position);

  const mapTokens: MapToken[] = [
    ...(Array.isArray(campaignRaw.map_tokens) ? (campaignRaw.map_tokens as MapToken[]) : []),
  ].filter((t) => {
    if (t.type === "npc") {
      const npc = npcs.find((n) => n.id === t.entity_id);
      return npc?.visible_to_players ?? false;
    }
    return true;
  });

  const [selectedCharId, setSelectedCharId] = useState(characters[0]?.id ?? "");
  const char = characters.find((c) => c.id === selectedCharId) ?? characters[0] ?? null;

  const activeTurn = turns.find((t) => t.is_active);
  const isMyTurn = char && activeTurn?.entity_id === char.id;

  if (!sessionActive) {
    return (
      <SurfaceCard className="py-16 text-center space-y-3">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
            <Activity className="h-6 w-6 text-white/20" />
          </div>
        </div>
        <p className="text-lg font-semibold text-white/50">Sessão não iniciada</p>
        <p className="text-sm text-white/30">Aguarde o mestre iniciar a sessão para entrar.</p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session live indicator */}
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <p className="text-sm font-semibold text-emerald-300">Sessão ao vivo</p>
        {isMyTurn && (
          <span className="ml-auto rounded-full bg-[var(--accent)]/20 px-3 py-0.5 text-xs font-bold text-[var(--accent)] animate-bounce">
            ⚔️ Seu turno!
          </span>
        )}
      </div>

      {/* Character selector (if player has multiple) */}
      {characters.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCharId(c.id)}
              className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                c.id === selectedCharId
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {char && (
        <>
          {/* Character header */}
          <SurfaceCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{char.name}</h2>
                <p className="text-xs text-white/45">{char.class_key} · Nível {char.level}</p>
              </div>
              {char.is_downed && (
                <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-sm font-bold text-rose-400">
                  💀 Caído
                </span>
              )}
            </div>

            {/* HP bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-white/60">
                <span className="flex items-center gap-1.5"><Heart className="h-4 w-4 text-rose-400" /> Pontos de Vida</span>
                <span className="font-bold text-white">{char.current_hp} / {char.total_hp}</span>
              </div>
              <div className="h-4 w-full rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-4 rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(0, Math.min(100, (char.current_hp / char.total_hp) * 100))}%`,
                    background: char.current_hp / char.total_hp > 0.6
                      ? "linear-gradient(90deg,#16a34a,#22c55e)"
                      : char.current_hp / char.total_hp > 0.3
                      ? "linear-gradient(90deg,#d97706,#eab308)"
                      : "linear-gradient(90deg,#b91c1c,#ef4444)",
                  }}
                />
              </div>
            </div>

            {/* Key stats grid */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <StatBox label="Armadura" value={`${char.armor_current}/${char.armor_max}`} color="text-blue-400" />
              <StatBox label="Evasão" value={char.evasion} color="text-violet-400" />
              <StatBox label="Limiar" value={`${char.threshold1}/${char.threshold2}`} color="text-orange-400" />
              <StatBox label="Esperança" value={char.resources.hope ?? 0} sub={`/${char.resources.hopeMax ?? "?"}`} color="text-yellow-400" />
              <StatBox label="Fadiga" value={char.resources.fatigue ?? 0} sub={`/${char.resources.fatigueMax ?? "?"}`} color="text-purple-400" />
              <StatBox label="Estresse" value={char.resources.stress ?? 0} sub={`/${char.resources.stressMax ?? "?"}`} color="text-rose-400" />
            </div>

            {/* Resource tracks */}
            <div className="space-y-3">
              <ResourceTrack label="Esperança" current={char.resources.hope ?? 0} max={char.resources.hopeMax ?? 6} color="text-yellow-400" />
              <ResourceTrack label="Fadiga" current={char.resources.fatigue ?? 0} max={char.resources.fatigueMax ?? 6} color="text-purple-400" />
              <ResourceTrack label="Estresse" current={char.resources.stress ?? 0} max={char.resources.stressMax ?? 6} color="text-rose-400" />
            </div>

            {/* Conditions */}
            {char.conditions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-widest text-white/40">Condições ativas</p>
                <div className="flex flex-wrap gap-1.5">
                  {char.conditions.map((c) => (
                    <span key={c.label} className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
                      {c.label}{c.duration !== undefined ? ` · ${c.duration}t` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SurfaceCard>

          {/* Equipment summary */}
          {(char.equipment.primaryWeapon || char.equipment.secondaryWeapon || char.equipment.armor) && (
            <SurfaceCard className="space-y-3">
              <div className="flex items-center gap-2">
                <Sword className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-sm font-semibold text-white">Equipamento</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                {[
                  { label: "Arma primária", item: char.equipment.primaryWeapon },
                  { label: "Arma secundária", item: char.equipment.secondaryWeapon },
                  { label: "Armadura", item: char.equipment.armor },
                ].map(({ label, item }) => {
                  const eq = item as Record<string, unknown> | null | undefined;
                  if (!eq) return null;
                  return (
                    <div key={label} className="rounded-xl border border-white/8 bg-black/20 p-3">
                      <p className="text-white/40">{label}</p>
                      <p className="mt-1 font-semibold text-white">{String(eq.name ?? "—")}</p>
                      {Boolean(eq.damage) && <p className="text-[var(--accent)]">{String(eq.damage)}</p>}
                      {Boolean(eq.ability) && <p className="text-white/50 mt-1">{String(eq.ability)}</p>}
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          )}
        </>
      )}

      {/* Turn order */}
      {turns.length > 0 && (
        <SurfaceCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold text-white">Ordem de turnos</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${
                  turn.is_active
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 scale-105"
                    : "border-white/8 bg-white/4"
                }`}
              >
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: turn.entity_type === "npc" ? "#ef4444" : "#3b82f6" }}
                >
                  {turn.entity_name.charAt(0)}
                </div>
                <span className={`font-semibold ${turn.is_active ? "text-[var(--accent)]" : "text-white/70"}`}>
                  {turn.entity_name}
                </span>
                {turn.is_active && <span className="text-[var(--accent)]">⚔️</span>}
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* Visible NPCs */}
      {npcs.length > 0 && (
        <SurfaceCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-400" />
            <p className="text-sm font-semibold text-white">Inimigos / NPCs visíveis</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {npcs.map((npc) => {
              const health = HEALTH_LABELS[npc.health_indicator] ?? HEALTH_LABELS.unknown;
              return (
                <div key={npc.id} className="rounded-xl border border-white/8 bg-black/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: npc.token_color }}>
                      {npc.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{npc.name}</p>
                      <p className="text-[10px] text-white/40">{npc.npc_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{health.emoji}</span>
                    <span className={`text-xs font-semibold ${health.color}`}>{health.label}</span>
                  </div>
                  {npc.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {npc.conditions.map((c) => (
                        <span key={c.label} className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] text-white/60">
                          {c.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* Mini-map (read-only for player) */}
      {mapTokens.length > 0 && (
        <SurfaceCard>
          <MiniMap tokens={mapTokens} readonly />
        </SurfaceCard>
      )}
    </div>
  );
}

// fix missing import
import { Sword } from "lucide-react";
