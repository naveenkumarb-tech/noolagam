type FormErrorProps = {
  message: string;
};

export function FormError({ message }: FormErrorProps) {
  return (
    <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-3 text-sm font-semibold text-danger">
      {message}
    </p>
  );
}
