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
/**
 * ACP `zElicitationSchema` 的最小子集（form mode 用到的字段）。
 * **不**包含 `_meta`，因为 `_meta` 在 `zCreateElicitationRequest` 顶层。
 */
export interface ElicitationSchema {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
}
/**
 * 一个 form-mode elicitation 请求的"载荷部分"——
 * `requestedSchema` 以及与之配套的 `_meta`。
 *
 * 调用方应该这样使用：
 * ```ts
 * const payload = questionsToElicitationFormPayload(questions);
 * await client.unstable_createElicitation({
 *   sessionId,
 *   mode: "form",
 *   message: "...",
 *   ...payload,                 // → requestedSchema + _meta 都展开到 request 顶层
 * });
 * ```
 */
export interface ElicitationFormRequestPayload {
    requestedSchema: ElicitationSchema;
    _meta?: Record<string, unknown>;
}
export declare function questionsToElicitationFormPayload(questions: AskUserQuestionInputQuestion[]): ElicitationFormRequestPayload;
export declare function contentToAnswers(content: Record<string, unknown> | undefined | null, questions: AskUserQuestionInputQuestion[]): Record<string, string>;
//# sourceMappingURL=elicitation-bridge.d.ts.map