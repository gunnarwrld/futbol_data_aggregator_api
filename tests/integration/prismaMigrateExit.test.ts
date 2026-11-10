import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { patchInstalledPrismaCli } from '../../scripts/patch-prisma-migrate-exit.mjs';

describe('prisma migrate deploy', () => {
  it('exits after success even when another handle keeps the event loop alive', async () => {
    patchInstalledPrismaCli();
    const hold = path.join(mkdtempSync(path.join(tmpdir(), 'prisma-hold-')), 'hold.cjs');
    writeFileSync(hold, 'setInterval(() => {}, 1000);\n');

    const result = await new Promise<{ code: number; stdout: string; stderr: string }>(
      (resolve, reject) => {
        execFile(
          process.execPath,
          [
            '--require',
            hold,
            path.resolve('node_modules/prisma/build/index.js'),
            'migrate',
            'deploy',
          ],
          {
            timeout: 20_000,
            maxBuffer: 10 * 1024 * 1024,
            env: process.env,
          },
          (err, stdout, stderr) => {
            if (err) {
              reject(err instanceof Error ? err : new Error('prisma migrate deploy failed'));
              return;
            }
            resolve({ code: 0, stdout, stderr });
          },
        );
      },
    );

    expect(result.code).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /No pending migrations to apply|All migrations have been successfully applied/,
    );
  });
});
