import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

import type { BookSort, BookStatus } from "../api/books";
import { Button } from "../components/Button";
import { SectionError, SectionSkeleton } from "../components/SectionStates";
import { FilterChips, StatusTabs } from "../features/books/BookFilters";
import { BookRow } from "../features/books/BookRow";
import { useBookCounts, useBookFacets, useBookList } from "../features/books/useBooks";

const STATUSES: BookStatus[] = ["to_read", "reading", "finished"];
const SORTS: BookSort[] = ["recent", "title", "author", "finished"];
const SEARCH_DELAY_MS = 300;

function pick<T extends string>(allowed: T[], value: string | null): T | undefined {
  return allowed.find((item) => item === value);
}

export function MyBooksPage() {
  const location = useLocation();
  // Filters live in the URL, so that Back from a book returns to the same list.
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() || undefined;
  const status = pick(STATUSES, searchParams.get("status"));
  const author = searchParams.get("author") || undefined;
  const giftedBy = searchParams.get("gifted_by") || undefined;
  const sort = pick(SORTS, searchParams.get("sort")) ?? "recent";
  const [searchText, setSearchText] = useState(q ?? "");

  const setParam = (name: string, value?: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    const wanted = searchText.trim();
    if (wanted === (q ?? "")) return;
    const timer = setTimeout(() => setParam("q", wanted), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam changes on every render.
  }, [searchText, q]);

  const { data: counts } = useBookCounts();
  const { data: facets } = useBookFacets();
  const list = useBookList({ q, status, author, gifted_by: giftedBy, sort });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;

  const books = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const isFiltered = Boolean(q || status || author || giftedBy);

  const clearFilters = () => {
    setSearchText("");
    setSearchParams({}, { replace: true });
  };

  // Infinite scroll: the next page loads as the end of the list comes close.
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage || isFetchingNextPage || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px] lg:text-[30px]">My books</h1>

      <div className="relative">
        <label htmlFor="book-search" className="sr-only">
          Search books
        </label>
        <Search
          aria-hidden="true"
          size={18}
          className="pointer-events-none absolute top-[15px] left-3.5 text-text-secondary"
        />
        <input
          id="book-search"
          type="search"
          value={searchText}
          autoFocus={Boolean(location.state?.focusSearch)}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search title, author, description"
          maxLength={200}
          className="h-12 w-full rounded-xl border border-border bg-surface pr-3.5 pl-[42px] text-[15px] text-text placeholder:text-text-secondary focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary"
        />
      </div>

      <StatusTabs value={status} counts={counts} onChange={(value) => setParam("status", value)} />

      <FilterChips
        author={author}
        giftedBy={giftedBy}
        sort={sort}
        isSearching={Boolean(q)}
        authors={facets?.authors}
        giftedByNames={facets?.gifted_by}
        onAuthorChange={(value) => setParam("author", value)}
        onGiftedByChange={(value) => setParam("gifted_by", value)}
        onSortChange={(value) => setParam("sort", value === "recent" ? undefined : value)}
      />

      {/* Always mounted, so that screen readers announce each new result count. */}
      <p role="status" className="m-0 text-[13px] text-text-secondary empty:hidden">
        {isFiltered && list.data ? `${total} ${total === 1 ? "book" : "books"} found` : ""}
      </p>

      {list.isPending && <SectionSkeleton heightClass="h-96" />}
      {list.isError && !list.data && <SectionError error={list.error} onRetry={list.refetch} />}

      {list.data && books.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center shadow-card">
          {isFiltered ? (
            <>
              <p className="m-0 text-base font-bold">No books match</p>
              <p className="m-0 text-sm text-text-secondary">Try a different search or remove a filter.</p>
              <Button variant="outline" size="md" className="!w-auto px-5" onClick={clearFilters}>
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <p className="m-0 text-base font-bold">Your shelf is empty</p>
              <p className="m-0 text-sm text-text-secondary">Add the first book you own.</p>
              <Link
                to="/books/new"
                className="flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white no-underline hover:bg-primary-hover hover:text-white"
              >
                Add a book
              </Link>
            </>
          )}
        </div>
      )}

      {books.length > 0 && (
        <ul
          aria-busy={list.isPlaceholderData}
          className={`m-0 grid list-none grid-cols-1 gap-2.5 p-0 lg:grid-cols-2 lg:gap-3.5 ${
            list.isPlaceholderData ? "opacity-60" : ""
          }`}
        >
          {books.map((book) => (
            <BookRow key={book.id} book={book} />
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div ref={loadMoreRef} className="flex flex-col items-center gap-2 py-2">
          {list.isFetchNextPageError && (
            <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
              We couldn't load more books.
            </p>
          )}
          <Button
            variant="outline"
            size="md"
            className="!w-auto px-5"
            isLoading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
