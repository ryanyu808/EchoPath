# EchoPath

**Real experiences. Smarter next steps.** An independent student-developed experience knowledge bank for the USC Marshall MSBA community. Not an official USC service.

EchoPath preserves the original landing page, experience cards, filters, related experiences, roadmaps, progress, printing, feedback, and responsive design. The PRD alignment adds a short guided intake, private/public content separation, scoped contribution management, skills-first synthesis, reminders, and contextual helpfulness.

## Run locally

Node 22.12+ is required; dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Leave both public Supabase variables unset for demo mode. In this Windows workspace, if Node is not on PATH:

```powershell
cd C:\Users\ryany\EchoPath
$env:PATH="$PWD\.tools\node-v24.22.0-win-x64;$env:PATH"
npm.cmd run dev
```

No credentials are needed for the complete local demonstration. Partial/invalid Supabase settings show an error rather than silently switching to fictional data.

## What works in demo mode

- Ten clearly fictional sample records. They are never inserted into a live database or presented as verified alumni accounts.
- Four-step conversational intake with essential questions, optional outcomes/culture/detail, local draft autosave, public-version editing and preview, sensitive-information warnings, and publication consent. Five minutes is a target, not a verified result.
- Originals saved separately in browser-local private contribution records; anonymous public projections appear only after the explicit **Simulate approval & view insights** action.
- Private management links support review, editing, sharing changes and withdrawal. Editing invalidates publication and requires renewed approval. Keep the private link: tokens cannot be recovered from their hashes.
- Search and combined filters use normalized original and extracted tags. Aliases include Postgres/PostgreSQL, MS Excel/Microsoft Excel/Excel, and PowerBI/Power BI.
- **AI Insights Across Experiences** aggregates the actual matching approved records, with distinct-record counts, source links, excerpts, differences and insufficient-evidence messaging. Local output is labeled deterministic demo synthesis, not AI.
- Roadmaps retain their existing timelines, progress checkboxes and print/PDF option. Withdrawn or edited records cannot supply a newly generated roadmap.
- `/reminders` demonstrates enrollment, UTC eligibility, private preview, an adjustable simulation clock, failed-delivery retries, duplicate suppression, completion suppression, and opt-out. No email is sent in demo mode.
- Contextual Yes/No helpfulness and optional private comments for detail pages and synthesis results. Existing overall feedback remains available.
- Footer JSON export includes local events, feedback, contextual feedback and actual local helpfulness rates. Empty datasets have no fabricated rate.

Drafts and originals in local demo mode belong to this browser profile; they are not encrypted or shared with a server. Browser-local original records from the earlier MVP remain private. Recover them through **Manage contribution → Recover legacy demo contributions**, save the generated private link, then renew the public-version review. Do not clear site data until you have saved any management links you need.

## Stack

React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7, Lucide, Zod 4, Supabase, Deno Edge Functions and OpenAI Responses structured output. No vector database, standalone chatbot or replacement UI framework was added. Vitest, Testing Library, PGlite, Playwright and axe provide local verification.

## Database migration and persistent mode

**Apply both migrations in order.** Back up an existing database before applying changes. The alignment migration intentionally revokes public access to original experience and AI-insight tables. Old published records are retained privately and are NOT automatically republished without renewed review.

1. `supabase/migrations/202610190001_initial.sql`
2. `supabase/migrations/202610200001_prd_alignment.sql`

Use your own Supabase SQL editor, or link your project with the CLI and run `supabase db push`. No hosted migration or deployment was performed during local development.

Copy `.env.example` to `.env.local` and set only public frontend values:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

Set Edge Function secrets through your trusted Supabase administration workflow:

```sh
supabase secrets set ALLOWED_ORIGIN=http://127.0.0.1:5173 AI_ENABLED=false
supabase functions deploy echopath
```

These are future setup instructions, not actions already executed. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function. The exact origin matters: localhost and 127.0.0.1 differ. `verify_jwt=false` permits the prototype's unauthenticated intake; sensitive operations are protected inside the handler, not by the public frontend key.

