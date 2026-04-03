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
        if (this.state.isTracking && doc.uri.scheme === 'file') {
          this.snapshotManager.takeSnapshot(doc);
          this.state.trackedFiles.add(doc.uri.toString());
        }
      })
    );

    // Listen for documents being saved
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(doc => {
        if (this.state.isTracking) {
          this.decorationProvider.updateDecorations(
            vscode.window.activeTextEditor!
          );
        }
      })
    );
  }

  /**
   * Start tracking changes
   */
  public startTracking(): void {
    if (this.state.isTracking) {
      vscode.window.showInformationMessage('Already tracking changes');
      return;
    }

    // Take snapshot of all open documents
    this.snapshotManager.takeSnapshotOfAllOpen();
    
    // Track URIs
    vscode.workspace.textDocuments.forEach(doc => {
      if (doc.uri.scheme === 'file' && !doc.isUntitled) {
        this.state.trackedFiles.add(doc.uri.toString());
      }
    });

    // Activate decorations
    this.decorationProvider.activate();

    this.state.isTracking = true;
    this.state.startTime = Date.now();
    
    this.updateStatusBar();
    vscode.window.showInformationMessage(
      `Tracking started. Monitoring ${this.state.trackedFiles.size} file(s).`
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
      vscode.window.showWarningMessage(
        'Not currently tracking changes. Start tracking first.',
        action
      ).then(selection => {
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
  public acceptAll(): void {
    if (!this.state.isTracking) return;

    this.snapshotManager.getTrackedUris().forEach(async uri => {
      try {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
        this.snapshotManager.updateSnapshot(uri, document.getText());
      } catch (e) {
        // File might be closed or deleted
      }
    });

    this.decorationProvider.refreshAll();
    vscode.window.showInformationMessage('All changes accepted');
  }

  /**
   * Reject all changes
   */
  public async rejectAll(): Promise<void> {
    if (!this.state.isTracking) return;

    for (const uri of this.snapshotManager.getTrackedUris()) {
      const snapshot = this.snapshotManager.getSnapshot(uri);
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
      } catch (e) {
        // File might be closed or deleted
      }
    }

    this.decorationProvider.refreshAll();
    vscode.window.showInformationMessage('All changes rejected - reverted to snapshots');
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
