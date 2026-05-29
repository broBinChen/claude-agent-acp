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
export {};
//# sourceMappingURL=acp-agent.askuserquestion.test.d.ts.map