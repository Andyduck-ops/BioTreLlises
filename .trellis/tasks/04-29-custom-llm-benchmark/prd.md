# Custom LLM CLI + Benchmark + Cross-Validation

## Goal

让 BioTreLlises CLI 能够接入任意 OpenAI 兼容 API，同时建立 Planner 质量基准测试和 Aggregator 交叉验证能力。

## Decisions

**P1**: CLI 新增 `-u/--api-url`, `-k/--api-key`, `-m/--model-id`。`ModelStrategy.selectModel()` 在 registry 无匹配时 fallback 到 Agent 的 `state.model`。

**P2**: 新建 `scripts/benchmark-planner.mjs`，内嵌 10 个 ground truth 查询。

**P3**: Aggregator prompt 加入 cross-source consistency check，`AnalysisReport` 新增 `consistency` 字段。

## Acceptance Criteria

- [ ] `npx biotrellises -m deepseek-chat -u https://api.deepseek.com/v1 -k sk-xxx` 可正常启动
- [ ] 自定义 LLM 的 Planner/Executor/Aggregator 全链路可运行
- [ ] `node scripts/benchmark-planner.mjs` 输出 10 题准确率报告
- [ ] Aggregator 报告包含多源一致性检查结果
- [ ] 101 已有测试无回归
- [ ] `tsgo --noEmit` 零错误

## Technical Approach

### P1: 自定义 LLM CLI (关键文件: cli.ts, model-strategy.ts)

```
cli.ts: parseArgs 增加 -u/--api-url, -k/--api-key, -m/--model-id
       main() 中根据 args 构造自定义 Model 对象
       通过 initialState.model 传入 BioAgent

model-strategy.ts: selectModel() 在遍历 preferredModels 后
                  若无匹配，返回 availableModels[0]
                  若 availableModels 为空，return undefined
                  → BioAgent 此时使用 state.model
```

### P2: Benchmark (新文件: scripts/benchmark-planner.mjs)

```
10 个查询覆盖:
  - sequence, structure, disease, pathway, literature 各至少 1 题
  - 多类别组合题 3+ 题
  - 中文题 5 题

评估维度: category accuracy, count match, dependency correctness
```

### P3: 交叉验证 (关键文件: aggregator.ts)

```
buildAggregationPrompt: 加入 cross-source consistency 指令
AnalysisReport 新增 consistency: { conflicts: string[], agreements: string[] }
LLMAggregator parseReportJson 解析新增字段
SimpleAggregator 用基础正则提取一致性标记
```

## Out of Scope

- 非 OpenAI-compatible 协议 (anthropic/gemini 等已由 pi-ai 内置支持)
- TUI 内的 LLM 配置切换（仅 CLI flags）
- Benchmark 的 CI 自动化（手动运行）
- 中文查询的交叉验证（先做英文）
