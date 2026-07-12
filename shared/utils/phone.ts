/**
 * Phone helpers shared by the storefront checkout, admin WhatsApp buttons
 * and the web-orders API. Normalizes local numbers to E.164 using the
 * shop's configurable default country code (settings.phoneCountryCode).
 */

/** Normalize a raw phone input to E.164 (+213xxxxxxxxx). Returns null when invalid. */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountryCode = '+213'
): string | null {
  if (!raw) return null;
  let value = raw.replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(value)) return null;

  if (value.startsWith('00')) {
    value = `+${value.slice(2)}`;
  } else if (!value.startsWith('+')) {
    const cc = defaultCountryCode.startsWith('+')
      ? defaultCountryCode
      : `+${defaultCountryCode}`;
    // Local format: drop the trunk prefix "0" before prepending the country code
    value = cc + (value.startsWith('0') ? value.slice(1) : value);
  }

  const digits = value.slice(1);
  if (digits.length < 8 || digits.length > 15) return null;
  return value;
}

/** Build a wa.me deep link (pure URL, no API, no webhooks). */
export function whatsappLink(
  phone: string | null | undefined,
  defaultCountryCode = '+213',
  text?: string
): string | null {
  const normalized = normalizePhone(phone, defaultCountryCode);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized.slice(1)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Human-readable grouping for display: +213 555 12 34 56. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/(\+\d{3})(\d{3})(\d{2})(\d{2})(\d+)/, '$1 $2 $3 $4 $5');
}
