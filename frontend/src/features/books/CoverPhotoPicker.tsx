import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "../../components/Button";
import { Cover } from "../../components/Cover";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 15 * 1024 * 1024;

function problemWith(file: File): string | null {
  // Some Android galleries don't report a type, so an unknown one is left for the server to judge.
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    return "Choose a JPEG, PNG or WebP photo";
  }
  return file.size > MAX_BYTES ? "That photo is too large. Choose one under 15 MB" : null;
}

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = file && URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The address has to be released, so it can't be made while rendering.
    setUrl(objectUrl);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  return url;
}

type CoverPhotoPickerProps = {
  photo: File | null;
  /** The cover to show until a photo is chosen. */
  currentUrl: string | null;
  onChange: (photo: File | null) => void;
};

export function CoverPhotoPicker({ photo, currentUrl, onChange }: CoverPhotoPickerProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useObjectUrl(photo);
  const shownUrl = photo ? previewUrl : currentUrl;

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again, after removing it, still counts as a change.
    event.target.value = "";
    if (!file) return;
    const fileProblem = problemWith(file);
    setProblem(fileProblem);
    if (fileProblem) return;
    try {
      // On Android a file is only a temporary link to the photo, which can fail to display or later
      // to upload. A copy in memory can't, and any problem shows up now rather than after saving.
      onChange(new File([await file.arrayBuffer()], file.name, { type: file.type }));
    } catch {
      setProblem("We couldn't read that photo. Try choosing it again");
    }
  };

  const remove = () => {
    setProblem(null);
    onChange(null);
  };

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-semibold">Cover photo</legend>
      <div className="flex items-start gap-3">
        {shownUrl ? (
          <Cover title="Cover" coverUrl={shownUrl} showTitle={false} sizeClass="h-[108px] w-[72px]" />
        ) : (
          <div className="flex h-[108px] w-[72px] flex-none items-center justify-center rounded-md border border-dashed border-input-border text-text-tertiary">
            <ImagePlus aria-hidden="true" size={24} />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Hidden on laptops, whose camera can't usefully be pointed at a book. */}
          <Button
            type="button"
            variant="outline"
            size="md"
            className="lg:hidden"
            onClick={() => cameraInput.current?.click()}
          >
            <Camera aria-hidden="true" size={18} />
            Take photo
          </Button>
          <Button type="button" variant="outline" size="md" onClick={() => fileInput.current?.click()}>
            <ImagePlus aria-hidden="true" size={18} />
            Choose photo
          </Button>
          {photo && (
            <Button type="button" variant="outline" size="md" onClick={remove}>
              <Trash2 aria-hidden="true" size={18} />
              Remove photo
            </Button>
          )}
        </div>
      </div>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Photo from camera"
        tabIndex={-1}
        className="hidden"
        onChange={choose}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        aria-label="Photo from files"
        tabIndex={-1}
        className="hidden"
        onChange={choose}
      />
      <p role="status" className="m-0 text-[13px] leading-[1.45] text-text-secondary">
        {photo ? "New photo chosen. It's saved with the book." : "Optional. JPEG, PNG or WebP, up to 15 MB."}
      </p>
      {problem && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
