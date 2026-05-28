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
});
