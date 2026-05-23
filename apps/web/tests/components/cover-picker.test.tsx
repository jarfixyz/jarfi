import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProcessedCover } from "@/lib/cover";

const mockDone = vi.fn();
vi.mock("@/components/ui/cover-cropper-modal", () => ({
  CoverCropperModal: (props: {
    open: boolean;
    file: File | null;
    onDone: (r: ProcessedCover) => void;
    onOpenChange: (o: boolean) => void;
  }) => {
    mockDone.mockImplementation(props.onDone);
    return props.open ? (
      <div data-testid="cropper-mock">
        <button
          onClick={() =>
            props.onDone({
              blob: new Blob(["x"], { type: "image/webp" }),
              contentType: "image/webp",
              hash16: "aaaaaaaaaaaaaaaa",
              extension: "webp",
            })
          }
        >
          mock done
        </button>
      </div>
    ) : null;
  },
}));

import { CoverPicker } from "@/components/ui/cover-picker";

describe("CoverPicker", () => {
  it("shows the empty placeholder when value is null and no initialUrl", () => {
    render(<CoverPicker value={null} onChange={() => {}} />);
    expect(screen.getByText(/Upload a cover/i)).toBeInTheDocument();
  });

  it("renders initialUrl when value is null but initialUrl is provided", () => {
    render(
      <CoverPicker
        value={null}
        initialUrl="/api/metadata/pda/cover/abcdef0123456789.webp"
        onChange={() => {}}
      />,
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/api/metadata/pda/cover/abcdef0123456789.webp");
  });

  it("opens the cropper when a file is chosen and calls onChange on done", async () => {
    const onChange = vi.fn();
    render(<CoverPicker value={null} onChange={onChange} />);
    const file = new File(["dummy"], "pic.png", { type: "image/png" });
    const input = screen.getByTestId("cover-file-input") as HTMLInputElement;
    await userEvent.upload(input, file);
    expect(screen.getByTestId("cropper-mock")).toBeInTheDocument();
    fireEvent.click(screen.getByText("mock done"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      hash16: "aaaaaaaaaaaaaaaa",
      extension: "webp",
    });
  });

  it("fires onChange(null) when Remove is clicked", async () => {
    const onChange = vi.fn();
    const value: ProcessedCover = {
      blob: new Blob(["x"], { type: "image/webp" }),
      contentType: "image/webp",
      hash16: "1111111111111111",
      extension: "webp",
    };
    render(<CoverPicker value={value} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Remove/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("rejects files that are not images", async () => {
    const onChange = vi.fn();
    render(<CoverPicker value={null} onChange={onChange} />);
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("cover-file-input") as HTMLInputElement;
    await userEvent.upload(input, file, { applyAccept: false });
    expect(screen.getByText(/Unsupported file type/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects files larger than 20 MB", async () => {
    const onChange = vi.fn();
    render(<CoverPicker value={null} onChange={onChange} />);
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 21 * 1024 * 1024 });
    const input = screen.getByTestId("cover-file-input") as HTMLInputElement;
    await userEvent.upload(input, big, { applyAccept: false });
    expect(screen.getByText(/File too large/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
