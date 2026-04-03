import * as vscode from 'vscode';
import { SnapshotManager } from './snapshotManager';
import { DiffEngine } from './diffEngine';
import { DecorationProvider } from './decorationProvider';
import { ChangeTracker } from './changeTracker';

let changeTracker: ChangeTracker | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Vibe Changes extension is now active');

  // Initialize components
  const snapshotManager = new SnapshotManager();
  const diffEngine = new DiffEngine();
  const decorationProvider = new DecorationProvider(snapshotManager, diffEngine);
  
  changeTracker = new ChangeTracker(
    snapshotManager,
    diffEngine,
    decorationProvider,
    context.extensionUri
  );

  // Register commands
  const commandDisposables = [
    vscode.commands.registerCommand('vibeChanges.startTracking', () => {
      changeTracker?.startTracking();
    }),

    vscode.commands.registerCommand('vibeChanges.stopTracking', () => {
      changeTracker?.stopTracking();
    }),

    vscode.commands.registerCommand('vibeChanges.openReview', () => {
      changeTracker?.openReviewPanel();
    }),

    vscode.commands.registerCommand('vibeChanges.acceptAll', () => {
      changeTracker?.acceptAll();
    }),

    vscode.commands.registerCommand('vibeChanges.rejectAll', () => {
      changeTracker?.rejectAll();
    }),
  ];

  // Add all disposables to context
  context.subscriptions.push(
    snapshotManager,
    decorationProvider,
    changeTracker,
    ...commandDisposables
  );

  // Show welcome message on first activation
  const welcomeShown = context.globalState.get('hasShownWelcome');
  if (!welcomeShown) {
    vscode.window.showInformationMessage(
      'Vibe Changes installed! Use Ctrl+Shift+T to start tracking.',
      'Start Tracking'
    ).then(selection => {
      if (selection === 'Start Tracking') {
        changeTracker?.startTracking();
      }
    });
    context.globalState.update('hasShownWelcome', true);
  }
}

export function deactivate() {
  changeTracker?.stopTracking();
  changeTracker = undefined;
}
