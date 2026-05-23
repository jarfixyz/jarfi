import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RadioCard } from "@/components/ui/radio-card";

describe("RadioCard", () => {
  it("renders title and description", () => {
    render(
      <RadioCard
        title="Flexible"
        description="Withdraw anytime"
        selected={false}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("Flexible")).toBeInTheDocument();
    expect(screen.getByText("Withdraw anytime")).toBeInTheDocument();
  });

  it("shows filled dot when selected", () => {
    const { container } = render(
      <RadioCard title="Flexible" selected={true} onSelect={() => {}} />
    );
    expect(container.querySelector("[data-selected='true']")).toBeInTheDocument();
  });

  it("calls onSelect on click", () => {
    const onSelect = vi.fn();
    render(<RadioCard title="Flexible" selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Flexible").closest("button")!);
    expect(onSelect).toHaveBeenCalled();
  });

  it("renders icon when provided", () => {
    render(
      <RadioCard
        title="SOL"
        selected={false}
        onSelect={() => {}}
        icon={<span data-testid="sol-icon">◎</span>}
      />
    );
    expect(screen.getByTestId("sol-icon")).toBeInTheDocument();
  });
});
