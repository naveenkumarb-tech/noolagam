import type { Book } from "../../api/books";
import { localDate } from "./localDate";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Counted in UTC, because a local day can be 23 or 25 hours long when clocks change.
function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/** Days from starting to finishing, or to today for a book still being read. Null if it has no such span. */
export function readingDays(book: Book, today = localDate()): number | null {
  if (!book.started_at || book.status === "to_read") return null;
  const end = book.status === "finished" ? book.finished_at : today;
  // Never negative: a book started today where it's already tomorrow on the server is still day 0 here.
  return end ? Math.max(dayNumber(end) - dayNumber(book.started_at), 0) : null;
}

export function readingTimeLabel(book: Book, today = localDate()): string | null {
  const days = readingDays(book, today);
  if (days === null) return null;
  if (days === 0) {
    // Not "Read in a day": a book added as already finished has one date, so this often only means the
    // real dates weren't entered. Stats leaves these out of the average for the same reason.
    return book.status === "finished" ? "Started and finished the same day" : "Started today";
  }
  const span = `${days} ${days === 1 ? "day" : "days"}`;
  return book.status === "finished" ? `Read in ${span}` : `Reading for ${span}`;
}
