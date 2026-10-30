type AvatarProps = {
  name?: string;
};

export function Avatar({ name }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className="flex size-11 flex-none items-center justify-center rounded-full bg-reading-bg text-base font-extrabold text-reading"
    >
      {name?.trim().charAt(0).toUpperCase()}
    </span>
  );
}
