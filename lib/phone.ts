export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim() || null;
}

export function phonesToMatch(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return [
      digits,
      `1${digits}`,
      `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
      `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`,
      `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`,
    ];
  }
  return [phone];
}
