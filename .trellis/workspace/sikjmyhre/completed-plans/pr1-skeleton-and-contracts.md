# PR1: BioTreLlises 骨架与契约定义

## Context

基于 trellis PRD 和 info.md 技术设计，BioTreLlises 是一个基于 pi-mono Agent 框架的生物 AI Scientist Agent。PR1 是整个项目的基础设施——创建 TypeScript 包骨架、定义核心接口契约（BioToolRegistry、BioAgent）、提供 Mock 工具集以便后续 Track 可并行开发。

## Analysis

- **Affected files**:
  - `pi-mono/packages/biotrellises-core/package.json` — 新包配置
  - `pi-mono/packages/biotrellises-core/tsconfig.json` — TypeScript 配置
  - `pi-mono/packages/biotrellises-core/src/index.ts` — 公共 API 导出
  - `pi-mono/packages/biotrellises-core/src/registry.ts` — Tool Registry 核心
  - `pi-mono/packages/biotrellises-core/src/agent/bio-agent.ts` — Agent 基类
  - `pi-mono/packages/biotrellises-core/src/agent/system-prompt.ts` — 领域提示词
  - `pi-mono/packages/biotrellises-core/src/agent/model-strategy.ts` — 多模型路由
  - `pi-mono/packages/biotrellises-core/src/connectors/types.ts` — 连接器共享类型
  - `pi-mono/packages/biotrellises-core/src/cache/store.ts` — 缓存层骨架
  - `pi-mono/packages/biotrellises-core/src/tools/mock/` — Mock 工具集
  - `pi-mono/packages/biotrellises-core/test/` — 基础测试
- **New files**: 上述所有（全部新建）
- **Dependencies**: pi-agent-core, pi-ai, pi-tui, TypeBox
- **Complexity**: medium
- **Risk areas**:
  - pi-mono workspace 集成方式需要正确（放在 packages/ 下继承 workspace）
  - pi-agent-core 的 Agent 继承模式需要仔细对标现有 API
  - TypeBox 工具 schema 必须与 pi-agent-core 的 `AgentTool` 接口兼容

## Phases

### Phase 1: 项目骨架
- **Goal**: 创建 biotrellises-core 包目录结构和基础配置
- **Files**:
  - `pi-mono/packages/biotrellises-core/package.json`
  - `pi-mono/packages/biotrellises-core/tsconfig.json`
  - `pi-mono/packages/biotrellises-core/src/index.ts`
  - `pi-mono/packages/biotrellises-core/src/connectors/types.ts`
  - `pi-mono/packages/biotrellises-core/src/cache/store.ts`
- **Steps**:
  - [x] 创建目录结构（按 spec 的 directory-structure.md）
  - [x] 配置 package.json（引用 pi-mono workspace 包、TypeBox 等依赖）
  - [x] 配置 tsconfig.json（继承 pi-mono tsconfig.base.json）
  - [x] 创建连接器共享类型（BioConnector 接口、RateLimit、CacheStore）
  - [x] 创建缓存层骨架（SQLite/JSONL 抽象）
- **Done when**:
  - [x] `npm install` 在 pi-mono 根目录成功
  - [x] `tsc --noEmit` 无错误
  - [x] 目录结构符合 spec

### Phase 2: BioToolRegistry + Mock 工具集
- **Goal**: 实现工具注册中心和 Mock 工具，定义核心契约
- **Files**:
  - `pi-mono/packages/biotrellises-core/src/registry.ts`
  - `pi-mono/packages/biotrellises-core/src/tools/mock/gene-search.ts`
  - `pi-mono/packages/biotrellises-core/src/tools/mock/protein-info.ts`
  - `pi-mono/packages/biotrellises-core/src/tools/mock/pubmed-search.ts`
- **Steps**:
  - [x] 实现 BioToolRegistry 类（register / getAll / getByCategory / suggest）
  - [x] 创建 3 个 Mock 工具（gene_search, protein_info, pubmed_search）
  - [x] 每个工具使用 TypeBox schema，符合 pi-agent-core 的 AgentTool 接口
  - [x] 添加 registry 单元测试
- **Done when**:
  - [x] 所有 Mock 工具可通过 registry 注册和检索
  - [x] TypeBox schema 编译通过
  - [x] registry 测试通过

