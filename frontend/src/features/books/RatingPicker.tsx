import { Star } from "lucide-react";
import { useId } from "react";

const RATINGS = [1, 2, 3, 4, 5];

type RatingPickerProps = {
  value: number | null;
  onChange: (rating: number | null) => void;
};

export function RatingPicker({ value, onChange }: RatingPickerProps) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <p id={labelId} className="m-0 text-sm font-semibold">
        Your rating (optional)
      </p>
      <div role="group" aria-labelledby={labelId} className="flex">
        {RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            aria-label={`${rating} out of 5`}
            aria-pressed={value === rating}
            onClick={() => onChange(value === rating ? null : rating)}
            className="flex size-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gifted"
          >
            <Star aria-hidden="true" size={26} fill={value !== null && rating <= value ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}
