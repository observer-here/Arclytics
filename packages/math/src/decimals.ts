export function toNumber(raw: string | bigint, decimals: number): number {
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  return Number(whole) + Number(frac) / Number(base);
}

export function fromNumber(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals));
}
