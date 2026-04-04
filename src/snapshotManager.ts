import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileSnapshot } from './types';

interface SnapshotMeta {
  uri: string;
  tempPath: string;
  timestamp: number;
  languageId: string;
}

export class SnapshotManager {
  private snapshots: Map<string, SnapshotMeta> = new Map();
  private tempDir: string;
  private _onSnapshotChanged = new vscode.EventEmitter<string>();
  public readonly onSnapshotChanged = this._onSnapshotChanged.event;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), `vibe-changes-${crypto.randomBytes(4).toString('hex')}`);
    vscode.workspace.fs.createDirectory(vscode.Uri.file(this.tempDir));
  }

  private getTempPath(uri: string): string {
    const hash = crypto.createHash('md5').update(uri).digest('hex');
    return path.join(this.tempDir, hash);
  }

  private async writeTemp(tempPath: string, content: string): Promise<void> {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(tempPath),
      Buffer.from(content, 'utf-8')
    );
  }

  private async readTemp(tempPath: string): Promise<string> {
    const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(tempPath));
    return Buffer.from(raw).toString('utf-8');
  }

  /**
   * Take a snapshot of a single document (saves to disk)
   */
  public async takeSnapshot(document: vscode.TextDocument): Promise<void> {
    const uri = document.uri.toString();
    const tempPath = this.getTempPath(uri);
    await this.writeTemp(tempPath, document.getText());
    this.snapshots.set(uri, {
      uri,
      tempPath,
      timestamp: Date.now(),
      languageId: document.languageId,
    });
    this._onSnapshotChanged.fire(uri);
  }

  /**
   * Take snapshots of all currently open documents
   */
  public async takeSnapshotOfAllOpen(): Promise<void> {
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme === 'file' && !doc.isUntitled) {
        await this.takeSnapshot(doc);
      }
    }
  }

  /**
   * Create a snapshot from raw content (saves to disk, not memory)
   */
  public async takeSnapshotFromContent(uri: string, content: string, languageId: string): Promise<void> {
    const tempPath = this.getTempPath(uri);
    await this.writeTemp(tempPath, content);
    this.snapshots.set(uri, {
      uri,
      tempPath,
      timestamp: Date.now(),
      languageId,
    });
    this._onSnapshotChanged.fire(uri);
  }

  /**
   * Snapshot all files in the workspace by copying to temp dir
   */
  public async snapshotAllWorkspaceFiles(): Promise<number> {
    const exclude = '{**/node_modules/**,**/.git/**,**/.vscode/**,**/dist/**,**/out/**,**/.next/**,**/.nuxt/**,**/build/**,**/.cache/**,**/coverage/**,**/__pycache__/**,**/*.lock,**/package-lock.json,**/yarn.lock,**/pnpm-lock.yaml,**/*.png,**/*.jpg,**/*.jpeg,**/*.gif,**/*.ico,**/*.svg,**/*.webp,**/*.bmp,**/*.woff,**/*.woff2,**/*.ttf,**/*.eot,**/*.otf,**/*.mp3,**/*.mp4,**/*.avi,**/*.mov,**/*.zip,**/*.tar,**/*.gz,**/*.rar,**/*.7z,**/*.exe,**/*.dll,**/*.so,**/*.dylib,**/*.bin,**/*.pdf,**/*.map,**/*.pack,**/*.idx,**/*.wasm,**/*.pyc,**/*.class,**/*.o,**/*.obj,**/*.lib,**/*.a,**/*.db,**/*.sqlite,**/*.min.js,**/*.min.css,**/*.chunk.js,**/*.bundle.js}';
    const files = await vscode.workspace.findFiles('**/*', exclude);
    const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
    let count = 0;

    for (const fileUri of files) {
      try {
        const stat = await vscode.workspace.fs.stat(fileUri);
        if (stat.size > MAX_FILE_SIZE) continue;

        // Copy file to temp dir instead of reading into memory
        const uri = fileUri.toString();
        const tempPath = this.getTempPath(uri);
        await vscode.workspace.fs.copy(fileUri, vscode.Uri.file(tempPath), { overwrite: true });

        const ext = fileUri.path.split('.').pop() ?? '';
        const languageId = EXTENSION_LANGUAGE_MAP[ext] ?? 'plaintext';
        this.snapshots.set(uri, {
          uri,
          tempPath,
          timestamp: Date.now(),
          languageId,
        });
        count++;
      } catch {
        // Skip files that can't be read
      }
    }
    return count;
  }

  /**
   * Get snapshot for a specific file (reads content from disk on demand)
   */
  public async getSnapshot(uri: string): Promise<FileSnapshot | undefined> {
    const meta = this.snapshots.get(uri);
    if (!meta) return undefined;
    try {
      const content = await this.readTemp(meta.tempPath);
      return {
        uri: meta.uri,
        content,
        timestamp: meta.timestamp,
        languageId: meta.languageId,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Get snapshot metadata without reading content from disk
   */
  public getSnapshotMeta(uri: string): SnapshotMeta | undefined {
    return this.snapshots.get(uri);
  }

  private static readonly EXCLUDED_PATHS = [
    '/node_modules/', '/.git/', '/.vscode/', '/dist/', '/out/',
    '/.next/', '/.nuxt/', '/build/', '/.cache/', '/coverage/',
    '/__pycache__/',
  ];

  private static readonly EXCLUDED_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp', 'bmp',
    'woff', 'woff2', 'ttf', 'eot', 'otf',
    'mp3', 'mp4', 'avi', 'mov',
    'zip', 'tar', 'gz', 'rar', '7z',
    'exe', 'dll', 'so', 'dylib', 'bin',
    'pdf', 'map', 'pack', 'idx', 'wasm',
    'pyc', 'class', 'o', 'obj', 'lib', 'a',
    'db', 'sqlite', 'lock',
  ]);

  /**
   * Check if a file URI should be tracked (not binary/excluded)
   */
  public shouldTrack(uri: string): boolean {
    const lowerUri = uri.toLowerCase();
    for (const excluded of SnapshotManager.EXCLUDED_PATHS) {
      if (lowerUri.includes(excluded)) return false;
    }
    const ext = uri.split('.').pop()?.toLowerCase() ?? '';
    if (SnapshotManager.EXCLUDED_EXTENSIONS.has(ext)) return false;
    if (lowerUri.endsWith('package-lock.json') || lowerUri.endsWith('yarn.lock') || lowerUri.endsWith('pnpm-lock.yaml')) return false;
    return true;
  }

  /**
   * Check if a snapshot exists for a file
   */
  public hasSnapshot(uri: string): boolean {
    return this.snapshots.has(uri);
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
  public async updateSnapshot(uri: string, newContent: string): Promise<void> {
    const meta = this.snapshots.get(uri);
    if (meta) {
      await this.writeTemp(meta.tempPath, newContent);
      meta.timestamp = Date.now();
      this._onSnapshotChanged.fire(uri);
    }
  }

  /**
   * Remove snapshot for a file
   */
  public removeSnapshot(uri: string): void {
    const meta = this.snapshots.get(uri);
    if (meta) {
      try { vscode.workspace.fs.delete(vscode.Uri.file(meta.tempPath)); } catch {}
    }
    this.snapshots.delete(uri);
  }

  /**
   * Clear all snapshots and clean up temp files
   */
  public clearAll(): void {
    this.snapshots.clear();
    try {
      vscode.workspace.fs.delete(vscode.Uri.file(this.tempDir), { recursive: true });
      // Recreate empty temp dir for potential reuse
      this.tempDir = path.join(os.tmpdir(), `vibe-changes-${crypto.randomBytes(4).toString('hex')}`);
      vscode.workspace.fs.createDirectory(vscode.Uri.file(this.tempDir));
    } catch {}
  }

  /**
   * Get snapshot count
   */
  public get count(): number {
    return this.snapshots.size;
  }

  public dispose(): void {
    this._onSnapshotChanged.dispose();
    try {
      vscode.workspace.fs.delete(vscode.Uri.file(this.tempDir), { recursive: true });
    } catch {}
    this.snapshots.clear();
  }
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescriptreact',
  js: 'javascript', jsx: 'javascriptreact',
  json: 'json', md: 'markdown', html: 'html',
  css: 'css', scss: 'scss', less: 'less',
  py: 'python', rs: 'rust', go: 'go',
  java: 'java', c: 'c', cpp: 'cpp', h: 'c',
  cs: 'csharp', rb: 'ruby', php: 'php',
  yaml: 'yaml', yml: 'yaml', xml: 'xml',
  sh: 'shellscript', bash: 'shellscript',
  sql: 'sql', svelte: 'svelte', vue: 'vue',
};
