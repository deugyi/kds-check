# RC beam tests

Run from the repository root with Node.js:

```sh
node --test tests/*.test.cjs
```

The UI smoke tests use a minimal DOM adapter and do not verify visual layout.

The construction-results UI tests use the pinned `linkedom` development dependency. Run `npm ci` before `npm test`. The deployed-site screenshot check remains separate from these tests.

`site-progress-db.sql` exercises real database authorization, approval, optimistic versions, bot deduplication and reminder routing inside one transaction, then rolls back every fixture. It expects an existing approved admin and viewer account.
