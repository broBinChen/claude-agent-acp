/**
 * TDD 红灯测试 — canUseTool AskUserQuestion 特判分支
 *
 * Task 1.6: 写失败测试，覆盖 4 种状态（accept / decline / cancel / aborted）。
 * Task 1.7 负责实现该分支；在此之前这 4 个测试应该失败。
 *
 * 注意：AskUserQuestion 分支调用 client.unstable_createElicitation(...)，
 * 而非 client.requestPermission(...)。当前实现没有这个特判，所以会走到
 * requestPermission 分支，导致前 4 个测试 fail。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentSideConnection } from "@agentclientprotocol/sdk";
import { ClaudeAcpAgent } from "../acp-agent.js";

// -----------------------------------------------------------------------
// Mock helpers
// -----------------------------------------------------------------------

/**
 * 构造一个最小可用的 AgentSideConnection mock。
 * 与 session-load.test.ts / acp-agent-settings.test.ts 保持一致的风格。
 */
function createMockClient() {
  return {
    sessionUpdate: vi.fn().mockResolvedValue(undefined),
    requestPermission: vi.fn().mockResolvedValue({
      outcome: { outcome: "cancelled" },
    }),
    readTextFile: vi.fn().mockResolvedValue({ content: "" }),
    writeTextFile: vi.fn().mockResolvedValue({}),
    unstable_createElicitation: vi.fn(),
  } as unknown as AgentSideConnection & {
    unstable_createElicitation: ReturnType<typeof vi.fn>;
    requestPermission: ReturnType<typeof vi.fn>;
    sessionUpdate: ReturnType<typeof vi.fn>;
  };
}

/**
 * 构造 ClaudeAcpAgent 并注入最小 session，使 canUseTool 不在
 * "Session not found" 处短路，也不触发 bypassPermissions 快速通道。
 */
function makeAgent(client: ReturnType<typeof createMockClient>) {
  const agent = new ClaudeAcpAgent(client as unknown as AgentSideConnection);

  // 注入最小 session：mode 必须是非 bypassPermissions 的值，
  // 这样 canUseTool 才会真正执行到 AskUserQuestion 判断或 requestPermission。
  (agent as any).sessions = {
    "sess-1": {
      modes: { currentModeId: "default", availableModes: [] },
      models: { currentModelId: "claude-sonnet-4-5", availableModels: [] },
      cwd: "/tmp",
      configOptions: [],
    },
  };
  (agent as any).clientCapabilities = {
    elicitation: { form: {} },
  };

  return agent;
}

// -----------------------------------------------------------------------
// Fixture
// -----------------------------------------------------------------------

const sampleInput = {
  questions: [
    {
      question: "Which lib?",
      header: "Library Selection",
      options: [
        { label: "A", description: "Option A" },
        { label: "B", description: "Option B" },
      ],
    },
  ],
};

