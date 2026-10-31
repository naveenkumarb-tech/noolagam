import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Cover } from "./Cover";

const SIZE = "h-20 w-12";
const URL = "https://covers.openlibrary.org/b/id/5-M.jpg?default=false";

function image(container: HTMLElement) {
  return container.querySelector("img");
}

describe("Cover", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("loads an uploaded photo from the page's own address on the website", () => {
    vi.stubEnv("VITE_API_URL", "");
    const { container } = render(<Cover title="Book" coverUrl="/api/v1/media/covers/a.jpg" sizeClass={SIZE} />);

    expect(image(container)).toHaveAttribute("src", "/api/v1/media/covers/a.jpg");
  });

  it("loads an uploaded photo from the API's address in the Android app", () => {
    vi.stubEnv("VITE_API_URL", "http://192.168.1.50:8000");
    const { container } = render(<Cover title="Book" coverUrl="/api/v1/media/covers/a.jpg" sizeClass={SIZE} />);

    expect(image(container)).toHaveAttribute("src", "http://192.168.1.50:8000/api/v1/media/covers/a.jpg");
  });

  it.each([URL, "blob:chosen-photo"])("leaves %s as it is", (address) => {
    vi.stubEnv("VITE_API_URL", "http://192.168.1.50:8000");
    const { container } = render(<Cover title="Book" coverUrl={address} sizeClass={SIZE} />);

    expect(image(container)).toHaveAttribute("src", address);
  });
});
