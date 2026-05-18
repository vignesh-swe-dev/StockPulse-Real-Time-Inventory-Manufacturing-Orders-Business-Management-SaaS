/**
 * StockPulse Currency & Locale Formatters
 * Invariant: All money values in the domain and API are exact integer minor units (paise).
 * Floating-point money arithmetic is strictly forbidden.
 * Numbers follow Indian numbering system (Lakhs and Crores e.g., ₹ 1,23,45,678.00).
 */

/**
 * Formats an integer minor amount (paise) into an Indian Rupee string (₹).
 * Example: 12500000 -> "₹1,25,000.00"
 */
export function formatPaiseToInr(
  paise: number | bigint | null | undefined,
  { showPaisa = true, showSymbol = true }: { showPaisa?: boolean; showSymbol?: boolean } = {}
): string {
  if (paise === null || paise === undefined || Number.isNaN(Number(paise))) {
    return showSymbol ? "₹0.00" : "0.00";
  }

  const numericPaise = Number(paise);
  const isNegative = numericPaise < 0;
  const absPaise = Math.abs(numericPaise);

  const rupees = Math.floor(absPaise / 100);
  const paisaFraction = absPaise % 100;

  // Format the rupee part using en-IN grouping (e.g. 1,00,000)
  const formattedRupees = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(rupees);

  let formatted = formattedRupees;
  if (showPaisa) {
    formatted += `.${paisaFraction.toString().padStart(2, "0")}`;
  }

  const prefix = isNegative ? "−" : "";
  const symbol = showSymbol ? "₹" : "";
  return `${prefix}${symbol}${formatted}`;
}

/**
 * Parses a user input string (e.g. "1,500.50" or "250") into integer paise (minor units).
 * Example: "1,500.50" -> 150050
 */
export function parseInrToPaise(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return 0;
    return Math.round(input * 100);
  }
  if (!input) return 0;

  // Strip currency symbol, whitespace, commas
  const cleaned = input.replace(/[₹,\s]/g, "").trim();
  if (!cleaned) return 0;

  const parts = cleaned.split(".");
  const rupeesPart = parseInt(parts[0] || "0", 10);
  if (Number.isNaN(rupeesPart)) return 0;

  let paisaPart = 0;
  if (parts.length > 1) {
    const rawPaisa = parts[1].slice(0, 2).padEnd(2, "0");
    paisaPart = parseInt(rawPaisa, 10) || 0;
  }

  const isNeg = cleaned.startsWith("-");
  const total = Math.abs(rupeesPart) * 100 + paisaPart;
  return isNeg ? -total : total;
}

/**
 * Formats quantities with unit of measurement.
 * Example: 2500.5, "KG" -> "2,500.5 KG"
 */
export function formatQuantity(quantity: number | null | undefined, uom: string = ""): string {
  if (quantity === null || quantity === undefined) return "0";
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3
  }).format(quantity);
  return uom ? `${formatted} ${uom}` : formatted;
}

/**
 * Formats basis points (bps) to percentage.
 * Example: 1800 -> "18%"
 */
export function formatBpsToPercent(bps: number | null | undefined): string {
  if (!bps) return "0%";
  const pct = bps / 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

/**
 * Formats date into Indian DD/MM/YYYY format.
 */
export function formatDateIndian(
  dateString: string | number | Date | null | undefined,
  { includeTime = false }: { includeTime?: boolean } = {}
): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "—";

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    if (!includeTime) {
      return `${day}/${month}/${year}`;
    }

    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return "—";
  }
}
