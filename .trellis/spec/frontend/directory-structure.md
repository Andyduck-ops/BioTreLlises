# Directory Structure

> BioTreLlises TUI package — terminal UI built on pi-tui.

---

## Overview

The TUI package extends `@mariozechner/pi-tui` for differential terminal rendering. It subscribes to BioTreLlises Agent events and renders panels independently.

---

## Directory Layout

```
packages/biotrellises-tui/
├── src/
│   ├── panels/                 # TUI panels — each subscribes to agent events
│   │   ├── message-panel.ts    # Chat display (user messages + agent responses)
│   │   ├── tool-log-panel.ts   # Real-time tool call/result log
│   │   ├── progress-panel.ts   # Analysis progress indicator
│   │   ├── report-panel.ts     # Generated report preview
│   │   └── footer-panel.ts     # Status bar (model, tokens, cost, session)
│   │
│   ├── components/             # Reusable TUI widgets
│   │   ├── thinking-block.ts   # Collapsible thinking display
│   │   ├── tool-call-entry.ts  # Single tool call with expandable details
│   │   ├── markdown-view.ts    # Markdown renderer for reports
│   │   └── table-view.ts       # Data table renderer
│   │
│   ├── themes/                 # Color themes
│   │   ├── bio-dark.ts         # Dark theme (default)
│   │   └── bio-light.ts        # Light theme
│   │
│   ├── app.ts                  # TUI application init + panel layout
│   └── index.ts                # Public exports
│
├── test/
│   └── panels/                 # Panel rendering tests
│
└── package.json
```

---

## Module Organization

**Panel rule**: Each panel subscribes to a subset of agent events. No panel imports another panel.

```
Agent Event Stream
  ├── message-panel    ← message_start, message_update, message_end
  ├── tool-log-panel   ← tool_execution_start, tool_execution_end
  ├── progress-panel   ← turn_start, turn_end, reasoning_plan
  ├── report-panel     ← aggregation_complete
  └── footer-panel     ← all events (cost + token tracking)
```

---

## Naming Conventions

- Panel files: `*-panel.ts` (kebab-case prefix, panel suffix)
- Component files: kebab-case (`thinking-block.ts`, `tool-call-entry.ts`)
- Theme files: `bio-*.ts`
- Classes: PascalCase (`MessagePanel`, `ToolLogPanel`)
- Panel state: `interface XxxPanelState`

---

## Example

- Panel: `packages/biotrellises-tui/src/panels/message-panel.ts`
- Component: `packages/biotrellises-tui/src/components/thinking-block.ts`
