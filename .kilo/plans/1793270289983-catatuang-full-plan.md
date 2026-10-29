# CatatUang Full Remediation & Feature Plan

## Goal
Fix all listed bugs and deliver requested features in one coordinated implementation.

## Scope (ordered)
1. Updater: compare GitHub release tag to APP_VERSION; use Exsors-Code/catat-uang-apk default.
2. Notification parsing: use notification timestamp for transaction date; restrict packages to banks/e-wallets; avoid salary/balance as amount; top-up not income.
3. Duplicate prevention: check parsed item against detected and saved tx/inc.
4. Auto-save: keep confirmation mode default; only auto-save when enabled.
5. Restore backup: require confirmation; show last backup time.
6. Data storage: split IndexedDB stores (meta, tx, inc, detected, transfers, goals, photos) already present; migrate photos separately.
7. Wallets & transfers: wallet list management, balances, transfers not counted income/expense.
8. Income complete: date, wallet, editable.
9. Recurring transactions.
10. Search/filter and date navigation.
11. Budgets per category with warnings.
12. Custom categories with learning from corrections.
13. Undo after delete.
14. OCR reads date and merchant.
15. Security: PIN/biometric, privacy policy, disable Android auto backup, encrypted backup option.
16. UX: onboarding Android 13+, battery exemption guide, request notification permission.
17. Tests for parser; unify version; package-lock.

## Validation
- Run lint/typecheck if available; add parser unit tests.
- Manual test backup/restore, notifications, OCR.

## Risks
- Large refactor of app.js; need incremental commits.
</content>