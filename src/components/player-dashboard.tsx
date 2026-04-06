"use client";

import Link from "next/link";
import { Plus, ScrollText, Sparkles, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { CharacterWizard } from "@/components/character-wizard";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { useUiStore } from "@/stores/ui-store";
import { classes } from "@/lib/reference-data";
import { emitLiveRefresh } from "@/hooks/use-live-refresh";
import type { CampaignSummary, CardSummary, CharacterSummary } from "@/types/domain";

type PlayerDashboardProps = {
  characters: CharacterSummary[];
  cards: CardSummary[];
  campaigns: CampaignSummary[];
};

export function PlayerDashboard({ characters, cards, campaigns }: PlayerDashboardProps) {
  const router = useRouter();
  const { playerTab, setPlayerTab } = useUiStore();
  const [joiningCampaignId, setJoiningCampaignId] = useState<string | null>(null);
  const [selectedCharacterByCampaign, setSelectedCharacterByCampaign] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);
  useLiveRefresh(3000);

  async function joinCampaign(campaignId: string) {
    try {
      setError(null);
      const baseCharacterId = selectedCharacterByCampaign[campaignId] ?? characters[0]?.id;
      if (!baseCharacterId) {
        throw new Error("Crie pelo menos um personagem base antes de entrar em campanha.");
      }

      setJoiningCampaignId(campaignId);
      const response = await fetch("/api/campaigns/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId,
          baseCharacterId,
        }),
      });

      const data = (await response.json()) as { error?: string; id?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error ?? "Não foi possível entrar na campanha.");
      }

      emitLiveRefresh("join-campaign");
      router.push(`/player/campaigns/${campaignId}/characters/${data.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao entrar na campanha.");
    } finally {
      setJoiningCampaignId(null);
    }
  }

  return (
    <AppShell
      role="PLAYER"
      title="Home do Jogador"
      subtitle="Crie personagens, mantenha fichas base e entre em campanhas abertas com snapshots independentes."
    >
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/45">
                Cadastro de personagens
              </p>
              <h2 className="text-3xl font-semibold text-white">
                Crie, retome e navegue entre fichas de Daggerheart.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-white/60">
                O criador sugere classe, subclasse, herança, atributos, recursos, limiares e cartas
                com base nos dados do livro e nas cartas importadas.
              </p>
            </div>
            <Button onClick={() => setPlayerTab("novo")} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova ficha
            </Button>
          </div>
        </SurfaceCard>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <SurfaceCard>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Fichas base</p>
            <p className="mt-3 text-3xl font-semibold text-white">{characters.length}</p>
            <p className="mt-2 text-sm text-white/55">Personagens permanentes da sua conta.</p>
          </SurfaceCard>
          <SurfaceCard>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Cartas</p>
            <p className="mt-3 text-3xl font-semibold text-white">{cards.length}</p>
            <p className="mt-2 text-sm text-white/55">Cartas disponíveis para seleção.</p>
          </SurfaceCard>
          <SurfaceCard>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Campanhas abertas</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {campaigns.filter((campaign) => campaign.isOpen).length}
            </p>
            <p className="mt-2 text-sm text-white/55">Mesas liberadas pelo mestre.</p>
          </SurfaceCard>
        </div>
      </section>

      <SurfaceCard className="space-y-4">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-lg font-semibold text-white">Campanhas abertas</h3>
        </div>
        {campaigns.filter((campaign) => campaign.isOpen).length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {campaigns
              .filter((campaign) => campaign.isOpen)
              .map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-[24px] border border-white/10 bg-black/18 p-4 space-y-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{campaign.name}</p>
                    <p className="mt-1 text-xs text-white/50">
                      Nível inicial: {campaign.startLevel}
                    </p>
                    {campaign.description ? (
                      <p className="mt-2 text-sm text-white/60">{campaign.description}</p>
                    ) : null}
                  </div>
                  <select
                    className="field"
                    value={selectedCharacterByCampaign[campaign.id] ?? ""}
                    onChange={(event) =>
                      setSelectedCharacterByCampaign((current) => ({
                        ...current,
                        [campaign.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione a ficha base</option>
                    {characters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name} · Nível {character.level}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => joinCampaign(campaign.id)}
                    disabled={joiningCampaignId === campaign.id}
                  >
                    {joiningCampaignId === campaign.id ? "Entrando..." : "Entrar na campanha"}
                  </Button>
                  <a
                    href={`/player/campaigns/${campaign.id}/session`}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Sessão ao vivo
                  </a>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-white/55">Nenhuma campanha aberta no momento.</p>
        )}
      </SurfaceCard>

      <div className="flex flex-wrap gap-3">
        <button
          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            playerTab === "criados"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-white/6 text-white/65"
          }`}
          onClick={() => setPlayerTab("criados")}
        >
          Personagens criados
        </button>
        <button
          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            playerTab === "novo"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-white/6 text-white/65"
          }`}
          onClick={() => setPlayerTab("novo")}
        >
          Novo personagem
        </button>
      </div>

      {playerTab === "criados" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {characters.length ? (
            characters.map((character) => (
              <SurfaceCard key={character.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                      Nível {character.level}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {character.name}
                    </h3>
                    <p className="mt-2 text-sm text-white/60">{character.shortDescription}</p>
                  </div>
                  <div className="rounded-2xl bg-black/18 px-3 py-2 text-right">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/40">HP</p>
                    <p className="text-lg font-semibold text-white">
                      {character.totalHp - character.currentHp}/{character.totalHp}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-white/70">
                    {character.classKey}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-white/70">
                    {character.subclassKey}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-white/70">
                    {character.ancestryKey}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-white/70">
                    {character.communityKey}
                  </span>
                </div>

                <div className="mt-auto flex flex-wrap gap-3">
                  <Link href={`/player/characters/${character.id}`}>
                    <Button className="gap-2">
                      <ScrollText className="h-4 w-4" />
                      Abrir ficha base
                    </Button>
                  </Link>
                </div>
              </SurfaceCard>
            ))
          ) : (
            <SurfaceCard className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[var(--accent)]" />
                <p className="text-sm text-white/65">
                  Nenhuma ficha criada ainda. Abra a aba &quot;Novo personagem&quot; para começar.
                </p>
              </div>
            </SurfaceCard>
          )}
        </section>
      ) : (
        <CharacterWizard availableCards={cards} campaigns={campaigns} />
      )}

      <SurfaceCard>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Classes base</p>
        <p className="mt-3 text-3xl font-semibold text-white">{classes.length}</p>
        <p className="mt-2 text-sm text-white/55">Dados carregados do livro básico.</p>
      </SurfaceCard>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </AppShell>
  );
}