The browser reads only `published_experiences`, never private originals. Private tables have RLS and no anon/authenticated grants. There are no public insert/update/delete policies. Anonymous roadmap state remains browser-owned; reserved roadmap tables remain private.

## Publication and management

The browser creates a 256-bit token using Web Crypto and sends it in a POST body. The server stores its SHA-256 hash only. A stable request UUID and token make retries idempotent; another token cannot claim that UUID. Management is scoped to one contribution and uses revision checks to prevent stale edits. The raw capability appears only in the private client link's fragment and request body, not in public records or query parameters. Do not share it.

A submission creates a private original, private candidate and private revision history. Publication consent can be false, in which case the contribution stays private. If publication is requested, contributor public-version review is required. Identifying contacts, recognizable name patterns, supplied private names and token-like strings are removed from the candidate; heuristic warnings flag sensitive figures and client details. Heuristics are imperfect. Contributor review AND trusted moderation are required before live publication.

To approve a reviewed pending contribution, a trusted server/CLI client POSTs this body to `/functions/v1/echopath` with `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`:

```json
{
  "action": "approve",
  "id": "EXPERIENCE_UUID",
  "revision": 1,
  "moderator_reviewed": true
}
```

Inspect `submission_controls.public_candidate` privately before approving. Never put a service-role key in a browser or Vite variable. Approval checks the current revision and consent atomically. Changing status manually is insufficient to publish: only an approved anonymized projection is publicly readable.

For a legacy record with no management capability, trusted administration can prepare recovery using action `recover-legacy`, the record `id`, and a newly generated 64-character hexadecimal `management_token`. Privately give the contributor the corresponding `/manage#id=...&token=...` link. They must review and save a candidate before approval. This operation cannot overwrite an existing management token.

Editing invalidates the public copy and stale insights. Withdrawal removes future public access, search, synthesis and roadmap use. Private originals/history remain for trusted administration; withdrawal is not erasure. Previously downloaded reports, saved roadmaps, open browser snapshots or external caches cannot be recalled. Contact the project team for database-level deletion. A refresh updates an already-open library.

## AI extraction and synthesis

Optional server secrets:

```sh
supabase secrets set OPENAI_API_KEY=YOUR_KEY OPENAI_MODEL=gpt-4o-mini AI_ENABLED=true
```

No live API calls were made during verification. Existing approved API access is required; do not purchase services or enable charges without the owner's authorization.

The shared Zod schemas validate strict structured Responses output. `store:false` and a timeout are used. AI receives only the anonymous candidate or approved public projections, never private originals, reminder contacts or management tokens. Extracted public tags must be anchored in approved text; public narrative insights retain literal approved passages. Unsupported AI narratives and identities are discarded. Aliases are normalized in the searchable representation.

Cross-experience synthesis verifies every source's published status and revision on the server, before and after generation. Counts are computed from distinct actual records, not model-generated statistics. AI selects source-supported excerpts; unsupported output falls back to explicitly labeled deterministic aggregation. Source counts apply to the bounded source set (up to 20). Roadmaps revalidate approved sources too.

The original is committed before extraction. Extraction errors preserve it and return an honest processing status with a rule-based preview. A trusted operator can POST `{"action":"retry-extraction","id":"EXPERIENCE_UUID"}` with service-role authorization. No key or disabled AI means rule-based extraction and template roadmaps; it never means simulated AI presented as real.

