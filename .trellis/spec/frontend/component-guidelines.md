# TUI Panel & Component Guidelines

> Panels and components for the BioTreLlises TUI built on pi-tui.

---

## Panel Lifecycle

Every panel follows the same pattern:

```typescript
class MessagePanel {
  private state: MessagePanelState;
  private unsubscribe: () => void;

  constructor(private agent: BioAgent, private renderFn: RenderFunction) {
    this.state = { messages: [], isStreaming: false };
    // Subscribe to relevant events
    this.unsubscribe = agent.subscribe((event) => this.handleEvent(event));
  }

  private handleEvent(event: AgentEvent) {
    switch (event.type) {
      case 'message_start': /* update state + re-render */ break;
      case 'message_update': /* streaming content */ break;
      case 'message_end': /* message complete */ break;
    }
  }

  dispose() {
    this.unsubscribe(); // Clean up subscription
  }
}
```

**Rules**:
- Panels subscribe in constructor, unsubscribe in dispose
- State updates are synchronous (pi-tui is single-threaded, no concurrent mutations)
- `renderFn` is called after state changes (pi-tui diffs DOM automatically)

---

## Component Patterns

Reusable components are stateless functions:

```typescript
// Component = function that returns VirtualNode (pi-tui)
function thinkingBlock(content: string, collapsed: boolean): VirtualNode {
  return collapsed
    ? h('text', { content: '💭 Thinking... (press Ctrl+T to expand)' })
    : h('box', {}, [
        h('text', { content: 'Thinking:' }),
        h('text', { content }),
      ]);
}
```

---

## Styling

All colors/styling come from the active theme:

```typescript
import { theme } from '../themes/current';

// Use theme colors, never hardcode
const entryStyle = {
  color: theme.colors.toolName,
  background: theme.colors.panelBg,
};
```

Theme reference: `packages/biotrellises-tui/src/themes/bio-dark.ts`

---

## Terminal Compatibility

- Width-aware: check `process.stdout.columns` for responsive layout
- Unicode-safe: pi-tui handles East Asian width via `get-east-asian-width`
- No emoji in production (per pi-mono convention)
