# Event Handling

> BioTreLlises TUI has no React hooks. This covers event subscription and handler patterns for pi-tui.

---

## Overview

The TUI reacts to agent events from pi-agent-core. No React, no hooks — just direct event subscription via `agent.subscribe()`.

---

## Event Subscription Pattern

```typescript
// Subscribe to specific event types
agent.subscribe((event, signal) => {
  switch (event.type) {
    case 'message_update': {
      const { delta, contentIndex } = event.assistantMessageEvent;
      if (event.assistantMessageEvent.type === 'text_delta') {
        appendToMessageBuffer(delta);
        rerender();
      }
      break;
    }
    case 'tool_execution_start': {
      addToolEntry(event.toolCallId, event.toolName, event.args);
      rerender();
      break;
    }
  }
});
```

---

## Key Events for UI

| Event | UI Action |
|-------|-----------|
| `message_start` | Create new message bubble |
| `message_update` / `text_delta` | Append text to streaming message |
| `message_update` / `thinking_delta` | Append to thinking block (collapsed by default) |
| `message_end` | Finalize message, enable action buttons |
| `tool_execution_start` | Show spinner on tool entry |
| `tool_execution_end` | Show result summary, collapse details |
| `turn_end` | Update progress indicator |
| `agent_end` | Enable new prompt input |

---

## Performance

Pi-tui uses differential rendering — only changed nodes re-render. However:

- Debounce `text_delta` events: no need to render every character
- Collapse large tool outputs (>500 chars) by default
- Lazily render report content (render visible portion only)
