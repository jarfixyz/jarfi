import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { InlineCalendar } from "@/components/ui/inline-calendar";

describe("InlineCalendar", () => {
  it("renders current month and year", () => {
    render(<InlineCalendar value={null} onChange={() => {}} />);
    const now = new Date();
    const monthName = now.toLocaleString("en", { month: "long" });
    expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument();
  });

  it("renders weekday headers", () => {
    render(<InlineCalendar value={null} onChange={() => {}} />);
    expect(screen.getByText("Mo")).toBeInTheDocument();
    expect(screen.getByText("Su")).toBeInTheDocument();
  });

  it("navigates to next month", () => {
    render(<InlineCalendar value={null} onChange={() => {}} />);
    const nextBtn = screen.getByLabelText("Next month");
    fireEvent.click(nextBtn);
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const monthName = next.toLocaleString("en", { month: "long" });
    expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument();
  });

  it("calls onChange when a future date is clicked", () => {
    const onChange = vi.fn();
    render(<InlineCalendar value={null} onChange={onChange} />);
    // Navigate to next month to ensure future dates exist
    fireEvent.click(screen.getByLabelText("Next month"));
    // Click on day 15
    fireEvent.click(screen.getByText("15"));
    expect(onChange).toHaveBeenCalled();
    const selected = onChange.mock.calls[0][0] as Date;
    expect(selected.getDate()).toBe(15);
  });

  it("disables past dates", () => {
    render(<InlineCalendar value={null} onChange={() => {}} />);
    const today = new Date();
    if (today.getDate() > 1) {
      const dayButton = screen.getByText("1").closest("button");
      expect(dayButton).toBeDisabled();
    }
  });

  it("highlights selected date", () => {
    const selected = new Date(2030, 5, 15);
    render(<InlineCalendar value={selected} onChange={() => {}} />);
    // The component should auto-navigate to the month of the selected value
    expect(screen.getByText("15").closest("button")).toHaveAttribute("aria-selected", "true");
  });
});
