# Browser checks

Scripts that drive the real app in Chromium (Playwright) for things unit tests can't see:
IndexedDB in a real browser, the Settings UI, warnings.

```bash
npm run dev            # in one terminal
node tests/e2e/storage.cjs   # in another (LIFEOS_URL=http://localhost:5173/ by default)
```

Scripts: `storage.cjs` (IndexedDB, backups, save warnings), `tree.cjs` (task tree), `ritual.cjs` (morning / evening, quick capture), `smoke.cjs` (opens every app; run it against `npx vite build && npx vite preview --port 5192` with `LIFEOS_URL=http://localhost:5192/`).

Each prints `PASS` / `FAIL` per check and `ALL PASS` at the end. Screenshots go to `$SHOTS` (default: the temp folder).
Playwright isn't a project dependency; install it yourself (`npm i -g playwright && npx playwright install chromium`) if you don't have it.

`tests/e2e/run.sh <script.cjs>...` runs scripts and fails unless each exits 0, prints no `FAIL` line and prints `ALL PASS`.
CI (`browser` job in `.github/workflows/ci.yml`, pull requests only) runs `smoke.cjs` against `vite preview` on :5192 and
`storage.cjs`, `tree.cjs`, `ritual.cjs` against the dev server on :5173 (they import `/src/store/store.ts` from the page).
