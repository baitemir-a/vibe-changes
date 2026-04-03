import * as vscode from 'vscode';
import { SnapshotManager } from './snapshotManager';
import { DiffEngine } from './diffEngine';

export class DecorationProvider implements vscode.Disposable {
  private addedDecorationType: vscode.TextEditorDecorationType;
  private removedDecorationType: vscode.TextEditorDecorationType;
  private modifiedDecorationType: vscode.TextEditorDecorationType;
  private gutterAddedDecorationType: vscode.TextEditorDecorationType;
  private gutterRemovedDecorationType: vscode.TextEditorDecorationType;
  
  private disposables: vscode.Disposable[] = [];
  private isActive: boolean = false;

  constructor(
    private snapshotManager: SnapshotManager,
    private diffEngine: DiffEngine
  ) {
    // Initialize decoration types with colors from settings
    const config = vscode.workspace.getConfiguration('vibeChanges');
    
    this.addedDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: config.get('addedLineColor', 'rgba(40, 167, 69, 0.2)'),
      isWholeLine: true,
      overviewRulerColor: 'rgba(40, 167, 69, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.removedDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: config.get('removedLineColor', 'rgba(220, 53, 69, 0.2)'),
      isWholeLine: true,
      overviewRulerColor: 'rgba(220, 53, 69, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.modifiedDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: config.get('modifiedLineColor', 'rgba(255, 193, 7, 0.2)'),
      isWholeLine: true,
      overviewRulerColor: 'rgba(255, 193, 7, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Gutter decorations
    this.gutterAddedDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.createGutterIcon('added'),
      gutterIconSize: 'contain',
    });

    this.gutterRemovedDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.createGutterIcon('removed'),
      gutterIconSize: 'contain',
    });
  }

  private createGutterIcon(type: 'added' | 'removed'): vscode.Uri {
    const color = type === 'added' ? '%2328a745' : '%23dc3545';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <rect x="6" y="0" width="4" height="16" fill="${color}"/>
    </svg>`;
    return vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svg)}`);
  }

  /**
   * Start decorating editors
   */
  public activate(): void {
    this.isActive = true;
    
    // Decorate all visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
      this.updateDecorations(editor);
    });

    // Listen for editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && this.isActive) {
          this.updateDecorations(editor);
        }
      })
    );

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        if (this.isActive) {
          const editor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.toString() === event.document.uri.toString()
          );
          if (editor) {
            this.updateDecorations(editor);
          }
        }
      })
    );

    // Listen for snapshot changes
    this.disposables.push(
      this.snapshotManager.onSnapshotChanged(uri => {
        const editor = vscode.window.visibleTextEditors.find(
          e => e.document.uri.toString() === uri
        );
        if (editor && this.isActive) {
          this.updateDecorations(editor);
        }
      })
    );
  }

  /**
   * Stop decorating editors
   */
  public deactivate(): void {
    this.isActive = false;
    this.clearAllDecorations();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  /**
   * Update decorations for a specific editor
   */
  public updateDecorations(editor: vscode.TextEditor): void {
    if (!this.isActive) return;
    
    const uri = editor.document.uri.toString();
    const snapshot = this.snapshotManager.getSnapshot(uri);
    
    if (!snapshot) {
      // No snapshot - clear decorations
      this.clearDecorations(editor);
      return;
    }

    const currentContent = editor.document.getText();
    
    if (currentContent === snapshot.content) {
      // No changes - clear decorations
      this.clearDecorations(editor);
      return;
    }

    const changes = this.diffEngine.getChangeRanges(snapshot.content, currentContent);
    
    // Create decoration ranges
    const addedRanges: vscode.DecorationOptions[] = changes.added.map(lineNum => ({
      range: new vscode.Range(lineNum - 1, 0, lineNum - 1, Number.MAX_SAFE_INTEGER),
      hoverMessage: new vscode.MarkdownString('**Added line**'),
    }));

    const removedRanges: vscode.DecorationOptions[] = changes.removed.map(r => {
      const line = Math.min(r.afterLine, editor.document.lineCount - 1);
      return {
        range: new vscode.Range(line, 0, line, 0),
        hoverMessage: new vscode.MarkdownString('**Line(s) removed below**'),
      };
    });

    // Apply decorations
    editor.setDecorations(this.addedDecorationType, addedRanges);
    editor.setDecorations(this.gutterAddedDecorationType, addedRanges);
    editor.setDecorations(this.gutterRemovedDecorationType, removedRanges);
  }

  /**
   * Clear decorations from an editor
   */
  private clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.addedDecorationType, []);
    editor.setDecorations(this.removedDecorationType, []);
    editor.setDecorations(this.modifiedDecorationType, []);
    editor.setDecorations(this.gutterAddedDecorationType, []);
    editor.setDecorations(this.gutterRemovedDecorationType, []);
  }

  /**
   * Clear all decorations from all editors
   */
  private clearAllDecorations(): void {
    vscode.window.visibleTextEditors.forEach(editor => {
      this.clearDecorations(editor);
    });
  }

  /**
   * Refresh decorations in all visible editors
   */
  public refreshAll(): void {
    vscode.window.visibleTextEditors.forEach(editor => {
      this.updateDecorations(editor);
    });
  }

  public dispose(): void {
    this.deactivate();
    this.addedDecorationType.dispose();
    this.removedDecorationType.dispose();
    this.modifiedDecorationType.dispose();
    this.gutterAddedDecorationType.dispose();
    this.gutterRemovedDecorationType.dispose();
  }
}
