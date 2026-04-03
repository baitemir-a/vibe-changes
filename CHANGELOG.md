# Changelog

All notable changes to the "Vibe Changes" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-XX-XX

### Added
- Initial release
- Session-based file snapshots
- Real-time change highlighting (added lines in green, removed indicators in gutter)
- Review panel with Accept/Reject controls
- File-level and hunk-level change management
- Status bar indicator showing tracking state
- Configurable highlight colors
- Keyboard shortcuts:
  - `Ctrl+Shift+T` / `Cmd+Shift+T` - Start tracking
  - `Ctrl+Shift+R` / `Cmd+Shift+R` - Open review panel

### Commands
- `Vibe Changes: Start Tracking` - Create snapshot and begin tracking
- `Vibe Changes: Stop Tracking` - Clear snapshots and stop
- `Vibe Changes: Open Review Panel` - Open the review webview
- `Vibe Changes: Accept All` - Accept all changes
- `Vibe Changes: Reject All` - Reject all changes

## [Unreleased]

### Planned
- Surgical hunk rejection (revert individual hunks without affecting entire file)
- Persist snapshots across VS Code restarts
- Side-by-side diff view
- Inline CodeLens accept/reject buttons
- Ignore patterns configuration
- Export changes as patch file
