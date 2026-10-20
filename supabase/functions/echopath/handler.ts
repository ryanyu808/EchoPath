import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  submissionSchema,
  extractionSchema,
  feedbackSchema,
  goalSchema,
  roadmapSchema,
  templateRoadmap,
  type Experience,
} from "../_shared/domain.ts";
import {
  publicCandidate,
  publicPayload,
  hydratePublic,
  safeInsights,
  tokenHash,
  tokenSchema,
  reminderSchema,
  reminderMessage,
  synthesisAISchema,
  aggregateExperiences,
  groundedSynthesis,
  helpfulnessSchema,
  sensitiveWarnings,
} from "../_shared/alignment.ts";
import { structuredAI } from "./ai.ts";
const env = (name: string) => Deno.env.get(name) ?? "";
const admin = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
);
const uuid = z.string().uuid();
const hasAI = () =>
  env("AI_ENABLED") === "true" && Boolean(env("OPENAI_API_KEY"));
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(error.message || "Database operation failed");
  return data;
}
async function published(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const { data, error } = await admin
    .from("published_experiences")
    .select("id,content,revision")
    .in("id", unique)
    .eq("status", "published");
  if (error) throw error;
  if ((data?.length ?? 0) !== unique.length)
    throw new Error(
      "Selected experiences are no longer published. Refresh the library.",
    );
  return (data ?? []).map((r) => hydratePublic(r.id, r.content, r.revision));
}
async function verifySources(sources: Experience[]) {
  const current = await published(sources.map((e) => e.id));
  if (
    current.some(
      (e) => e.revision !== sources.find((s) => s.id === e.id)?.revision,
    )
  )
    throw new Error("Sources changed during generation. Refresh and retry.");
}
async function controls(id: string) {
  const { data, error } = await admin
    .from("submission_controls")
    .select("*,experiences(revision,status,consent_to_publish,created_at)")
    .eq("experience_id", id)
    .single();
  if (error || !data)
    throw new Error(
      "Contribution not found or requires trusted legacy recovery.",
    );
  return data;
}
async function extract(id: string) {
  const c = await controls(id);
  const parent = Array.isArray(c.experiences)
    ? c.experiences[0]
    : c.experiences;
  const candidate = publicCandidate(submissionSchema.parse(c.public_candidate));
  let insights = safeInsights(candidate);
  let model = "rules-no-ai";
  let processing = hasAI()
    ? "Rule-based extraction · private or unreviewed content is not sent to AI"
    : "Rule-based extraction · no AI configured";
  if (hasAI() && c.privacy_reviewed && parent.consent_to_publish) {
    try {
      const ai = await structuredAI(
        extractionSchema,
        "experience_insights",
        "Extract source-supported skills, tools, role categories, industry, responsibilities, challenges, lessons and preparation advice. Use empty arrays for absent facts. Do not infer identities.",
        publicPayload({
          ...candidate,
          id,
          created_at: parent.created_at,
          status: "pending",
        }),
      );
      insights = safeInsights(candidate, ai);
      model = env("OPENAI_MODEL") || "gpt-4o-mini";
      processing = "AI extraction complete";
    } catch {
      processing =
        "AI extraction failed · original preserved; rule-based preview available";
    }
  }
  const current = await controls(id);
  const currentParent = Array.isArray(current.experiences)
    ? current.experiences[0]
    : current.experiences;
  if (currentParent.revision !== parent.revision)
    throw new Error("Contribution changed during extraction. Retry.");
  const { error } = await admin.from("ai_insights").upsert(
    {
      ...insights,
      extracted_skills: [
        ...insights.technical_skills,
        ...insights.business_skills,
      ],
      experience_id: id,
      revision: parent.revision,
      model_version: model,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "experience_id" },
  );
  if (error) throw error;
  return {
    candidate,
    insights,
    model,
    processing,
    revision: parent.revision,
    created_at: parent.created_at,
  };
}
async function unsubscribeToken(id: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(
      env("REMINDER_SIGNING_SECRET") || env("SUPABASE_SERVICE_ROLE_KEY"),
    ),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`echopath-reminder:${id}`),
  );
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function dispatch() {
  if (!env("EMAIL_API_KEY") || !env("EMAIL_FROM"))
    return {
      mode: "not-configured",
      sent: 0,
      message: "No email provider configured. No emails sent; queue unchanged.",
    };
  const endpoint = env("EMAIL_PROVIDER_URL") || "https://api.resend.com/emails";
  if (!endpoint.startsWith("https://"))
    throw new Error("Email endpoint must use HTTPS");
  const rows = await rpc("claim_reminders", { p_limit: 3 });
  let sent = 0;
  let failed = 0;
  for (const r of rows) {
    const { data: current, error } = await admin
      .from("reminders")
      .select("status,claim_token")
      .eq("id", r.id)
      .single();
    if (error) throw error;
    if (
      current?.status !== "processing" ||
      current.claim_token !== r.claim_token
    )
      continue;
    const token = await unsubscribeToken(r.id);
    if (r.unsubscribe_hash && (await tokenHash(token)) !== r.unsubscribe_hash) {
      await rpc("finish_reminder", {
        p_id: r.id,
        p_claim: r.claim_token,
        p_success: false,
        p_error:
          "Reminder signing key changed; restore the key or perform trusted queue recovery.",
      });
      failed++;
      continue;
    }
    const message = reminderMessage(r, env("ALLOWED_ORIGIN"), token);
    let success = false;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env("EMAIL_API_KEY")}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `echopath-reminder-${r.id}`,
        },
        body: JSON.stringify({
          from: env("EMAIL_FROM"),
          to: [r.email],
          ...message,
        }),
        signal: AbortSignal.timeout(10000),
      });
      success = response.ok;
    } catch {
      /* Provider failure is retryable; never log recipient or tokens. */
    }
    await rpc("finish_reminder", {
      p_id: r.id,
      p_claim: r.claim_token,
      p_success: success,
      p_error: success ? null : "Provider request failed; retry scheduled",
    });
    if (success) sent++;
    else failed++;
  }
  return { mode: "provider", sent, failed };
}
export async function handle(request: Request) {
  const origin = env("ALLOWED_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  const reply = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  if (!origin) return reply({ error: "Server origin not configured" }, 503);
  if (request.headers.get("origin") && request.headers.get("origin") !== origin)
    return reply({ error: "Origin not allowed" }, 403);
  try {
    const raw = await limitedBody(request);
    const body = JSON.parse(raw);
    const action = z.string().parse(body.action);
    const authorization = request.headers.get("authorization");
    const trusted =
      authorization === `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (action === "dispatch-reminders") {
      const scheduler = env("REMINDER_CRON_SECRET");
      if (!trusted && (!scheduler || authorization !== `Bearer ${scheduler}`))
        return reply({ error: "Unauthorized" }, 401);
      return reply(await dispatch());
    }
    if (["approve", "retry-extraction", "recover-legacy"].includes(action)) {
      if (!trusted) return reply({ error: "Unauthorized" }, 401);
      const id = uuid.parse(body.id);
      if (action === "recover-legacy") {
        const hash = await tokenHash(tokenSchema.parse(body.management_token));
        const { data: original, error } = await admin
          .from("experiences")
          .select("*")
          .eq("id", id)
          .single();
        if (error || !original)
          return reply({ error: "Contribution not found" }, 404);
        const parsed = submissionSchema.parse(original);
        const { error: insertError } = await admin
          .from("submission_controls")
          .insert({
            experience_id: id,
            management_hash: hash,
            original_content: parsed,
            public_candidate: publicCandidate(parsed),
            privacy_reviewed: false,
          });
        if (insertError) throw insertError;
        return reply({
          id,
          message:
            "Private recovery prepared. Contributor must review before publication.",
        });
      }
      const c = await controls(id);
      if (
        action === "approve" &&
        (!c.privacy_reviewed || body.moderator_reviewed !== true)
      )
        return reply(
          { error: "Contributor and moderator public-version review required" },
          400,
        );
      const result = await extract(id);
      if (action === "retry-extraction")
        return reply({ processing: result.processing });
      const expected = z.number().int().positive().parse(body.revision);
      if (expected !== result.revision)
        throw new Error("Revision conflict; reload before approval");
      const e: Experience = {
        ...result.candidate,
        id,
        created_at: result.created_at,
        status: "published",
        insights: result.insights,
        model_version: result.model,
      };
      const payload = publicPayload(e);
      await rpc("approve_publication", {
        p_id: id,
        p_revision: expected,
        p_content: payload,
      });
      return reply({ published: true, processing: result.processing });
    }
    const permitted = [
      "submit",
      "manage",
      "feedback",
      "roadmap",
      "synthesis",
      "reminder-enroll",
      "reminder-manage",
      "helpfulness",
    ];
    if (!permitted.includes(action))
      return reply({ error: "Unknown operation" }, 400);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(env("SUPABASE_SERVICE_ROLE_KEY") + ip),
    );
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const allowed = await rpc("consume_request", {
      bucket_key: `${action}:${hash}`,
      max_hits: ["synthesis", "roadmap"].includes(action) ? 10 : 30,
    });
    if (!allowed)
      return reply(
        { error: "Hourly request limit reached. Try again later." },
        429,
      );
    if (action === "submit" || action === "manage") {
      const id = uuid.parse(action === "submit" ? body.request_id : body.id);
      const managementHash = await tokenHash(
        tokenSchema.parse(body.management_token),
      );
      const operation =
        action === "submit"
          ? "submit"
          : z.enum(["read", "edit", "withdraw"]).parse(body.operation);
      if (operation === "read" || operation === "withdraw") {
        const result = await rpc("manage_contribution", {
          p_id: id,
          p_hash: managementHash,
          p_action: operation,
          p_expected_revision: body.revision ?? null,
        });
        return reply(result);
      }
      const original = submissionSchema.parse(body.experience);
      const reviewed = body.privacy_reviewed === true;
      if (original.consent_to_publish && !reviewed)
        return reply(
          {
            error:
              "Review the anonymized public version before requesting publication.",
          },
          400,
        );
      const proposed = submissionSchema.parse({
        ...body.public_version,
        consent_to_publish: original.consent_to_publish,
        contributor_display_name: "",
        anonymity_preference: "Anonymous",
      });
      const candidate = publicCandidate({
        ...proposed,
        contributor_display_name: original.contributor_display_name,
      });
      const result =
        operation === "submit"
          ? await rpc("create_contribution", {
              p_id: id,
              p_original: original,
              p_public: candidate,
              p_hash: managementHash,
              p_reviewed: reviewed,
              p_reminder_id: body.reminder_id
                ? uuid.parse(body.reminder_id)
                : null,
              p_reminder_hash: body.reminder_token
                ? await tokenHash(tokenSchema.parse(body.reminder_token))
                : null,
            })
          : await rpc("manage_contribution", {
              p_id: id,
              p_hash: managementHash,
              p_action: "edit",
              p_original: original,
              p_public: candidate,
              p_reviewed: reviewed,
              p_expected_revision: z
                .number()
                .int()
                .positive()
                .parse(body.revision),
            });
      if (operation === "submit" && result.duplicate)
        return reply({
          ...result,
          processing:
            "Submission already received; existing processing status preserved.",
        });
      let processing = "Original saved privately · processing not completed";
      try {
        processing = (await extract(id)).processing;
      } catch {
        /* Original and controls are already committed; retry is a trusted operation. */
      }
      return reply({ ...result, processing });
    }
    if (action === "feedback") {
      const feedback = feedbackSchema.parse(body.feedback);
      const { error } = await admin
        .from("feedback")
        .insert({ ...feedback, id: uuid.parse(body.request_id) });
      if (error && error.code !== "23505") throw error;
      return reply({ saved: true });
    }
    if (action === "helpfulness") {
      const feedback = helpfulnessSchema.parse(body.feedback);
      uuid.parse(feedback.target_id);
      if (feedback.target_type === "experience")
        await published([feedback.target_id]);
      else {
        const { data, error } = await admin
          .from("synthesis_runs")
          .select("id")
          .eq("id", feedback.target_id)
          .single();
        if (error || !data) throw new Error("Synthesis reference not found");
      }
      const { error } = await admin
        .from("helpfulness")
        .insert({ ...feedback, id: uuid.parse(body.request_id) });
      if (error && error.code !== "23505") throw error;
      return reply({ saved: true });
    }
    if (action === "reminder-enroll") {
      const input = reminderSchema.parse(body.reminder);
      const id = uuid.parse(body.request_id);
      const managementHash = await tokenHash(
        tokenSchema.parse(body.management_token),
      );
      const unsub = await unsubscribeToken(id);
      const { error } = await admin.from("reminders").insert({
        ...input,
        id,
        management_hash: managementHash,
        unsubscribe_hash: await tokenHash(unsub),
        next_attempt_at: `${input.end_date}T09:00:00Z`,
      });
      if (error) {
        if (error.code !== "23505") throw error;
        const { data } = await admin
          .from("reminders")
          .select("id")
          .eq("id", id)
          .eq("management_hash", managementHash)
          .single();
        if (!data) throw new Error("Enrollment conflict");
      }
      return reply({
        id,
        status: "scheduled",
        message:
          "Reminder saved privately. Delivery requires configured email and scheduler.",
      });
    }
    if (action === "reminder-manage") {
      const id = uuid.parse(body.id);
      const hash = await tokenHash(tokenSchema.parse(body.management_token));
      const { data: r, error } = await admin
        .from("reminders")
        .select("*")
        .eq("id", id)
        .or(`management_hash.eq.${hash},unsubscribe_hash.eq.${hash}`)
        .single();
      if (error || !r)
        return reply({ error: "Invalid reminder management link" }, 403);
      const op = z
        .enum(["read", "unsubscribe", "complete"])
        .parse(body.operation);
      if (op !== "read") {
        const { error: updateError } = await admin
          .from("reminders")
          .update({
            status: op === "unsubscribe" ? "unsubscribed" : "completed",
            lease_until: null,
            claim_token: null,
          })
          .eq("id", id);
        if (updateError) throw updateError;
        r.status = op === "unsubscribe" ? "unsubscribed" : "completed";
      }
      const {
        management_hash: _a,
        unsubscribe_hash: _b,
        claim_token: _c,
        ...safe
      } = r;
      void [_a, _b, _c];
      return reply(safe);
    }
    const ids = z
      .array(uuid)
      .max(action === "roadmap" ? 5 : 20)
      .parse(body.source_ids);
    const sources = await published(ids);
    if (action === "synthesis") {
      let result = aggregateExperiences(
        sources,
        "Rule-based synthesis · no AI configured",
      );
      if (hasAI() && sources.length >= 2) {
        try {
          const output = await structuredAI(
            synthesisAISchema,
            "cross_experience_synthesis",
            "Select representative literal excerpts from the approved source fields. Each text must be an exact contiguous source passage and each source_id must support that exact text. Cover typical responsibilities, recurring challenges and preparation advice. Counts and differences are computed separately; do not invent claims.",
            sources.map((e) => ({ id: e.id, content: publicPayload(e) })),
          );
          result = {
            ...result,
            ...groundedSynthesis(output, sources),
            mode: "AI synthesis · source-verified excerpts; counts computed from records",
          };
        } catch {
          result.mode =
            "AI unavailable · deterministic aggregation, not AI output";
        }
      }
      await verifySources(sources);
      const { error } = await admin
        .from("synthesis_runs")
        .insert({ id: result.id, source_ids: result.source_ids });
      if (error) throw error;
      return reply(result);
    }
    const goal = goalSchema.parse(body.goal);
    if (!hasAI()) {
      await verifySources(sources);
      return reply({
        mode: "template",
        roadmap: templateRoadmap(goal, sources),
      });
    }
    if (sensitiveWarnings(goal).length)
      return reply(
        {
          error:
            "Remove identifying or confidential details from roadmap goals.",
        },
        400,
      );
    const roadmap = await structuredAI(
      roadmapSchema,
      "preparation_roadmap",
      `Create a practical ${goal.weeks}-week roadmap. Use only supplied source IDs. Cite a source only for supported advice. Tasks without evidence are general suggestions. Include every week. Explain missing evidence without inventing details.`,
      {
        goal,
        experiences: sources.map((e) => ({ id: e.id, ...publicPayload(e) })),
      },
    );
    if (
      roadmap.tasks.some(
        (t) =>
          t.week_number > goal.weeks ||
          t.source_ids.some((id) => !ids.includes(id)),
      ) ||
      Array.from({ length: goal.weeks }, (_, i) => i + 1).some(
        (w) => !roadmap.tasks.some((t) => t.week_number === w),
      )
    )
      throw new Error("Invalid roadmap evidence or timeline");
    await verifySources(sources);
    roadmap.tasks.sort((a, b) => a.week_number - b.week_number);
    return reply({ mode: "ai", roadmap });
  } catch (error) {
    if (error instanceof Error && error.message === "Request too large")
      return reply({ error: "Request too large" }, 413);
    if (error instanceof z.ZodError)
      return reply(
        {
          error:
            "Invalid input. Review the required fields and privacy controls.",
        },
        400,
      );
    const message = error instanceof Error ? error.message : "";
    if (/token|link/.test(message))
      return reply({ error: "Invalid management link or token." }, 403);
    if (/Revision|changed|no longer published/.test(message))
      return reply({ error: message }, 409);
    return reply(
      {
        error:
          "Request could not be completed. Saved originals remain private; no success is claimed.",
      },
      503,
    );
  }
}
async function limitedBody(request: Request) {
  const limit = 120000;
  if (Number(request.headers.get("content-length")) > limit)
    throw new Error("Request too large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Request too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
