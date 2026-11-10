import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PATCHED_EXIT,
  UNPATCHED_EXIT,
  patchPrismaCliSource,
} from '../../scripts/patch-prisma-migrate-exit.mjs';

function runNode(
  file: string,
  timeout: number,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [file], { timeout }, (err) => {
      if (!err) {
        resolve({ code: 0, signal: null });
        return;
      }
      resolve({ code: err.code, signal: err.signal });
    });
    child.stdout?.resume();
    child.stderr?.resume();
  });
}

describe('patchPrismaCliSource', () => {
  it('rewrites the success path so the CLI exits', () => {
    const patched = patchPrismaCliSource(`prefix ${UNPATCHED_EXIT} suffix`);

    expect(patched.changed).toBe(true);
    expect(patched.source).toBe(`prefix ${PATCHED_EXIT} suffix`);
    expect(patchPrismaCliSource(patched.source)).toEqual({
      source: patched.source,
      changed: false,
    });
  });

  it('refuses a CLI build it does not recognize', () => {
    expect(() => patchPrismaCliSource('something else')).toThrow(/success-exit site/);
  });

  it('exits on success while an open timer would otherwise keep the process alive', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'prisma-exit-'));
    const hanging = path.join(dir, 'hang.js');
    const exiting = path.join(dir, 'exit.js');
    const hold = 'setInterval(() => {}, 1000);\n';
    writeFileSync(
      hanging,
      `${hold}Promise.resolve(0).then((e) => { e !== 0 && process.exit(e); });\n`,
    );
    writeFileSync(exiting, `${hold}Promise.resolve(0).then((e) => { process.exit(e ?? 0); });\n`);

    const hung = await runNode(hanging, 400);
    const exited = await runNode(exiting, 2_000);

    expect(hung.signal).toBe('SIGTERM');
    expect(exited).toEqual({ code: 0, signal: null });
  });
});
