import { describe, it, expect } from "vitest";
import {
  questionsToElicitationSchema,
  type AskUserQuestionInputQuestion,
} from "../elicitation-bridge.js";

describe("questionsToElicitationSchema", () => {
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
    const schema = questionsToElicitationSchema([singleSelect]);
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["q0"]);
    const prop = schema.properties.q0 as Record<string, unknown>;
    expect(prop.type).toBe("string");
    expect(prop.title).toBe("Which auth method?");
    expect(prop.oneOf).toEqual([
      { const: "OAuth", title: "OAuth" },
      { const: "JWT", title: "JWT" },
    ]);
  });

  it("preserves header / option descriptions / previews in _meta", () => {
    const schema = questionsToElicitationSchema([singleSelect]);
    const meta = schema._meta?.["acpx/askUserQuestion"] as Record<string, unknown>;
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
    const schema = questionsToElicitationSchema([q]);
    const prop = schema.properties.q0 as Record<string, unknown>;
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
    const schema = questionsToElicitationSchema(qs);
    expect(schema.required).toEqual(["q0", "q1", "q2", "q3"]);
    expect(Object.keys(schema.properties)).toEqual(["q0", "q1", "q2", "q3"]);
  });
});
