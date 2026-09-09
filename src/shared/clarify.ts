/**
 * Multi-question clarify support. The gateway's clarify tool can ask several
 * questions in one `clarify.request` (payload `questions: [{qid, question,
 * choices, multi_select}]`) and expects an answer per `qid` — a plain-text
 * reply to the batch is treated as cancel-all on the tool side. These helpers
 * are shared by the renderer's dashboard transport and the main-process
 * gateway client so both render the same prompt text.
 */
export interface ClarifyQuestion {
  qid: string;
  question: string;
  choices: string[];
  multiSelect: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** The batch questions carried by a `clarify.request` payload, or `[]`. */
export function parseClarifyQuestions(payload: unknown): ClarifyQuestion[] {
  if (!isRecord(payload) || !Array.isArray(payload.questions)) return [];
  return payload.questions.flatMap((entry, index): ClarifyQuestion[] => {
    if (!isRecord(entry)) return [];
    const question = String(entry.question ?? "").trim();
    if (!question) return [];
    return [
      {
        qid: String(entry.qid ?? `q${index}`),
        question,
        choices: Array.isArray(entry.choices)
          ? entry.choices.map((c) => String(c)).filter((c) => c.trim())
          : [],
        multiSelect: entry.multi_select === true,
      },
    ];
  });
}

/** Prompt text for one question of a batch, with its choices numbered. */
export function formatClarifyQuestion(
  q: ClarifyQuestion,
  index: number,
  total: number,
): string {
  const header = total > 1 ? `**Question ${index + 1} of ${total}**\n\n` : "";
  const choices = q.choices.length
    ? `\n\n${q.choices.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
    : "";
  return `${header}${q.question}${choices}`;
}
