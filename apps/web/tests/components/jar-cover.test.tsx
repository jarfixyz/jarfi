import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { JarCover } from "@/components/ui/jar-cover";

describe("JarCover", () => {
  it("renders emoji when no coverUrl", () => {
    render(<JarCover emoji="🎂" height={200} />);
    expect(screen.getByText("🎂")).toBeInTheDocument();
  });

  it("renders photo when coverUrl is provided", () => {
    render(<JarCover coverUrl="/test.jpg" height={200} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/test.jpg");
  });

  it("uses default emoji when none provided", () => {
    render(<JarCover height={100} />);
    expect(screen.getByText("🫙")).toBeInTheDocument();
  });

  it("applies height style", () => {
    const { container } = render(<JarCover emoji="🎂" height={100} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe("100px");
  });
});
