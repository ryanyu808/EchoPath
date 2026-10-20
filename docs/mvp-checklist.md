# EchoPath PRD implementation checklist

The team's Step 3 PRD groups R6–R8 and R9–R10. IDs below follow their listed order. Local implementation is distinguished from live external verification.

| ID  | Priority | Implementation                                                                                                                                             | Status                                                                                                                                            |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | P0       | Four-step guided intake; essential fields; optional detail, outcomes and culture; local autosave; review, consent, validation and anonymous session timing | Implemented and locally tested. Five-minute target requires real student testing.                                                                 |
| R2  | P0       | Private enrollment/queue; UTC eligibility; leases; retries; idempotency; private links; opt-out/completion suppression; provider adapter and cron example  | Demo workflow locally tested; real delivery requires an authorized email sender, secrets and hosted scheduler.                                    |
| R3  | P0       | Validated extraction; normalized technical/business/tool/category/industry tags; original retention; extracted tags used in search/facets                  | Rules/demo path locally tested. OpenAI integration tested with mocked transport, not live credentials.                                            |
| R4  | P0       | Skills-first facet; cross-experience panel; actual distinct source counts; grounded excerpts, tools, advice, differences, links and insufficient evidence  | Demo aggregation locally tested. Secure AI selection and publication/revision rechecks tested with mocks; live provider verification outstanding. |
| R5  | P0       | Private originals; reviewed anonymous candidate; whitelisted approved public copies; no public names/contacts/capabilities; secure database grants/RLS     | Implemented and locally tested against both migrations in embedded PostgreSQL; hosted API smoke test outstanding.                                 |
| R6  | P1       | Hashed scoped tokens; private management; editing, consent changes, withdrawal; revision checks; public invalidation and original history                  | Implemented and locally tested. Live recovery/moderation workflow requires owner setup.                                                           |
| R7  | P1       | Contact/name/token redaction; exact financial/count/metric/client warnings; editable public wording; explicit review                                       | Implemented and locally tested. Heuristics are imperfect; contributor/moderator review remains mandatory.                                         |
| R8  | P1       | Yes/No helpfulness on detail/synthesis; optional private comments; source references; local actual rate export; original overall feedback preserved        | Implemented and locally tested. Persistent tables/handler tested locally; hosted configuration outstanding.                                       |
| R9  | P2       | Standalone AI Q&A assistant                                                                                                                                | Deferred as specified; synthesis and roadmaps are not represented as Q&A.                                                                         |
| R10 | P2       | Peer/contact routing                                                                                                                                       | Deferred and outside the MVP; no public contact directory added.                                                                                  |

## Preserved

- [x] EchoPath branding, landing page, cards, details and responsive design.
- [x] Search/filter combinations, sorting, related experiences and empty/error/loading states.
- [x] Preparation roadmaps, source links, saved checkbox progress and print/PDF.
- [x] Existing overall feedback and browser-local analytics export.
- [x] Ten clearly fictional sample records; no mixing with live contributions.
- [x] Backward-compatible private retention/recovery for earlier submissions.
- [x] No replacement stack, vector infrastructure, paid resource creation, commit, push or deployment.

## Before a real community launch

- [ ] Apply both migrations to the owner's Supabase project after backup.
- [ ] Verify direct anon/authenticated API denial on private tables and allowed reads on approved projections.
- [ ] Configure the function origin, trusted moderation/recovery and secret handling.
- [ ] Verify actual OpenAI extraction, grounded synthesis and roadmap behavior with approved credentials.
- [ ] Configure a sender and Vault-backed scheduler; test a controlled email, retries, unsubscribe and completion suppression.
- [ ] Review sender idempotency, queue monitoring, double opt-in/CAPTCHA, retention and deletion operations.
- [ ] Collect actual consented debriefs for launch; fictional fixtures do not establish a real knowledge-bank corpus.
- [ ] Test with 2–3 real students and measure completion, elapsed time, usefulness and discovery behavior.
- [ ] Record genuine feedback and a product modification in the evidence register.
- [ ] Obtain separate approval before committing, pushing or deploying.
