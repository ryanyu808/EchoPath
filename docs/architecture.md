# EchoPath architecture

EchoPath keeps its Vite React SPA and existing visual system. `src/contribution.tsx` adds the streamlined intake and public-version review. `src/enhancements.tsx` contains synthesis, contextual helpfulness, contributor management and reminders. `src/pages.tsx` preserves the library, details, roadmaps, landing and About pages. `src/store.ts` selects a browser-local demo adapter or the Supabase/function adapter. Shared Zod schemas, privacy helpers, normalization, aggregation and reminder eligibility live in `supabase/functions/_shared/`.

## Private originals and approved public copies

The first migration establishes the baseline schema. The alignment migration revokes all public grants and policies on raw `experiences` and `ai_insights`. Both tables retain RLS. New private tables store submission controls, original versions, reminder contacts, synthesis-run references and contextual comments. Only `published_experiences` is publicly readable; public clients have no insert/update/delete grants.

New intake flow:

1. The browser autosaves a private local draft, creates a random request UUID and a Web Crypto 256-bit management token, and prepares an anonymized candidate.
2. The contributor can edit the public candidate, review flagged figures/identifiers, choose private storage or publication consent, and confirm public-version review.
3. The function validates the original and candidate. The raw token is hashed; only its SHA-256 hash is stored server-side.
4. A backend-only SQL function atomically inserts the private original, scoped controls and version history. Duplicate request IDs require the same capability; an existing legacy row cannot be claimed publicly.
5. Extraction uses only the anonymized candidate when publication consent and review are present. Private/unreviewed contributions use rule-based processing without an AI call. The original is already safely committed before extraction, so provider failure cannot lose it.
6. A trusted moderator reviews the candidate and calls `approve`. The SQL publication function locks the original and checks consent, status, review and revision before inserting a whitelisted public projection. Merely changing the raw status does not expose a row.

Public JSON contains approved experience fields, source-supported insights, normalized tags and nonprivate metadata. Structured names, contact fields and capabilities are not in its field whitelist. AI tags must be anchored in approved text. Public narrative insights use approved source passages; unsupported generated narrative is discarded. Pattern-based redaction is a safeguard, not a guarantee. Human review is mandatory.

## Contributor management and withdrawal

Private fragment links supply the contribution ID and token. The server hashes the presented token and uses a backend-only SQL function to verify ownership under a row lock. Editing and withdrawal require the current revision. Editing retains private history, invalidates the public copy and insights, increments the revision and returns the candidate to pending/private status. Withdrawal revokes consent and removes the public projection. Reapproval cannot restore an obsolete revision.

Live legacy originals are retained privately. Trusted recovery can issue a new capability only when no control row exists; the contributor must review before republication. Old browser-local submissions are not silently republished: local recovery creates a private managed contribution first.

Withdrawal blocks future public reads, discovery and generation. It cannot recall previously downloaded files, existing browser snapshots, saved roadmaps or third-party caches. Private original/history deletion remains a trusted team operation, separate from publication withdrawal.

## Search extraction synthesis and roadmaps

The library reads `published_experiences`, hydrates the existing card/detail shape, and filters locally. Skill facets include contributor text and validated extracted skills/tools. Shared normalization canonicalizes common aliases. Role and industry facets also include extracted categories. Existing text search, filters, sorting and related experiences remain.

Synthesis receives a bounded source-ID list, never unrestricted SQL or model database tools. The function reloads only published public copies. Distinct-record skill/tool counts and differences are deterministic. Optional AI selects representative literal passages with validated source references. Unsupported provider output falls back to explicitly labeled rule-based aggregation. Fewer than two records yields an insufficient-evidence explanation. Source status and revision are checked again after generation; withdrawn/changed records invalidate the response. The source-count label describes the actual bounded set, not population statistics.

Roadmap generation reuses approved public copies and validates source IDs and week coverage. The no-AI path returns a clearly labeled template. Anonymous progress, goals and completed tasks stay in the browser, preserving the previous print/PDF flow. Existing saved roadmaps are historical browser copies, not evidence that their sources remain public.

## Reminder workflow

Reminder enrollment is separate from public contributions and requires email consent. The private queue stores expected end date, email, management/unsubscribe hashes, status, attempts, next eligibility, lease, claim token and provider acceptance metadata. Eligibility is 09:00 UTC on the end date. The email capability is derived using HMAC with a stable server secret, then verified against its stored hash; raw tokens are not persisted server-side.

A Vault-backed scheduled POST authenticates with a separate cron secret. The dispatcher does nothing if the email adapter is unconfigured. When configured, it atomically claims up to three due records using row locks and `SKIP LOCKED`, sends with a stable provider idempotency key, and conditionally records acceptance or backoff against the claim token. Expired leases can retry; three attempts or the bounded retry window terminates retries. A signing-key mismatch blocks sending until trusted recovery. Unsubscribe and completion prevent future dispatch. A contribution submitted through its reminder capability suppresses the queue atomically. An already in-flight provider request may still complete after opt-out.

The configurable adapter uses a Resend-compatible HTTPS API. Provider acceptance is recorded as `sent`; inbox delivery is not established without a webhook. Provider idempotency and a 23-hour automatic retry window limit duplicate delivery. Real sender/scheduler credentials were not configured or exercised during local tests.

Demo reminder enrollment, clock advancement, previews, retries and dispatch are local simulations. The UI always says that no email was sent. Demo moderation and extraction are also explicitly labeled.

## Feedback analytics and testing boundaries

Existing overall feedback remains private. Contextual Yes/No ratings reference an experience or synthesis run and optionally include private comments. No public comment feed or feedback-read endpoint exists. Local JSON export computes actual local counts/rates, with null values when no denominator exists. Completion instrumentation links anonymous flow IDs and elapsed session time; skill-only discovery also emits a search event without storing query text.

PGlite executes both migrations and tests SQL permissions, token scope, revisions, invalidation and reminder claims. Deno HTTP tests use mocked Supabase, OpenAI and email transports. Playwright checks desktop/mobile Chromium product flows and axe accessibility. These tests do not prove hosted gateway behavior, provider delivery, human-rated usefulness or five-minute completion. Those require the owner's integration setup and actual student testing.
