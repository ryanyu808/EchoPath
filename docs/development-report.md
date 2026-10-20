# EchoPath PRD alignment development report

## Delivery status

The existing EchoPath application has been enhanced locally for R1–R8. Branding, the stack, landing page, cards, navigation, filters, details, related experiences, roadmaps, saved progress, printing, feedback and responsive design remain. R9 (standalone Q&A) and R10 (peer routing) remain deferred as specified by the PRD.

The full workflow is functional locally in explicitly labeled demo mode. Supabase, OpenAI and email integrations are implemented and locally tested with embedded PostgreSQL or mocked transports. No hosted database, live AI API, email sender or production scheduler was connected or exercised. No real email was sent. No service was purchased or paid resource created. No commit, push or deployment was performed.

## R1–R10 compliance matrix

| ID  | Priority | Local implementation                                                                                                                                                 | External verification or limitation                                                                                                                                                |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | P0       | Guided four-step intake; reduced required answers; optional outcomes/culture/detail; draft resume; preview; consent; anonymous flow timing                           | Human five-minute target remains unverified. Timing can include idle time across resumed drafts.                                                                                   |
| R2  | P0       | Private enrollment, expected end date, eligibility, previews, scoped opt-out, retries, leases, idempotency, completion suppression, demo clock and no-email dispatch | Real email requires an authorized compatible sender and scheduled authenticated dispatcher; provider acceptance is not inbox delivery.                                             |
| R3  | P0       | Validated extraction; normalized skills/tools/categories/industry; original retention; extracted skills used by search and facets                                    | Rules/demo processing tested locally; actual OpenAI calls unverified.                                                                                                              |
| R4  | P0       | Skills-first filter; cross-record insight panel; distinct-record frequencies; sourced responsibilities/challenges/advice, differences and evidence limitations       | AI selection uses approved records and rejects unsupported excerpts; live API unverified. Local output is deterministic and labeled.                                               |
| R5  | P0       | Raw originals/private insights inaccessible to public readers; reviewed candidates; approved whitelisted anonymous projections; no public capability/contact fields  | Embedded PostgreSQL permission tests passed. Hosted PostgREST smoke tests and human moderation remain required. Heuristics cannot guarantee detection of every identifying detail. |
| R6  | P1       | Hashed capability tokens; own-record management; revision checks; consent changes; private history; editing invalidation and withdrawal                              | Private links must be retained. Trusted legacy recovery is available; downloaded/cached copies cannot be recalled.                                                                 |
| R7  | P1       | Contact/name/token redaction; targeted financial/count/metric/client warnings; editable public wording and explicit review                                           | Exact figures are flagged for review rather than universally removed; contributor and moderator must assess confidentiality.                                                       |
| R8  | P1       | Contextual Yes/No feedback and private comments on details/synthesis; target references; actual local rates; existing overall feedback preserved                     | Shared-server feedback is private and reviewed through trusted database administration, not a public dashboard.                                                                    |
| R9  | P2       | Deferred                                                                                                                                                             | No standalone chatbot or Q&A endpoint added.                                                                                                                                       |
| R10 | P2       | Deferred / outside MVP                                                                                                                                               | No peer contact directory or routing added.                                                                                                                                        |

## Changes made

The second SQL migration removes public access to original contributions and insights without deleting existing data. New private control/version tables support scoped management; an approved-public projection is the sole seeker data source. SQL functions atomically create, edit, withdraw and approve records with ownership/revision checks. An existing legacy UUID cannot be claimed through intake, including records with unusual future timestamps. Old records are held privately until renewed review.

AI receives only reviewed anonymized candidates or approved public projections. Private/unreviewed originals are not sent to the model. Structured extraction adds roles and industries, validates source-supported tags and preserves original wording privately. Search now uses extracted tags and canonical aliases. Cross-record synthesis verifies publication and revision before/after generation, computes counts outside the model, checks cited passages against actual sources, and falls back honestly when the provider is absent or output is invalid. Roadmaps use the same public boundary.

Reminder contacts are separate and private. Atomic leased claims, bounded retries, provider idempotency, a bounded retry window, signing-key checks and scoped unsubscribe/completion links prevent routine duplicate or unauthorized dispatch. The complete local simulation covers eligibility, preview, failure/retry and suppression, with no-email labels. The optional Vault-backed scheduler example is not automatically applied.

Frontend additions use existing cards, colors and spacing. The contribution flow collects essential answers and optional context, autosaves a browser-local draft, shows the exact public version for editing/review, permits private storage and returns a private management link. Contextual helpfulness and anonymous flow timing/search counts support future validation. Team-reported survey findings and their n=8 caveat are preserved without claiming that product success targets were reached.

## Files created or modified

