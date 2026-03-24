import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
  async?: boolean;
}

interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: {
    PostToolUse?: HookMatcher[];
    PermissionRequest?: HookMatcher[];
    [key: string]: HookMatcher[] | undefined;
  };
  [key: string]: unknown;
}

export function installHooks(extensionPath: string, workspaceRoot: string): void {
  const settingsPath = path.join(workspaceRoot, '.claude', 'settings.json');
  logger.info(`installHooks: updating ${settingsPath}`);

  let settings: ClaudeSettings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    logger.debug('installHooks: loaded existing settings');
  } catch {
    logger.warn('installHooks: settings file missing or invalid — starting fresh');
  }

  if (!settings.hooks) settings.hooks = {};

  const openPlanCmd = `node "${path.join(extensionPath, 'out', 'hooks', 'open-plan.js')}"`;
  const postPlanCmd = `node "${path.join(extensionPath, 'out', 'hooks', 'post-plan.js')}"`;

  // --- PostToolUse · Write ---
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
  let writeMatcher = settings.hooks.PostToolUse.find(m => m.matcher === 'Write');
  if (!writeMatcher) {
    writeMatcher = { matcher: 'Write', hooks: [] };
    settings.hooks.PostToolUse.push(writeMatcher);
  }
  if (!writeMatcher.hooks.some(h => h.command === openPlanCmd)) {
    writeMatcher.hooks.push({ type: 'command', command: openPlanCmd, timeout: 6, async: true });
    logger.debug('installHooks: added open-plan hook (PostToolUse/Write)');
  } else {
    logger.debug('installHooks: open-plan hook already present, skipping');
  }

  // --- PermissionRequest · ExitPlanMode ---
  if (!settings.hooks.PermissionRequest) settings.hooks.PermissionRequest = [];
  let exitMatcher = settings.hooks.PermissionRequest.find(m => m.matcher === 'ExitPlanMode');
  if (!exitMatcher) {
    exitMatcher = { matcher: 'ExitPlanMode', hooks: [] };
    settings.hooks.PermissionRequest.push(exitMatcher);
  }
  if (!exitMatcher.hooks.some(h => h.command === postPlanCmd)) {
    exitMatcher.hooks.push({ type: 'command', command: postPlanCmd, timeout: 5 });
    logger.debug('installHooks: added post-plan hook (PermissionRequest/ExitPlanMode)');
  } else {
    logger.debug('installHooks: post-plan hook already present, skipping');
  }

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 });
  logger.info('installHooks: settings written');
}
