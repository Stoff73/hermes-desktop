import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryEntries } from "./MemoryEntries";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const api = {
  addMemoryEntry: vi.fn(),
  updateMemoryEntry: vi.fn(),
  removeMemoryEntry: vi.fn(),
};

const entries = [
  { index: 0, content: "a" },
  { index: 1, content: "b" },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.updateMemoryEntry.mockResolvedValue({ success: true });
  api.removeMemoryEntry.mockResolvedValue({ success: true });
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

// @lat: [[memory#Memory#Tests#Entry editor sends expectations]]
describe("MemoryEntries conflict handling", () => {
  it("sends the entry's original text as the expectation when saving an edit", async () => {
    render(
      <MemoryEntries entries={entries} profile="p" onRefresh={() => {}} />,
    );
    fireEvent.click(screen.getAllByText("memory.edit")[1]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "B" } });
    fireEvent.click(screen.getByText("memory.save"));
    await waitFor(() =>
      expect(api.updateMemoryEntry).toHaveBeenCalledWith(1, "B", "p", "b"),
    );
  });

  it("reloads, closes the editor and shows the message on a conflict", async () => {
    api.updateMemoryEntry.mockResolvedValue({
      success: false,
      conflict: true,
      error: "changed underneath",
    });
    const onRefresh = vi.fn();
    render(
      <MemoryEntries entries={entries} profile="p" onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getAllByText("memory.edit")[0]);
    fireEvent.click(screen.getByText("memory.save"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("changed underneath")).toBeTruthy();
  });

  it("sends the entry's text as the expectation when deleting, and reports failure", async () => {
    api.removeMemoryEntry.mockResolvedValue({ success: false, error: "nope" });
    const onRefresh = vi.fn();
    const { container } = render(
      <MemoryEntries entries={entries} profile="p" onRefresh={onRefresh} />,
    );
    // The trash button is icon-only: second .memory-entry-btn in the first card.
    const firstCard = container.querySelectorAll(".memory-entry-card")[0];
    fireEvent.click(firstCard.querySelectorAll(".memory-entry-btn")[1]);
    fireEvent.click(screen.getByText("memory.yes"));
    await waitFor(() =>
      expect(api.removeMemoryEntry).toHaveBeenCalledWith(0, "p", "a"),
    );
    expect(onRefresh).toHaveBeenCalled();
    expect(screen.getByText("nope")).toBeTruthy();
  });
});
