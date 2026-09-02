import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Memory from "./Memory";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

vi.mock("../../components/common/ProfileAvatar", () => ({
  default: ({ name }: { name: string }) => (
    <span data-testid={`avatar-${name}`} />
  ),
}));

const agents = [
  {
    id: "default",
    name: "Hermes One",
    isActive: true,
    memoryChars: 512,
    memoryLimit: 2200,
    memoryEntries: 2,
    userChars: 1363,
    userLimit: 1375,
    totalSessions: 22,
    lastSessionAt: Math.floor(Date.now() / 1000) - 7200,
    provider: null,
    vaultLinked: true,
    available: true,
  },
  {
    id: "myrtle",
    name: "Myrtle",
    isActive: false,
    memoryChars: 0,
    memoryLimit: 0,
    memoryEntries: 0,
    userChars: 0,
    userLimit: 0,
    totalSessions: 0,
    lastSessionAt: null,
    provider: null,
    vaultLinked: false,
    available: false,
  },
];

beforeEach(() => {
  (window as unknown as { hermesAPI: unknown }).hermesAPI = {
    readAllAgentsMemory: vi.fn().mockResolvedValue(agents),
  };
});

// @lat: [[memory#Memory#Tests#Overview rows]]
describe("Memory overview", () => {
  it("lists every agent with its memory facts", async () => {
    render(<Memory />);
    await waitFor(() => expect(screen.getByText("Hermes One")).toBeTruthy());
    expect(screen.getByText("Myrtle")).toBeTruthy();
    const row = screen.getByTestId("memory-agent-default");
    expect(row.textContent).toContain("memory.sessionsCount:22");
    expect(row.textContent).toContain("memory.lastActive:");
    expect(row.textContent).toContain("memory.providerBuiltIn");
    expect(row.textContent).toContain("memory.vaultLinked");
    expect(row.textContent).toContain("memory.activeAgent");
  });

  it("marks an unreadable agent without blanking the list", async () => {
    render(<Memory />);
    await waitFor(() =>
      expect(screen.getByText("memory.agentUnavailable")).toBeTruthy(),
    );
    expect(screen.getByText("Hermes One")).toBeTruthy();
    // No bar for an agent whose limits are unknown — and no NaN%.
    expect(
      screen
        .getByTestId("memory-agent-myrtle")
        .querySelector(".memory-capacity"),
    ).toBeNull();
  });

  it("opens the selected agent", async () => {
    const onOpenAgent = vi.fn();
    render(<Memory onOpenAgent={onOpenAgent} />);
    await waitFor(() => screen.getByText("Myrtle"));
    fireEvent.click(screen.getByTestId("memory-agent-myrtle"));
    expect(onOpenAgent).toHaveBeenCalledWith("myrtle");
  });

  it("has no editing affordance", async () => {
    render(<Memory />);
    await waitFor(() => screen.getByText("Myrtle"));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("memory.addMemory")).toBeNull();
  });
});
