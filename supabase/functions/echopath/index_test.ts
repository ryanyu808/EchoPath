// Mocked HTTP integration tests. No live Supabase, OpenAI or email requests.
import {
  submissionSchema,
  extractTemplate,
  type Experience,
} from "../_shared/domain.ts";
import {
  publicCandidate,
  publicPayload,
  tokenHash,
} from "../_shared/alignment.ts";
Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-secret");
Deno.env.set("ALLOWED_ORIGIN", "https://echopath.test");
const { handle } = await import("./handler.ts");
const id = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const token = "a".repeat(64);
const hash = await tokenHash(token);
const original = submissionSchema.parse({
  experience_type: "Internship",
  role_title: "Analytics Intern",
  company: "Example Organization",
  industry: "Technology",
  role_category: "Analytics",
  year: 2026,
  duration: "12 weeks",
  work_arrangement: "Hybrid",
  responsibilities:
    "Private Person wrote SQL queries and built Tableau reports.",
  projects: "Built a dashboard",
  typical_day: "Analyzed metrics",
  tools: "SQL, Tableau",
  challenges: "Inconsistent metrics",
  solutions: "Wrote a metric dictionary",
  valuable_skills: "Communication",
  lessons_learned: "Define metrics first",
  advice: "Practice SQL joins and explain your analysis.",
  contributor_display_name: "Private Person",
  anonymity_preference: "Display name",
  consent_to_publish: true,
});
const candidate = publicCandidate(original);
const experience: Experience = {
  ...candidate,
  id,
  status: "published",
  created_at: "2026-10-20T09:00:00Z",
  insights: extractTemplate(candidate),
  model_version: "test-model",
  revision: 1,
};
const content = publicPayload(experience);
const goal = {
  target_role: "Business Analyst",
  target_industry: "Technology",
  existing_skills: "Excel",
  target_skills: "SQL",
  weeks: 2,
};
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
type Options = {
  ai?: boolean;
  insertFailure?: boolean;
  aiFailure?: boolean;
  invalidAI?: boolean;
  allowed?: boolean;
  origin?: string;
  sourceAvailable?: boolean;
  withdrawDuringAI?: boolean;
  email?: boolean;
  emailFailure?: boolean;
  wrongSigningHash?: boolean;
  authorization?: string;
  roadmap?: unknown;
};
type Call = { url: string; payload: Record<string, unknown>; headers: Headers };
async function run(action: Record<string, unknown>, options: Options = {}) {
  Deno.env.set("AI_ENABLED", options.ai ? "true" : "false");
  Deno.env.set("OPENAI_API_KEY", options.ai ? "fake-key" : "");
  Deno.env.set("EMAIL_API_KEY", options.email ? "fake-email-key" : "");
  Deno.env.set(
    "EMAIL_FROM",
    options.email ? "EchoPath <sender@example.com>" : "",
  );
  const calls: Call[] = [];
  let reads = 0;
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const payload = req.body ? await req.json() : {};
    const url = req.url;
    calls.push({ url, payload, headers: req.headers });
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url.includes("/rpc/consume_request"))
      return json(options.allowed ?? true);
    if (url.includes("/rpc/create_contribution"))
      return options.insertFailure
        ? json({ code: "42501", message: "database rejected insert" }, 403)
        : json({ id, status: "pending", revision: 1 });
    if (url.includes("/rpc/manage_contribution")) {
      if (payload.p_hash !== hash)
        return json({ message: "Invalid management token" }, 400);
      return json({
        id,
        status: payload.p_action === "withdraw" ? "withdrawn" : "pending",
        revision: 1,
        original,
        public_candidate: candidate,
        privacy_reviewed: true,
      });
    }
    if (url.includes("/rpc/approve_publication")) return json(true);
    if (url.includes("/rpc/claim_reminders"))
      return json([
        {
          id,
          experience_type: "Internship",
          email: "private@example.com",
          claim_token: second,
          attempts: 1,
          unsubscribe_hash: options.wrongSigningHash
            ? "0".repeat(64)
            : undefined,
        },
      ]);
    if (url.includes("/rpc/finish_reminder")) return json(true);
    if (url.includes("/submission_controls"))
      return json({
        experience_id: id,
        original_content: original,
        public_candidate: candidate,
        privacy_reviewed: action.privacy_reviewed ?? true,
        experiences: {
          revision: 1,
          status: "pending",
          consent_to_publish:
            (action.experience as { consent_to_publish?: boolean } | undefined)
              ?.consent_to_publish ?? true,
          created_at: experience.created_at,
        },
      });
    if (url.includes("/published_experiences")) {
      reads++;
      return json(
        options.sourceAvailable && !(options.withdrawDuringAI && reads > 1)
          ? [
              { id, content, revision: 1 },
              { id: second, content, revision: 1 },
            ].filter((e) => new URL(url).searchParams.get("id")?.includes(e.id))
          : [],
      );
    }
    if (url.includes("api.openai.com")) {
      if (options.aiFailure) return json({ error: "unavailable" }, 503);
      const format = (payload.text as { format: { name: string } }).format.name;
      const response = options.invalidAI
        ? { invalid: true }
        : format === "experience_insights"
          ? extractTemplate(candidate)
          : format === "cross_experience_synthesis"
            ? {
                responsibilities: [
                  { text: candidate.responsibilities, source_ids: [id] },
                ],
                challenges: [{ text: candidate.challenges, source_ids: [id] }],
                advice: [{ text: candidate.advice, source_ids: [id] }],
              }
            : (options.roadmap ?? {
                summary: "Source-informed preparation",
                skills: ["SQL"],
                technical_preparation: ["Practice joins"],
                business_preparation: ["Define metrics"],
                practice_projects: ["Build a dashboard"],
                interview_preparation: ["Explain your results"],
                tasks: [
                  {
                    title: "Practice SQL",
                    description: "Contributor advice: practice SQL joins.",
                    week_number: 1,
                    source_ids: [id],
                  },
                  {
                    title: "Explain results",
                    description:
                      "General suggestion: rehearse a project presentation.",
                    week_number: 2,
                    source_ids: [],
                  },
                ],
              });
      return json({
        status: "completed",
        output: [
          {
            content: [{ type: "output_text", text: JSON.stringify(response) }],
          },
        ],
      });
    }
    if (url.includes("api.resend.com"))
      return options.emailFailure
        ? json({ error: "unavailable" }, 503)
        : json({ id: "provider-id" });
    if (url.includes("/reminders") && req.method === "GET")
      return json({ id, status: "processing", claim_token: second });
    if (url.includes("/synthesis_runs") && req.method === "GET")
      return json({ id });
    if (
      [
        "/ai_insights",
        "/feedback",
        "/helpfulness",
        "/synthesis_runs",
        "/reminders",
      ].some((t) => url.includes(t))
    )
      return json(null, 201);
    throw new Error("Unexpected transport: " + url);
  };
  try {
    const response = await handle(
      new Request("https://test.supabase.co/functions/v1/echopath", {
        method: "POST",
        headers: {
          Origin: options.origin ?? "https://echopath.test",
          "Content-Type": "application/json",
          ...(options.authorization
            ? { Authorization: options.authorization }
            : {}),
        },
        body: JSON.stringify(action),
      }),
    );
    return { status: response.status, body: await response.json(), calls };
  } finally {
    globalThis.fetch = savedFetch;
  }
}
const submit = {
  action: "submit",
  experience: { ...original, status: "published" },
  request_id: id,
  management_token: token,
  public_version: candidate,
  privacy_reviewed: true,
};
Deno.test(
  "submission forces private pending storage, hashes tokens and preserves original privately",
  async () => {
    const r = await run(submit);
    assert(r.status === 200);
    const insert = r.calls.find((c) => c.url.includes("create_contribution"));
    assert(insert?.payload.p_hash === hash);
    assert(insert.payload.p_hash !== token);
    assert(
      (insert.payload.p_original as Record<string, unknown>)
        .contributor_display_name === "Private Person",
    );
    assert(
      !("status" in (insert.payload.p_original as Record<string, unknown>)),
    );
    assert(!r.calls.some((c) => c.url.includes("approve_publication")));
  },
);
Deno.test(
  "failed original insert cannot claim success or call AI",
  async () => {
    const r = await run(submit, { ai: true, insertFailure: true });
    assert(r.status === 503);
    assert(!r.calls.some((c) => c.url.includes("openai.com")));
  },
);
Deno.test(
  "AI failure preserves a successful original save and reports an honest fallback",
  async () => {
    const r = await run(submit, { ai: true, aiFailure: true });
    assert(
      r.status === 200 && r.body.processing.includes("AI extraction failed"),
    );
    assert(
      r.calls.findIndex((c) => c.url.includes("create_contribution")) <
        r.calls.findIndex((c) => c.url.includes("openai.com")),
    );
  },
);
Deno.test(
  "invalid extraction is rejected and cannot be mistaken for successful AI output",
  async () => {
    const r = await run(submit, { ai: true, invalidAI: true });
    assert(
      r.status === 200 && r.body.processing.includes("AI extraction failed"),
    );
    const write = r.calls.find((c) => c.url.includes("/ai_insights"));
    assert(write?.payload.model_version === "rules-no-ai");
  },
);
Deno.test(
  "valid extraction uses strict output and only the anonymized candidate",
  async () => {
    const r = await run(submit, { ai: true });
    assert(r.body.processing === "AI extraction complete");
    const ai = r.calls.find((c) => c.url.includes("openai.com"));
    assert(ai?.payload.store === false);
    assert(!String(ai?.payload.input).includes("Private Person"));
    assert(!String(ai?.payload.input).includes("management_token"));
    assert((ai?.payload.text as { format: { strict: boolean } }).format.strict);
    const insight = r.calls.find((c) => c.url.includes("/ai_insights"));
    assert(insight?.payload.experience_id === id);
  },
);
Deno.test(
  "publication and administrative retry require trusted authorization and public review",
  async () => {
    const denied = await run({
      action: "approve",
      id,
      revision: 1,
      moderator_reviewed: true,
    });
    assert(denied.status === 401);
    const reviewed = await run(
      { action: "approve", id, revision: 1, moderator_reviewed: false },
      { authorization: "Bearer test-service-secret" },
    );
    assert(reviewed.status === 400);
    const approved = await run(
      { action: "approve", id, revision: 1, moderator_reviewed: true },
      { authorization: "Bearer test-service-secret" },
    );
    assert(approved.status === 200);
    const publish = approved.calls.find((c) =>
      c.url.includes("approve_publication"),
    );
    assert(
      !JSON.stringify(publish?.payload.p_content).includes("Private Person"),
    );
    assert(
      !(publish?.payload.p_content as Record<string, unknown>)
        .contributor_display_name,
    );
  },
);
Deno.test(
  "management is scoped to the hashed capability and revision is forwarded",
  async () => {
    const wrong = await run({
      action: "manage",
      id,
      management_token: "b".repeat(64),
      operation: "withdraw",
      revision: 1,
    });
    assert(wrong.status === 403);
    const ok = await run({
      action: "manage",
      id,
      management_token: token,
      operation: "withdraw",
      revision: 1,
    });
    assert(ok.status === 200 && ok.body.status === "withdrawn");
    const call = ok.calls.find((c) => c.url.includes("manage_contribution"));
    assert(call?.payload.p_expected_revision === 1);
  },
);
Deno.test(
  "public-version review is required when publication consent is requested",
  async () => {
    const r = await run({ ...submit, privacy_reviewed: false });
    assert(r.status === 400);
    assert(!r.calls.some((c) => c.url.includes("create_contribution")));
  },
);
Deno.test(
  "roadmap reloads only approved publication copies and validates citations",
  async () => {
    const r = await run(
      { action: "roadmap", goal, source_ids: [id] },
      { ai: true, sourceAvailable: true },
    );
    assert(r.status === 200 && r.body.mode === "ai");
    assert(
      r.calls.some(
        (c) =>
          c.url.includes("published_experiences") &&
          c.url.includes("status=eq.published"),
      ),
    );
    const ai = r.calls.find((c) => c.url.includes("openai.com"));
    assert(!String(ai?.payload.input).includes("Private Person"));
    const invalid = {
      summary: "bad",
      skills: [],
      technical_preparation: [],
      business_preparation: [],
      practice_projects: [],
      interview_preparation: [],
      tasks: [
        {
          title: "bad",
          description: "bad",
          week_number: 1,
          source_ids: [second],
        },
      ],
    };
    const rejected = await run(
      { action: "roadmap", goal, source_ids: [id] },
      { ai: true, sourceAvailable: true, roadmap: invalid },
    );
    assert(rejected.status !== 200);
  },
);
Deno.test(
  "missing, withdrawn or changed source records cannot be used before or after generation",
  async () => {
    const missing = await run(
      { action: "roadmap", goal, source_ids: [id] },
      { ai: true },
    );
    assert(missing.status === 409);
    assert(!missing.calls.some((c) => c.url.includes("openai.com")));
    const changed = await run(
      { action: "roadmap", goal, source_ids: [id] },
      { ai: true, sourceAvailable: true, withdrawDuringAI: true },
    );
    assert(changed.status === 409);
  },
);
Deno.test(
  "roadmap without AI and without evidence returns a clearly identified template",
  async () => {
    const r = await run({ action: "roadmap", goal, source_ids: [] });
    assert(r.status === 200 && r.body.mode === "template");
    assert(r.body.roadmap.summary.includes("No experience evidence"));
  },
);
Deno.test(
  "cross-experience synthesis counts actual records and protects source grounding",
  async () => {
    const r = await run(
      { action: "synthesis", source_ids: [id, second] },
      { ai: true, sourceAvailable: true },
    );
    assert(r.status === 200 && r.body.source_count === 2);
    assert(r.body.mode.startsWith("AI synthesis"));
    assert(
      r.body.skills.find((s: { tag: string }) => s.tag === "SQL").count === 2,
    );
    assert(!JSON.stringify(r.body).includes("Private Person"));
    const failed = await run(
      { action: "synthesis", source_ids: [id, second] },
      { ai: true, sourceAvailable: true, invalidAI: true },
    );
    assert(failed.body.mode.includes("deterministic"));
  },
);
Deno.test(
  "feedback and contextual helpfulness store private comments with approved references",
  async () => {
    const feedback = await run({
      action: "feedback",
      feedback: {
        usefulness: 5,
        findability: 4,
        confusing: "",
        improve: "More examples",
        admin: true,
      },
      request_id: id,
    });
    assert(feedback.status === 200);
    assert(
      !(
        "admin" in
        feedback.calls.find((c) => c.url.includes("/feedback"))!.payload
      ),
    );
    const helpful = await run(
      {
        action: "helpfulness",
        feedback: {
          target_type: "experience",
          target_id: id,
          helpful: true,
          comment: "Useful",
        },
        request_id: second,
      },
      { sourceAvailable: true },
    );
    assert(helpful.status === 200);
    assert(!helpful.body.comment);
  },
);
Deno.test(
  "reminder contact details are separate and only token hashes enter storage",
  async () => {
    const r = await run({
      action: "reminder-enroll",
      request_id: id,
      management_token: token,
      reminder: {
        experience_type: "Internship",
        end_date: "2026-10-20",
        email: "private@example.com",
        consent: true,
      },
    });
    assert(r.status === 200);
    const write = r.calls.find((c) => c.url.includes("/reminders"));
    assert(write?.payload.management_hash === hash);
    assert(!("management_token" in write.payload));
    assert(!("email" in r.body));
  },
);
Deno.test(
  "unconfigured email leaves the queue unchanged; dispatch requires scheduler authorization",
  async () => {
    const denied = await run({ action: "dispatch-reminders" });
    assert(denied.status === 401);
    const r = await run(
      { action: "dispatch-reminders" },
      { authorization: "Bearer test-service-secret" },
    );
    assert(r.body.mode === "not-configured" && r.body.sent === 0);
    assert(!r.calls.some((c) => c.url.includes("claim_reminders")));
  },
);
Deno.test(
  "configured sender receives stable idempotency key and failures schedule retry",
  async () => {
    const sent = await run(
      { action: "dispatch-reminders" },
      { authorization: "Bearer test-service-secret", email: true },
    );
    assert(sent.body.sent === 1);
    const provider = sent.calls.find((c) => c.url.includes("api.resend.com"));
    assert(
      provider?.headers.get("idempotency-key") === "echopath-reminder-" + id,
    );
    assert(String(provider.payload.text).includes("/reminders#id="));
    const failed = await run(
      { action: "dispatch-reminders" },
      {
        authorization: "Bearer test-service-secret",
        email: true,
        emailFailure: true,
      },
    );
    assert(failed.body.failed === 1);
    assert(
      failed.calls.find((c) => c.url.includes("finish_reminder"))?.payload
        .p_success === false,
    );
  },
);
Deno.test(
  "invalid IDs, rate limits and disallowed origins are rejected",
  async () => {
    assert(
      (await run({ action: "roadmap", goal, source_ids: ["demo-1"] }))
        .status === 400,
    );
    assert(
      (
        await run(
          { action: "roadmap", goal, source_ids: [] },
          { allowed: false },
        )
      ).status === 429,
    );
    const origin = await run(
      { action: "feedback" },
      { origin: "https://other.test" },
    );
    assert(origin.status === 403 && origin.calls.length === 0);
  },
);

Deno.test(
  "private or unreviewed submissions are never sent to OpenAI",
  async () => {
    const r = await run(
      {
        ...submit,
        experience: { ...original, consent_to_publish: false },
        privacy_reviewed: false,
      },
      { ai: true },
    );
    assert(r.status === 200);
    assert(!r.calls.some((c) => c.url.includes("openai.com")));
  },
);
Deno.test(
  "oversized UTF-8 bodies are rejected before transport or database work",
  async () => {
    const r = await run({ action: "feedback", text: "😀".repeat(40000) });
    assert(r.status === 413);
    assert(r.calls.length === 0);
  },
);
Deno.test(
  "a changed reminder signing key blocks delivery instead of issuing a broken link",
  async () => {
    const r = await run(
      { action: "dispatch-reminders" },
      {
        authorization: "Bearer test-service-secret",
        email: true,
        wrongSigningHash: true,
      },
    );
    assert(r.body.failed === 1);
    assert(!r.calls.some((c) => c.url.includes("api.resend.com")));
  },
);
