import { BARCODE_TYPES, normalizeBarcode } from './barcode';

describe('normalizeBarcode', () => {
  it('trims and keeps leading zeros', () => {
    expect(normalizeBarcode('  0123456789012 ')).toBe('0123456789012');
  });
  it('accepts 8 and 14 digits', () => {
    expect(normalizeBarcode('12345678')).toBe('12345678');
    expect(normalizeBarcode('12345678901234')).toBe('12345678901234');
  });
  it.each(['1234567', '123456789012345', '1234abcd5678', '1234 5678', '', 'https://x.test'])('rejects %p', (raw) => {
    expect(normalizeBarcode(raw)).toBeNull();
  });
  it('lists the supported types', () => {
    expect(BARCODE_TYPES).toEqual(['upc_a', 'upc_e', 'ean13', 'ean8']);
  });
});
