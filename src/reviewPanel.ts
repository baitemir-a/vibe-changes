import * as vscode from 'vscode';
import { SnapshotManager } from './snapshotManager';
import { DiffEngine } from './diffEngine';
import { FileChanges, Hunk, WebviewMessage } from './types';

export class ReviewPanel implements vscode.Disposable {
  public static currentPanel: ReviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  
  private constructor(
    panel: vscode.WebviewPanel,
    private snapshotManager: SnapshotManager,
    private diffEngine: DiffEngine,
    private extensionUri: vscode.Uri
  ) {
    this.panel = panel;
    
    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message),
      null,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Update content when documents change
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(() => {
        this.updateContent();
      })
    );

    // Initial content
    this.updateContent();
  }

  public static createOrShow(
    snapshotManager: SnapshotManager,
    diffEngine: DiffEngine,
    extensionUri: vscode.Uri
  ): ReviewPanel {
    const column = vscode.ViewColumn.Beside;

    if (ReviewPanel.currentPanel) {
      ReviewPanel.currentPanel.panel.reveal(column);
      ReviewPanel.currentPanel.updateContent();
      return ReviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'vibeChangesReview',
      'Review Changes',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    ReviewPanel.currentPanel = new ReviewPanel(
      panel,
      snapshotManager,
      diffEngine,
      extensionUri
    );

    return ReviewPanel.currentPanel;
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.command) {
      case 'acceptHunk':
        await this.acceptHunk(message.payload.fileUri, message.payload.hunkId);
        break;
      case 'rejectHunk':
        await this.rejectHunk(message.payload.fileUri, message.payload.hunkId);
        break;
      case 'acceptFile':
        await this.acceptFile(message.payload.fileUri);
        break;
      case 'rejectFile':
        await this.rejectFile(message.payload.fileUri);
        break;
      case 'acceptAll':
        await this.acceptAll();
        break;
      case 'rejectAll':
        await this.rejectAll();
        break;
      case 'openFile':
        await this.openFile(message.payload.fileUri, message.payload.line);
        break;
      case 'refresh':
        this.updateContent();
        break;
    }
  }

  private async acceptHunk(fileUri: string, hunkId: string): Promise<void> {
    // Accepting a hunk means updating the snapshot to include this change
    const uri = vscode.Uri.parse(fileUri);
    const document = await vscode.workspace.openTextDocument(uri);
    this.snapshotManager.updateSnapshot(fileUri, document.getText());
    this.updateContent();
    vscode.window.showInformationMessage('Change accepted');
  }

  private async rejectHunk(fileUri: string, hunkId: string): Promise<void> {
    // Rejecting means reverting to snapshot
    const snapshot = this.snapshotManager.getSnapshot(fileUri);
    if (!snapshot) return;

    const uri = vscode.Uri.parse(fileUri);
    const document = await vscode.workspace.openTextDocument(uri);
    const currentContent = document.getText();
    
    // Get the specific hunk
    const fileChanges = this.diffEngine.computeDiff(
      snapshot.content,
      currentContent,
      fileUri,
      this.getFileName(fileUri)
    );
    
    const hunk = fileChanges.hunks.find(h => h.id === hunkId);
    if (!hunk) return;

    // For simplicity, we'll revert the entire file to snapshot
    // A more sophisticated approach would surgically revert just the hunk
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(currentContent.length)
    );
    edit.replace(uri, fullRange, snapshot.content);
    await vscode.workspace.applyEdit(edit);
    
    this.updateContent();
    vscode.window.showInformationMessage('Change rejected - reverted to snapshot');
  }

  private async acceptFile(fileUri: string): Promise<void> {
    const uri = vscode.Uri.parse(fileUri);
    const document = await vscode.workspace.openTextDocument(uri);
    this.snapshotManager.updateSnapshot(fileUri, document.getText());
    this.updateContent();
    vscode.window.showInformationMessage(`All changes in ${this.getFileName(fileUri)} accepted`);
  }

  private async rejectFile(fileUri: string): Promise<void> {
    const snapshot = this.snapshotManager.getSnapshot(fileUri);
    if (!snapshot) return;

    const uri = vscode.Uri.parse(fileUri);
    const document = await vscode.workspace.openTextDocument(uri);
    
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(uri, fullRange, snapshot.content);
    await vscode.workspace.applyEdit(edit);
    
    this.updateContent();
    vscode.window.showInformationMessage(`All changes in ${this.getFileName(fileUri)} rejected`);
  }

  private async acceptAll(): Promise<void> {
    const trackedUris = this.snapshotManager.getTrackedUris();
    for (const fileUri of trackedUris) {
      try {
        const uri = vscode.Uri.parse(fileUri);
        const document = await vscode.workspace.openTextDocument(uri);
        this.snapshotManager.updateSnapshot(fileUri, document.getText());
      } catch (e) {
        // File might have been deleted
      }
    }
    this.updateContent();
    vscode.window.showInformationMessage('All changes accepted');
  }

  private async rejectAll(): Promise<void> {
    const trackedUris = this.snapshotManager.getTrackedUris();
    for (const fileUri of trackedUris) {
      const snapshot = this.snapshotManager.getSnapshot(fileUri);
      if (!snapshot) continue;

      try {
        const uri = vscode.Uri.parse(fileUri);
        const document = await vscode.workspace.openTextDocument(uri);
        
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        edit.replace(uri, fullRange, snapshot.content);
        await vscode.workspace.applyEdit(edit);
      } catch (e) {
        // File might have been deleted
      }
    }
    this.updateContent();
    vscode.window.showInformationMessage('All changes rejected');
  }

  private async openFile(fileUri: string, line?: number): Promise<void> {
    const uri = vscode.Uri.parse(fileUri);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    
    if (line !== undefined) {
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
  }

  private updateContent(): void {
    const allChanges = this.computeAllChanges();
    this.panel.webview.html = this.getHtmlContent(allChanges);
  }

  private computeAllChanges(): FileChanges[] {
    const changes: FileChanges[] = [];
    const trackedUris = this.snapshotManager.getTrackedUris();

    for (const uri of trackedUris) {
      const snapshot = this.snapshotManager.getSnapshot(uri);
      if (!snapshot) continue;

      try {
        const document = vscode.workspace.textDocuments.find(
          d => d.uri.toString() === uri
        );
        
        if (!document) continue;

        const currentContent = document.getText();
        if (currentContent === snapshot.content) continue;

        const fileChanges = this.diffEngine.computeDiff(
          snapshot.content,
          currentContent,
          uri,
          this.getFileName(uri)
        );

        if (fileChanges.hunks.length > 0) {
          changes.push(fileChanges);
        }
      } catch (e) {
        // File might not be open
      }
    }

    return changes;
  }

  private getFileName(uri: string): string {
    const parts = uri.split('/');
    return parts[parts.length - 1];
  }

  private getHtmlContent(allChanges: FileChanges[]): string {
    const totalFiles = allChanges.length;
    const totalHunks = allChanges.reduce((sum, f) => sum + f.hunks.length, 0);
    const totalAdded = allChanges.reduce((sum, f) => sum + f.totalAdded, 0);
    const totalRemoved = allChanges.reduce((sum, f) => sum + f.totalRemoved, 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Changes</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-panel-border);
      --added-bg: rgba(40, 167, 69, 0.2);
      --added-color: #28a745;
      --removed-bg: rgba(220, 53, 69, 0.2);
      --removed-color: #dc3545;
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--text-primary);
      background: var(--bg-primary);
      padding: 16px;
      line-height: 1.5;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .header h1 {
      font-size: 1.4em;
      font-weight: 600;
    }

    .stats {
      display: flex;
      gap: 16px;
      font-size: 0.9em;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat.added { color: var(--added-color); }
    .stat.removed { color: var(--removed-color); }

    .global-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }

    button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      transition: background 0.2s;
    }

    .btn-primary {
      background: var(--button-bg);
      color: var(--button-fg);
    }

    .btn-primary:hover {
      background: var(--button-hover);
    }

    .btn-accept {
      background: var(--added-color);
      color: white;
    }

    .btn-accept:hover {
      background: #218838;
    }

    .btn-reject {
      background: var(--removed-color);
      color: white;
    }

    .btn-reject:hover {
      background: #c82333;
    }

    .btn-small {
      padding: 4px 8px;
      font-size: 0.8em;
    }

    .file-section {
      margin-bottom: 24px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
    }

    .file-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: var(--bg-secondary);
      cursor: pointer;
    }

    .file-header:hover {
      opacity: 0.9;
    }

    .file-name {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .file-stats {
      display: flex;
      gap: 12px;
      font-size: 0.85em;
    }

    .file-actions {
      display: flex;
      gap: 6px;
    }

    .hunks-container {
      padding: 12px;
    }

    .hunk {
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      overflow: hidden;
    }

    .hunk:last-child {
      margin-bottom: 0;
    }

    .hunk-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--bg-secondary);
      font-size: 0.85em;
    }

    .hunk-location {
      color: var(--text-secondary);
    }

    .hunk-actions {
      display: flex;
      gap: 6px;
    }

    .diff-content {
      font-family: var(--vscode-editor-font-family), monospace;
      font-size: 12px;
      overflow-x: auto;
    }

    .diff-line {
      display: flex;
      padding: 2px 12px;
      white-space: pre;
    }

    .diff-line.added {
      background: var(--added-bg);
    }

    .diff-line.removed {
      background: var(--removed-bg);
    }

    .diff-line.context {
      opacity: 0.7;
    }

    .line-type {
      width: 20px;
      flex-shrink: 0;
      user-select: none;
    }

    .line-content {
      flex: 1;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-secondary);
    }

    .empty-state h2 {
      margin-bottom: 8px;
      font-weight: 500;
    }

    .icon {
      width: 16px;
      height: 16px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📝 Review Changes</h1>
    <div class="stats">
      <span class="stat">${totalFiles} file${totalFiles !== 1 ? 's' : ''}</span>
      <span class="stat">${totalHunks} change${totalHunks !== 1 ? 's' : ''}</span>
      <span class="stat added">+${totalAdded}</span>
      <span class="stat removed">-${totalRemoved}</span>
    </div>
  </div>

  ${totalFiles > 0 ? `
  <div class="global-actions">
    <button class="btn-accept" onclick="acceptAll()">✓ Accept All</button>
    <button class="btn-reject" onclick="rejectAll()">✕ Reject All</button>
    <button class="btn-primary" onclick="refresh()">↻ Refresh</button>
  </div>

  ${allChanges.map(file => this.renderFile(file)).join('')}
  ` : `
  <div class="empty-state">
    <h2>No changes detected</h2>
    <p>Make some edits to tracked files to see them here.</p>
    <button class="btn-primary" style="margin-top: 16px" onclick="refresh()">↻ Refresh</button>
  </div>
  `}

  <script>
    const vscode = acquireVsCodeApi();

    function send(command, payload) {
      vscode.postMessage({ command, payload });
    }

    function acceptHunk(fileUri, hunkId) {
      send('acceptHunk', { fileUri, hunkId });
    }

    function rejectHunk(fileUri, hunkId) {
      send('rejectHunk', { fileUri, hunkId });
    }

    function acceptFile(fileUri) {
      send('acceptFile', { fileUri });
    }

    function rejectFile(fileUri) {
      send('rejectFile', { fileUri });
    }

    function acceptAll() {
      send('acceptAll', {});
    }

    function rejectAll() {
      send('rejectAll', {});
    }

    function openFile(fileUri, line) {
      send('openFile', { fileUri, line });
    }

    function refresh() {
      send('refresh', {});
    }
  </script>
</body>
</html>`;
  }

  private renderFile(file: FileChanges): string {
    return `
    <div class="file-section">
      <div class="file-header" onclick="openFile('${this.escapeHtml(file.uri)}')">
        <span class="file-name">
          📄 ${this.escapeHtml(file.fileName)}
        </span>
        <div class="file-stats">
          <span class="stat added">+${file.totalAdded}</span>
          <span class="stat removed">-${file.totalRemoved}</span>
        </div>
      </div>
      <div class="file-actions" style="padding: 8px 14px; background: var(--bg-secondary); border-top: 1px solid var(--border-color);">
        <button class="btn-accept btn-small" onclick="event.stopPropagation(); acceptFile('${this.escapeHtml(file.uri)}')">✓ Accept File</button>
        <button class="btn-reject btn-small" onclick="event.stopPropagation(); rejectFile('${this.escapeHtml(file.uri)}')">✕ Reject File</button>
      </div>
      <div class="hunks-container">
        ${file.hunks.map(hunk => this.renderHunk(file.uri, hunk)).join('')}
      </div>
    </div>`;
  }

  private renderHunk(fileUri: string, hunk: Hunk): string {
    const diffLines = this.renderDiffLines(hunk);
    
    return `
    <div class="hunk">
      <div class="hunk-header">
        <span class="hunk-location" onclick="openFile('${this.escapeHtml(fileUri)}', ${hunk.startLine})">
          Lines ${hunk.startLine}-${hunk.endLine}
        </span>
        <div class="hunk-actions">
          <button class="btn-accept btn-small" onclick="acceptHunk('${this.escapeHtml(fileUri)}', '${hunk.id}')">✓</button>
          <button class="btn-reject btn-small" onclick="rejectHunk('${this.escapeHtml(fileUri)}', '${hunk.id}')">✕</button>
        </div>
      </div>
      <div class="diff-content">
        ${diffLines}
      </div>
    </div>`;
  }

  private renderDiffLines(hunk: Hunk): string {
    return hunk.changes.map(change => {
      if (change.type === 'added') {
        return `<div class="diff-line added"><span class="line-type">+</span><span class="line-content">${this.escapeHtml(change.newContent || '')}</span></div>`;
      } else if (change.type === 'removed') {
        return `<div class="diff-line removed"><span class="line-type">-</span><span class="line-content">${this.escapeHtml(change.oldContent || '')}</span></div>`;
      } else {
        return `<div class="diff-line context"><span class="line-type"> </span><span class="line-content">${this.escapeHtml(change.newContent || change.oldContent || '')}</span></div>`;
      }
    }).join('');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public dispose(): void {
    ReviewPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
