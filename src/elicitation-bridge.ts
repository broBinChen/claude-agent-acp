/**
 * AskUserQuestion → ACP elicitation/create 桥接工具函数。
 *
 * 把 SDK builtin AskUserQuestion 的 input 转成 ACP elicitation form schema，
 * 以及把用户填写的 form content 转回 AskUserQuestion 的 answers。
 *
 * AskUserQuestion 的 schema 在 SDK 内部 zod 强制：
 *   - questions: 1-4 个
 *   - 每个 question: 1-4 个 options
 *   - options[i] 含 label / description / preview?
 *   - multiSelect?: boolean
 *
 * ACP elicitation form schema 是 JSON-Schema 风格：
 *   - 顶层 { type: "object", properties, required[], _meta? }
 *   - property: union of string / number / integer / boolean / array
 *   - 单选用 string + oneOf: [{const, title}]
 *   - 多选用 array + items.enum: string[]
 *   - 没有 per-option description / preview 字段，走 _meta 透传
 */

export interface AskUserQuestionInputOption {
  label: string;
  description: string;
  preview?: string;
}

export interface AskUserQuestionInputQuestion {
  question: string;
  header: string;
  options: AskUserQuestionInputOption[];
  multiSelect?: boolean;
}

export interface ElicitationSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  _meta?: Record<string, unknown>;
}

export function questionsToElicitationSchema(
  questions: AskUserQuestionInputQuestion[],
): ElicitationSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const headers: string[] = [];
  const optionDescs: string[][] = [];
  const previews: (string | null)[][] = [];

  questions.forEach((q, i) => {
    const propKey = `q${i}`;
    required.push(propKey);
    headers.push(q.header);
    optionDescs.push(q.options.map((o) => o.description));
    previews.push(q.options.map((o) => o.preview ?? null));

    if (q.multiSelect) {
      properties[propKey] = {
        type: "array",
        title: q.question,
        items: {
          type: "string",
          enum: q.options.map((o) => o.label),
        },
      };
    } else {
      properties[propKey] = {
        type: "string",
        title: q.question,
        oneOf: q.options.map((o) => ({ const: o.label, title: o.label })),
      };
    }
  });

  return {
    type: "object",
    properties,
    required,
    _meta: {
      "acpx/askUserQuestion": {
        headers,
        optionDescs,
        previews,
      },
    },
  };
}

export function contentToAnswers(
  content: Record<string, unknown> | undefined | null,
  questions: AskUserQuestionInputQuestion[],
): Record<string, string> {
  const answers: Record<string, string> = {};
  questions.forEach((q, i) => {
    const v = content?.[`q${i}`];
    if (Array.isArray(v)) {
      answers[q.question] = v.join(", ");
    } else if (v !== undefined && v !== null) {
      answers[q.question] = String(v);
    }
  });
  return answers;
}
