import { useQuery } from "@tanstack/react-query";

import { getCurrentUser } from "../../api/users";
import { useAuthStatus } from "./AuthProvider";

export const CURRENT_USER_KEY = ["current-user"];

export function useCurrentUser() {
  const status = useAuthStatus();
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: getCurrentUser,
    enabled: status === "authenticated",
  });
}
