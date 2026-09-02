import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryProfile } from "./MemoryProfile";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const api = { writeUserProfile: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  api.writeUserProfile.mockResolvedValue({ success: true });
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

describe("MemoryProfile conflict handling", () => {
  it("sends the loaded content as the expectation", async () => {
    render(
      <MemoryProfile
        content="me"
        charLimit={1375}
        profile="p"
        onRefresh={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "me v2" },
    });
    fireEvent.click(screen.getByText("memory.saveProfile"));
    await waitFor(() =>
      expect(api.writeUserProfile).toHaveBeenCalledWith("me v2", "p", "me"),
    );
  });

  it("keeps the draft, reloads, and shows the message on a conflict", async () => {
    api.writeUserProfile.mockResolvedValue({
      success: false,
      conflict: true,
      error: "agent wrote first",
    });
    const onRefresh = vi.fn();
    render(
      <MemoryProfile
        content="me"
        charLimit={1375}
        profile="p"
        onRefresh={onRefresh}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "me v2" },
    });
    fireEvent.click(screen.getByText("memory.saveProfile"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "me v2",
    );
    expect(screen.getByText("agent wrote first")).toBeTruthy();
  });

  it("resyncs the textarea when fresh content arrives and nothing is being edited", () => {
    const { rerender } = render(
      <MemoryProfile
        content="me"
        charLimit={1375}
        profile="p"
        onRefresh={() => {}}
      />,
    );
    rerender(
      <MemoryProfile
        content="fresh"
        charLimit={1375}
        profile="p"
        onRefresh={() => {}}
      />,
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "fresh",
    );
  });
});
