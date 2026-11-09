/** The backend accepts 8 to 14 digits (EAN-8, UPC-A/E, EAN-13, GTIN-14). */
export const BARCODE_PATTERN = /^\d{8,14}$/;

export const BARCODE_TYPES = ['upc_a', 'upc_e', 'ean13', 'ean8'] as const;

/** Trimmed digit string, or null when it is not a barcode. Stays a string so leading zeros survive. */
export function normalizeBarcode(raw: string): string | null {
  const code = raw.trim();
  return BARCODE_PATTERN.test(code) ? code : null;
}
