import { useSyncExternalStore } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Stats } from "../../api/stats";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Below this width, three-letter month names run into each other.
const NARROW_SCREEN = "(max-width: 359px)";

function subscribeToScreenWidth(onChange: () => void) {
  const query = window.matchMedia?.(NARROW_SCREEN);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function isScreenNarrow(): boolean {
  return window.matchMedia?.(NARROW_SCREEN).matches ?? false;
}

function bookCount(count: number): string {
  return `${count} ${count === 1 ? "book" : "books"}`;
}

type MonthTooltipProps = {
  active?: boolean;
  payload?: readonly { payload?: { index: number; count: number } }[];
};

function MonthTooltip({ active, payload }: MonthTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-card">
      <p className="m-0 font-bold text-text">{bookCount(point.count)}</p>
      <p className="m-0 text-text-secondary">{MONTH_NAMES[point.index]}</p>
    </div>
  );
}

export function FinishedPerMonth({ months }: { months: Stats["finished_by_month"] }) {
  const isNarrow = useSyncExternalStore(subscribeToScreenWidth, isScreenNarrow);
  const data = months.map(({ count }, index) => ({
    index,
    label: isNarrow ? MONTHS[index].charAt(0) : MONTHS[index],
    count,
  }));

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl bg-surface p-4 shadow-card">
      <h2 className="m-0 text-base font-bold">Finished per month</h2>

      {/* Hidden from screen readers, which get the same values from the table below. */}
      <div aria-hidden="true" className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 0, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <XAxis
              dataKey="label"
              interval={0}
              height={22}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
              axisLine={{ stroke: "var(--color-border)" }}
            />
            {/* dataMax makes the tallest bar use the full height. */}
            <YAxis hide allowDecimals={false} domain={[0, "dataMax"]} />
            <Tooltip content={<MonthTooltip />} cursor={{ fill: "var(--color-background)" }} isAnimationActive={false} />
            <Bar
              dataKey="count"
              fill="var(--color-primary)"
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="count"
                position="top"
                fontSize={11}
                fontWeight={700}
                fill="var(--color-text-tertiary)"
                formatter={(value) => (value ? String(value) : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Books finished per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Books finished</th>
          </tr>
        </thead>
        <tbody>
          {data.map(({ index, count }) => (
            <tr key={index}>
              <th scope="row">{MONTH_NAMES[index]}</th>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
