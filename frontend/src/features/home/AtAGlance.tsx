import { SectionError, SectionSkeleton } from "../../components/SectionStates";
import { useBookCounts } from "../books/useBooks";

export function AtAGlance() {
  const { data: counts, isPending, isError, error, refetch } = useBookCounts();

  const tiles = counts && [
    { label: "Books owned", value: counts.total, colorClass: "" },
    { label: "Finished", value: counts.finished, colorClass: "text-finished-number" },
    { label: "To read", value: counts.to_read, colorClass: "" },
    { label: "Received as gifts", value: counts.gifted, colorClass: "text-gifted" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-[17px] font-bold lg:sr-only">At a glance</h2>
      {isPending && <SectionSkeleton heightClass="h-44 lg:h-24" />}
      {isError && <SectionError error={error} onRetry={refetch} />}
      {tiles && (
        <dl className="m-0 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3.5">
          {tiles.map(({ label, value, colorClass }) => (
            <div key={label} className="flex flex-col-reverse gap-0.5 rounded-[14px] bg-surface p-3.5 shadow-card lg:p-[18px]">
              <dt className="text-[13px] text-text-secondary lg:text-sm">{label}</dt>
              <dd className={`m-0 text-[26px] font-extrabold lg:text-[30px] ${colorClass}`}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
