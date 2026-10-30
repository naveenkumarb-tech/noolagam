import { apiClient } from "./client";

export type Stats = {
  total_books: number;
  finished: number;
  currently_reading: number;
  to_read: number;
  gifted_books: number;
  year: number;
  available_years: number[];
  finished_this_year: number;
  pages_read_this_year: number;
  avg_days_per_book: number | null;
  finished_by_month: { month: string; count: number }[];
  top_authors: { author: string; count: number }[];
  gifted_by: { name: string; count: number }[];
};

export async function getStats(year: number): Promise<Stats> {
  const { data } = await apiClient.get<Stats>("/stats", { params: { year } });
  return data;
}
