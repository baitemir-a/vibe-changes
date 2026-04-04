import * as vscode from 'vscode';
import { SnapshotManager } from './snapshotManager';
import { DiffEngine } from './diffEngine';
import { DecorationProvider } from './decorationProvider';
import { ReviewPanel } from './reviewPanel';
import { TrackerState } from './types';

export class ChangeTracker implements vscode.Disposable {
  private state: TrackerState = {
    isTracking: false,
    startTime: null,
    trackedFiles: new Set(),
  };

  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private snapshotManager: SnapshotManager,
    private diffEngine: DiffEngine,
    private decorationProvider: DecorationProvider,
    private extensionUri: vscode.Uri
  ) {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'vibeChanges.openReview';
    this.updateStatusBar();
    this.statusBarItem.show();

    // Listen for new documents being opened
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument(doc => {
        if (this.state.isTracking && doc.uri.scheme === 'file' && this.snapshotManager.shouldTrack(doc.uri.toString())) {
          this.snapshotManager.takeSnapshot(doc);
          this.state.trackedFiles.add(doc.uri.toString());
        }
      })
    );

    // Refresh decorations on every text change (debounced inside decorationProvider)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        if (!this.state.isTracking) return;
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document) {
          this.decorationProvider.updateDecorations(editor);
        }
      })
    );

    // Listen for documents being saved
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        if (this.state.isTracking && vscode.window.activeTextEditor) {
          this.decorationProvider.updateDecorations(
            vscode.window.activeTextEditor
          );
        }
      })
    );
  }

  /**
   * Start tracking changes
   */
  public async startTracking(): Promise<void> {
    if (this.state.isTracking) {
      vscode.window.showInformationMessage('Already tracking changes');
      return;
    }

    this.state.isTracking = true;
    this.state.startTime = Date.now();

    // Snapshot ALL workspace files to temp dir on disk
    const count = await this.snapshotManager.snapshotAllWorkspaceFiles();

    for (const uri of this.snapshotManager.getTrackedUris()) {
      this.state.trackedFiles.add(uri);
    }

    this.decorationProvider.activate();
    this.updateStatusBar();
    vscode.window.showInformationMessage(
      `Tracking started. Monitoring ${count} file(s).`
    );
  }

  /**
   * Stop tracking changes
   */
  public stopTracking(): void {
    if (!this.state.isTracking) {
      vscode.window.showInformationMessage('Not currently tracking');
      return;
    }

    this.decorationProvider.deactivate();
    this.snapshotManager.clearAll();

    this.state.isTracking = false;
    this.state.startTime = null;
    this.state.trackedFiles.clear();

    this.updateStatusBar();
    vscode.window.showInformationMessage('Tracking stopped');
  }

  /**
   * Open the review panel
   */
  public openReviewPanel(): void {
    if (!this.state.isTracking) {
      const action = 'Start Tracking';
      vscode.window
        .showWarningMessage(
          'Not currently tracking changes. Start tracking first.',
          action
        )
        .then(selection => {
          if (selection === action) {
            this.startTracking();
            this.openReviewPanel();
          }
        });
      return;
    }

    ReviewPanel.createOrShow(
      this.snapshotManager,
      this.diffEngine,
      this.extensionUri
    );
  }

  /**
   * Accept all changes
   */
  public async acceptAll(): Promise<void> {
    if (!this.state.isTracking) return;

    for (const uri of this.snapshotManager.getTrackedUris()) {
      try {
        const document = await vscode.workspace.openTextDocument(
          vscode.Uri.parse(uri)
        );
        await this.snapshotManager.updateSnapshot(uri, document.getText());
      } catch {
        // File might be closed or deleted
      }
    }

    this.decorationProvider.refreshAll();
    vscode.window.showInformationMessage('All changes accepted');
  }

  /**
   * Reject all changes
   */
  public async rejectAll(): Promise<void> {
    if (!this.state.isTracking) return;

    for (const uri of this.snapshotManager.getTrackedUris()) {
      const snapshot = await this.snapshotManager.getSnapshot(uri);
      if (!snapshot) continue;

      try {
        const docUri = vscode.Uri.parse(uri);
        const document = await vscode.workspace.openTextDocument(docUri);

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        edit.replace(docUri, fullRange, snapshot.content);
        await vscode.workspace.applyEdit(edit);
      } catch {
        // File might be closed or deleted
      }
    }

    this.decorationProvider.refreshAll();
    vscode.window.showInformationMessage(
      'All changes rejected - reverted to snapshots'
    );
  }

  /**
   * Get current tracking state
   */
  public getState(): TrackerState {
    return { ...this.state };
  }

  /**
   * Check if tracking is active
   */
  public get isTracking(): boolean {
    return this.state.isTracking;
  }

  private updateStatusBar(): void {
    if (this.state.isTracking) {
      const fileCount = this.state.trackedFiles.size;
      this.statusBarItem.text = `$(eye) Tracking (${fileCount} files)`;
      this.statusBarItem.tooltip = 'Click to open Review Panel';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else {
      this.statusBarItem.text = '$(eye-closed) Not Tracking';
      this.statusBarItem.tooltip = 'Change tracking is off';
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
