import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "@/components/ui/status-badge";

describe("StatusBadge", () => {
  it("renders Active badge", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders Locked badge with lock emoji", () => {
    render(<StatusBadge status="locked" />);
    expect(screen.getByText(/Locked/)).toBeInTheDocument();
  });

  it("renders Completed badge with check", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });
});
