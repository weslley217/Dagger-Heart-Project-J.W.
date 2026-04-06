"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitLiveRefresh } from "@/hooks/use-live-refresh";

type Props = { campaignId: string; onCreated?: () => void };

const NPC_COLORS = [
  { value: "#ef4444", label: "Vermelho" },
  { value: "#f97316", label: "Laranja" },
  { value: "#eab308", label: "Amarelo" },
  { value: "#22c55e", label: "Verde" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#a855f7", label: "Roxo" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#ffffff", label: "Branco" },
];

const NPC_ICONS = ["monster", "boss", "npc", "undead", "beast", "dragon", "humanoid"];

export function NpcCreator({ campaignId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [npcType, setNpcType] = useState<"monster" | "npc" | "boss">("monster");
  const [level, setLevel] = useState(1);
  const [description, setDescription] = useState("");
  const [totalHp, setTotalHp] = useState(20);
  const [armorMax, setArmorMax] = useState(0);
  const [threshold1, setThreshold1] = useState(5);
  const [threshold2, setThreshold2] = useState(10);
  const [evasion, setEvasion] = useState(10);
  const [damageDice, setDamageDice] = useState("1d8");
  const [attackBonus, setAttackBonus] = useState(0);
  const [tokenColor, setTokenColor] = useState("#ef4444");
  const [tokenIcon, setTokenIcon] = useState("monster");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) { setError("Nome obrigatório."); return; }
    try {
      setError(null);
      setSubmitting(true);
      const res = await fetch(`/api/master/campaigns/${campaignId}/npcs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), npc_type: npcType, level, description: description.trim() || null,
          total_hp: totalHp, armor_max: armorMax, threshold1, threshold2, evasion,
          damage_dice: damageDice || null, attack_bonus: attackBonus,
          token_color: tokenColor, token_icon: tokenIcon, notes: notes.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar NPC.");
      emitLiveRefresh("npc-created");
      setName(""); setDescription(""); setNotes(""); setTotalHp(20); setArmorMax(0);
      setThreshold1(5); setThreshold2(10); setEvasion(10); setDamageDice("1d8");
      setAttackBonus(0); setLevel(1);
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-sm font-semibold text-white">Novo NPC / Monstro</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-white/55">Nome</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Goblin Batedor" />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">Tipo</span>
          <select className="field" value={npcType} onChange={(e) => setNpcType(e.target.value as "monster" | "npc" | "boss")}>
            <option value="monster">Monstro</option>
            <option value="npc">NPC</option>
            <option value="boss">Chefe</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">Nível</span>
          <input type="number" min={1} max={20} className="field" value={level} onChange={(e) => setLevel(Math.max(1, Number(e.target.value)))} />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">PV total</span>
          <input type="number" min={1} className="field" value={totalHp} onChange={(e) => setTotalHp(Math.max(1, Number(e.target.value)))} />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">Armadura</span>
          <input type="number" min={0} className="field" value={armorMax} onChange={(e) => setArmorMax(Math.max(0, Number(e.target.value)))} />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">Limiar menor</span>
          <input type="number" min={1} className="field" value={threshold1} onChange={(e) => setThreshold1(Math.max(1, Number(e.target.value)))} />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">Limiar maior</span>
          <input type="number" min={1} className="field" value={threshold2} onChange={(e) => setThreshold2(Math.max(1, Number(e.target.value)))} />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">Evasão</span>
          <input type="number" min={1} className="field" value={evasion} onChange={(e) => setEvasion(Math.max(1, Number(e.target.value)))} />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">Dados de dano</span>
          <input className="field" value={damageDice} onChange={(e) => setDamageDice(e.target.value)} placeholder="Ex.: 2d6+3" />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-white/55">Bônus de ataque</span>
          <input type="number" className="field" value={attackBonus} onChange={(e) => setAttackBonus(Number(e.target.value))} />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-white/55">Descrição (visível para o mestre)</span>
          <textarea className="field min-h-16 resize-y py-2" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Aparência, comportamento..." />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-white/55">Notas internas</span>
          <textarea className="field min-h-12 resize-y py-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Segredos, estratégias..." />
        </label>
      </div>

      {/* Token visual */}
      <div className="space-y-2">
        <p className="text-xs text-white/55">Token no mapa</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {NPC_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => setTokenColor(c.value)}
                className={`h-6 w-6 rounded-full border-2 transition ${tokenColor === c.value ? "border-white scale-110" : "border-transparent"}`}
                style={{ background: c.value }}
              />
            ))}
          </div>
          <select className="field max-w-[140px] text-xs" value={tokenIcon} onChange={(e) => setTokenIcon(e.target.value)}>
            {NPC_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          {/* Token preview */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow" style={{ background: tokenColor }}>
            {name.charAt(0).toUpperCase() || "?"}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <Button onClick={create} disabled={submitting} className="gap-2">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {submitting ? "Criando..." : "Adicionar à campanha"}
      </Button>
    </div>
  );
}
