# Vibe Changes

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/YOUR-PUBLISHER-ID.vibe-changes?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=YOUR-PUBLISHER-ID.vibe-changes)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**Session-based change tracking for VS Code** — track, highlight, and review code changes independently of Git.

Perfect for:
- Reviewing AI-generated code changes before committing
- Tracking experimental edits without staging
- Quick code reviews during pair programming
- Keeping focus on "what changed since I started"

> 💡 Inspired by change tracking UI in modern AI-powered code editors.

## Features

✨ **Session Snapshots** — Start tracking at any point, creates a baseline of your files  
🎨 **Real-time Highlighting** — Added lines glow green, removed lines marked in gutter  
📋 **Review Panel** — Dedicated UI to browse all changes with Accept/Reject controls  
🎯 **Granular Control** — Accept or reject at file or hunk level  
📊 **Status Bar** — Always see tracking status and file count  

## Quick Start

1. **Start tracking**: `Ctrl+Shift+T` (or `Cmd+Shift+T` on Mac)
2. **Make edits** — changes are highlighted in real-time
3. **Review**: `Ctrl+Shift+R` to open the review panel
4. **Accept or Reject** — update baseline or revert changes
5. **Stop tracking**: `Ctrl+Shift+Y` to stop tracking

## Screenshots

| Editor Highlighting | Review Panel |
|---------------------|--------------|
| ![Editor](https://via.placeholder.com/400x250?text=Editor+Highlighting) | ![Review](https://via.placeholder.com/400x250?text=Review+Panel) |

## Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `Vibe Changes: Start Tracking` | `Ctrl+Shift+T` | Create snapshot and start tracking |
| `Vibe Changes: Stop Tracking` | — | Clear snapshots and stop |
| `Vibe Changes: Open Review Panel` | `Ctrl+Shift+R` | Open the review panel |
| `Vibe Changes: Accept All` | — | Accept all changes (update baseline) |
| `Vibe Changes: Reject All` | — | Reject all changes (revert to snapshot) |
| `Vibe Changes: Take New Snapshot` | — | Update baseline without stopping |

## How It Works

```
[Start Tracking] → Snapshot all open files
        ↓
[Edit files] → Diff computed in real-time → Lines highlighted
        ↓
[Open Review] → See all changes grouped by file
        ↓
[Accept] → Snapshot updated (new baseline)
[Reject] → File reverted to snapshot
```

### Accept vs Reject

- **Accept** = "These changes are good, make them the new baseline"
- **Reject** = "Undo these changes, go back to the snapshot"

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vibeChanges.addedLineColor` | `rgba(40, 167, 69, 0.2)` | Background for added lines |
| `vibeChanges.removedLineColor` | `rgba(220, 53, 69, 0.2)` | Color for removed indicators |
| `vibeChanges.modifiedLineColor` | `rgba(255, 193, 7, 0.2)` | Background for modified lines |
| `vibeChanges.highlightAddedLines` | `true` | Enable added line highlighting |
| `vibeChanges.highlightRemovedLines` | `true` | Enable removed line indicators |

## Use Cases

### Reviewing AI-Generated Code
1. Start tracking before asking AI to modify your code
2. AI makes changes
3. Open review panel to see exactly what changed
4. Accept good changes, reject bad ones

### Experimental Edits
1. Start tracking
2. Try different approaches
3. If it works → Accept
4. If it breaks → Reject and try again

### Quick Code Review
1. Colleague makes changes to your file
2. Start tracking, they edit
3. Review their changes in the panel
4. Discuss and accept/reject together

## Development

```bash
git clone https://github.com/baitemir-a/vibe-changes.git
cd vibe-changes
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## Contributing

Contributions welcome! Some ideas:

- [ ] Surgical hunk rejection (currently reverts entire file)
- [ ] Persist snapshots across VS Code restarts
- [ ] Side-by-side diff view
- [ ] Inline CodeLens accept/reject buttons
- [ ] Ignore patterns (node_modules, etc.)
- [ ] Export changes as patch file

## License

[MIT](LICENSE) © 2024
