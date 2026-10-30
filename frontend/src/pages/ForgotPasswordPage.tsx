import { Link } from "react-router";

import { AuthSubpage } from "../features/auth/AuthSubpage";
import { ForgotPasswordForm } from "../features/auth/ForgotPasswordForm";

export function ForgotPasswordPage() {
  return (
    <AuthSubpage
      title="Forgot password?"
      description="Enter the email you signed up with and we'll send you a link to reset your password."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="relative font-bold no-underline after:absolute after:inset-x-0 after:-inset-y-3">
            Back to log in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthSubpage>
  );
}
