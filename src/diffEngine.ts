import { Hunk, LineChange, FileChanges } from './types';
import * as crypto from 'crypto';

interface DiffLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export class DiffEngine {
  /**
   * Compute diff between old and new content
   */
  public computeDiff(
    oldContent: string,
    newContent: string,
    fileUri: string,
    fileName: string
  ): FileChanges {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const diffResult = this.myersDiff(oldLines, newLines);
    const hunks = this.createHunks(diffResult, fileUri);
    
    let totalAdded = 0;
    let totalRemoved = 0;
    let totalModified = 0;

    hunks.forEach(hunk => {
      hunk.changes.forEach(change => {
        if (change.type === 'added') totalAdded++;
        else if (change.type === 'removed') totalRemoved++;
        else if (change.type === 'modified') totalModified++;
      });
    });

    return {
      uri: fileUri,
      fileName,
      hunks,
      totalAdded,
      totalRemoved,
      totalModified,
    };
  }

  /**
   * Simple Myers diff implementation
   */
  private myersDiff(oldLines: string[], newLines: string[]): DiffLine[] {
    const result: DiffLine[] = [];
    const oldLen = oldLines.length;
    const newLen = newLines.length;
    
    // LCS-based approach for simplicity
    const lcs = this.longestCommonSubsequence(oldLines, newLines);
    
    let oldIdx = 0;
    let newIdx = 0;
    let lcsIdx = 0;

    while (oldIdx < oldLen || newIdx < newLen) {
      if (lcsIdx < lcs.length && oldIdx < oldLen && newIdx < newLen && 
          oldLines[oldIdx] === lcs[lcsIdx] && newLines[newIdx] === lcs[lcsIdx]) {
        // Context line (unchanged)
        result.push({
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else if (newIdx < newLen && (lcsIdx >= lcs.length || newLines[newIdx] !== lcs[lcsIdx])) {
        // Added line
        result.push({
          type: 'added',
          content: newLines[newIdx],
          newLineNum: newIdx + 1,
        });
        newIdx++;
      } else if (oldIdx < oldLen && (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
        // Removed line
        result.push({
          type: 'removed',
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
        });
        oldIdx++;
      }
    }

    return result;
  }

  /**
   * Compute Longest Common Subsequence
   */
  private longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
    const m = arr1.length;
    const n = arr2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find LCS
    const result: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (arr1[i - 1] === arr2[j - 1]) {
        result.unshift(arr1[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return result;
  }

  /**
   * Group diff lines into hunks
   */
  private createHunks(diffLines: DiffLine[], fileUri: string): Hunk[] {
    const hunks: Hunk[] = [];
    let currentHunk: Hunk | null = null;
    let contextBefore: DiffLine[] = [];
    const CONTEXT_LINES = 3;

    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];

      if (line.type === 'context') {
        if (currentHunk) {
          // Add context to current hunk
          currentHunk.changes.push({
            type: 'modified', // Using modified for context in display
            lineNumber: line.newLineNum!,
            oldContent: line.content,
            newContent: line.content,
          });
          currentHunk.endLine = line.newLineNum!;
          currentHunk.oldEndLine = line.oldLineNum!;
          
          // Check if we should close the hunk (more than CONTEXT_LINES of context ahead)
          let contextAhead = 0;
          for (let j = i + 1; j < diffLines.length && diffLines[j].type === 'context'; j++) {
            contextAhead++;
          }
          
          if (contextAhead > CONTEXT_LINES * 2) {
            // Trim trailing context and finalize hunk
            const trimCount = Math.max(0, contextAhead - CONTEXT_LINES);
            hunks.push(this.finalizeHunk(currentHunk));
            currentHunk = null;
            contextBefore = [];
          }
        } else {
          // Store context for potential new hunk
          contextBefore.push(line);
          if (contextBefore.length > CONTEXT_LINES) {
            contextBefore.shift();
          }
        }
      } else {
        // Added or removed line
        if (!currentHunk) {
          // Start new hunk
          currentHunk = {
            id: this.generateHunkId(),
            fileUri,
            startLine: line.newLineNum || line.oldLineNum || 1,
            endLine: line.newLineNum || line.oldLineNum || 1,
            oldStartLine: contextBefore.length > 0 ? contextBefore[0].oldLineNum! : (line.oldLineNum || 1),
            oldEndLine: line.oldLineNum || 1,
            changes: [],
            oldContent: '',
            newContent: '',
          };

          // Add leading context
          contextBefore.forEach(ctx => {
            currentHunk!.changes.push({
              type: 'modified',
              lineNumber: ctx.newLineNum!,
              oldContent: ctx.content,
              newContent: ctx.content,
            });
          });
          
          if (contextBefore.length > 0) {
            currentHunk.startLine = contextBefore[0].newLineNum!;
          }
        }

        const change: LineChange = {
          type: line.type === 'added' ? 'added' : 'removed',
          lineNumber: line.newLineNum || line.oldLineNum || currentHunk.endLine,
        };

        if (line.type === 'added') {
          change.newContent = line.content;
          currentHunk.endLine = line.newLineNum!;
        } else {
          change.oldContent = line.content;
          currentHunk.oldEndLine = line.oldLineNum!;
        }

        currentHunk.changes.push(change);
        contextBefore = [];
      }
    }

    // Finalize last hunk
    if (currentHunk) {
      hunks.push(this.finalizeHunk(currentHunk));
    }

    return hunks;
  }

  private finalizeHunk(hunk: Hunk): Hunk {
    // Build old and new content strings
    const oldLines: string[] = [];
    const newLines: string[] = [];

    hunk.changes.forEach(change => {
      if (change.type === 'removed') {
        oldLines.push(change.oldContent || '');
      } else if (change.type === 'added') {
        newLines.push(change.newContent || '');
      } else {
        // Context/modified - same in both
        oldLines.push(change.oldContent || change.newContent || '');
        newLines.push(change.newContent || change.oldContent || '');
      }
    });

    return {
      ...hunk,
      oldContent: oldLines.join('\n'),
      newContent: newLines.join('\n'),
    };
  }

  private generateHunkId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get line numbers that were added
   */
  public getAddedLineNumbers(oldContent: string, newContent: string): number[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff = this.myersDiff(oldLines, newLines);
    
    return diff
      .filter(d => d.type === 'added' && d.newLineNum !== undefined)
      .map(d => d.newLineNum!);
  }

  /**
   * Get line numbers that were removed (returns old line numbers)
   */
  public getRemovedLineNumbers(oldContent: string, newContent: string): number[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff = this.myersDiff(oldLines, newLines);
    
    return diff
      .filter(d => d.type === 'removed' && d.oldLineNum !== undefined)
      .map(d => d.oldLineNum!);
  }

  /**
   * Get ranges of modified lines for decoration
   */
  public getChangeRanges(oldContent: string, newContent: string): {
    added: number[];
    removed: { afterLine: number }[];
  } {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff = this.myersDiff(oldLines, newLines);
    
    const added: number[] = [];
    const removed: { afterLine: number }[] = [];
    
    let lastNewLine = 0;
    
    diff.forEach(d => {
      if (d.type === 'added' && d.newLineNum !== undefined) {
        added.push(d.newLineNum);
        lastNewLine = d.newLineNum;
      } else if (d.type === 'removed') {
        removed.push({ afterLine: lastNewLine });
      } else if (d.newLineNum !== undefined) {
        lastNewLine = d.newLineNum;
      }
    });
    
    return { added, removed };
  }
}
