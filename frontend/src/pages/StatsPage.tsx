import { useState } from "react";
import { Link } from "react-router";

import { ChipSelect } from "../components/ChipSelect";
import { SectionError, SectionSkeleton } from "../components/SectionStates";
import { FinishedPerMonth } from "../features/stats/FinishedPerMonth";
import { GiftedBy } from "../features/stats/GiftedBy";
import { TopAuthors } from "../features/stats/TopAuthors";
import { useStats } from "../features/stats/useStats";

function KpiTile({ label, value, isAccent = false }: { label: string; value: string; isAccent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-surface p-3 shadow-card lg:p-[18px]">
      <dt className="text-xs leading-[1.3] text-text-secondary lg:text-sm">{label}</dt>
      {/* Shown above its label, so that the numbers line up even when a label wraps. */}
      <dd className={`order-first m-0 text-2xl font-extrabold lg:text-[30px] ${isAccent ? "text-primary" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

export function StatsPage() {
  // The reader's own year, because just after New Year the server's UTC date can still be in the old one.
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data: stats, isPending, isError, error, refetch, isPlaceholderData } = useStats(year);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px] lg:text-[30px]">Reading stats</h1>
        <ChipSelect
          className="w-[92px] flex-none"
          label="Year"
          value={String(year)}
          isActive={false}
          options={(stats?.available_years ?? [year]).map((value) => ({
            value: String(value),
            label: String(value),
          }))}
          onChange={(value) => setYear(Number(value))}
        />
      </header>

      {isPending && (
        <>
          <SectionSkeleton heightClass="h-20" />
          <SectionSkeleton heightClass="h-64" />
        </>
      )}
      {isError && !stats && <SectionError error={error} onRetry={refetch} />}

      {stats && (
        <div
          aria-busy={isPlaceholderData}
          className={`flex flex-col gap-4 ${isPlaceholderData ? "opacity-60" : ""}`}
        >
          <dl className="m-0 grid grid-cols-3 gap-2 lg:gap-3.5">
            <KpiTile label="Books finished" value={stats.finished_this_year.toLocaleString("en-IN")} isAccent />
            <KpiTile label="Pages read" value={stats.pages_read_this_year.toLocaleString("en-IN")} />
            <KpiTile
              label="Avg days per book"
              value={stats.avg_days_per_book === null ? "—" : stats.avg_days_per_book.toLocaleString("en-IN")}
            />
          </dl>

          {stats.finished_this_year > 0 ? (
            <FinishedPerMonth months={stats.finished_by_month} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center shadow-card">
              <p className="m-0 text-base font-bold">No books finished in {stats.year}</p>
              {stats.total_books === 0 ? (
                <>
                  <p className="m-0 text-sm text-text-secondary">Add your books to start seeing your stats.</p>
                  <Link
                    to="/books/new"
                    className="flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white no-underline hover:bg-primary-hover hover:text-white"
                  >
                    Add a book
                  </Link>
                </>
              ) : (
                <p className="m-0 text-sm text-text-secondary">Finished books will appear here.</p>
              )}
            </div>
          )}

          {(stats.top_authors.length > 0 || stats.gifted_by.length > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
              {stats.top_authors.length > 0 && <TopAuthors authors={stats.top_authors} />}
              {stats.gifted_by.length > 0 && <GiftedBy gifters={stats.gifted_by} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
