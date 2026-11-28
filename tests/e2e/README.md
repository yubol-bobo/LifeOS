# Browser checks

Scripts that drive the real app in Chromium (Playwright) for things unit tests can't see:
IndexedDB in a real browser, the Settings UI, warnings.

```bash
npm run dev            # in one terminal
node tests/e2e/storage.cjs   # in another (LIFEOS_URL=http://localhost:5173/ by default)
```

Each prints `PASS` / `FAIL` per check and `ALL PASS` at the end. Screenshots go to `$SHOTS` (default: the temp folder).
Playwright isn't a project dependency; install it yourself (`npm i -g playwright && npx playwright install chromium`) if you don't have it.
