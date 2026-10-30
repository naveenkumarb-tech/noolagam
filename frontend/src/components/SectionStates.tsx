import { apiErrorMessage } from "../api/errors";
import { Button } from "./Button";

export function SectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl bg-surface p-4 shadow-card">
      <p className="m-0 text-sm font-semibold text-danger">{apiErrorMessage(error)}</p>
      <Button variant="outline" size="md" className="!w-auto px-5" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function SectionSkeleton({ heightClass }: { heightClass: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-border ${heightClass}`} />;
}
