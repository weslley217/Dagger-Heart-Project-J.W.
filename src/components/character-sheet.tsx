"use client";

import { useMemo, useState } from "react";
import { BadgeInfo, Shield, Sparkles, Sword } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CardModal } from "@/components/card-modal";
import { Button } from "@/components/ui/button";
import { IconTrack } from "@/components/ui/icon-track";
import { SurfaceCard } from "@/components/ui/surface-card";
import { emitLiveRefresh } from "@/hooks/use-live-refresh";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { formatDateTime } from "@/lib/utils";
import type { CharacterCardSummary, CharacterDetail } from "@/types/domain";

type CharacterSheetProps = {
  character: CharacterDetail;
  campaignCharacterId?: string;
};

export function CharacterSheet({ character, campaignCharacterId }: CharacterSheetProps) {
  const [selectedCard, setSelectedCard] = useState<CharacterCardSummary | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  useLiveRefresh();

  const remainingHp = Math.max(character.totalHp - character.currentHp, 0);

  const topCards = useMemo(
    () => character.cards.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [character.cards],
  );

  async function applyAdjustment(
    key: string,
    payload: {
      delta?: {
        currentHp?: number;
        armorCurrent?: number;
        hope?: number;
        fatigue?: number;
        stress?: number;
        gold?: number;
      };
      set?: {
        currentHp?: number;
        armorCurrent?: number;
        hope?: number;
        fatigue?: number;
        stress?: number;
        gold?: number;
      };
    },
  ) {
    try {
      setAdjustError(null);
      setAdjusting(key);

      const response = await fetch("/api/characters/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          characterId: campaignCharacterId ? undefined : character.id,
          campaignCharacterId,
          ...payload,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao ajustar recursos.");
      }

      emitLiveRefresh("player-adjust");
    } catch (caught) {
      setAdjustError(caught instanceof Error ? caught.message : "Falha ao ajustar recursos.");
    } finally {
      setAdjusting(null);
    }
  }

  return (
    <AppShell
      role="PLAYER"
      title={character.name}
      subtitle={`${character.classKey} · ${character.subclassKey} · ${character.ancestryKey} · ${character.communityKey}`}
    >
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/45">Visão geral</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-4xl font-semibold text-white">{character.name}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
                {character.shortDescription}
              </p>
            </div>
            <div className="rounded-[28px] border border-white/8 bg-black/18 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Nível</p>
              <p className="text-3xl font-semibold text-white">{character.level}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {character.conditions.map((condition) => (
              <span
                key={condition}
                className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/70"
              >
                {condition}
              </span>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="grid gap-4 sm:grid-cols-2">
          <IconTrack
            label="Vida"
            total={character.totalHp}
            filled={remainingHp}
            icon="heart"
            helper="Corações acesos representam vida restante."
          />
          <IconTrack
            label="Armadura"
            total={character.armorMax}
            filled={character.armorCurrent}
            icon="shield"
            helper="Escudos acesos representam armadura disponível."
          />
          <IconTrack
            label="Esperança"
            total={character.resources.hopeMax}
            filled={character.resources.hope}
            icon="sparkles"
          />
          <IconTrack
            label="Estresse"
            total={character.resources.stressMax}
            filled={character.resources.stress}
            icon="star"
          />
        </SurfaceCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SurfaceCard>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Combate e recursos</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Evasão", character.evasion],
              ["Limiar 1", character.threshold1],
              ["Limiar 2", character.threshold2],
              ["Ouro", character.resources.gold],
              ["Fadiga", `${character.resources.fatigue}/${character.resources.fatigueMax}`],
              ["Cartas", character.cards.length],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-3xl border border-white/8 bg-black/18 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
          {character.druidForms.length ? (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Formas druidas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {character.druidForms.map((form) => (
                  <span
                    key={form}
                    className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/70"
                  >
                    {form}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center gap-2">
            <BadgeInfo className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Atributos</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Agilidade", character.attributes.agility],
              ["Força", character.attributes.strength],
              ["Acuidade", character.attributes.finesse],
              ["Instinto", character.attributes.instinct],
              ["Presença", character.attributes.presence],
              ["Conhecimento", character.attributes.knowledge],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-3xl border border-white/8 bg-black/18 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Ajustes rapidos</h3>
          </div>
          <p className="text-sm text-white/60">
            Use estes controles para marcar dano, consumir armadura e sinalizar uso de Esperanca/Fadiga em tempo real.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => applyAdjustment("hp-inc", { delta: { currentHp: 1 } })}
              disabled={adjusting !== null}
            >
              Sofrer 1 dano
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyAdjustment("hp-dec", { delta: { currentHp: -1 } })}
              disabled={adjusting !== null}
            >
              Curar 1 dano
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyAdjustment("armor-dec", { delta: { armorCurrent: -1 } })}
              disabled={adjusting !== null}
            >
              Gastar 1 armadura
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyAdjustment("armor-inc", { delta: { armorCurrent: 1 } })}
              disabled={adjusting !== null}
            >
              Recuperar 1 armadura
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyAdjustment("hope-dec", { delta: { hope: -1 } })}
              disabled={adjusting !== null}
            >
              Usar 1 Esperanca
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyAdjustment("hope-inc", { delta: { hope: 1 } })}
              disabled={adjusting !== null}
            >
              Ganhar 1 Esperanca
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyAdjustment("fatigue-inc", { delta: { fatigue: 1 } })}
              disabled={adjusting !== null}
            >
              Marcar 1 Fadiga
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyAdjustment("fatigue-dec", { delta: { fatigue: -1 } })}
              disabled={adjusting !== null}
            >
              Recuperar 1 Fadiga
            </Button>
          </div>
          {adjustError ? <p className="text-sm text-rose-300">{adjustError}</p> : null}
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Sword className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Equipamento</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/8 bg-black/18 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Primaria</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {character.equipment.primaryWeapon?.name ?? "Nao equipada"}
              </p>
              {character.equipment.primaryWeapon ? (
                <p className="mt-2 text-xs text-white/55">
                  {character.equipment.primaryWeapon.attribute} | {character.equipment.primaryWeapon.range} |{" "}
                  {character.equipment.primaryWeapon.damage}
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/8 bg-black/18 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Secundaria</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {character.equipment.secondaryWeapon?.name ?? "Nao equipada"}
              </p>
              {character.equipment.secondaryWeapon ? (
                <p className="mt-2 text-xs text-white/55">
                  {character.equipment.secondaryWeapon.attribute} | {character.equipment.secondaryWeapon.range} |{" "}
                  {character.equipment.secondaryWeapon.damage}
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/8 bg-black/18 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Armadura</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {character.equipment.armor?.name ?? "Nao equipada"}
              </p>
              {character.equipment.armor ? (
                <p className="mt-2 text-xs text-white/55">
                  Base {character.equipment.armor.baseArmor} | Limiar{" "}
                  {character.equipment.armor.baseThresholds[0]}/{character.equipment.armor.baseThresholds[1]}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Inventario</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(character.equipment.inventory ?? []).length ? (
                character.equipment.inventory.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/70"
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-sm text-white/55">Sem itens listados.</span>
              )}
            </div>
          </div>
        </SurfaceCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Cartas</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {topCards.map((card) => (
              <button
                key={card.linkId}
                className="rounded-[26px] border border-white/10 bg-white/4 p-4 text-left transition hover:border-white/20 hover:bg-white/7"
                onClick={() => setSelectedCard(card)}
              >
                <p className="text-sm font-semibold text-white">{card.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/40">
                  {card.category} {card.tier ? `· ${card.tier}` : ""}
                </p>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-white/60">
                  {card.text}
                </p>
                {card.usesMax ? (
                  <p className="mt-3 text-xs text-white/45">
                    Usos: {card.usesCurrent ?? 0}/{card.usesMax}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-4">
          <SurfaceCard>
            <h3 className="text-lg font-semibold text-white">Histórico de dano</h3>
            <div className="mt-4 space-y-3">
              {character.damageLogs.length ? (
                character.damageLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-[24px] border border-white/8 bg-black/18 p-4"
                  >
                    <p className="text-sm font-semibold text-white">
                      {log.damageRaw} bruto → {log.damagePoints} ponto(s)
                    </p>
                    <p className="mt-2 text-xs text-white/50">
                      Armadura {log.armorUsed ? "usada" : "não usada"} · HP {log.hpBefore} →{" "}
                      {log.hpAfter}
                    </p>
                    <p className="mt-2 text-xs text-white/40">{formatDateTime(log.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">Nenhum dano registrado ainda.</p>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <h3 className="text-lg font-semibold text-white">Atividade recente</h3>
            <div className="mt-4 space-y-3">
              {character.effectLogs.length ? (
                character.effectLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-[24px] border border-white/8 bg-black/18 p-4"
                  >
                    <p className="text-sm font-semibold text-white">{log.summary}</p>
                    <p className="mt-2 text-xs text-white/40">{formatDateTime(log.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">Nenhuma ação de carta registrada ainda.</p>
              )}
            </div>
          </SurfaceCard>
        </div>
      </section>

      <CardModal
        characterId={campaignCharacterId ? undefined : character.id}
        campaignCharacterId={campaignCharacterId}
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </AppShell>
  );
}
