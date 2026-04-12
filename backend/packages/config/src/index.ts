export const STOCKPULSE_CONFIG = {
  apiPrefix: "/api/v1",
  defaultCurrency: "INR",
  minorUnitScale: 100, // 100 paise = 1 INR, 100 cents = 1 USD
  maxJobRetries: 3,
  backoffBaseMs: 1000,
};
