import "@testing-library/jest-dom/vitest";

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