const baseOpts = () => ({
  signal: new AbortController().signal,
  suggestions: undefined as any,
  toolUseID: "tu-1",
});

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe("canUseTool: AskUserQuestion bridge", () => {
  let client: ReturnType<typeof createMockClient>;
  let agent: ClaudeAcpAgent;

  beforeEach(() => {
    client = createMockClient();
    agent = makeAgent(client);
  });

  // -------------------------------------------------------------------
  // Test 1: accept → allow + answers
  // -------------------------------------------------------------------
  it("accept → returns allow with answers in updatedInput", async () => {
    // Task 1.7 将调用 unstable_createElicitation，返回 accept + content
    client.unstable_createElicitation.mockResolvedValueOnce({
      action: "accept",
      content: { q0: "A" },
    });

    const result = await agent.canUseTool("sess-1")(
      "AskUserQuestion",
      sampleInput,
      baseOpts() as any,
    );

    // 应该调用 unstable_createElicitation，不调用 requestPermission
    expect(client.unstable_createElicitation).toHaveBeenCalledOnce();
    expect(client.requestPermission).not.toHaveBeenCalled();

    const callArg = client.unstable_createElicitation.mock.calls[0][0];
    // 请求中必须有 sessionId
    expect(callArg.sessionId).toBe("sess-1");
    // mode 应该是 "form"
    expect(callArg.mode).toBe("form");
    // requestedSchema 由 questionsToElicitationFormPayload 生成
    expect(callArg.requestedSchema).toBeDefined();
    // _meta 必须提升到顶层（与 requestedSchema 同级）
    expect(callArg._meta?.["acpx/askUserQuestion"]).toBeDefined();

    // 结果：allow + updatedInput 带有 answers + questions
    expect(result.behavior).toBe("allow");
    expect((result as any).updatedInput).toBeDefined();
    expect((result as any).updatedInput.answers).toEqual({ "Which lib?": "A" });
    expect((result as any).updatedInput.questions).toEqual(sampleInput.questions);
  });

  // -------------------------------------------------------------------
  // Test 2: decline → deny with descriptive message
  // -------------------------------------------------------------------
  it("decline → returns deny with descriptive message", async () => {
    client.unstable_createElicitation.mockResolvedValueOnce({ action: "decline" });

    const result = await agent.canUseTool("sess-1")(
      "AskUserQuestion",
      sampleInput,
      baseOpts() as any,
    );

    expect(client.unstable_createElicitation).toHaveBeenCalledOnce();
    expect(client.requestPermission).not.toHaveBeenCalled();

    expect(result.behavior).toBe("deny");
    expect((result as any).message).toMatch(/declined/i);
  });

  // -------------------------------------------------------------------
  // Test 3: cancel → deny with cancel message
  // -------------------------------------------------------------------
  it("cancel → returns deny with cancel message", async () => {
    client.unstable_createElicitation.mockResolvedValueOnce({ action: "cancel" });

    const result = await agent.canUseTool("sess-1")(
      "AskUserQuestion",
      sampleInput,
      baseOpts() as any,
    );

    expect(client.unstable_createElicitation).toHaveBeenCalledOnce();
    expect(client.requestPermission).not.toHaveBeenCalled();

    expect(result.behavior).toBe("deny");
    expect((result as any).message).toMatch(/cancel/i);
  });

  // -------------------------------------------------------------------
  // Test 4: signal aborted during elicitation → throws "Tool use aborted"
  // -------------------------------------------------------------------
  it("aborted signal during elicitation throws 'Tool use aborted'", async () => {
    const ctrl = new AbortController();

    client.unstable_createElicitation.mockImplementationOnce(async () => {
      // 模拟 elicitation 挂起期间 signal 被 abort
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      ctrl.abort();
      // 返回 accept 但 signal 已经 aborted，实现应该检测并抛出
      return { action: "accept", content: { q0: "A" } };
    });

    await expect(
      agent.canUseTool("sess-1")("AskUserQuestion", sampleInput, {
        ...baseOpts(),
        signal: ctrl.signal,
      } as any),
    ).rejects.toThrow(/aborted/i);
  });

  // -------------------------------------------------------------------
  // Test 5 (green): non-AskUserQuestion tools 走 requestPermission 流程
  //
  // 这个测试验证现有逻辑不受影响 — 预期通过（因为不依赖未实现的分支）。
  // -------------------------------------------------------------------
  it("non-AskUserQuestion tools fall through to existing requestPermission flow", async () => {
    client.requestPermission.mockResolvedValueOnce({
      outcome: { outcome: "selected", optionId: "allow" },
    });

    const result = await agent.canUseTool("sess-1")(
      "Bash",
      { command: "ls" },
      baseOpts() as any,
    );

    expect(client.unstable_createElicitation).not.toHaveBeenCalled();
    expect(client.requestPermission).toHaveBeenCalledOnce();
    expect(result.behavior).toBe("allow");
  });

  // -------------------------------------------------------------------
  // Test 6: client without elicitation.form capability → deny gracefully
  // -------------------------------------------------------------------
  it("client without elicitation.form capability → deny gracefully", async () => {
    // Override the default clientCapabilities set in makeAgent — simulate
    // a client that has not declared elicitation.form support.
    (agent as any).clientCapabilities = {};

    const result = await agent.canUseTool("sess-1")("AskUserQuestion", sampleInput, baseOpts() as any);

    expect(client.unstable_createElicitation).not.toHaveBeenCalled();
    expect(result.behavior).toBe("deny");
    expect((result as any).message).toMatch(/elicitation\.form|plain text/i);
  });

  // -------------------------------------------------------------------
  // Test 7: malformed toolInput (no questions field) → deny gracefully
  // -------------------------------------------------------------------
  it("malformed toolInput (no questions array) → deny gracefully", async () => {
    const result = await agent.canUseTool("sess-1")(
      "AskUserQuestion",
      { foo: "bar" } as any,
      baseOpts() as any,
    );

    expect(client.unstable_createElicitation).not.toHaveBeenCalled();
    expect(result.behavior).toBe("deny");
    expect((result as any).message).toMatch(/questions array|malformed|invalid/i);
  });

  // -------------------------------------------------------------------
  // Test 8: malformed toolInput (questions not array) → deny gracefully
  // -------------------------------------------------------------------
  it("malformed toolInput (questions not array) → deny gracefully", async () => {
    const result = await agent.canUseTool("sess-1")(
      "AskUserQuestion",
      { questions: "not an array" } as any,
      baseOpts() as any,
    );

    expect(client.unstable_createElicitation).not.toHaveBeenCalled();
    expect(result.behavior).toBe("deny");
  });
});
