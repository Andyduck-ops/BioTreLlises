# BioTreLlises: Bio AI Scientist Agent Platform

## Goal

基于 pi-mono Agent 框架，构建开源 **Bio AI Scientist Agent**——自然语言描述科学问题，Agent 自主编排跨数据库、跨工具的多步分析流程，交付结构化报告。

核心价值：**把「3天数据分析马拉松」变成「5分钟对话」**。

## What We Know

### 技术资产（pi-mono）
- **pi-ai**: 20+ LLM 提供商统一 API，tool calling、streaming、reasoning、image input
- **pi-agent-core**: Agent 运行时 —— 自动工具执行循环、事件流、steering/follow-up、并行工具执行、TypeBox 工具验证、会话 JSONL 持久化
- **pi-coding-agent**: CLI 框架 —— TypeScript 扩展系统、Skills、Pi Packages
- **pi-tui**: 终端差异渲染 UI 库

### 竞争定位
- 2025-2026 Bio AI Agent 空间加速（OpenScientist、BioAgents 81★、SAGA、BloClaw）
- **全部为早期 Python 科研原型，无生产级 Agent 框架**
- **Pi-mono 的事件流 + 工具系统 + 扩展生态是真实工程差异化**

### 生态定位
- 生物数据连接器成熟（BioPython、NCBI API、UniProt REST、KEGG 等）
- K-Dense Skills 已有 134 个科学数据库 Skill 标准化
- **缺失的是推理编排层**：将分散工具串成自主研究循环

## Three Core Principles

1. **不造生物数据轮子** —— 复用现有 API/SDK。Agent 是编排者，不是数据提供者
2. **造推理编排层** —— 科学问题 → 假设分解 → 数据检索 → 分析方法选择 → 结果解释 → 迭代
3. **利用 pi-mono 工程优势** —— 多模型策略、TUI、扩展生态、会话持久化

## Requirements

### MVP Backlog（可并行）

**Track A — 基础设施 & Agent 骨架**
- 初始化 TypeScript 项目，本地引用 pi-mono packages
- Bio Tool Registry 框架（TypeBox schema + 注册 + 自动 LLM 工具描述生成）
- Agent 运行时封装（继承 pi-agent-core 的 Agent 类，配置 bio system prompt + tool registry）
- TUI 骨架（pi-tui 集成，至少：消息面板 + 工具调用日志面板）

**Track B — 核心数据连接器 & 工具**

每个数据源走同一模式：REST client → 缓存层 → AgentTool 注册

- NCBI E-utilities：基因/序列检索 + 下载
- UniProt REST：蛋白质查询 + 功能注释
- PubMed E-utilities：文献检索 + 摘要提取

> 更多 REST 源（KEGG、PDB、ClinVar/OMIM）在 Track B 完成后追加。

**Track C — Bio Reasoning Engine & 报告生成**
- 问题分解策略：用户提问 → LLM 拆解子问题 → 匹配工具 → 执行 → 子结果聚合
- 结果解释与交叉验证：多来源数据对比、标记冲突/一致
- 结构化报告生成（Markdown，含结论+证据+数据表格+可视化链接）
- Python 桥接工具：BLAST 序列比对、PROSITE motif 扫描
  → BLAST 归 Track C（需 BioPython 运行 BLAST+ 本地比对），非 Track B 纯 REST 模式

**Track D — 端到端集成 & 文档**
- 3 个端到端场景覆盖
- README + 架构文档
- 外部依赖引导脚本（检测 Python/BioPython，提示 API key 注册）

### 后续 Phase
- 合成生物学工具（gRNA 设计、质粒构建、密码子优化）
- **Web UI（pi-web-ui）** — 设计规范见 `DESIGN.md`（Anthropic Claude 风格设计系统：暖色调 parchment 底色、Serif/Sans/Mono 字体层级、ring shadow 深度系统、响应式断点 479–992px）
- Pi Package 发布（社区可贡献工具扩展）
- 自主假设-验证循环
- 跨物种推理引擎

