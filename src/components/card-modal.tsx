"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CardPageCanvas } from "@/components/ui/card-page-canvas";
import { emitLiveRefresh } from "@/hooks/use-live-refresh";
import { describeCardEffect } from "@/rules/cards/engine";
import type { CharacterCardSummary } from "@/types/domain";

type CardModalProps = {
  characterId?: string;
  campaignCharacterId?: string;
  card: CharacterCardSummary | null;
  onClose: () => void;
};

export function CardModal({
  characterId,
  campaignCharacterId,
  card,
  onClose,
}: CardModalProps) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!card) {
    return null;
  }

  const activeCard = card;

  async function activateEffect(effectIndex: number) {
    setError(null);
    setBusyIndex(effectIndex);

    const response = await fetch("/api/cards/effects/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        characterId,
        campaignCharacterId,
        cardId: activeCard.id,
        effectIndex,
      }),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? "Nao foi possivel aplicar a carta.");
      setBusyIndex(null);
      return;
    }

    emitLiveRefresh("card-effect");
    setBusyIndex(null);
  }

  const hasNoUses =
    typeof activeCard.usesCurrent === "number" &&
    activeCard.usesCurrent <= 0 &&
    activeCard.usesMax;

  return (
    <Modal open title={activeCard.name} onClose={onClose}>
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[26px] border border-white/8 bg-black/20 p-4">
          {activeCard.sourcePdfKey ? (
            <CardPageCanvas
              sourcePdfKey={activeCard.sourcePdfKey}
              sourcePage={activeCard.sourcePage ?? 1}
              className="rounded-2xl border border-white/8"
            />
          ) : (
            <div className="flex h-[520px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[radial-gradient(circle_at_top,rgba(212,177,106,0.18),transparent_50%),rgba(255,255,255,0.04)] p-8 text-center">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/40">Preview</p>
                <p className="mt-4 text-3xl font-semibold text-white">{activeCard.name}</p>
                <p className="mt-3 text-sm text-white/55">
                  Imagem nao vinculada. O texto abaixo e o importador manual continuam disponiveis.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[26px] border border-white/8 bg-black/20 p-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-white/70">
                {activeCard.category}
              </span>
              {activeCard.tier ? (
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-white/70">
                  {activeCard.tier}
                </span>
              ) : null}
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-white/70">
                {activeCard.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/70">{activeCard.text}</p>
            {activeCard.usesMax ? (
              <p className="mt-4 text-xs uppercase tracking-[0.22em] text-white/45">
                Usos restantes: {activeCard.usesCurrent ?? 0}/{activeCard.usesMax}
              </p>
            ) : null}
          </div>

          <div className="rounded-[26px] border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">Aplicar efeitos</p>
            <div className="mt-4 space-y-3">
              {activeCard.effects.length ? (
                activeCard.effects.map((effect, index) => (
                  <Button
                    key={`${activeCard.id}-${index}`}
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => activateEffect(index)}
                    disabled={Boolean(hasNoUses) || busyIndex !== null}
                  >
                    {busyIndex === index ? "Aplicando..." : describeCardEffect(effect)}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-white/55">
                  Esta carta ainda nao possui efeitos estruturados. Use o importador manual para enriquecer a DSL.
                </p>
              )}
            </div>
            {hasNoUses ? (
              <p className="mt-3 text-sm text-amber-200">
                Todos os usos desta carta ja foram consumidos.
              </p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
