import { execFile } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function runCreateKey(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      path.resolve('node_modules/.bin/tsx'),
      [path.resolve('scripts/create-api-key.ts'), ...args],
      {
        timeout: 15_000,
        env: {
          ...process.env,
          NODE_ENV: 'development',
        },
      },
      (err, stdout, stderr) => {
        if (!err) {
          resolve({ code: 0, stdout, stderr });
          return;
        }
        if (typeof err.code === 'number') {
          resolve({ code: err.code, stdout, stderr });
          return;
        }
        reject(err instanceof Error ? err : new Error('admin:create-key failed to exit'));
      },
    );
  });
}

describe('admin:create-key', () => {
  it('prints one raw key and exits while the dev logger is running', async () => {
    const result = await runCreateKey(['Bootstrap']);

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^fda_[0-9a-f]{64}$/m);
  });

  it('exits with usage when the name is missing', async () => {
    const result = await runCreateKey([]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage:');
  });
});
