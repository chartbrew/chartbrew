function roll(random) {
  return typeof random === "function" ? random() : Math.random();
}

export function getTypeDelay(char, random = Math.random) {
  const first = roll(random);
  if (char === "." || char === ",") return 64 + first * 112;
  if (char === " ") return 14 + first * 40;
  let delay = 6 + first * 42;
  if (roll(random) < 0.1) delay += 28 + roll(random) * 72;
  return delay;
}

export function getLinePause(random = Math.random) {
  return 88 + roll(random) * 136;
}
