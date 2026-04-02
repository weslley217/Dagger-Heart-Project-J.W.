import { clamp } from "@/lib/utils";
import { runCustomCardHandler } from "@/rules/cards/handlers";
import type { CardEffect, CharacterDetail, CharacterResources } from "@/types/domain";

type AppliedCardState = {
  currentHp: number;
  armorCurrent: number;
  threshold1: number;
  threshold2: number;
  conditions: string[];
  resources: CharacterResources;
  summary: string;
};

function resourceLabel(resource: "hope" | "fatigue" | "armor" | "stress") {
  switch (resource) {
    case "hope":
      return "Esperança";
    case "fatigue":
      return "Fadiga";
    case "armor":
      return "Armadura";
    case "stress":
      return "Estresse";
  }
}

export function describeCardEffect(effect: CardEffect) {
  switch (effect.type) {
    case "grant_resource":
      return `${effect.mode === "recover" ? "Recuperar" : "Ganhar"} ${Math.abs(effect.amount)} ${resourceLabel(effect.resource)}`;
    case "heal_hp":
      return `Curar ${effect.amount} PV`;
    case "apply_condition":
      return `Aplicar condição: ${effect.condition}`;
    case "modify_thresholds":
      return `Ajustar limiares em ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
    case "modify_damage":
      return `Modificar dano em ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
    case "uses_per_rest":
      return `${effect.uses} uso(s) por descanso`;
    case "custom_handler":
      return "Executar habilidade personalizada";
  }
}

export function applyCardEffectToCharacter(
  character: CharacterDetail,
  effect: CardEffect,
): AppliedCardState {
  const state: AppliedCardState = {
    currentHp: character.currentHp,
    armorCurrent: character.armorCurrent,
    threshold1: character.threshold1,
    threshold2: character.threshold2,
    conditions: [...character.conditions],
    resources: { ...character.resources },
    summary: "",
  };

  switch (effect.type) {
    case "grant_resource":
      if (effect.resource === "armor") {
        state.armorCurrent = clamp(
          state.armorCurrent + effect.amount,
          0,
          character.armorMax,
        );
      } else {
        const currentValue = state.resources[effect.resource];
        const maxKey = `${effect.resource}Max` as keyof CharacterResources;
        const maxValue = Number(state.resources[maxKey] ?? currentValue);
        state.resources[effect.resource] = clamp(currentValue + effect.amount, 0, maxValue);
      }
      state.summary = describeCardEffect(effect);
      return state;
    case "heal_hp":
      state.currentHp = Math.max(0, state.currentHp - effect.amount);
      state.summary = describeCardEffect(effect);
      return state;
    case "apply_condition":
      if (!state.conditions.includes(effect.condition)) {
        state.conditions.push(effect.condition);
      }
      state.summary = describeCardEffect(effect);
      return state;
    case "modify_thresholds":
      state.threshold1 += effect.amount;
      state.threshold2 += effect.amount;
      state.summary = describeCardEffect(effect);
      return state;
    case "modify_damage":
      state.summary = describeCardEffect(effect);
      return state;
    case "uses_per_rest":
      state.summary = describeCardEffect(effect);
      return state;
    case "custom_handler": {
      const handled = runCustomCardHandler(effect.handler, character);
      state.resources = handled.nextResources;
      state.summary = handled.summary;
      return state;
    }
  }
}
