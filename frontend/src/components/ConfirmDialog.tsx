import { apiErrorMessage } from "../api/errors";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { FormError } from "./FormError";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  isPending: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  isPending,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog title={title} onClose={onClose}>
      {error ? <FormError message={apiErrorMessage(error)} /> : null}
      <p className="m-0 text-[15px] leading-normal text-text-secondary">{message}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="outline" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="danger" size="md" isLoading={isPending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
