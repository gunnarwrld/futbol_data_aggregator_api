/**
 * Commitlint Configuration
 *
 * Enforces Conventional Commits on every git commit.
 * Any commit that doesn't follow the `type: description` convention
 * will be automatically rejected by Husky's commit-msg hook.
 *
 * Valid types: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test
 *
 * @see https://www.conventionalcommits.org/
 * @see https://github.com/conventional-changelog/commitlint
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    /* ── Type ────────────────────────────────────────────── */
    'type-enum': [
      2,
      'always',
      [
        'build',    // Changes to build system or external dependencies
        'chore',    // Maintenance tasks, tooling, config
        'ci',       // CI/CD pipeline changes
        'docs',     // Documentation only
        'feat',     // New feature
        'fix',      // Bug fix
        'perf',     // Performance improvement
        'refactor', // Code restructuring (no behavior change)
        'revert',   // Revert a previous commit
        'style',    // Code style (formatting, whitespace)
        'test',     // Adding or updating tests
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],

    /* ── Subject ─────────────────────────────────────────── */
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 100],

    /* ── Header ──────────────────────────────────────────── */
    'header-max-length': [2, 'always', 120],

    /* ── Body ────────────────────────────────────────────── */
    'body-max-line-length': [1, 'always', 200],
  },
};
