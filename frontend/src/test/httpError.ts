import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";

export function httpError(status: number, message?: string) {
  const data = message ? { error: { code: "ERROR", message, request_id: "r" } } : {};
  const response = { status, data } as AxiosResponse;
  return new AxiosError("failed", undefined, { headers: new AxiosHeaders() }, null, response);
}

export function networkError() {
  return new AxiosError("Network Error", AxiosError.ERR_NETWORK);
}
