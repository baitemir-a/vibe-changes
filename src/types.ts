export interface FileSnapshot {
  uri: string;
  content: string;
  timestamp: number;
  languageId: string;
}

export interface LineChange {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  oldContent?: string;
  newContent?: string;
}

export interface Hunk {
  id: string;
  fileUri: string;
  startLine: number;
  endLine: number;
  oldStartLine: number;
  oldEndLine: number;
  changes: LineChange[];
  oldContent: string;
  newContent: string;
}

export interface FileChanges {
  uri: string;
  fileName: string;
  hunks: Hunk[];
  totalAdded: number;
  totalRemoved: number;
  totalModified: number;
}

export interface TrackerState {
  isTracking: boolean;
  startTime: number | null;
  trackedFiles: Set<string>;
}

export interface ReviewAction {
  type: 'accept' | 'reject';
  hunkId: string;
  fileUri: string;
}

export interface WebviewMessage {
  command: string;
  payload?: any;
}
