import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";

import { lookupBook, type BookLookup, type BookStatus, type NewBook } from "../../api/books";
import { apiErrorMessage } from "../../api/errors";
import { Button } from "../../components/Button";
import { Cover } from "../../components/Cover";
import { FormError } from "../../components/FormError";
import { InfoBox } from "../../components/InfoBox";
import { TextField } from "../../components/TextField";
import { addBookSchema, type AddBookFormValues } from "./addBookSchema";
import { CoverPhotoPicker } from "./CoverPhotoPicker";
import { isValidIsbn, normalizeIsbn } from "./isbn";
import { localDate } from "./localDate";
import { RatingPicker } from "./RatingPicker";
import { useCreateBook, type SavedBook } from "./useBooks";

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: "to_read", label: "To read" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
];

const DATE_LABELS: Partial<Record<BookStatus, string>> = {
  reading: "Started on",
  finished: "Finished on",
};

function defaultValues(): AddBookFormValues {
  return {
    isbn: "",
    title: "",
    author: "",
    pageCount: "",
    giftedBy: "",
    status: "to_read",
    date: localDate(),
    rating: null,
  };
}

function toNewBook(values: AddBookFormValues, found: BookLookup | null): NewBook {
  return {
    title: values.title,
    author: values.author,
    isbn: values.isbn ? normalizeIsbn(values.isbn) : undefined,
    page_count: values.pageCount ? Number(values.pageCount) : undefined,
    gifted_by: values.giftedBy || undefined,
    cover_url: found?.cover_url ?? undefined,
    description: found?.description ?? undefined,
    status: values.status,
    started_at: values.status === "reading" ? values.date : undefined,
    finished_at: values.status === "finished" ? values.date : undefined,
    rating: values.status === "finished" ? (values.rating ?? undefined) : undefined,
  };
}

function lookupErrorMessage(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 404) {
    return "We couldn't find this ISBN. You can still enter the details below.";
  }
  if (isAxiosError(error) && error.response?.status === 503) {
    return "Book lookup isn't available right now. You can still enter the details below.";
  }
  return apiErrorMessage(error);
}

