import type { ReactNode } from "react";

import { BackLink } from "../../components/BackLink";

type AuthSubpageProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthSubpage({ title, description, children, footer }: AuthSubpageProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-6 px-7 pt-6 pb-8 lg:justify-center">
      <BackLink to="/login" label="Back to login" />

      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.5px]">{title}</h1>
        <p className="m-0 text-[15px] leading-normal text-text-secondary">{description}</p>
      </div>

      {children}

      <p className="m-0 mt-auto text-center text-[15px] text-text-secondary lg:mt-0">{footer}</p>
    </main>
  );
}