### Phase 3: BioAgent 基类 + 多模型策略
- **Goal**: 封装 pi-agent-core Agent，添加生物领域配置
- **Files**:
  - `pi-mono/packages/biotrellises-core/src/agent/bio-agent.ts`
  - `pi-mono/packages/biotrellises-core/src/agent/system-prompt.ts`
  - `pi-mono/packages/biotrellises-core/src/agent/model-strategy.ts`
- **Steps**:
  - [x] 编写生物领域 system prompt（问题分解、数据检索、分析方法的指导）
  - [x] 实现 ModelStrategy 类（Planner/Executor/Aggregator/Simple 四种角色路由）
  - [x] 实现 BioAgent 类（继承/封装 pi-agent-core Agent，预配置 bio system prompt + registry）
  - [x] 添加 Agent 初始化测试
- **Done when**:
  - [x] BioAgent 可实例化并加载 BioToolRegistry 中的工具
  - [x] ModelStrategy 可根据角色返回对应模型配置
  - [x] 测试通过

### Phase 4: 验证与收尾
- **Goal**: 确保整个包编译通过、测试通过、接口一致
- **Files**: 前述所有文件
- **Steps**:
  - [x] 运行 `npm run check`（lint + typecheck）
  - [x] 运行 `npm test`（如果 workspace 支持）
  - [x] 验证 index.ts 导出完整公共 API
  - [x] 对照 trellis info.md 技术设计，确认接口契约一致
- **Done when**:
  - [x] `npm run check` 零错误
  - [x] 所有测试通过
  - [x] index.ts 导出 BioToolRegistry、BioAgent、ModelStrategy、CacheStore、所有 Mock 工具

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| pi-mono workspace 集成复杂 | 高 | 放在 pi-mono/packages/ 下，复用现有 workspace 配置 |
| Agent 继承模式与 pi-agent-core 不兼容 | 中 | 先封装再继承，对标现有 API 仔细验证 |
| TypeBox schema 与 pi-ai Tool 接口不匹配 | 中 | 严格使用 pi-ai 导出的 Type 和 Static 类型 |
| 依赖循环（tools → connectors → cache） | 低 | 按 spec 规定单向依赖，registry 不依赖具体工具 |

## Rollback Strategy

如果 workspace 集成失败：
1. 将 biotrellises-core 移出 pi-mono，在 Bioagent 根目录作为独立包
2. 通过 `file:` 协议引用 pi-mono 包
3. 重新配置 tsconfig

## Completion Summary

**Status**: Completed
**Phases**: 4 / 4 completed

### Results
- 创建了 `@mariozechner/biotrellises-core` 包，位于 `pi-mono/packages/biotrellises-core/`
- 实现了 `BioToolRegistry`（register/getAll/getByCategory/suggest/getByName）
- 创建了 3 个 Mock 工具：gene_search、protein_info、pubmed_search
- 实现了 `BioAgent` 类（继承 pi-agent-core Agent，预配置 bio system prompt + registry）
- 实现了 `DefaultModelStrategy`（planner/executor/aggregator/simple 四种角色路由）
- 定义了缓存层抽象（CacheStore、CachePolicy）和连接器类型（BioConnector、RateLimit）
- 14 个单元测试全部通过（7 registry + 7 agent）

### Deviations
- 没有使用 `pi-tui` 作为依赖（PR1 不需要 TUI，将在 PR5 引入）
- `BioAgentTool` 接口扩展了 `AgentTool` 添加 `category` 字段，而非在 registry 中维护映射
- tsconfig 使用 `rootDir: "."` 而非 `"./src"`，以同时包含 src 和 test

### Verification
- [x] Build passes (`tsgo` 构建成功，dist 产物完整)
- [x] No diagnostic errors (biome lint clean)
- [x] Tests pass (14/14)
- [x] index.ts 导出完整公共 API

### Follow-up
- PR2: 实现 NCBI/UniProt/PubMed 真实数据连接器
- PR3: 将 Mock 工具替换为真实工具实现
- PR4: Bio Reasoning Engine（Planner + Executor + Aggregator）
- PR5: TUI 面板集成
