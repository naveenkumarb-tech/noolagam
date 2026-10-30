type ProgressBarProps = {
  percent: number;
  label: string;
};

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const width = Math.min(Math.max(percent, 0), 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 overflow-hidden rounded bg-border"
    >
      <div style={{ width: `${width}%` }} className="h-full rounded bg-primary" />
    </div>
  );
}
