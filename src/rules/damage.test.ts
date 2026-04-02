import { describe, expect, it } from "vitest";

import { aplicarArmadura, atualizarHP, classificarDano } from "./damage";

describe("classificarDano", () => {
  it("retorna 0 quando o dano bruto e zero ou menor", () => {
    expect(classificarDano(0, 8, 14)).toBe(0);
  });

  it("retorna 1 quando o dano e menor que o primeiro limiar", () => {
    expect(classificarDano(7, 8, 14)).toBe(1);
  });

  it("retorna 2 quando o dano fica entre os limiares", () => {
    expect(classificarDano(12, 8, 14)).toBe(2);
  });

  it("retorna 3 quando o dano alcanca o segundo limiar", () => {
    expect(classificarDano(14, 8, 14)).toBe(3);
  });
});

describe("aplicarArmadura", () => {
  it("consome 1 armadura e reduz o dano em 1", () => {
    expect(aplicarArmadura(3, 2, true)).toEqual({
      pontosDanoFinal: 2,
      armorFinal: 1,
    });
  });

  it("nao deixa armadura negativa", () => {
    expect(aplicarArmadura(1, 0, true)).toEqual({
      pontosDanoFinal: 1,
      armorFinal: 0,
    });
  });

  it("nao aplica reducao se o mestre optar por nao usar armadura", () => {
    expect(aplicarArmadura(2, 3, false)).toEqual({
      pontosDanoFinal: 2,
      armorFinal: 3,
    });
  });
});

describe("atualizarHP", () => {
  it("soma o dano acumulado sem ultrapassar o total", () => {
    expect(atualizarHP(1, 4, 2)).toEqual({
      currentHPFinal: 3,
      downed: false,
    });
  });

  it("marca downed quando o dano acumulado alcanca o total", () => {
    expect(atualizarHP(3, 4, 2)).toEqual({
      currentHPFinal: 4,
      downed: true,
    });
  });
});
