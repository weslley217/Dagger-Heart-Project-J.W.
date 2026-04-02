export function classificarDano(
  danoBruto: number,
  threshold1: number,
  threshold2: number,
): 0 | 1 | 2 | 3 {
  if (danoBruto <= 0) {
    return 0;
  }

  if (danoBruto < threshold1) {
    return 1;
  }

  if (danoBruto < threshold2) {
    return 2;
  }

  return 3;
}

export function aplicarArmadura(
  pontosDano: number,
  armor: number,
  usarArmadura: boolean,
) {
  const podeUsar = usarArmadura && armor > 0 && pontosDano > 0;

  return {
    pontosDanoFinal: podeUsar ? Math.max(pontosDano - 1, 0) : pontosDano,
    armorFinal: podeUsar ? Math.max(armor - 1, 0) : Math.max(armor, 0),
  };
}

export function atualizarHP(
  currentHP: number,
  totalHP: number,
  pontosDanoFinal: number,
) {
  const currentHPFinal = Math.min(currentHP + Math.max(pontosDanoFinal, 0), totalHP);

  return {
    currentHPFinal,
    downed: currentHPFinal >= totalHP,
  };
}
