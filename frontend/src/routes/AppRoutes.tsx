import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { AppLayout } from "../components/AppLayout";
import { SectionSkeleton } from "../components/SectionStates";
import { AddBookPage } from "../pages/AddBookPage";
import { BookDetailPage } from "../pages/BookDetailPage";
import { EditBookPage } from "../pages/EditBookPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { MyBooksPage } from "../pages/MyBooksPage";
import { ProfilePage } from "../pages/ProfilePage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { SignUpPage } from "../pages/SignUpPage";
import { GuestRoute, ProtectedRoute } from "./guards";

// Loaded only when opened, because the charting library is large and most visits never need it.
const StatsPage = lazy(() => import("../pages/StatsPage").then((module) => ({ default: module.StatsPage })));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Opened from an email link, so it works whether or not the user is logged in. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/books" element={<MyBooksPage />} />
          <Route path="/books/new" element={<AddBookPage />} />
          <Route
            path="/stats"
            element={
              <Suspense fallback={<SectionSkeleton heightClass="h-96" />}>
                <StatsPage />
              </Suspense>
            }
          />
        </Route>
        <Route element={<AppLayout hideBottomNav />}>
          <Route path="/books/:bookId" element={<BookDetailPage />} />
          <Route path="/books/:bookId/edit" element={<EditBookPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
