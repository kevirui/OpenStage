import fs from 'fs';
import path from 'path';

function findRepoRoot(startDir: string): string {
  let dir = startDir;

  while (true) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
          workspaces?: unknown;
        };
        if (pkg.workspaces) {
          return dir;
        }
      } catch {
        // ignore unreadable package.json and keep walking up
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}

export const repoRoot = findRepoRoot(__dirname);

export function resolveFromRepoRoot(relativeOrAbsolutePath: string): string {
  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(repoRoot, relativeOrAbsolutePath);
}

export const rootEnvPath = path.join(repoRoot, '.env');
