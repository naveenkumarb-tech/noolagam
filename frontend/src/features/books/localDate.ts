/** Today's date where the user is, as YYYY-MM-DD. The server's UTC date can be a day behind or ahead. */
export function localDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
