import type { CharacterDetail } from "@/types/domain";

import { bardInspirationHandler } from "./bard-inspiration";

export function runCustomCardHandler(handler: string, character: CharacterDetail) {
  switch (handler) {
    case "bard_inspiration":
      return bardInspirationHandler(character);
    default:
      return {
        summary: `A habilidade personalizada "${handler}" foi registrada no histórico.`,
        nextResources: character.resources,
      };
  }
}
