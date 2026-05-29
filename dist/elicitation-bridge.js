/**
 * AskUserQuestion → ACP elicitation/create 桥接工具函数。
 *
 * 把 SDK builtin AskUserQuestion 的 input 转成 ACP elicitation form payload，
 * 以及把用户填写的 form content 转回 AskUserQuestion 的 answers。
 *
 * AskUserQuestion 的 schema 在 SDK 内部 zod 强制：
 *   - questions: 1-4 个
 *   - 每个 question: 1-4 个 options
 *   - options[i] 含 label / description / preview?
 *   - multiSelect?: boolean
 *
 * ACP elicitation form schema 是 JSON-Schema 风格（zElicitationSchema）：
 *   - 顶层 { type: "object", properties, required }
 *   - property: union of string / number / integer / boolean / array
 *   - 单选用 string + oneOf: [{const, title}]
 *   - 多选用 array + items.enum: string[]
 *   - **没有 _meta 字段**（如果放进去会被 zod parser 静默剥离）
 *
 * 因此本模块把 _meta 拆到顶层 ElicitationFormRequestPayload，与 ACP
 * zCreateElicitationRequest 的 layout 对齐：_meta 与 mode/message/requestedSchema 同级。
 *
 * Lossy 字段（option description / preview HTML / question header）走 _meta
 * 透传，前端按需读取，不读也不会破坏标准 ACP client。
 */
export function questionsToElicitationFormPayload(questions) {
    const properties = {};
    const required = [];
    const headers = [];
    const optionDescs = [];
    const previews = [];
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
        }
        else {
            properties[propKey] = {
                type: "string",
                title: q.question,
                oneOf: q.options.map((o) => ({ const: o.label, title: o.label })),
            };
        }
    });
    return {
        requestedSchema: {
            type: "object",
            properties,
            required,
        },
        _meta: {
            "acpx/askUserQuestion": {
                headers,
                optionDescs,
                previews,
            },
        },
    };
}
export function contentToAnswers(content, questions) {
    const answers = {};
    questions.forEach((q, i) => {
        const v = content?.[`q${i}`];
        if (Array.isArray(v)) {
            answers[q.question] = v.join(", ");
        }
        else if (v !== undefined && v !== null) {
            answers[q.question] = String(v);
        }
    });
    return answers;
}
