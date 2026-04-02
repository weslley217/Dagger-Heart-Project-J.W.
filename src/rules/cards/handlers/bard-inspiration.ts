import type { CharacterDetail } from "@/types/domain";

export function bardInspirationHandler(character: CharacterDetail) {
  const hope = Math.min(character.resources.hope + 1, character.resources.hopeMax);

  return {
    summary: `${character.name} recebeu 1 ponto de Esperança por inspiração.`,
    nextResources: {
      ...character.resources,
      hope,
    },
  };
}