## Reasoning Engine Design（核心壁垒）

这是整个项目最关键的部分，不是简单的 prompt chain。

### 问题分解

```
用户: "水稻干旱胁迫上调基因的通路和药物靶点"
         ↓
  Planner LLM（reasoning model）
  拆解：
  1. 检索"水稻 干旱胁迫 转录组" 相关数据集/基因列表
  2. 对基因集做通路富集分析（KEGG + GO）
  3. 对关键基因查 DrugBank / ClinVar 找已知药物靶点
  4. 交叉验证：文献中是否有类似报道
  5. 汇总形成结论
```

### 执行策略

每个子问题 → `agentLoop` 调用（带该子问题特定的工具子集），结果汇入共享 context：
- 子问题之间可并行（独立数据查询）→ 并行 agentLoop
- 子问题之间有依赖（需要先拿到基因列表才能做富集）→ 串行

### 结果聚合

子问题结果集 → Aggregator LLM（长上下文模型）→ 结构化报告：
- 结论（1-2 段）
- 证据摘要（每项关键发现 + 来源）
- 数据表格
- 不确定性标注（数据来源可靠度、分析局限性）

### 关键约束

- 每个子问题执行前验证前置条件（必要数据是否到位）
- 外部 API 调用失败不阻塞整体流程（标记错误继续）
- 所有中间结果写入会话（可追溯、可 /tree 回看）

## Acceptance Criteria

**Phase 1 MVP**:
- [ ] 输入: "查找水稻干旱胁迫上调基因的相关通路和药物靶点" → 自动完成多源查询+通路分析+靶点标注 → 结构化报告
- [ ] 输入: "分析 TP53 的蛋白质结构域和翻译后修饰位点" → UniProt+PDB 查询 → 结构域/PTM 报告
- [ ] 输入: "检索近期 CRISPR 敲除筛选的文献综述" → PubMed 检索+摘要聚合 → 综述摘要
- [ ] TUI 实时展示工具调用链路（哪个工具在执行、结果摘要在侧）
- [ ] 分析过程可在会话 JSONL 中完整回放（/tree 导航任意步骤）

**后续 Phase**:
- [ ] gRNA 设计全流程（候选→脱靶→功能影响）
- [ ] 跨物种同源基因分析
- [ ] 多组学数据联合解读

## Definition of Done

- TypeScript 类型完整，lint/typecheck 通过
- Track B 覆盖至少 3 个公共数据库（NCBI/UniProt/PubMed）
- 至少 3 个端到端场景完整跑通
- README 含快速开始、架构说明、Demo GIF
- 可作为独立 npm 包发布

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              BioTreLlises Agent                       │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Bio Reasoning Engine                          │  │
│  │  问题分解(Planner LLM)                          │  │
│  │  → 子问题1(ToolSet1) 子问题2(ToolSet2) ...      │  │
│  │  → 结果聚合(Aggregator LLM) → 结构化报告         │  │
│  └──────────────┬─────────────────────────────────┘  │
│                 │                                     │
│  ┌──────────────▼─────────────────────────────────┐  │
│  │  Bio Tool Registry (TypeBox schemas)           │  │
│  │  gene_search │ protein_info │ pubmed_search    │  │
│  │  pathway_enrich │ blast │ disease_link         │  │
│  └──────────────┬─────────────────────────────────┘  │
│                 │                                     │
│  ┌──────────────▼─────────────────────────────────┐  │
│  │  Data Connectors (TypeScript native HTTP)      │  │
│  │  NCBI E-utils │ UniProt REST │ PubMed E-utils  │  │
│  │  KEGG REST │ PDB REST │ ClinVar REST           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Python Bridge（仅非 REST 场景: BLAST 解析等）        │
└────────────────────┬─────────────────────────────────┘
                     │ Event Stream
