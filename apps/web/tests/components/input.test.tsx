import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders with a label", () => {
    render(<Input label="Jar name" name="title" />);
    expect(screen.getByLabelText("Jar name")).toBeInTheDocument();
  });

  it("types characters", async () => {
    render(<Input label="Title" name="title" />);
    const field = screen.getByLabelText("Title") as HTMLInputElement;
    await userEvent.type(field, "Rent jar");
    expect(field.value).toBe("Rent jar");
  });

  it("shows a hint when provided", () => {
    render(<Input label="Goal" name="goal" hint="In lamports" />);
    expect(screen.getByText("In lamports")).toBeInTheDocument();
  });

  it("renders an error message and marks invalid", () => {
    render(<Input label="Goal" name="goal" error="Required" />);
    const field = screen.getByLabelText("Goal");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});
