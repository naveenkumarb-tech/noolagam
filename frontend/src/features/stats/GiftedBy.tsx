import { useState } from "react";

import type { Stats } from "../../api/stats";

const SHOWN_AT_FIRST = 6;
const CHIP_CLASS = "rounded-full px-3 py-1.5 text-[13px] font-semibold";

export function GiftedBy({ gifters }: { gifters: Stats["gifted_by"] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? gifters : gifters.slice(0, SHOWN_AT_FIRST);
  const hiddenCount = gifters.length - shown.length;

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
      <h2 className="m-0 text-base font-bold">Books gifted by</h2>
      <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
        {shown.map(({ name, count }) => (
          <li key={name} className={`${CHIP_CLASS} max-w-full truncate bg-gifted-bg text-gifted`}>
            {name} · {count}
          </li>
        ))}
        {hiddenCount > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className={`${CHIP_CLASS} relative cursor-pointer border-0 bg-to-read-bg text-to-read after:absolute after:inset-x-0 after:-inset-y-1.5`}
            >
              +{hiddenCount} more
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
