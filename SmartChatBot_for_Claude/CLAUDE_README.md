# How to use this package with Claude

This is a cleaned snapshot of the project for code review.

## What was excluded
- VCS folders (.git), IDE settings (.idea/.vscode), caches
- Build artifacts (dist/build/.next)
- Dependencies (node_modules)
- Logs, temporary and very large binary files
- Secrets (.env files) — please provide .env.example instead

## Suggested first prompt
> Analyze the project structure: entry points, modules, and key dependencies. List potential technical debt and quick fixes (linting, types, tests, architecture). Ask clarifying questions about missing env vars, DB schemas, and run scripts.

## Notes
- If some assets are required for the app to run, include small samples only.
