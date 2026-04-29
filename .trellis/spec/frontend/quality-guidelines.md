# TUI Quality Guidelines

> Quality standards for the BioTreLlises TUI.

---

## Visual Consistency

- All colors from theme file — never hardcode hex/rgb in components
- Text labels use sentence case (not Title Case, not ALL CAPS)
- Consistent padding: 1 char left margin for entries, 2 char for nested content
- Tool call entries: `[tool_name] (running...)` → `[tool_name] ✓ (234ms, cache hit)`

---

## Terminal Compatibility

- Test with: Windows Terminal, iTerm2, kitty, tmux
- Minimum terminal width: 80 columns (graceful degradation below)
- No raw ANSI escape sequences — use pi-tui abstractions
- Unicode characters: only from pi-tui's known-safe set

---

## User Experience

- Tool calls auto-collapse after completion (show summary, expand on keypress)
- Thinking blocks collapsed by default (Ctrl+T to toggle)
- Progress indicator: always visible during active analysis
- Error messages: red text, one-line summary, expand for details
- Keyboard shortcuts: discoverable via `/?` or `/hotkeys`

---

## Testing

- Panel rendering: snapshot tests (virtual DOM output comparison)
- Event handling: simulate agent events, verify panel state changes
- Keyboard input: simulate key sequences, verify expected actions
- Theme: verify color coverage (all components exist in both themes)

---

## Forbidden Patterns

| Pattern | Reason |
|---------|--------|
| Hardcoded ANSI escapes | Use pi-tui abstractions |
| Blocking the event loop | All event handlers return quickly; heavy work offloaded |
| Direct terminal writes | Use pi-tui render, not process.stdout.write |
| Fixed-width assumptions | Check `process.stdout.columns` |
| Emoji in production UI | Per pi-mono convention, no emoji |
