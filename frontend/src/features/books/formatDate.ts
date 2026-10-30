/** "12 Oct" this year, and "12 Oct 2019" otherwise. Dates are parsed as local, so they never shift by a day. */
export function formatBookDate(value: string, now = new Date()): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: year === now.getFullYear() ? undefined : "numeric",
  });
}
