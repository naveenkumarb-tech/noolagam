import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Cover } from "./Cover";

const SIZE = "h-20 w-12";
const URL = "https://covers.openlibrary.org/b/id/5-M.jpg?default=false";

function image(container: HTMLElement) {
  return container.querySelector("img");
}

describe("Cover", () => {
  it("shows the title on a coloured block when there is no cover", () => {
    const { container } = render(<Cover title="Thirukkural" coverUrl={null} sizeClass={SIZE} />);

    expect(screen.getByText("Thirukkural")).toBeInTheDocument();
    expect(image(container)).toBeNull();
  });

  it("can leave the title out on small covers", () => {
    render(<Cover title="Thirukkural" coverUrl={null} sizeClass={SIZE} showTitle={false} />);

    expect(screen.queryByText("Thirukkural")).not.toBeInTheDocument();
  });

  it("keeps the placeholder underneath while the image loads", () => {
    const { container } = render(<Cover title="Thirukkural" coverUrl={URL} sizeClass={SIZE} />);

    expect(image(container)).toHaveAttribute("src", URL);
    expect(screen.getByText("Thirukkural")).toBeInTheDocument();
  });

  it("falls back to the placeholder when the image fails", () => {
    const { container } = render(<Cover title="Thirukkural" coverUrl={URL} sizeClass={SIZE} />);

    fireEvent.error(image(container)!);

    expect(image(container)).toBeNull();
    expect(screen.getByText("Thirukkural")).toBeInTheDocument();
  });

  it("tries again when given a different image", () => {
    const { container, rerender } = render(<Cover title="Thirukkural" coverUrl={URL} sizeClass={SIZE} />);
    fireEvent.error(image(container)!);

    rerender(<Cover title="Thirukkural" coverUrl={`${URL}&next`} sizeClass={SIZE} />);

    expect(image(container)).toHaveAttribute("src", `${URL}&next`);
  });

  it("gives the same title the same colour every time", () => {
    const { container: first } = render(<Cover title="Thirukkural" coverUrl={null} sizeClass={SIZE} />);
    const { container: second } = render(<Cover title="Thirukkural" coverUrl={null} sizeClass={SIZE} />);

    expect((first.firstChild as HTMLElement).style.backgroundColor).toBe(
      (second.firstChild as HTMLElement).style.backgroundColor,
    );
  });
});
