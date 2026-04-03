import * as vscode from 'vscode';
import { FileSnapshot } from './types';

export class SnapshotManager {
  private snapshots: Map<string, FileSnapshot> = new Map();
  private _onSnapshotChanged = new vscode.EventEmitter<string>();
  public readonly onSnapshotChanged = this._onSnapshotChanged.event;

  /**
   * Take a snapshot of a single document
   */
  public takeSnapshot(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    const snapshot: FileSnapshot = {
      uri,
      content: document.getText(),
      timestamp: Date.now(),
      languageId: document.languageId,
    };
    this.snapshots.set(uri, snapshot);
    this._onSnapshotChanged.fire(uri);
  }

  /**
   * Take snapshots of all currently open documents
   */
  public takeSnapshotOfAllOpen(): void {
    vscode.workspace.textDocuments.forEach((doc) => {
      // Skip untitled documents and non-file schemes
      if (doc.uri.scheme === 'file' && !doc.isUntitled) {
        this.takeSnapshot(doc);
      }
    });
  }

  /**
   * Get snapshot for a specific file
   */
  public getSnapshot(uri: string): FileSnapshot | undefined {
    return this.snapshots.get(uri);
  }

  /**
   * Check if a snapshot exists for a file
   */
  public hasSnapshot(uri: string): boolean {
    return this.snapshots.has(uri);
  }

  /**
   * Get all snapshots
   */
  public getAllSnapshots(): Map<string, FileSnapshot> {
    return new Map(this.snapshots);
  }

  /**
   * Get URIs of all tracked files
   */
  public getTrackedUris(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Update snapshot with current content (after accepting changes)
   */
  public updateSnapshot(uri: string, newContent: string): void {
    const existing = this.snapshots.get(uri);
    if (existing) {
      this.snapshots.set(uri, {
        ...existing,
        content: newContent,
        timestamp: Date.now(),
      });
      this._onSnapshotChanged.fire(uri);
    }
  }

  /**
   * Remove snapshot for a file
   */
  public removeSnapshot(uri: string): void {
    this.snapshots.delete(uri);
  }

  /**
   * Clear all snapshots
   */
  public clearAll(): void {
    this.snapshots.clear();
  }

  /**
   * Get snapshot count
   */
  public get count(): number {
    return this.snapshots.size;
  }

  public dispose(): void {
    this._onSnapshotChanged.dispose();
    this.clearAll();
  }
}
