import { Link } from "react-router";

import { AuthSubpage } from "../features/auth/AuthSubpage";
import { SignUpForm } from "../features/auth/SignUpForm";

export function SignUpPage() {
  return (
    <AuthSubpage
      title="Create your account"
      description="Start your own library. Your books are private to you."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="relative font-bold no-underline after:absolute after:inset-x-0 after:-inset-y-3">
            Log in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthSubpage>
  );
}
