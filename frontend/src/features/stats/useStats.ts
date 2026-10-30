import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getStats } from "../../api/stats";
import { BOOKS_KEY } from "../books/useBooks";

export function useStats(year: number) {
  return useQuery({
    // Under the books key, so that any change to a book refreshes the stats too.
    queryKey: [BOOKS_KEY, "stats", year],
    queryFn: () => getStats(year),
    // Keeps the current charts on screen while another year loads.
    placeholderData: keepPreviousData,
  });
}
