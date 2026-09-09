import { describe, expect, it } from "vitest";
import { formatClarifyQuestion, parseClarifyQuestions } from "./clarify";

// @lat: [[chat-commands#Multi-question clarify]]
describe("parseClarifyQuestions", () => {
  it("reads the gateway's batch wire shape", () => {
    const qs = parseClarifyQuestions({
      request_id: "r1",
      questions: [
        { qid: "q0", question: "Which source?", choices: ["Gmail", "Apple"] },
        { qid: "q1", question: "Auto-apply?", choices: [], multi_select: true },
      ],
    });
    expect(qs).toEqual([
      {
        qid: "q0",
        question: "Which source?",
        choices: ["Gmail", "Apple"],
        multiSelect: false,
      },
      { qid: "q1", question: "Auto-apply?", choices: [], multiSelect: true },
    ]);
  });

  it("returns nothing for a single-question payload", () => {
    expect(
      parseClarifyQuestions({ request_id: "r1", question: "Which?" }),
    ).toEqual([]);
  });
});

describe("formatClarifyQuestion", () => {
  it("numbers the question within the batch and lists choices", () => {
    const text = formatClarifyQuestion(
      {
        qid: "q0",
        question: "Which source?",
        choices: ["Gmail", "Apple"],
        multiSelect: false,
      },
      0,
      3,
    );
    expect(text).toBe(
      "**Question 1 of 3**\n\nWhich source?\n\n1. Gmail\n2. Apple",
    );
  });
});
