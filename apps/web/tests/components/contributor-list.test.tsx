import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ContributorList } from "@/components/jar/contributor-list";

const mockContributors = Array.from({ length: 8 }, (_, i) => ({
  name: `User ${i + 1}`,
  wallet: `${i}abc...xyz${i}`,
  amount: (i + 1) * 0.5,
  asset: "SOL",
  timestamp: Date.now() - i * 86400000,
}));

describe("ContributorList", () => {
  it("shows first 5 contributors by default", () => {
    render(<ContributorList contributors={mockContributors} />);
    expect(screen.getByText("User 1")).toBeInTheDocument();
    expect(screen.getByText("User 5")).toBeInTheDocument();
    expect(screen.queryByText("User 6")).not.toBeInTheDocument();
  });

  it("shows all after clicking Show all", () => {
    render(<ContributorList contributors={mockContributors} />);
    fireEvent.click(screen.getByText(/Show all/));
    expect(screen.getByText("User 8")).toBeInTheDocument();
  });

  it("shows count in header", () => {
    render(<ContributorList contributors={mockContributors} />);
    expect(screen.getByText("Contributors (8)")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<ContributorList contributors={[]} />);
    expect(screen.getByText("Contributors (0)")).toBeInTheDocument();
  });
});