export function AddBookForm() {
  const create = useCreateBook();
  const [found, setFound] = useState<BookLookup | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saved, setSaved] = useState<SavedBook | null>(null);
  const savedMessage = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    clearErrors,
    control,
    reset,
    formState: { errors },
  } = useForm<AddBookFormValues>({ resolver: zodResolver(addBookSchema), defaultValues: defaultValues() });

  const lookup = useMutation({
    mutationFn: lookupBook,
    onSuccess: (book) => {
      setFound(book);
      const filled = { shouldValidate: true };
      if (book.title) setValue("title", book.title, filled);
      if (book.author) setValue("author", book.author, filled);
      if (book.page_count) setValue("pageCount", String(book.page_count), filled);
    },
  });

  const status = useWatch({ control, name: "status" });
  const rating = useWatch({ control, name: "rating" });
  const dateLabel = DATE_LABELS[status];

  // The form is reset for the next book, so the page returns to the top where this message is.
  useEffect(() => {
    if (saved) {
      savedMessage.current?.scrollIntoView?.({ block: "center" });
    }
  }, [saved]);

  const lookUp = () => {
    const isbn = getValues("isbn").trim();
    if (!isValidIsbn(isbn)) {
      setError("isbn", {
        message: isbn ? "Enter a valid 10 or 13 digit ISBN" : "Enter the ISBN to look up",
      });
      return;
    }
    clearErrors("isbn");
    setFound(null);
    setSaved(null);
    lookup.mutate(normalizeIsbn(isbn));
  };

  const lookUpOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      lookUp();
    }
  };

  const onSubmit = (values: AddBookFormValues) => {
    setSaved(null);
    create.mutate({ book: toNewBook(values, found), photo }, {
      onSuccess: (result) => {
        setSaved(result);
        setFound(null);
        setPhoto(null);
        lookup.reset();
        reset(defaultValues());
      },
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div ref={savedMessage} role="status" className="empty:hidden">
        {saved && !saved.photoError && (
          <InfoBox icon={CircleCheck}>
            <strong>{saved.book.title}</strong> is on your shelf. Add another below, or{" "}
            <Link to="/" className="font-bold text-reading underline hover:text-reading">
              go to Home
            </Link>
            .
          </InfoBox>
        )}
        {saved && Boolean(saved.photoError) && (
          <InfoBox icon={TriangleAlert}>
            <strong>{saved.book.title}</strong> is on your shelf, but its photo wasn't saved.{" "}
            {apiErrorMessage(saved.photoError).replace(/\.?$/, ".")}{" "}
            <Link to={`/books/${saved.book.id}/edit`} className="font-bold text-reading underline hover:text-reading">
              Try again from Edit
            </Link>
            .
          </InfoBox>
        )}
      </div>

      <section className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
        <TextField
          label="Quick add with ISBN"
          type="text"
          autoComplete="off"
          placeholder="ISBN on the back cover"
          error={errors.isbn?.message}
          onKeyDown={lookUpOnEnter}
          trailing={
            <Button
              type="button"
              variant="dark"
              size="md"
              className="!h-12 !w-auto flex-none px-4"
              isLoading={lookup.isPending}
              onClick={lookUp}
            >
              Look up
            </Button>
          }
          {...register("isbn", {
            // These results belong to the ISBN that was looked up, not to a new one.
            onChange: () => {
              setFound(null);
              lookup.reset();
            },
          })}
        />
        <p className="m-0 text-[13px] leading-[1.45] text-text-secondary">
          Cover, description and page count are filled in automatically.
        </p>
        {lookup.isError && (
          <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
            {lookupErrorMessage(lookup.error)}
          </p>
        )}
        {found && (
          <div role="status" className="flex gap-3 rounded-xl bg-background p-3">
            <Cover title={found.title ?? "Book"} coverUrl={found.cover_url} showTitle={false} sizeClass="h-[72px] w-12" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="m-0 text-sm font-bold">Found: {found.title ?? "this ISBN"}</p>
              {found.description && (
                <p className="m-0 line-clamp-2 text-[13px] leading-[1.4] text-text-secondary">{found.description}</p>
              )}
              {(!found.title || !found.author) && (
                <p className="m-0 text-[13px] font-semibold text-gifted">Please fill in what's missing below.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-2.5 text-[13px] font-semibold text-text-secondary">
        <div className="h-px flex-1 bg-input-border" />
        or enter manually
        <div className="h-px flex-1 bg-input-border" />
      </div>

      <TextField label="Title" type="text" placeholder="Book title" error={errors.title?.message} {...register("title")} />
      <TextField
        label="Author"
        type="text"
        placeholder="Author name"
        error={errors.author?.message}
        {...register("author")}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <TextField
          label="Pages"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 320"
          error={errors.pageCount?.message}
          {...register("pageCount")}
        />
        <TextField
          label="Gifted by"
          type="text"
          placeholder="Optional"
          error={errors.giftedBy?.message}
          {...register("giftedBy")}
        />
      </div>

      <CoverPhotoPicker photo={photo} currentUrl={found?.cover_url ?? null} onChange={setPhoto} />

      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-sm font-semibold">Status</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-border p-1">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setValue("status", value, { shouldValidate: false })}
              // The pseudo-element extends the 38 px button to a 44 px tap area over the track's padding.
              className={`relative h-[38px] cursor-pointer rounded-[9px] border-0 text-[13px] after:absolute after:inset-x-0 after:-inset-y-[3px] ${
                status === value ? "bg-surface font-bold text-text shadow-card" : "bg-transparent font-semibold text-text-tertiary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {dateLabel && (
        <TextField
          label={dateLabel}
          type="date"
          max={localDate()}
          error={errors.date?.message}
          {...register("date")}
        />
      )}
      {status === "finished" && (
        <RatingPicker value={rating} onChange={(value) => setValue("rating", value)} />
      )}

      {create.isError && <FormError message={apiErrorMessage(create.error)} />}
      <Button type="submit" isLoading={create.isPending}>
        {create.isPending ? "Saving…" : "Save book"}
      </Button>
    </form>
  );
}
