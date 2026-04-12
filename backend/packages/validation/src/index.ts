/**
 * Shared validation rules for StockPulse
 * Validates SKUs, tax identifiers (GSTIN/VAT), phone numbers, and integer minor currency units.
 */
export function isValidGstinOrTaxId(taxId: string, countryCode = "IN"): boolean {
  if (!taxId) return true;
  if (countryCode === "IN") {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(taxId.trim().toUpperCase());
  }
  return /^[A-Z0-9\-]{5,24}$/i.test(taxId.trim());
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[0-9\s\-()]{7,18}$/.test(phone.trim());
}
