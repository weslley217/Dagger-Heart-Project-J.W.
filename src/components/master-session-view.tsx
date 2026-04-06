"use client";

import { useCallback, useState } from "react";
import {
  Activity, AlertTriangle, BookOpen, Eye, EyeOff, Flame,
  Loader2, Plus, Shield, Skull, Swords, Trash2, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { NpcCreator } from "@/components/npc-creator";
import { MiniMap, type MapToken } from "@/components/mini-map";
import { TurnTracker, type TurnEntry } from "@/components/turn-tracker";
import { emitLiveRefresh, useLiveRefresh } from "@/hooks/use-live-refresh";
import { aplicarArmadura, atualizarHP, classificarDano } from "@/rules/damage";
import { commonConditions } from "@/lib/reference-data";

// ── Types ────────────────────────────────────────────────────────────────────
type NpcRaw = Record<string, unknown>;
type CharRaw = Record<string, unknown>;

type CampaignNpc = {
  id: string; campaign_id: string; name: string; npc_type: string; level: number;
  description: string | null; total_hp: number; current_hp: number;
  armor_max: number; armor_current: number; threshold1: number; threshold2: number;
  evasion: number; damage_dice: string | null; attack_bonus: number;
  conditions: Array<{ label: string; duration?: number }>;
  health_indicator: string; visible_to_players: boolean;
  token_x: number | null; token_y: number | null; token_color: string;
  token_icon: string; is_downed: boolean; notes: string | null;
};

type CampaignChar = {
  id: string; name: string; level: number; class_key: string;
  current_hp: number; total_hp: number; armor_current: number; armor_max: number;
  threshold1: number; threshold2: number; evasion: number;
  conditions: Array<{ label: string; duration?: number }>;
  resources: Record<string, number>; is_downed: boolean; player_id: string;
};

function parseNpc(raw: NpcRaw): CampaignNpc {
  return {
    id: String(raw.id), campaign_id: String(raw.campaign_id), name: String(raw.name),
    npc_type: String(raw.npc_type ?? "monster"), level: Number(raw.level ?? 1),
    description: (raw.description as string | null) ?? null,
    total_hp: Number(raw.total_hp ?? 10), current_hp: Number(raw.current_hp ?? 10),
    armor_max: Number(raw.armor_max ?? 0), armor_current: Number(raw.armor_current ?? 0),
    threshold1: Number(raw.threshold1 ?? 5), threshold2: Number(raw.threshold2 ?? 10),
    evasion: Number(raw.evasion ?? 10), damage_dice: (raw.damage_dice as string | null) ?? null,
    attack_bonus: Number(raw.attack_bonus ?? 0),
    conditions: (Array.isArray(raw.conditions) ? raw.conditions : []) as CampaignNpc["conditions"],
    health_indicator: String(raw.health_indicator ?? "unknown"),
    visible_to_players: Boolean(raw.visible_to_players),
    token_x: raw.token_x != null ? Number(raw.token_x) : null,
    token_y: raw.token_y != null ? Number(raw.token_y) : null,
    token_color: String(raw.token_color ?? "#ef4444"),
    token_icon: String(raw.token_icon ?? "monster"),
    is_downed: Boolean(raw.is_downed), notes: (raw.notes as string | null) ?? null,
  };
}

function parseChar(raw: CharRaw): CampaignChar {
  return {
    id: String(raw.id), name: String(raw.name), level: Number(raw.level ?? 1),
    class_key: String(raw.class_key ?? ""), current_hp: Number(raw.current_hp ?? 0),
    total_hp: Number(raw.total_hp ?? 1), armor_current: Number(raw.armor_current ?? 0),
    armor_max: Number(raw.armor_max ?? 0), threshold1: Number(raw.threshold1 ?? 7),
    threshold2: Number(raw.threshold2 ?? 14), evasion: Number(raw.evasion ?? 10),
    conditions: (Array.isArray(raw.conditions) ? raw.conditions : []) as CampaignChar["conditions"],
    resources: (typeof raw.resources === "object" && raw.resources ? raw.resources : {}) as Record<string, number>,
    is_downed: Boolean(raw.is_downed), player_id: String(raw.player_id ?? ""),
  };
}

const HEALTH_LABELS: Record<string, { label: string; color: string }> = {
  plena_forma:       { label: "Plena forma",         color: "text-emerald-400" },
  ferido:            { label: "Ferido",               color: "text-yellow-400" },
  gravemente_ferido: { label: "Gravemente ferido",    color: "text-orange-400" },
  critico:           { label: "Estado crítico",       color: "text-red-400" },
  desacordado:       { label: "Desacordado",          color: "text-white/40" },
  unknown:           { label: "Desconhecido",         color: "text-white/40" },
};

type MasterTab = "personagens" | "bestiario" | "sessao" | "mapa";

// ── Component ─────────────────────────────────────────────────────────────────
export function MasterSessionView({
  campaignId, campaignRaw, npcsRaw, turnsRaw, charactersRaw,
}: {
  campaignId: string;
  campaignRaw: Record<string, unknown>;
  npcsRaw: NpcRaw[];
  turnsRaw: Record<string, unknown>[];
  charactersRaw: CharRaw[];
}) {
  useLiveRefresh(8000);

  const [activeTab, setActiveTab] = useState<MasterTab>("personagens");

  // Session state
  const sessionActive = Boolean(campaignRaw.session_active);
  const [togglingSession, setTogglingSession] = useState(false);

  // NPC damage state
  const [npcDamageRaw, setNpcDamageRaw] = useState<Record<string, number>>({});
  const [npcUseArmor, setNpcUseArmor] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Condition state
  const [conditionInput, setConditionInput] = useState<Record<string, string>>({});
  const [conditionDuration, setConditionDuration] = useState<Record<string, number>>({});

  // Player damage state
  const [playerDamageRaw, setPlayerDamageRaw] = useState<Record<string, number>>({});
  const [playerUseArmor, setPlayerUseArmor] = useState<Record<string, boolean>>({});

  // Map tokens derived from campaign + live edits
  const rawTokens: MapToken[] = [
    ...charactersRaw.map((c) => ({
      id: `player-${String(c.id)}`,
      type: "player" as const,
      entity_id: String(c.id),
      name: String(c.name),
      x: 0.2 + Math.random() * 0.3,
      y: 0.3 + Math.random() * 0.4,
      color: "#3b82f6",
      visible: true,
    })),
    ...npcsRaw
      .filter((n) => n.token_x != null && n.token_y != null)
      .map((n) => ({
        id: `npc-${String(n.id)}`,
        type: "npc" as const,
        entity_id: String(n.id),
        name: String(n.name),
        x: Number(n.token_x) || 0.5,
        y: Number(n.token_y) || 0.5,
        color: String(n.token_color ?? "#ef4444"),
        visible: Boolean(n.visible_to_players),
      })),
  ];

  const [mapTokens, setMapTokens] = useState<MapToken[]>(() => {
    const saved = campaignRaw.map_tokens;
    return Array.isArray(saved) && saved.length > 0
      ? (saved as MapToken[])
      : rawTokens;
  });

  const npcs = npcsRaw.map(parseNpc);
  const characters = charactersRaw.map(parseChar);

  const turns: TurnEntry[] = turnsRaw.map((t) => ({
    id: String(t.id), entity_type: String(t.entity_type) as "player" | "npc",
    entity_id: String(t.entity_id), entity_name: String(t.entity_name),
    initiative: Number(t.initiative ?? 0), position: Number(t.position ?? 0),
    is_active: Boolean(t.is_active),
  }));

  // ── Actions ──────────────────────────────────────────────────────────────

  async function post(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Falha.");
    return data;
  }

  async function patch(url: string, body: object) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Falha.");
    return data;
  }

  async function toggleSession() {
    setTogglingSession(true);
    try {
      await post(`/api/master/campaigns/${campaignId}/session`, { active: !sessionActive });
      emitLiveRefresh("session");
    } finally {
      setTogglingSession(false);
    }
  }

  async function applyNpcDamage(npc: CampaignNpc) {
    setBusy(`npc-dmg-${npc.id}`);
    setError(null);
    try {
      const raw = npcDamageRaw[npc.id] ?? 0;
      const useArmor = npcUseArmor[npc.id] ?? true;
      await post(`/api/master/campaigns/${campaignId}/npcs/${npc.id}/damage`, {
        damageBruto: raw, usarArmadura: useArmor,
      });
      emitLiveRefresh("npc-damage");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(null);
    }
  }

  async function applyPlayerDamage(char: CampaignChar) {
    setBusy(`player-dmg-${char.id}`);
    setError(null);
    try {
      const raw = playerDamageRaw[char.id] ?? 0;
      const useArmor = playerUseArmor[char.id] ?? true;
      await post("/api/master/damage", {
        campaignCharacterId: char.id, damageBruto: raw, usarArmadura: useArmor,
      });
      emitLiveRefresh("player-damage");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(null);
    }
  }

  async function addCondition(entityType: "player" | "npc", entityId: string) {
    const label = conditionInput[entityId]?.trim();
    if (!label) return;
    const duration = conditionDuration[entityId] ?? 0;
    setBusy(`cond-${entityId}`);
    try {
      if (entityType === "npc") {
        await post("/api/master/conditions", {
          campaignNpcId: entityId, action: "add",
          condition: label, duration: duration > 0 ? duration : undefined,
        });
      } else {
        await post("/api/master/conditions", {
          campaignCharacterId: entityId, action: "add",
          condition: label, duration: duration > 0 ? duration : undefined,
        });
      }
      emitLiveRefresh("condition");
      setConditionInput((prev) => ({ ...prev, [entityId]: "" }));
      setConditionDuration((prev) => ({ ...prev, [entityId]: 0 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(null);
    }
  }

  async function removeCondition(entityType: "player" | "npc", entityId: string, label: string) {
    try {
      if (entityType === "npc") {
        await post("/api/master/conditions", { campaignNpcId: entityId, action: "remove", condition: label });
      } else {
        await post("/api/master/conditions", { campaignCharacterId: entityId, action: "remove", condition: label });
      }
      emitLiveRefresh("condition");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    }
  }

  async function toggleNpcVisibility(npc: CampaignNpc) {
    setBusy(`vis-${npc.id}`);
    try {
      await patch(`/api/master/campaigns/${campaignId}/npcs/${npc.id}`, {
        visible_to_players: !npc.visible_to_players,
      });
      emitLiveRefresh("npc-visibility");
    } finally {
      setBusy(null);
    }
  }

  async function setHealthIndicator(npc: CampaignNpc, indicator: string) {
    setBusy(`hi-${npc.id}`);
    try {
      await patch(`/api/master/campaigns/${campaignId}/npcs/${npc.id}`, { health_indicator: indicator });
      emitLiveRefresh("health-indicator");
    } finally {
      setBusy(null);
    }
  }

  async function deleteNpc(npcId: string) {
    setBusy(`del-${npcId}`);
    try {
      await fetch(`/api/master/campaigns/${campaignId}/npcs/${npcId}`, { method: "DELETE" });
      emitLiveRefresh("npc-deleted");
    } finally {
      setBusy(null);
    }
  }

  const handleTokenMove = useCallback(async (id: string, x: number, y: number) => {
    setMapTokens((prev) => prev.map((t) => t.id === id ? { ...t, x, y } : t));
    // Extract npcId if it's an NPC token and update position
    if (id.startsWith("npc-")) {
      const npcId = id.replace("npc-", "");
      await patch(`/api/master/campaigns/${campaignId}/npcs/${npcId}`, { token_x: x, token_y: y });
    }
    // Persist map state
    setMapTokens((current) => {
      void fetch(`/api/master/campaigns/${campaignId}/map`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map_tokens: current }),
      });
      return current;
    });
  }, [campaignId]);

  async function addNpcToken(npc: CampaignNpc) {
    const existing = mapTokens.find((t) => t.entity_id === npc.id);
    if (existing) return;
    const token: MapToken = {
      id: `npc-${npc.id}`, type: "npc", entity_id: npc.id,
      name: npc.name, x: 0.5, y: 0.5, color: npc.token_color, visible: npc.visible_to_players,
    };
    const updated = [...mapTokens, token];
    setMapTokens(updated);
    await Promise.all([
      patch(`/api/master/campaigns/${campaignId}/npcs/${npc.id}`, { token_x: 0.5, token_y: 0.5 }),
      fetch(`/api/master/campaigns/${campaignId}/map`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map_tokens: updated }),
      }),
    ]);
    emitLiveRefresh("map");
  }

  function removeToken(id: string) {
    const updated = mapTokens.filter((t) => t.id !== id);
    setMapTokens(updated);
    void fetch(`/api/master/campaigns/${campaignId}/map`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ map_tokens: updated }),
    });
    emitLiveRefresh("map");
  }

  const TABS: Array<{ key: MasterTab; label: string; icon: React.ElementType }> = [
    { key: "personagens", label: "Jogadores", icon: Shield },
    { key: "bestiario", label: "Bestiário", icon: Skull },
    { key: "sessao", label: "Turnos", icon: Swords },
    { key: "mapa", label: "Mapa", icon: Activity },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Session toggle */}
      <SurfaceCard className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${sessionActive ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
            <p className="text-sm font-semibold text-white">
              {sessionActive ? "Sessão ativa" : "Sessão encerrada"}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-white/45">
            {sessionActive
              ? "Jogadores podem entrar na sessão ao vivo e ver atualizações em tempo real."
              : "Inicie a sessão para que os jogadores vejam a tela ao vivo."}
          </p>
        </div>
        <Button
          onClick={toggleSession}
          disabled={togglingSession}
          className={sessionActive ? "bg-rose-600 hover:bg-rose-700" : ""}
        >
          {togglingSession ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {sessionActive ? "Encerrar sessão" : "Iniciar sessão"}
        </Button>
      </SurfaceCard>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex overflow-x-auto rounded-2xl border border-white/8 bg-black/40 backdrop-blur-md">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab: JOGADORES ── */}
      {activeTab === "personagens" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {characters.map((char) => {
            const hpPct = char.total_hp > 0 ? char.current_hp / char.total_hp : 0;
            const dmg = playerDamageRaw[char.id] ?? 0;
            const useArmor = playerUseArmor[char.id] ?? true;
            const preview = dmg > 0 ? (() => {
              const pts = classificarDano(dmg, char.threshold1, char.threshold2);
              const arm = aplicarArmadura(pts, char.armor_current, useArmor);
              const hp = atualizarHP(char.current_hp, char.total_hp, arm.pontosDanoFinal);
              return { currentHPFinal: hp.currentHPFinal, downed: hp.downed };
            })() : null;

            return (
              <SurfaceCard key={char.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{char.name}</p>
                    <p className="text-xs text-white/45">{char.class_key} · Nível {char.level}</p>
                  </div>
                  {char.is_downed && (
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-400">Caído</span>
                  )}
                </div>

                {/* HP bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/50">
                    <span>PV</span>
                    <span>{char.current_hp}/{char.total_hp}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.max(0, Math.min(100, hpPct * 100))}%`,
                        background: hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#eab308" : "#ef4444",
                      }}
                    />
                  </div>
                </div>

                {/* Resources */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-black/20 py-1.5">
                    <p className="text-white/40">ARM</p>
                    <p className="font-bold text-white">{char.armor_current}/{char.armor_max}</p>
                  </div>
                  <div className="rounded-lg bg-black/20 py-1.5">
                    <p className="text-white/40">ESP</p>
                    <p className="font-bold text-white">{char.resources.hope ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-black/20 py-1.5">
                    <p className="text-white/40">FAD</p>
                    <p className="font-bold text-white">{char.resources.fatigue ?? 0}</p>
                  </div>
                </div>

                {/* Conditions */}
                {char.conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {char.conditions.map((c) => (
                      <button
                        key={c.label}
                        onClick={() => removeCondition("player", char.id, c.label)}
                        className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/20 transition-colors"
                        title="Clique para remover"
                      >
                        {c.label}{c.duration !== undefined ? ` (${c.duration}t)` : ""}
                      </button>
                    ))}
                  </div>
                )}

                {/* Damage */}
                <div className="space-y-2 rounded-xl border border-white/8 bg-black/20 p-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      className="field text-sm"
                      placeholder="Dano bruto"
                      value={playerDamageRaw[char.id] ?? 0}
                      onChange={(e) => setPlayerDamageRaw((prev) => ({ ...prev, [char.id]: Number(e.target.value) }))}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-white/60 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={playerUseArmor[char.id] ?? true}
                        onChange={(e) => setPlayerUseArmor((prev) => ({ ...prev, [char.id]: e.target.checked }))}
                      />
                      Armadura
                    </label>
                  </div>
                  {preview && (
                    <p className="text-xs text-rose-300">
                      PV: {char.current_hp} → {preview.currentHPFinal}{preview.downed ? " 💀" : ""}
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    className="w-full gap-1 text-rose-300 border-rose-500/30 hover:bg-rose-500/10"
                    onClick={() => applyPlayerDamage(char)}
                    disabled={busy === `player-dmg-${char.id}` || dmg === 0}
                  >
                    {busy === `player-dmg-${char.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    Aplicar dano
                  </Button>
                </div>

                {/* Add condition */}
                <div className="flex gap-2">
                  <select
                    className="field text-xs"
                    value={conditionInput[char.id] ?? ""}
                    onChange={(e) => setConditionInput((prev) => ({ ...prev, [char.id]: e.target.value }))}
                  >
                    <option value="">Condição...</option>
                    {commonConditions.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">Personalizada</option>
                  </select>
                  {conditionInput[char.id] === "__custom__" && (
                    <input className="field text-xs" placeholder="Nome" onChange={(e) => setConditionInput((prev) => ({ ...prev, [char.id]: e.target.value }))} />
                  )}
                  <input
                    type="number" min={0} placeholder="Turnos"
                    className="field max-w-[70px] text-xs"
                    value={conditionDuration[char.id] ?? 0}
                    onChange={(e) => setConditionDuration((prev) => ({ ...prev, [char.id]: Number(e.target.value) }))}
                  />
                  <Button variant="secondary" onClick={() => addCondition("player", char.id)} disabled={busy === `cond-${char.id}`}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </SurfaceCard>
            );
          })}

          {characters.length === 0 && (
            <p className="col-span-full text-center text-sm text-white/40 py-8">
              Nenhum personagem ativo nesta campanha.
            </p>
          )}
        </div>
      )}

      {/* ── Tab: BESTIÁRIO ── */}
      {activeTab === "bestiario" && (
        <div className="space-y-4">
          <NpcCreator campaignId={campaignId} />

          {npcs.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {npcs.map((npc) => {
                const hpPct = npc.total_hp > 0 ? npc.current_hp / npc.total_hp : 0;
                const dmg = npcDamageRaw[npc.id] ?? 0;
                const useArmor = npcUseArmor[npc.id] ?? true;
                const health = HEALTH_LABELS[npc.health_indicator] ?? HEALTH_LABELS.unknown;

                return (
                  <SurfaceCard key={npc.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: npc.token_color }}>
                          {npc.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{npc.name}</p>
                          <p className="text-xs text-white/45">Nível {npc.level} · {npc.npc_type}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleNpcVisibility(npc)}
                          disabled={busy === `vis-${npc.id}`}
                          className="rounded-lg p-1.5 text-white/40 hover:text-white transition-colors"
                          title={npc.visible_to_players ? "Ocultar dos jogadores" : "Revelar aos jogadores"}
                        >
                          {npc.visible_to_players ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => deleteNpc(npc.id)}
                          disabled={busy === `del-${npc.id}`}
                          className="rounded-lg p-1.5 text-white/30 hover:text-rose-400 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* HP bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white/50">
                        <span>PV</span>
                        <span>{npc.current_hp}/{npc.total_hp}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${Math.max(0, hpPct * 100)}%`, background: hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#eab308" : "#ef4444" }} />
                      </div>
                    </div>

                    {/* Health indicator selector */}
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-white/40">Indicador para jogadores</p>
                      <select
                        className="field text-xs"
                        value={npc.health_indicator}
                        onChange={(e) => setHealthIndicator(npc, e.target.value)}
                        disabled={busy === `hi-${npc.id}`}
                      >
                        {Object.entries(HEALTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>

                    {/* Conditions */}
                    {npc.conditions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {npc.conditions.map((c) => (
                          <button key={c.label} onClick={() => removeCondition("npc", npc.id, c.label)}
                            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/20"
                            title="Remover">
                            {c.label}{c.duration !== undefined ? ` (${c.duration}t)` : ""}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Damage */}
                    <div className="space-y-2 rounded-xl border border-white/8 bg-black/20 p-3">
                      <div className="flex gap-2">
                        <input type="number" min={0} className="field text-sm" placeholder="Dano bruto"
                          value={npcDamageRaw[npc.id] ?? 0}
                          onChange={(e) => setNpcDamageRaw((prev) => ({ ...prev, [npc.id]: Number(e.target.value) }))} />
                        <label className="flex items-center gap-1.5 text-xs text-white/60 whitespace-nowrap">
                          <input type="checkbox" checked={npcUseArmor[npc.id] ?? true}
                            onChange={(e) => setNpcUseArmor((prev) => ({ ...prev, [npc.id]: e.target.checked }))} />
                          Armadura
                        </label>
                      </div>
                      <Button variant="secondary" className="w-full gap-1 text-rose-300 border-rose-500/30"
                        onClick={() => applyNpcDamage(npc)} disabled={busy === `npc-dmg-${npc.id}` || dmg === 0}>
                        {busy === `npc-dmg-${npc.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flame className="h-3 w-3" />}
                        Aplicar dano ao NPC
                      </Button>
                    </div>

                    {/* Conditions + map */}
                    <div className="flex gap-2">
                      <select className="field text-xs" value={conditionInput[npc.id] ?? ""}
                        onChange={(e) => setConditionInput((prev) => ({ ...prev, [npc.id]: e.target.value }))}>
                        <option value="">Condição...</option>
                        {commonConditions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" min={0} placeholder="T" className="field max-w-[60px] text-xs"
                        value={conditionDuration[npc.id] ?? 0}
                        onChange={(e) => setConditionDuration((prev) => ({ ...prev, [npc.id]: Number(e.target.value) }))} />
                      <Button variant="secondary" onClick={() => addCondition("npc", npc.id)} disabled={busy === `cond-${npc.id}`}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Add to map */}
                    {!mapTokens.find((t) => t.entity_id === npc.id) && (
                      <Button variant="ghost" className="w-full gap-1 text-xs" onClick={() => addNpcToken(npc)}>
                        <BookOpen className="h-3.5 w-3.5" /> Adicionar ao mapa
                      </Button>
                    )}
                  </SurfaceCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: TURNOS ── */}
      {activeTab === "sessao" && (
        <SurfaceCard>
          <TurnTracker
            campaignId={campaignId}
            turns={turns}
            availablePlayers={characters.map((c) => ({ id: c.id, name: c.name }))}
            availableNpcs={npcs.map((n) => ({ id: n.id, name: n.name }))}
          />
        </SurfaceCard>
      )}

      {/* ── Tab: MAPA ── */}
      {activeTab === "mapa" && (
        <SurfaceCard>
          <MiniMap
            tokens={mapTokens}
            onTokenMove={handleTokenMove}
            onTokenRemove={removeToken}
          />
          <div className="mt-4 space-y-2">
            <p className="text-xs text-white/40">Tokens disponíveis para adicionar</p>
            <div className="flex flex-wrap gap-2">
              {[
                ...characters.map((c) => ({ id: `player-${c.id}`, entity_id: c.id, name: c.name, color: "#3b82f6", type: "player" as const })),
                ...npcs.map((n) => ({ id: `npc-${n.id}`, entity_id: n.id, name: n.name, color: n.token_color, type: "npc" as const })),
              ]
                .filter((t) => !mapTokens.find((m) => m.entity_id === t.entity_id))
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const token: MapToken = { id: t.id, type: t.type, entity_id: t.entity_id, name: t.name, x: 0.5, y: 0.5, color: t.color };
                      const updated = [...mapTokens, token];
                      setMapTokens(updated);
                      void fetch(`/api/master/campaigns/${campaignId}/map`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ map_tokens: updated }) });
                    }}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/70 hover:border-white/20 transition-colors"
                  >
                    <div className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </button>
                ))}
            </div>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
