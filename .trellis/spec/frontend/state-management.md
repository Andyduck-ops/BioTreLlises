# State Management

> BioTreLlises TUI state: source of truth is the BioAgent, TUI holds only view state.

---

## State Architecture

```
BioAgent.state          ← Source of truth (messages, tools, model, etc.)
    ↓ (event stream)
TUI Panel States        ← View-only state (scroll position, collapse state, focus)
```

**Rule**: Never duplicate BioAgent state in TUI. Read from `agent.state.*`, don't copy.

---

## State Categories

### Agent State (read-only for TUI)

```typescript
agent.state.messages       // All messages (user, assistant, tool result)
agent.state.tools          // Registered tools
agent.state.model          // Current model
agent.state.isStreaming    // Whether agent is processing
agent.state.streamingMessage // Current partial message
```

### TUI View State (per panel)

```typescript
interface MessagePanelState {
  scrollOffset: number;
  collapsedThinking: Set<string>;   // message IDs with collapsed thinking
  collapsedTools: Set<string>;      // tool call IDs with collapsed output
}

interface ToolLogPanelState {
  filter: 'all' | 'running' | 'completed' | 'error';
  expandedEntryId: string | null;
}
```

---

## State Updates

All state transitions happen via event handlers:

```
Agent Event → Panel.handleEvent() → update Panel.state → render()
```

Never mutate state outside of event handlers. Never share mutable state between panels.

---

## Derived Data

Compute from agent state, don't store:

```typescript
// Computed, not stored
function getToolCallCount(): number {
  return agent.state.messages.filter(
    m => m.role === 'toolResult'
  ).length;
}
```
