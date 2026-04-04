# Changelog

All notable changes to the "Vibe Changes" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Surgical hunk rejection (revert individual hunks without affecting entire file)
- Persist snapshots across VS Code restarts
- Side-by-side diff view
- Inline CodeLens accept/reject buttons
- Custom ignore patterns configuration
- Export changes as patch file

## [0.2.0] - 2026-04-04

### Changed
- **Disk-backed snapshots** — snapshot content is now stored in a temp directory on disk instead of in-memory `Map`. This eliminates out-of-memory crashes on large projects (tested with 26K+ files).
- `snapshotAllWorkspaceFiles()` now uses `vscode.workspace.fs.copy` instead of reading file contents into `Buffer`, reducing memory footprint during snapshot creation.
- `getSnapshot()` is now async — reads content from disk on demand only when needed for diff/review.
- Review panel `computeAllChanges()` now detects changes in files not open in the editor by comparing disk `mtime` against snapshot timestamp.
- Review panel shows a loading state immediately while async data loads (fixes blank dark panel).
- Added debounce (150ms) on decoration updates and (500ms) on review panel updates to avoid excessive I/O during rapid typing.

### Added
- `shouldTrack()` filter — prevents tracking binary files, `node_modules`, build artifacts, lock files, and other non-source files opened internally by VS Code.
- Comprehensive exclude patterns for `findFiles`: `.cache`, `build`, `.next`, `.nuxt`, `coverage`, `__pycache__`, `.pack`, `.wasm`, `.min.js`, `.chunk.js`, `.bundle.js`, and more.
- File size limit (1 MB) — files exceeding this are skipped during snapshot.

### Fixed
- VS Code crashing when starting tracking on large workspaces (all file content was held in memory).
- Review panel showing blank/dark screen (async `updateContent` was not awaited in constructor).
- Review panel missing changes from files modified on disk but not open in the editor.
- Binary and cache files (`.pack`, `.map`, etc.) appearing in the review panel.
- `onDidOpenTextDocument` capturing `node_modules` and binary files opened internally by VS Code.

## [0.1.0] - 2024-12-01

### Added
- Initial release
- Session-based file snapshots
- Real-time change highlighting (added lines in green, removed indicators in gutter)
- Review panel with Accept/Reject controls
- File-level and hunk-level change management
- Status bar indicator showing tracking state
- Configurable highlight colors
- Keyboard shortcuts:
  - `Ctrl+Shift+T` / `Cmd+Shift+T` — Start tracking
  - `Ctrl+Shift+R` / `Cmd+Shift+R` — Open review panel
  - `Ctrl+Shift+Y` / `Cmd+Shift+Y` — Stop tracking
- Commands: Start Tracking, Stop Tracking, Open Review Panel, Accept All, Reject All
