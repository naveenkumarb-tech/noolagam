import type { Stats } from "../../api/stats";

export function TopAuthors({ authors }: { authors: Stats["top_authors"] }) {
  const highest = Math.max(...authors.map((author) => author.count));

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
      <h2 className="m-0 text-base font-bold">Top authors</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {authors.map(({ author, count }) => (
          <li key={author} className="grid grid-cols-[110px_minmax(0,1fr)_24px] items-center gap-2.5 text-[13px]">
            <span className="truncate font-semibold">{author}</span>
            <span aria-hidden="true" className="block">
              <span
                style={{ width: `${(count / highest) * 100}%` }}
                className="block h-2 rounded bg-primary"
              />
            </span>
            <span className="text-right font-bold">
              <span className="sr-only">: </span>
              {count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
