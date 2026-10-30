import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

type DialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** A bottom sheet on phones and a centred dialog on laptops. Render it only while it is open. */
export function Dialog({ title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const closeOnBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={closeOnBackdropClick}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-transparent text-text backdrop:bg-black/40 lg:m-auto lg:max-w-[420px] lg:rounded-2xl"
    >
      <div className="flex flex-col gap-4 rounded-t-2xl bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] lg:rounded-2xl lg:pb-5">
        <h2 id="dialog-title" className="m-0 text-[17px] font-bold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
