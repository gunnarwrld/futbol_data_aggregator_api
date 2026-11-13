import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('admin provisioning artifacts', () => {
  it('defaults new and legacy keys to non-admin without revoking them', () => {
    const sql = readFileSync(
      new URL(
        '../../prisma/migrations/20261113010000_add_api_key_is_admin/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(sql).toMatch(
      /ALTER TABLE "ApiKey" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;/,
    );
    expect(sql).toMatch(/UPDATE "ApiKey" SET "isAdmin" = false;/);
    expect(sql).not.toMatch(/DELETE|DROP|isActive/i);
  });

  it('uses the compiled CLI available in production', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(pkg.scripts['admin:create-key']).toBe('node dist/cli/createAdminKey.js');
  });
});
