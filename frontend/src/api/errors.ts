import { isAxiosError } from "axios";

import type { ApiErrorBody } from "./client";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export function apiErrorMessage(error: unknown, statusMessages: Record<number, string> = {}): string {
  if (!isAxiosError<ApiErrorBody>(error)) {
    return GENERIC_MESSAGE;
  }
  if (!error.response) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  const { status } = error.response;
  if (statusMessages[status]) {
    return statusMessages[status];
  }
  if (status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  // The API writes these for people: "The current page cannot be higher than the book's page count".
  const serverMessage = error.response.data?.error?.message;
  if (status >= 400 && status < 500 && serverMessage) {
    return serverMessage;
  }
  return GENERIC_MESSAGE;
}
