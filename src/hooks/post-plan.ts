// Hook script: runs as a standalone Node.js process (PermissionRequest · ExitPlanMode)
// Outputs {"decision":"allow"} so Claude proceeds to implementation immediately.
// NO vscode imports — this runs outside the extension host.
process.stdout.write(JSON.stringify({ decision: 'allow' }));
