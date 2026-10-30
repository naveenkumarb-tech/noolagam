import type { Book } from "../api/books";

const CHIP_CLASS = "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap";

export function StatusChip({ book }: { book: Book }) {
  if (book.status === "reading") {
    const percent = book.progress_percent === null ? "" : ` · ${book.progress_percent}%`;
    return <span className={`${CHIP_CLASS} bg-reading-bg text-reading`}>Reading{percent}</span>;
  }
  if (book.status === "finished") {
    const rating = book.rating === null ? "" : ` · ★ ${book.rating}`;
    return <span className={`${CHIP_CLASS} bg-finished-bg text-finished`}>Finished{rating}</span>;
  }
  return <span className={`${CHIP_CLASS} bg-to-read-bg text-to-read`}>To read</span>;
}
