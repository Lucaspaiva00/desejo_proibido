function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function creatorCommissionPercent() {
  return clampInt(process.env.LIVE_PLATFORM_FEE_PERCENT, 0, 90, 30);
}

export function creditValueCentavos() {
  return clampInt(process.env.CREATOR_CREDITO_VALOR_CENTAVOS, 1, 100000, 1);
}

export function minPayoutCredits() {
  return clampInt(process.env.CREATOR_MIN_SAQUE_CREDITOS, 1, 1000000000, 5000);
}

export function maxPayoutCredits() {
  return clampInt(process.env.CREATOR_MAX_SAQUE_CREDITOS, 1, 2000000000, 10000000);
}

export function splitCreatorCredits(valorBruto) {
  const gross = Math.max(0, Math.trunc(Number(valorBruto) || 0));
  const percentual = creatorCommissionPercent();
  const taxa = Math.floor((gross * percentual) / 100);
  const criadora = Math.max(0, gross - taxa);
  return { bruto: gross, criadora, plataforma: taxa, percentual };
}

export function creditsToCentavos(credits) {
  return Math.max(0, Math.trunc(Number(credits) || 0)) * creditValueCentavos();
}

export function publicFinanceConfig() {
  return {
    taxaPlataformaPercent: creatorCommissionPercent(),
    creditoValorCentavos: creditValueCentavos(),
    saqueMinimoCreditos: minPayoutCredits(),
    saqueMaximoCreditos: maxPayoutCredits(),
  };
}
