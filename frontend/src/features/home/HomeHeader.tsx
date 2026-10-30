import { Plus, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { Avatar } from "../../components/Avatar";
import { useCurrentUser } from "../auth/useCurrentUser";

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeHeader() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const [query, setQuery] = useState("");

  const search = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/books?${new URLSearchParams({ q: query.trim() })}`);
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-secondary">{greeting(new Date().getHours())}</span>
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px] lg:text-[30px]">Your bookshelf</h1>
      </div>

      <div className="flex items-center gap-2.5 lg:hidden">
        <Link
          to="/books"
          state={{ focusSearch: true }}
          aria-label="Search books"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-text hover:text-text"
        >
          <Search aria-hidden="true" size={20} />
        </Link>
        <Link to="/profile" aria-label="Profile" className="rounded-full no-underline">
          <Avatar name={user?.name} />
        </Link>
      </div>

      <div className="hidden flex-wrap items-center gap-2.5 lg:flex">
        <form role="search" onSubmit={search}>
          <label htmlFor="home-search" className="sr-only">
            Search books
          </label>
          <input
            id="home-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, author…"
            className="h-11 w-[260px] max-w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-text placeholder:text-text-secondary focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary"
          />
        </form>
        <Link
          to="/books/new"
          className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-[18px] text-[15px] font-bold text-white no-underline hover:bg-primary-hover hover:text-white"
        >
          <Plus aria-hidden="true" size={18} />
          Add book
        </Link>
      </div>
    </header>
  );
}
