/**
 * Composes the first chat turn after onboarding.
 *
 * The channel checks are run desktop-side (the same test the Gateway screen
 * uses) so their results are facts, not the model's guesswork; the introduction
 * itself is left to the agent. It is a normal, visible user message — nothing
 * about the transcript is hidden from the user.
 */

export interface ChannelTestResult {
  id: string;
  ok: boolean;
  message: string;
}

export function buildIntroPrompt({
  purpose,
  channels,
}: {
  agentName: string;
  purpose: string;
  channels: ChannelTestResult[];
}): string {
  const parts = [
    "I've just set you up. Introduce yourself briefly and tell me what you can help with.",
  ];

  const want = purpose.trim();
  if (want) parts.push(`What I want help with: ${want}.`);

  if (channels.length) {
    const summary = channels
      .map((channel) =>
        channel.ok
          ? `${channel.id}: connected`
          : `${channel.id}: not working (${channel.message})`,
      )
      .join(", ");
    parts.push(`Confirm my channels — ${summary}.`);
  }

  return parts.join(" ");
}