See [official OpenAI structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Real reminders and email configuration

Reminder records, contact email and hashes are private and separate from public experiences. Eligibility is 09:00 UTC on the expected end date. Enrollment must include explicit reminder consent. The default adapter uses the Resend HTTP contract; `EMAIL_PROVIDER_URL` can point to an existing compatible HTTPS endpoint.

Configure only server-side secrets:

- `EMAIL_API_KEY`: your existing authorized sender API key.
- `EMAIL_FROM`: an allowed/verified sender, e.g. `EchoPath <sender@your-domain>`.
- `EMAIL_PROVIDER_URL`: optional; defaults to `https://api.resend.com/emails`.
- `REMINDER_CRON_SECRET`: a separate high-entropy secret for scheduled dispatch.
- `REMINDER_SIGNING_SECRET`: a stable high-entropy HMAC secret for email capability links. The service-role key is the fallback. Changing the key while reminders are pending blocks dispatch when hashes no longer match; restore the key or perform trusted queue recovery. Already-issued links are checked against stored hashes.

A scheduler POSTs `{"action":"dispatch-reminders"}` to the Edge Function with `Authorization: Bearer REMINDER_CRON_SECRET`. With no configured sender, the dispatcher sends nothing and leaves the queue unchanged. See `supabase/reminder-schedule.example.sql` for a Vault-backed cron example; it is not automatically applied.

The dispatcher claims up to three eligible rows atomically with leases, sends through the configured provider with a stable per-reminder `Idempotency-Key`, and records provider acceptance or a retry. At most three attempts are allowed, with 15/30-minute backoff and a bounded retry window. Expired final leases become failed rather than remaining stuck. Provider acceptance (`sent`) is not verified inbox delivery; no delivery/bounce webhook is implemented.

Resend documents a 24-hour idempotency window. Automatic retries stop within 23 hours of first attempt to avoid replaying beyond that window. A compatible alternative provider must honor the same idempotency contract. Requests already in flight may finish after an opt-out; future claims are suppressed. Do not reset failed/sent rows for replay without checking provider history.

Reminder email links support scoped unsubscribe and debrief completion. Submitting through the reminder's link atomically suppresses future reminders. The queue is not a marketing list. Add double opt-in/CAPTCHA and a retention policy before broad unauthenticated public enrollment.

See [email request format](https://resend.com/docs/api-reference/emails/send-email), [idempotency behavior](https://resend.com/docs/dashboard/emails/idempotency-keys), and [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions). No sender, account, paid resource or scheduler was provisioned, and no email was sent.

## Tests and build

```sh
npm run typecheck
npm run lint
npm test
npm run check:server
npm run test:server
npm run test:e2e
npm run build
npm run preview
```

Set `DENO_DIR` to `.tools/deno-cache` to keep Deno caches local. For a new browser installation, set `PLAYWRIGHT_BROWSERS_PATH` to `.tools/playwright` before both `npx playwright install chromium` and browser tests. Existing local Playwright installations can use their current cache. No new browser download was needed for this enhancement.

PGlite executes both real migrations and checks database permissions, scoped management, revision conflicts, publication invalidation, original history, reminder claims and suppression. It omits only the unavailable pgcrypto extension declaration; core UUID generation works. HTTP tests mock Supabase/OpenAI/email transports and do not establish live integration success. Browser tests cover desktop and mobile Chromium; Safari and manual screen-reader testing remain outstanding.

## Analytics, research and limitations

Only browser-local event names, timestamps and nonpersonal flow metadata are collected. Submission completion duration is a session measurement, not proof of the five-minute target. Overall usefulness feedback remains separate from contextual Yes/No helpfulness. Exported rates use actual local responses; there is no fabricated denominator or centralized usage claim.

The team's Step 3 survey findings (n=8, one cohort) are preserved in `docs/competition-evidence.md`. They are directional problem evidence, not validation results from this implementation. All PRD success thresholds remain proposed until measured with real students. Ten fictional examples support demonstrations, not a claim of ten real alumni debriefs.

No university authentication, peer routing, standalone Q&A assistant, cross-device roadmap sync or centralized analytics dashboard was added. R9 and R10 remain deferred. The library still fetches all approved records and filters locally; add pagination when the corpus grows. Heuristic anonymization is not a guarantee; publication review is mandatory.

## Deployment preparation

The production build is Vercel-compatible, with the existing SPA rewrites in `vercel.json`. Nothing was committed, pushed or deployed. Before authorizing deployment: apply both migrations in your own project, configure the function and exact origin, verify public API privacy, exercise live AI and email with approved credentials, review moderation/recovery and retention operations, then run the student testing protocol. Vercel receives only public Supabase frontend variables; all private keys remain server-side.

See `docs/mvp-checklist.md`, `docs/architecture.md`, `docs/demo-script.md`, and `docs/development-report.md` for the compliance matrix, complete workflow, demo and executed checks.
