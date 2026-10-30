import type { BookCounts, BookSort, BookStatus } from "../../api/books";
import { ChipSelect } from "../../components/ChipSelect";

const STATUS_TABS: { value: BookStatus | undefined; label: string; count: (counts: BookCounts) => number }[] = [
  { value: undefined, label: "All", count: (counts) => counts.total },
  { value: "to_read", label: "To read", count: (counts) => counts.to_read },
  { value: "reading", label: "Reading", count: (counts) => counts.reading },
  { value: "finished", label: "Finished", count: (counts) => counts.finished },
];

const SORT_OPTIONS: { value: BookSort; label: string }[] = [
  { value: "recent", label: "Sort: Recent" },
  { value: "title", label: "Sort: Title" },
  { value: "author", label: "Sort: Author" },
  { value: "finished", label: "Sort: Finished" },
];

type StatusTabsProps = {
  value?: BookStatus;
  counts?: BookCounts;
  onChange: (status?: BookStatus) => void;
};

export function StatusTabs({ value, counts, onChange }: StatusTabsProps) {
  return (
    <div role="group" aria-label="Filter by status" className="grid grid-cols-4 gap-1 rounded-xl bg-border p-1">
      {STATUS_TABS.map((tab) => (
        <button
          key={tab.label}
          type="button"
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center rounded-[9px] border-0 text-xs leading-tight ${
            value === tab.value ? "bg-surface font-bold text-text shadow-card" : "bg-transparent font-semibold text-text-tertiary"
          }`}
        >
          <span>{tab.label}</span>
          {counts && <span className="font-medium">{tab.count(counts)}</span>}
        </button>
      ))}
    </div>
  );
}

function withCurrent(values: string[] = [], current?: string): string[] {
  // A value from the URL may no longer exist, and must still show as selected.
  return current && !values.includes(current) ? [current, ...values] : values;
}

type FilterChipsProps = {
  author?: string;
  giftedBy?: string;
  sort: BookSort;
  isSearching: boolean;
  authors?: string[];
  giftedByNames?: string[];
  onAuthorChange: (author?: string) => void;
  onGiftedByChange: (name?: string) => void;
  onSortChange: (sort: BookSort) => void;
};

export function FilterChips({
  author,
  giftedBy,
  sort,
  isSearching,
  authors,
  giftedByNames,
  onAuthorChange,
  onGiftedByChange,
  onSortChange,
}: FilterChipsProps) {
  return (
    // Sized by the track rather than by the options, as a dropdown would otherwise be as wide as its longest name.
    // The narrowest phones have no room for three in a row, so Sort takes its own line.
    <div className="grid grid-cols-2 gap-2 min-[370px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:flex">
      <ChipSelect
        className="lg:w-48"
        label="Filter by author"
        value={author ?? ""}
        isActive={Boolean(author)}
        options={[
          { value: "", label: "Author" },
          ...withCurrent(authors, author).map((name) => ({ value: name, label: name })),
        ]}
        onChange={(value) => onAuthorChange(value || undefined)}
      />
      <ChipSelect
        className="lg:w-48"
        label="Filter by who gifted the book"
        value={giftedBy ?? ""}
        isActive={Boolean(giftedBy)}
        options={[
          { value: "", label: "Gifted by" },
          ...withCurrent(giftedByNames, giftedBy).map((name) => ({ value: name, label: name })),
        ]}
        onChange={(value) => onGiftedByChange(value || undefined)}
      />
      <ChipSelect
        className="col-span-2 min-[370px]:col-span-1 lg:w-48"
        label="Sort books"
        value={isSearching ? "best" : sort}
        isActive={false}
        disabled={isSearching}
        options={isSearching ? [{ value: "best", label: "Sort: Best match" }] : SORT_OPTIONS}
        onChange={(value) => onSortChange(value as BookSort)}
      />
    </div>
  );
}
