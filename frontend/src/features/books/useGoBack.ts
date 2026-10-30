import { useLocation, useNavigate } from "react-router";

/** Returns to the previous screen, keeping its filters. A page opened directly has none, so it uses the fallback. */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  const { key } = useLocation();

  return () => {
    if (key === "default") {
      navigate(fallback, { replace: true });
    } else {
      navigate(-1);
    }
  };
}
