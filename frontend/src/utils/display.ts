/**
 * Returns display value for employee/optional fields.
 * Treats placeholder/fake data as empty - never show fake data.
 */
export function toDisplayValue(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  const v = value.trim();
  if (!v) return '';
  if (v === 'N/A' || v === 'Imported' || v === '—' || v === '-') return '';
  if (v.toLowerCase().includes('placeholder')) return '';
  if (/^[a-z0-9]+@imported\.placeholder$/i.test(v)) return '';
  return v;
}

/** For email: hide @imported.placeholder and similar fake emails */
export function toDisplayEmail(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  const v = value.trim();
  if (!v) return '';
  if (v.toLowerCase().includes('placeholder')) return '';
  if (/@imported\.placeholder$/i.test(v)) return '';
  return v;
}

/** For name fields: hide N/A, Imported */
export function toDisplayName(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  const v = value.trim();
  if (!v || v === 'N/A' || v === 'Imported') return '';
  return v;
}

/** For full name display (e.g. "FirstName LastName"): remove placeholder parts */
export function toDisplayFullName(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  const parts = value.split(/\s+/).filter((p) => {
    const t = p.trim();
    return t && t !== 'N/A' && t !== 'Imported';
  });
  return parts.join(' ');
}
