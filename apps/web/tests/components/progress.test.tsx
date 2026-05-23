import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";

describe("ProgressBar", () => {
  it("renders with aria attributes", () => {
    render(<ProgressBar value={30} max={100} label="Funded" />);
    const bar = screen.getByRole("progressbar", { name: "Funded" });
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps value between 0 and max", () => {
    render(<ProgressBar value={200} max={100} label="Funded" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("ProgressRing", () => {
  it("shows percent text in the center", () => {
    render(<ProgressRing value={75} max={100} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("clamps negative values to zero", () => {
    render(<ProgressRing value={-10} max={100} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
