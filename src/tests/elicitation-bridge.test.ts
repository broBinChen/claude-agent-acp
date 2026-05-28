import { describe, it, expect } from "vitest";
import {
  questionsToElicitationFormPayload,
  contentToAnswers,
  type AskUserQuestionInputQuestion,
} from "../elicitation-bridge.js";

describe("questionsToElicitationFormPayload", () => {
  const singleSelect: AskUserQuestionInputQuestion = {
    question: "Which auth method?",
    header: "Auth",
    options: [
      { label: "OAuth", description: "Use OAuth flow" },
      { label: "JWT", description: "Use JWT tokens", preview: "<pre>jwt example</pre>" },
    ],
    multiSelect: false,
  };

  it("single-select question becomes string property with oneOf", () => {
    const payload = questionsToElicitationFormPayload([singleSelect]);
    expect(payload.requestedSchema.type).toBe("object");
    expect(payload.requestedSchema.required).toEqual(["q0"]);
    const prop = payload.requestedSchema.properties.q0 as Record<string, unknown>;
    expect(prop.type).toBe("string");
    expect(prop.title).toBe("Which auth method?");
    expect(prop.oneOf).toEqual([
      { const: "OAuth", title: "OAuth" },
      { const: "JWT", title: "JWT" },
    ]);
  });

  it("preserves header / option descriptions / previews in _meta", () => {
    const payload = questionsToElicitationFormPayload([singleSelect]);
    const meta = payload._meta?.["acpx/askUserQuestion"] as Record<string, unknown>;
    expect(meta).toBeDefined();
    expect(meta.headers).toEqual(["Auth"]);
    expect(meta.optionDescs).toEqual([["Use OAuth flow", "Use JWT tokens"]]);
    expect(meta.previews).toEqual([[null, "<pre>jwt example</pre>"]]);
  });

  it("multiSelect=true becomes array property with items.enum", () => {
    const q: AskUserQuestionInputQuestion = {
      question: "Which countries?",
      header: "Countries",
      options: [
        { label: "US", description: "United States" },
        { label: "DE", description: "Germany" },
      ],
      multiSelect: true,
    };
    const payload = questionsToElicitationFormPayload([q]);
    const prop = payload.requestedSchema.properties.q0 as Record<string, unknown>;
    expect(prop.type).toBe("array");
    expect(prop.title).toBe("Which countries?");
    const items = prop.items as Record<string, unknown>;
    expect(items.type).toBe("string");
    expect(items.enum).toEqual(["US", "DE"]);
  });

  it("4 questions all map correctly", () => {
    const qs: AskUserQuestionInputQuestion[] = [
      { question: "Q1", header: "H1", options: [{ label: "A", description: "" }, { label: "B", description: "" }] },
      { question: "Q2", header: "H2", options: [{ label: "C", description: "" }, { label: "D", description: "" }] },
      { question: "Q3", header: "H3", options: [{ label: "E", description: "" }, { label: "F", description: "" }] },
      { question: "Q4", header: "H4", options: [{ label: "G", description: "" }, { label: "H", description: "" }] },
    ];
    const payload = questionsToElicitationFormPayload(qs);
    expect(payload.requestedSchema.required).toEqual(["q0", "q1", "q2", "q3"]);
    expect(Object.keys(payload.requestedSchema.properties)).toEqual(["q0", "q1", "q2", "q3"]);
  });
});

describe("contentToAnswers", () => {
  const singleQ: AskUserQuestionInputQuestion = {
    question: "Lib?",
    header: "Lib",
    options: [{ label: "A", description: "" }, { label: "B", description: "" }],
  };

  it("single-select string content → answer string", () => {
    const out = contentToAnswers({ q0: "A" }, [singleQ]);
    expect(out).toEqual({ "Lib?": "A" });
  });

  it("multi-select array content → comma-joined answer", () => {
    const multiQ: AskUserQuestionInputQuestion = {
      question: "Countries?",
      header: "C",
      options: [{ label: "US", description: "" }, { label: "DE", description: "" }],
      multiSelect: true,
    };
    const out = contentToAnswers({ q0: ["US", "DE"] }, [multiQ]);
    expect(out).toEqual({ "Countries?": "US, DE" });
  });

  it("missing content key → no answer (skipped, not undefined)", () => {
    const out = contentToAnswers({}, [singleQ]);
    expect(out).toEqual({});
  });

  it("null content gracefully → empty answers", () => {
    const out = contentToAnswers(null, [singleQ]);
    expect(out).toEqual({});
  });

  it("number content stringified", () => {
    const out = contentToAnswers({ q0: 42 }, [singleQ]);
    expect(out).toEqual({ "Lib?": "42" });
  });
});
