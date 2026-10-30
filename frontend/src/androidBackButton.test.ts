import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setUpAndroidBackButton } from "./androidBackButton";

vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));

function pressBack(canGoBack: boolean) {
  const listener = vi.mocked(App.addListener).mock.calls[0][1] as (event: { canGoBack: boolean }) => void;
  listener({ canGoBack });
}

describe("Android's Back button", () => {
  beforeEach(() => {
    vi.mocked(App.addListener).mockClear();
    vi.mocked(App.exitApp).mockClear();
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(window.history, "back").mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "");
    vi.restoreAllMocks();
  });

  it("does nothing on the web, where the browser has its own Back", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    setUpAndroidBackButton();

    expect(App.addListener).not.toHaveBeenCalled();
  });

  it("goes back a screen", () => {
    setUpAndroidBackButton();

    pressBack(true);

    expect(window.history.back).toHaveBeenCalledTimes(1);
    expect(App.exitApp).not.toHaveBeenCalled();
  });

  it("goes back when the router knows of earlier screens, even if the WebView says it can't", () => {
    window.history.replaceState({ idx: 2 }, "");
    setUpAndroidBackButton();

    pressBack(false);

    expect(window.history.back).toHaveBeenCalledTimes(1);
    expect(App.exitApp).not.toHaveBeenCalled();
  });

  it("exits from the first screen", () => {
    setUpAndroidBackButton();

    pressBack(false);

    expect(App.exitApp).toHaveBeenCalledTimes(1);
  });

  it("closes an open dialog before anything else", () => {
    document.body.innerHTML = "<dialog open></dialog>";
    const cancelled = vi.fn();
    document.querySelector("dialog")!.addEventListener("cancel", cancelled);
    setUpAndroidBackButton();

    pressBack(true);

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(window.history.back).not.toHaveBeenCalled();
    expect(App.exitApp).not.toHaveBeenCalled();
  });
});
