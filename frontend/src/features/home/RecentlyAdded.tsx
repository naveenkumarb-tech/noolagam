import { Link } from "react-router";

import { SectionError, SectionSkeleton } from "../../components/SectionStates";
import { StatusChip } from "../../components/StatusChip";
import { useRecentlyAdded } from "../books/useBooks";

const HEADINGS = ["Title", "Author", "Gifted by", "Status"];

export function RecentlyAdded() {
  const { data, isPending, isError, error, refetch } = useRecentlyAdded();

  if (data?.items.length === 0) {
    return null;
  }

  return (
    <section className="hidden flex-col gap-3.5 lg:flex">
      <h2 className="m-0 text-[19px] font-bold">Recently added</h2>
      {isPending && <SectionSkeleton heightClass="h-52" />}
      {isError && <SectionError error={error} onRetry={refetch} />}
      {data && (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-text-secondary">
                {HEADINGS.map((heading) => (
                  <th key={heading} scope="col" className="border-b border-border px-[18px] py-3.5 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((book) => (
                <tr key={book.id} className="border-b border-background last:border-b-0">
                  <td className="px-[18px] py-3.5 font-bold">
                    <Link to={`/books/${book.id}`} className="text-text no-underline hover:text-primary">
                      {book.title}
                    </Link>
                  </td>
                  <td className="px-[18px] py-3.5 text-text-tertiary">{book.author}</td>
                  <td
                    className={`px-[18px] py-3.5 ${book.gifted_by ? "font-semibold text-gifted" : "text-text-secondary"}`}
                  >
                    {book.gifted_by ?? "—"}
                  </td>
                  <td className="px-[18px] py-3.5">
                    <StatusChip book={book} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
