import { App } from "@capacitor/app";

import { isNativeApp } from "./api/tokenStorage";

function isPastFirstScreen(): boolean {
  // React Router numbers each screen. The WebView's own canGoBack can say false even when there are
  // screens to return to, as it ignores history entries that no finger tap led to.
  const state = window.history.state as { idx?: number } | null;
  return (state?.idx ?? 0) > 0;
}

/** Without this, Android's Back button closes the whole app instead of going back a screen. */
export function setUpAndroidBackButton() {
  if (!isNativeApp()) return;

  void App.addListener("backButton", ({ canGoBack }) => {
    const openDialog = document.querySelector("dialog[open]");
    if (openDialog) {
      // The same event as pressing Escape, which the Dialog component already handles.
      openDialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    } else if (canGoBack || isPastFirstScreen()) {
      window.history.back();
    } else {
      void App.exitApp();
    }
  });
}
