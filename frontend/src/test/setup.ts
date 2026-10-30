import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// The default of 1 second makes tests fail on a busy computer, not because anything is wrong.
configure({ asyncUtilTimeout: 10_000 });

// jsdom may not implement the modal dialog methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};

// jsdom has no layout, and the charting library needs this to exist.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
