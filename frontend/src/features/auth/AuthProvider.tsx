import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { refreshAccessToken } from "../../api/client";
import { tokenStorage } from "../../api/tokenStorage";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export const AuthStatusContext = createContext<AuthStatus>("anonymous");

export function useAuthStatus(): AuthStatus {
  return useContext(AuthStatusContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const accessToken = useSyncExternalStore(tokenStorage.subscribe, tokenStorage.getAccessToken);
  const [isRestoring, setIsRestoring] = useState(true);
  const hadSession = useRef(false);

  // The access token does not survive a reload, so the refresh cookie is used to get a new one.
  useEffect(() => {
    refreshAccessToken()
      .catch(() => undefined)
      .finally(() => setIsRestoring(false));
  }, []);

  // One person's cached books must never be shown to the next person to log in on this device.
  useEffect(() => {
    if (hadSession.current && !accessToken) {
      queryClient.clear();
    }
    hadSession.current = Boolean(accessToken);
  }, [accessToken, queryClient]);

  const status: AuthStatus = accessToken ? "authenticated" : isRestoring ? "loading" : "anonymous";
  return <AuthStatusContext.Provider value={status}>{children}</AuthStatusContext.Provider>;
}
