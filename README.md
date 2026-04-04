# Vibe Changes

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**Session-based change tracking for VS Code** — track, highlight, and review code changes independently of Git.

Perfect for:
- Reviewing AI-generated code changes before committing
- Tracking experimental edits without staging
- Quick code reviews during pair programming
- Keeping focus on "what changed since I started"

## Features

- **Full workspace tracking** — snapshots all workspace files on disk, not just open tabs
- **Disk-backed snapshots** — files stored in a temp directory, not in memory, so large projects (26K+ files) work without issues
- **Real-time highlighting** — added lines highlighted in green, removed lines marked in the gutter
- **Review panel** — dedicated UI to browse all changes with accept/reject controls at hunk, file, or global level
- **Smart file filtering** — automatically excludes `node_modules`, `.git`, binary files, build artifacts, and lock files
- **Status bar** — always see tracking status and file count

## Quick Start

1. **Start tracking**: `Ctrl+Shift+T` (or `Cmd+Shift+T` on Mac)
2. **Make edits** — changes are highlighted in real-time
3. **Review**: `Ctrl+Shift+R` to open the review panel
4. **Accept or Reject** — update baseline or revert changes
5. **Stop tracking**: `Ctrl+Shift+Y` to stop tracking

## Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `Vibe Changes: Start Tracking` | `Ctrl+Shift+T` | Snapshot all workspace files and start tracking |
| `Vibe Changes: Stop Tracking` | `Ctrl+Shift+Y` | Clear snapshots and stop |
| `Vibe Changes: Open Review Panel` | `Ctrl+Shift+R` | Open the review panel |
| `Vibe Changes: Accept All` | — | Accept all changes (update baseline) |
| `Vibe Changes: Reject All` | — | Reject all changes (revert to snapshot) |

## How It Works

```
[Start Tracking] → Snapshot all workspace files to temp directory on disk
        ↓
[Edit files] → Diff computed on demand → Lines highlighted
        ↓
[Open Review] → Reads snapshots from disk, shows changes for open & modified files
        ↓
[Accept] → Snapshot updated (new baseline)
[Reject] → File reverted to snapshot
```

### Accept vs Reject

- **Accept** = "These changes are good, make them the new baseline"
- **Reject** = "Undo these changes, go back to the snapshot"

### What's Excluded

The following are automatically excluded from tracking:
- **Directories**: `node_modules`, `.git`, `.vscode`, `dist`, `out`, `build`, `.cache`, `.next`, `.nuxt`, `coverage`, `__pycache__`
- **Binary files**: images, fonts, archives, executables, compiled objects, `.wasm`
- **Lock files**: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- **Generated files**: `.map`, `.min.js`, `.min.css`, `.chunk.js`, `.bundle.js`
- **Files larger than 1 MB**

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
- [ ] Custom ignore patterns configuration
- [ ] Export changes as patch file

## License

[MIT](LICENSE)
