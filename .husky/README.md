# Pre-commit hooks (husky + lint-staged)

Runs automatically on `git commit`:

- ESLint --fix (max 20 warnings)
- Prettier --write

## Skip the hook (emergencies only)

```bash
git commit --no-verify
```

## Setup

Hooks are installed automatically via the `prepare` npm script.
If they don't trigger, run:

```bash
npm install
# or
npx husky
```
