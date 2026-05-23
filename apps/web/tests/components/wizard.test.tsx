import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateWizard } from "@/components/create/wizard";

vi.mock("@/components/create/use-create-jar", () => ({
  useCreateJar: () => ({ submit: vi.fn(), status: "idle", error: null }),
}));

vi.mock("@/components/create/cover-grid", () => ({
  CoverGrid: () => null,
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: {
      ...actual.motion,
      div: ({ children, ...props }: any) => {
        const { initial, animate, exit, transition, layout, ...rest } = props;
        return <div {...rest}>{children}</div>;
      },
    },
  };
});

vi.mock("@/lib/price", () => ({
  useAssetUsd: () => null,
}));

describe("CreateWizard", () => {
  it("starts on step 1 with the title field", () => {
    render(<CreateWizard />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it("blocks Next on step 1 until a title is typed", async () => {
    const user = userEvent.setup();
    render(<CreateWizard />);
    const next = screen.getByRole("button", { name: /next/i });
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText(/title/i), "Rent jar");
    expect(next).toBeEnabled();
  });

  it("advances to step 2 when Next is clicked with a valid title", async () => {
    const user = userEvent.setup();
    render(<CreateWizard />);
    await user.type(screen.getByLabelText(/title/i), "Rent jar");
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/how should it work/i)).toBeInTheDocument();
    });
  });
});
