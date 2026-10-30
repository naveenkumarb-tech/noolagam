export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsbn(value: string): boolean {
  const isbn = normalizeIsbn(value);
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const total = [...isbn].reduce(
      (sum, char, index) => sum + (10 - index) * (char === "X" ? 10 : Number(char)),
      0,
    );
    return total % 11 === 0;
  }
  if (/^\d{13}$/.test(isbn)) {
    const total = [...isbn].reduce((sum, char, index) => sum + (index % 2 ? 3 : 1) * Number(char), 0);
    return total % 10 === 0;
  }
  return false;
}
