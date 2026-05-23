import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PillTabs } from "@/components/ui/pill-tabs";

describe("PillTabs", () => {
  const tabs = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "locked", label: "Locked" },
  ];

  it("renders all tabs", () => {
    render(<PillTabs tabs={tabs} active="all" onSelect={() => {}} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("marks active tab with aria-selected", () => {
    render(<PillTabs tabs={tabs} active="active" onSelect={() => {}} />);
    expect(screen.getByText("Active").closest("button")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("All").closest("button")).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect with key on click", () => {
    const onSelect = vi.fn();
    render(<PillTabs tabs={tabs} active="all" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Locked"));
    expect(onSelect).toHaveBeenCalledWith("locked");
  });

  it("renders prefix for done tabs", () => {
    const tabsWithDone = [
      { key: "s1", label: "Details", done: true },
      { key: "s2", label: "Rules" },
    ];
    render(<PillTabs tabs={tabsWithDone} active="s2" onSelect={() => {}} />);
    expect(screen.getByText("Details").closest("button")?.textContent).toContain("✓");
  });
});