┌────────────────────▼─────────────────────────────────┐
│  pi-tui / CLI                                       │
│  消息面板 │ 工具调用日志 │ 进度指示 │ 报告预览         │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **数据连接器优先用 TypeScript HTTP**：NCBI/UniProt/PubMed 全是 REST，`fetch` 直接调。Python 桥接仅用于 BLAST 等必须场景
2. **多模型策略**：简单查询→轻量模型；问题分解/推理→reasoning model；结果聚合→长上下文模型
3. **缓存层**：所有外部 API 查询本地缓存（TTL: 序列/结构 24h，文献 1h），减少 API 调用
4. **会话=分析历史**：pi-agent-core JSONL 会话天然支持/tree回看、/fork复现
5. **并行工具执行**：pi-agent-core 已支持 parallel tool execution，子问题间可并发

## Risks

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 推理引擎产出不比"自己去问ChatGPT"好 | 中 | 致命 | 先做 POC，用真实生物问题盲测对比；如果差距不大就 pivot |
| NCBI 速率限制（未注册 3 req/s）| 高 | 中 | 缓存层 + 引导用户注册 API key 提升限额(10 req/s) |
| LLM 对生物学术语理解不够深，工具调用选错 | 中 | 中 | 工具 description 写得极具体 + few-shot 示例 |
| 外部 API 接口变更/服务中断 | 低 | 低 | 多数据源冗余设计（同一信息可能有 NCBI+UniProt 两个来源） |
| 个人开发时间碎片化，进度难以保证 | 中 | 高 | 轨道解耦 → 每个轨道独立可交付；MVP 完成后逐步迭代 |

## Implementation Plan（可并行轨道）

所有 Track 可并发开发，各自独立测试，通过 Tool Registry 接口契约集成。

```
Track A: 骨架 + Agent + TUI     ← 先建契约接口
Track B: 数据连接器 + 工具        ← 按契约实现工具
Track C: 推理引擎 + 报告生成      ← 用 mock 工具先调通，再换真工具
Track D: 端到端测试 + 文档       ← 最后集成
```

**PR1: 骨架 & 契约定义**（Track A 前半）
- TypeScript 项目初始化（引用 pi-mono workspace）
- Bio Tool Registry 接口定义（`registerTool`, `getTools`, `AgentTool` 工厂）
- Agent 运行时基类（`BioAgent extends pi-agent-core Agent`）
- Mock 工具集（假 NCBI/UniProt/PubMed，用于 Track C 并行开发）

**PR2: 数据连接器**（Track B，PR1 完成后并行）
- NCBI E-utilities client + cache
- UniProt REST client + cache
- PubMed E-utilities client + cache
- 每个 connector 独立目录，独立测试

**PR3: 工具实现**（Track B 续，依赖 PR2 各 connector 就绪一个做一个）
- gene_search → NCBI connector
- protein_info → UniProt connector
- pubmed_search → PubMed connector
- pathway_enrich → KEGG connector
- 每个工具 = AgentTool 注册 → 独立测试 → 集成

**PR4: 推理引擎 + 报告**（Track C，依赖 PR1 契约 + PR3 工具逐步就绪）
- Planner: 问题分解 prompt + few-shot 示例
- Executor: 子问题并发调度
- Aggregator: 结果聚合 + 报告模板
- 先用 mock 工具验证链路 → 逐步替换真工具

**PR5: TUI**（Track A 后半，依赖 PR1 骨架）
- 消息面板（用户输入 + Agent 响应流）
- 工具调用日志面板（实时：哪个工具在执行 → 参数 → 结果摘要）
- 分析进度指示
- 报告预览面板

**PR6: 端到端 + 发布**（Track D，依赖所有 Track 完成）
- 3 个端到端场景测试
- 外部依赖引导脚本
- README + 架构文档 + Demo
- npm publish

## Technical Notes

- Node.js >= 20, TypeScript
- 主要依赖：@mariozechner/pi-ai, @mariozechner/pi-agent-core, @mariozechner/pi-tui
- 外部 API 均为免费注册型（NCBI API key、UniProt 无需 key、PubMed 无需 key）
- Python 仅用于 BLAST/特定工具（可选依赖）
