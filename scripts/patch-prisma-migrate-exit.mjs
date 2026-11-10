import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Prisma 7.8's CLI only calls process.exit when the command returns non-zero.
 * After `migrate deploy` prints success, any open handle (telemetry, a TLS
 * socket, the schema engine) keeps the process alive. Production starts the
 * server with `prisma migrate deploy && node`, so that hang never reaches listen.
 */
export const UNPATCHED_EXIT =
  'eval("require.main === module")&&iir().then(e=>{e!==0&&process.exit(e)})';

export const PATCHED_EXIT = 'eval("require.main === module")&&iir().then(e=>{process.exit(e??0)})';

export function patchPrismaCliSource(source) {
  const unpatchedCount = countOccurrences(source, UNPATCHED_EXIT);
  const patchedCount = countOccurrences(source, PATCHED_EXIT);

  if (unpatchedCount === 0 && patchedCount === 1) {
    return { source, changed: false };
  }

  if (unpatchedCount !== 1 || patchedCount !== 0) {
    throw new Error(
      `Expected one unpatched Prisma CLI success-exit site, found ${unpatchedCount} unpatched and ${patchedCount} patched`,
    );
  }

  return {
    source: source.replace(UNPATCHED_EXIT, PATCHED_EXIT),
    changed: true,
  };
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function prismaCliPath(root = process.cwd()) {
  return path.join(root, 'node_modules/prisma/build/index.js');
}

export function patchInstalledPrismaCli(root = process.cwd()) {
  const target = prismaCliPath(root);
  if (!existsSync(target)) {
    return { patched: false, missing: true, target };
  }

  const current = readFileSync(target, 'utf8');
  const next = patchPrismaCliSource(current);
  if (next.changed) {
    writeFileSync(target, next.source);
  }
  return { patched: true, changed: next.changed, missing: false, target };
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isDirectRun) {
  const required = process.argv.includes('--required');
  try {
    const result = patchInstalledPrismaCli();
    if (result.missing) {
      const message = `Prisma CLI not found at ${result.target}`;
      if (required) {
        console.error(message);
        process.exit(1);
      }
      console.log(`${message}; skip`);
      process.exit(0);
    }
    console.log(result.changed ? `Patched ${result.target}` : `Already patched ${result.target}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
