"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, Shield, Sparkles, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { IconTrack } from "@/components/ui/icon-track";
import { SurfaceCard } from "@/components/ui/surface-card";
import { commonConditions } from "@/lib/reference-data";
import { formatDateTime } from "@/lib/utils";
import { emitLiveRefresh, useLiveRefresh } from "@/hooks/use-live-refresh";
import { useUiStore } from "@/stores/ui-store";
import { aplicarArmadura, atualizarHP, classificarDano } from "@/rules/damage";
import type {
  AppUserSummary,
  CampaignSummary,
  CardSummary,
  MasterCharacterDetail,
} from "@/types/domain";

type MasterDashboardProps = {
  characters: MasterCharacterDetail[];
  cards: CardSummary[];
  campaigns: CampaignSummary[];
  users: AppUserSummary[];
  usersByCampaign: Record<string, AppUserSummary[]>;
};

export function MasterDashboard({
  characters,
  cards,
  campaigns,
  users,
  usersByCampaign,
}: MasterDashboardProps) {
  const { masterCharacterId, setMasterCharacterId } = useUiStore();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(campaigns[0]?.id ?? null);
  const [damageRaw, setDamageRaw] = useState(0);
  const [useArmor, setUseArmor] = useState(true);
  const [cardSearch, setCardSearch] = useState("");
  const [selectedAssignCardId, setSelectedAssignCardId] = useState("");
  const [customCondition, setCustomCondition] = useState("");
  const [adjustingAction, setAdjustingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignStartLevel, setCampaignStartLevel] = useState(1);
  const [campaignSpecialRules, setCampaignSpecialRules] = useState("");
  const [campaignSpecialAbilities, setCampaignSpecialAbilities] = useState("");
  const [campaignBonusCards, setCampaignBonusCards] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  useLiveRefresh(3000);

  useEffect(() => {
    if (!selectedCampaignId && campaigns[0]) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null;

  const charactersInCampaign = useMemo(
    () =>
      selectedCampaign
        ? characters.filter((character) => character.campaignId === selectedCampaign.id)
        : [],
    [characters, selectedCampaign],
  );

  useEffect(() => {
    if (!charactersInCampaign.length) {
      setMasterCharacterId(null);
      return;
    }

    if (!masterCharacterId || !charactersInCampaign.some((item) => item.id === masterCharacterId)) {
      setMasterCharacterId(charactersInCampaign[0].id);
    }
  }, [charactersInCampaign, masterCharacterId, setMasterCharacterId]);

  const character =
    charactersInCampaign.find((item) => item.id === masterCharacterId) ??
    charactersInCampaign[0] ??
    null;

  const deferredSearch = useDeferredValue(cardSearch);

  const filteredCards = useMemo(() => {
    return cards
      .filter((card) =>
        card.name.toLowerCase().includes(deferredSearch.toLowerCase().trim()),
      )
      .slice(0, 14);
  }, [cards, deferredSearch]);

  const preview = useMemo(() => {
    if (!character) {
      return null;
    }

    const damagePoints = classificarDano(
      damageRaw,
      character.threshold1,
      character.threshold2,
    );
    const armor = aplicarArmadura(damagePoints, character.armorCurrent, useArmor);
    const hp = atualizarHP(character.currentHp, character.totalHp, armor.pontosDanoFinal);

    return {
      damagePoints,
      ...armor,
      ...hp,
    };
  }, [character, damageRaw, useArmor]);

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "A ação falhou.");
    }

    emitLiveRefresh(url);
    return data;
  }

  async function adjustResources(
    actionKey: string,
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
    if (!character) return;

    try {
      setError(null);
      setAdjustingAction(actionKey);
      await postJson("/api/characters/adjust", {
        campaignCharacterId: character.id,
        ...payload,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao ajustar recursos.");
    } finally {
      setAdjustingAction(null);
    }
  }

  async function applyDamage() {
    if (!character) return;
    try {
      setError(null);
      await postJson("/api/master/damage", {
        campaignCharacterId: character.id,
        damageBruto: damageRaw,
        usarArmadura: useArmor,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível aplicar dano.");
    }
  }

  async function undoLastAction() {
    if (!character) return;
    try {
      setError(null);
      await postJson("/api/master/undo", {
        campaignCharacterId: character.id,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desfazer.");
    }
  }

  async function assignCard() {
    if (!character || !selectedAssignCardId) return;
    try {
      setError(null);
      await postJson("/api/cards/assign", {
        campaignCharacterId: character.id,
        cardId: selectedAssignCardId,
      });
      setSelectedAssignCardId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atribuir a carta.");
    }
  }

  async function changeCondition(condition: string, mode: "add" | "remove") {
    if (!character || !condition.trim()) return;
    try {
      setError(null);
      await postJson("/api/master/conditions", {
        campaignCharacterId: character.id,
        condition,
        mode,
      });
      setCustomCondition("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar a condição.");
    }
  }

  async function createCampaign() {
    try {
      setError(null);
      if (!campaignName.trim()) {
        throw new Error("Nome da campanha é obrigatório.");
      }

      await postJson("/api/master/campaigns", {
        name: campaignName,
        description: campaignDescription,
        startLevel: campaignStartLevel,
        restrictions: {
          startingLevel: campaignStartLevel,
          specialAbilities: campaignSpecialAbilities
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          bonusCards: campaignBonusCards
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          customRules: campaignSpecialRules,
        },
        specialRules: campaignSpecialRules,
        isOpen: false,
      });

      setCampaignName("");
      setCampaignDescription("");
      setCampaignStartLevel(1);
      setCampaignSpecialRules("");
      setCampaignSpecialAbilities("");
      setCampaignBonusCards("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao criar campanha.");
    }
  }

  async function createUser() {
    try {
      setError(null);
      await postJson("/api/master/users", {
        username: newUserUsername,
        displayName: newUserDisplayName,
        password: newUserPassword,
        role: "PLAYER",
      });
      setNewUserUsername("");
      setNewUserDisplayName("");
      setNewUserPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao criar acesso de jogador.");
    }
  }

  async function addPlayerToCampaign() {
    if (!selectedCampaign || !selectedUserId) return;
    try {
      setError(null);
      await postJson(`/api/master/campaigns/${selectedCampaign.id}/members`, {
        userId: selectedUserId,
        role: "PLAYER",
      });
      setSelectedUserId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao adicionar jogador.");
    }
  }

  async function toggleCampaignStatus() {
    if (!selectedCampaign) return;
    try {
      setError(null);
      await postJson(`/api/master/campaigns/${selectedCampaign.id}/status`, {
        isOpen: !selectedCampaign.isOpen,
        status: selectedCampaign.isOpen ? "draft" : "open",
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao atualizar campanha.");
    }
  }

  const campaignPlayers = selectedCampaign
    ? usersByCampaign[selectedCampaign.id]?.filter((user) => user.role === "PLAYER") ?? []
    : [];

  const allPlayers = users.filter((user) => user.role === "PLAYER");

  const remainingHp = character ? Math.max(character.totalHp - character.currentHp, 0) : 0;

  return (
    <AppShell
      role="MASTER"
      title="Painel do Mestre"
      subtitle="Crie campanhas, cadastre logins de jogadores e controle dano, condições e cartas em snapshots por campanha."
    >
      <section className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-white">Nova campanha</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="field md:col-span-2"
              placeholder="Nome da campanha"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
            />
            <textarea
              className="field md:col-span-2 min-h-20 resize-y py-3"
              placeholder="Descrição da campanha"
              value={campaignDescription}
              onChange={(event) => setCampaignDescription(event.target.value)}
            />
            <label className="space-y-1">
              <span className="text-xs text-white/55">Nível inicial</span>
              <input
                type="number"
                min={1}
                className="field"
                value={campaignStartLevel}
                onChange={(event) => setCampaignStartLevel(Number(event.target.value || 1))}
              />
            </label>
            <input
              className="field"
              placeholder="Habilidades especiais (csv)"
              value={campaignSpecialAbilities}
              onChange={(event) => setCampaignSpecialAbilities(event.target.value)}
            />
            <input
              className="field md:col-span-2"
              placeholder="Cartas bônus (IDs, csv)"
              value={campaignBonusCards}
              onChange={(event) => setCampaignBonusCards(event.target.value)}
            />
            <textarea
              className="field md:col-span-2 min-h-20 resize-y py-3"
              placeholder="Regras especiais/customizações"
              value={campaignSpecialRules}
              onChange={(event) => setCampaignSpecialRules(event.target.value)}
            />
          </div>
          <Button onClick={createCampaign}>Criar campanha</Button>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-white">Criar login de jogador</h2>
          </div>
          <div className="grid gap-3">
            <input
              className="field"
              placeholder="Nome de exibição"
              value={newUserDisplayName}
              onChange={(event) => setNewUserDisplayName(event.target.value)}
            />
            <input
              className="field"
              placeholder="Login (sem espaços)"
              value={newUserUsername}
              onChange={(event) => setNewUserUsername(event.target.value)}
            />
            <input
              className="field"
              type="password"
              placeholder="Senha do jogador"
              value={newUserPassword}
              onChange={(event) => setNewUserPassword(event.target.value)}
            />
          </div>
          <Button onClick={createUser}>Criar acesso</Button>
        </SurfaceCard>
      </section>

      {selectedCampaign ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <SurfaceCard className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="field max-w-md"
                value={selectedCampaign.id}
                onChange={(event) => {
                  setSelectedCampaignId(event.target.value);
                  setMasterCharacterId(null);
                }}
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} · {campaign.isOpen ? "aberta" : "fechada"}
                  </option>
                ))}
              </select>
              <Button variant="secondary" onClick={toggleCampaignStatus}>
                {selectedCampaign.isOpen ? "Fechar campanha" : "Abrir campanha"}
              </Button>
              {selectedCampaign.isOpen && (
                <a
                  href={`/master/campaigns/${selectedCampaign.id}/session`}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Sessão ao vivo
                </a>
              )}
            </div>
            <p className="text-sm text-white/60">
              {selectedCampaign.description || "Sem descrição."}
            </p>
            <p className="text-xs text-white/50">
              Nível inicial: {selectedCampaign.startLevel} · Jogadores:{" "}
              {campaignPlayers.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {campaignPlayers.length ? (
                campaignPlayers.map((player) => (
                  <span
                    key={player.id}
                    className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/75"
                  >
                    {player.displayName} ({player.username})
                  </span>
                ))
              ) : (
                <span className="text-sm text-white/55">Sem jogadores vinculados ainda.</span>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Adicionar jogador à campanha</h3>
            <select
              className="field"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              <option value="">Selecione um jogador</option>
              {allPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.displayName} ({player.username})
                </option>
              ))}
            </select>
            <Button onClick={addPlayerToCampaign}>Adicionar jogador</Button>
          </SurfaceCard>
        </section>
      ) : (
        <SurfaceCard>
          <p className="text-sm text-white/65">
            Nenhuma campanha cadastrada ainda. Crie a primeira campanha para começar.
          </p>
        </SurfaceCard>
      )}

      {!character ? (
        <SurfaceCard>
          <p className="text-sm text-white/65">
            Nenhum personagem ativo na campanha selecionada. Peça para os jogadores entrarem com suas fichas.
          </p>
        </SurfaceCard>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
            <SurfaceCard className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-lg font-semibold text-white">Personagens da campanha</h2>
              </div>
              <div className="space-y-3">
                {charactersInCampaign.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      item.id === character.id
                        ? "border-transparent bg-[linear-gradient(135deg,rgba(212,177,106,0.24),rgba(18,126,117,0.18))]"
                        : "border-white/10 bg-white/4"
                    }`}
                    onClick={() => setMasterCharacterId(item.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-white/45">
                          {item.classKey} · {item.subclassKey} · {item.playerName}
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                        HP {item.totalHp - item.currentHp}/{item.totalHp}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <IconTrack label="Vida" total={character.totalHp} filled={remainingHp} icon="heart" />
              <IconTrack
                label="Armadura"
                total={character.armorMax}
                filled={character.armorCurrent}
                icon="shield"
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

          <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <SurfaceCard className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-lg font-semibold text-white">Simulador de dano</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Dano bruto</span>
                  <input
                    type="number"
                    min={0}
                    className="field"
                    value={damageRaw}
                    onChange={(event) => setDamageRaw(Number(event.target.value || 0))}
                  />
                </label>
                <label className="flex items-end gap-3 rounded-[24px] border border-white/8 bg-black/18 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={useArmor}
                    onChange={(event) => setUseArmor(event.target.checked)}
                  />
                  <span className="text-sm text-white/70">
                    Usar 1 armadura para reduzir o dano em 1
                  </span>
                </label>
              </div>

              {preview ? (
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ["Classificação", preview.damagePoints],
                    ["Armadura final", preview.armorFinal],
                    ["Dano final", preview.pontosDanoFinal],
                    ["HP marcado", preview.currentHPFinal],
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
              ) : null}

              <Button onClick={applyDamage}>Aplicar dano</Button>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-lg font-semibold text-white">Estados e cartas</h2>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-black/18 p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Ajustes rapidos de combate</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    onClick={() => adjustResources("hp-inc", { delta: { currentHp: 1 } })}
                    disabled={adjustingAction !== null}
                  >
                    Sofrer 1 dano
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => adjustResources("hp-dec", { delta: { currentHp: -1 } })}
                    disabled={adjustingAction !== null}
                  >
                    Curar 1 dano
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => adjustResources("armor-dec", { delta: { armorCurrent: -1 } })}
                    disabled={adjustingAction !== null}
                  >
                    Gastar 1 armadura
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => adjustResources("armor-inc", { delta: { armorCurrent: 1 } })}
                    disabled={adjustingAction !== null}
                  >
                    Recuperar 1 armadura
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => adjustResources("hope-dec", { delta: { hope: -1 } })}
                    disabled={adjustingAction !== null}
                  >
                    Usar 1 Esperanca
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => adjustResources("hope-inc", { delta: { hope: 1 } })}
                    disabled={adjustingAction !== null}
                  >
                    Ganhar 1 Esperanca
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => adjustResources("fatigue-inc", { delta: { fatigue: 1 } })}
                    disabled={adjustingAction !== null}
                  >
                    Marcar 1 Fadiga
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => adjustResources("fatigue-dec", { delta: { fatigue: -1 } })}
                    disabled={adjustingAction !== null}
                  >
                    Recuperar 1 Fadiga
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {commonConditions.map((condition) => {
                  const active = character.conditions.includes(condition);
                  return (
                    <button
                      key={condition}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : "bg-white/6 text-white/70"
                      }`}
                      onClick={() => changeCondition(condition, active ? "remove" : "add")}
                    >
                      {condition}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <input
                  className="field flex-1"
                  value={customCondition}
                  onChange={(event) => setCustomCondition(event.target.value)}
                  placeholder="Nova condição personalizada"
                />
                <Button onClick={() => changeCondition(customCondition, "add")}>Adicionar</Button>
              </div>

              <div className="space-y-3 rounded-[24px] border border-white/8 bg-black/18 p-4">
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Buscar carta</span>
                  <input
                    className="field"
                    value={cardSearch}
                    onChange={(event) => setCardSearch(event.target.value)}
                    placeholder="Nome da carta"
                  />
                </label>
                <select
                  className="field"
                  value={selectedAssignCardId}
                  onChange={(event) => setSelectedAssignCardId(event.target.value)}
                >
                  <option value="">Selecione uma carta</option>
                  {filteredCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} · {card.category}
                    </option>
                  ))}
                </select>
                <Button onClick={assignCard}>Atribuir carta</Button>
              </div>
            </SurfaceCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <SurfaceCard className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[var(--accent)]" />
                  <h2 className="text-lg font-semibold text-white">Histórico</h2>
                </div>
                <Button variant="ghost" onClick={undoLastAction}>
                  Desfazer última ação
                </Button>
              </div>
              <div className="space-y-3">
                {character.damageLogs.length ? (
                  character.damageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-[24px] border border-white/8 bg-black/18 p-4"
                    >
                      <p className="text-sm font-semibold text-white">
                        {log.damageRaw} bruto → {log.damagePoints} ponto(s) de dano
                      </p>
                      <p className="mt-2 text-xs text-white/50">
                        Armadura {log.armorUsed ? "usada" : "não usada"} · HP {log.hpBefore} →{" "}
                        {log.hpAfter}
                      </p>
                      <p className="mt-2 text-xs text-white/40">{formatDateTime(log.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/55">Nenhuma ação registrada ainda.</p>
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Cartas atribuídas</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {character.cards.map((card) => (
                  <div
                    key={card.linkId}
                    className="rounded-[24px] border border-white/8 bg-black/18 p-4"
                  >
                    <p className="text-sm font-semibold text-white">{card.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/40">
                      {card.category} {card.tier ? `· ${card.tier}` : ""}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      {card.text.slice(0, 150)}...
                    </p>
                  </div>
                ))}
              </div>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </SurfaceCard>
          </section>
        </>
      )}
    </AppShell>
  );
}