- Existing app integration: `src/App.tsx`, `src/pages.tsx`, `src/store.ts`, `src/styles.css`.
- New UI: `src/contribution.tsx`, `src/enhancements.tsx`.
- Shared logic: `supabase/functions/_shared/domain.ts`, new `alignment.ts`.
- Backend: `supabase/functions/echopath/index.ts`, new `handler.ts` and `ai.ts`, updated `index_test.ts`.
- Database: new `supabase/migrations/202610200001_prd_alignment.sql` and optional `supabase/reminder-schedule.example.sql`. The original migration is preserved.
- Tests: updated existing domain/store/database/live-adapter/browser tests; added `tests/alignment.test.ts` and `tests/e2e/alignment.spec.ts`. Existing component/config tests remain.
- Setup/docs: `.env.example`, `README.md`, `docs/architecture.md`, `mvp-checklist.md`, `demo-script.md`, `competition-evidence.md`, `user-testing.md`, and this report.

## Executed checks

| Check                                          | Result                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| TypeScript                                     | Passed                                                               |
| ESLint                                         | Passed                                                               |
| Vitest unit/component/adapter/PostgreSQL tests | 43 passed across 7 files                                             |
| Deno Edge Function type check                  | Passed                                                               |
| Deno mocked HTTP integration tests             | 20 passed                                                            |
| Playwright desktop/mobile Chromium tests       | 14 passed, including original journeys, new workflows and axe checks |
| Production build                               | Passed                                                               |

The PostgreSQL tests execute both actual migrations, omitting only pgcrypto extension installation because embedded PostgreSQL provides core UUID generation. They verify private/public grants for anon and authenticated roles, lack of public mutation/administrative RPC access, scoped tokens, duplicates, version conflicts, publication invalidation, original history, reminder leasing/retries/suppression, exhausted claims and rate limits.

HTTP tests mock all external transports and cover original-save ordering, failed inserts, failed/invalid AI output, strict structured formats, candidate-only AI inputs, private/unreviewed AI suppression, moderator authorization, source revalidation after withdrawal, contextual private feedback, reminder hash-only storage, absent provider behavior, stable idempotency keys, signing-key mismatch and bounded UTF-8 bodies. They are not live integration tests.

Browser tests cover search and filters, all fictional detail routes, roadmaps/progress, contribution validation and public review, draft reload, anonymous publication, editing/withdrawal, synthesis counts and references, contextual/global feedback, reminder retry/duplicate/completion simulation, responsive bounds and automated accessibility checks. Automated tests are not student research. Safari and manual assistive-technology tests remain outstanding.

## Migration and configuration

Apply `202610190001_initial.sql` then `202610200001_prd_alignment.sql` in the owner's Supabase project after backup. If the first migration is already applied, apply only the new migration. Configure public frontend URL/key, deploy the updated Edge Function only after separate authorization, and set the exact `ALLOWED_ORIGIN`. Do not merely change a raw row to published: use the trusted approval workflow described in README.

Optional server-only AI configuration: `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_ENABLED=true`.

Optional server-only reminder configuration: `EMAIL_API_KEY`, `EMAIL_FROM`, compatible `EMAIL_PROVIDER_URL`, `REMINDER_CRON_SECRET`, and stable `REMINDER_SIGNING_SECRET`. Configure the optional Vault-backed cron example manually. No scheduler exists merely because the example file is present. Verify recipient authorization, provider quotas/idempotency and acceptance/delivery behavior before enabling public use.

## Exact local commands

With Node installed:

```sh
npm ci
npm run dev
```

In this workspace without Node on PATH:

```powershell
cd C:\Users\ryany\EchoPath
$env:PATH="$PWD\.tools\node-v24.22.0-win-x64;$env:PATH"
npm.cmd run dev
```

Open http://127.0.0.1:5173. Use README for all test commands and full setup. No extra dependency or browser installation was required for this enhancement.

## Remaining limits and competition next steps

- Verify the real hosted database permissions, moderation/recovery, extraction, synthesis and roadmap paths with owner-provided credentials.
- Configure and test a controlled email plus scheduler; assess delivery webhooks, double opt-in, anti-abuse controls and retention before a broad launch.
- Keep management links private. Private originals/history remain after withdrawal; trusted deletion is a separate operation.
- Automatic redaction is heuristic. Human review remains essential, especially for indirect identifiers and confidential client context.
- Existing browser snapshots, downloads and saved roadmaps cannot be recalled. Refresh removes withdrawn sources from an open library.
- Search still loads all approved records; pagination is a future scale improvement. Synthesis is bounded to 20 sources and uses conservative, verifiable excerpts rather than unsupported narrative.
- Analytics are browser-local and explicitly labeled by mode. No centralized adoption or research outcome is claimed.
- Obtain actual consented seed debriefs and test with 2–3 students. Measure the proposed success criteria and record a genuine feedback-driven iteration.
- Keep Q&A and peer routing deferred. Obtain separate authorization before committing, pushing or deploying.
