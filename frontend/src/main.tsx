import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { setUpAndroidBackButton } from "./androidBackButton";
import { AuthProvider } from "./features/auth/AuthProvider";
import { AppRoutes } from "./routes/AppRoutes";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A client error will fail the same way again; only server and network errors are worth retrying.
      retry: (failureCount, error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        return failureCount < 1 && !(status && status < 500);
      },
    },
  },
});

setUpAndroidBackButton();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
