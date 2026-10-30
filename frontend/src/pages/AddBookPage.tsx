import { AddBookForm } from "../features/books/AddBookForm";

export function AddBookPage() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Add a book</h1>
      <AddBookForm />
    </div>
  );
}
