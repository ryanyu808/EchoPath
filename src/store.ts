import {
  publicCandidate,
  publicPayload,
  hydratePublic,
  safeInsights,
  newToken,
  tokenHash,
  aggregateExperiences,
  reminderSchema,
  reminderEligible,
  reminderMessage,
  helpfulnessSchema,
  type Synthesis,
  type ReminderInput,
  type Reminder,
  type Helpfulness,
} from "../supabase/functions/_shared/alignment";
import { createClient } from "@supabase/supabase-js";
import { demoExperiences } from "./data";
import {
  type Experience,
  type Submission,
  type Goal,
  type Roadmap,
  templateRoadmap,
  roadmapSchema,
  feedbackSchema,
  submissionSchema,
  savedRoadmapSchema,
} from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const live = Boolean(url || key);
export const db = (() => {
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
})();
function checkConfiguration() {
  if (live && !db)
    throw new Error(
      "Supabase configuration is incomplete or invalid. Check both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the app.",
    );
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`echopath:${key}`);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return Array.isArray(fallback) && !Array.isArray(value)
      ? fallback
      : (value as T);
  } catch {
    return fallback;
  }
}
export function loadRoadmap(): Roadmap | null {
  const parsed = savedRoadmapSchema.safeParse(
    readLocal(live ? "roadmap-live" : "roadmap-demo", null),
  );
  return parsed.success ? parsed.data : null;
}
export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(`echopath:${key}`, JSON.stringify(value));
  } catch {
    throw new Error(
      "Browser storage is unavailable or full. Allow storage and try again.",
    );
  }
}
export function track(
  event: string,
  details: Record<string, string | number> = {},
) {
  try {
    const events = readLocal<{ event: string; mode: string; at: string }[]>(
      "events",
      [],
    );
    saveLocal(
      "events",
      [
        ...events,
        {
          event,
          mode: live ? "live" : "demo",
          at: new Date().toISOString(),
          ...details,
        },
      ].slice(-1000),
    );
  } catch {
    /* Analytics must never block product use. */
  }
}
export async function listExperiences(): Promise<Experience[]> {
  checkConfiguration();
  if (!db)
    return [
      ...privateRecords()
        .filter(
          (r) =>
            r.status === "published" &&
            r.original.consent_to_publish &&
            r.privacy_reviewed,
        )
        .map((r) => recordPublic(r)),
      ...demoExperiences.map((e) =>
        hydratePublic(
          e.id,
          publicPayload({
            ...publicCandidate(e),
            id: e.id,
            created_at: e.created_at,
            status: "published",
            insights: safeInsights(publicCandidate(e), e.insights),
            model_version: "demo-template",
          }),
          1,
          "fictional",
        ),
      ),
    ];
  const { data, error } = await db
    .from("published_experiences")
    .select("id,content,revision")
    .eq("status", "published");
  if (error)
    throw new Error(
      "Could not load approved public experiences. Check the connection and apply both database migrations.",
    );
  return (data ?? []).map((row) =>
    hydratePublic(row.id, row.content, row.revision),
  );
}
export async function invoke(action: string, payload: unknown) {
  if (!db) throw new Error("Persistent mode is not configured.");
  const { data, error } = await db.functions.invoke("echopath", {
    body: { action, ...(payload as object) },
  });
  if (error)
    throw new Error(
      "The server could not complete this request. Check your connection or contact the project team.",
    );
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function generateRoadmap(
  goal: Goal,
  sources: Experience[],
): Promise<Roadmap> {
  checkConfiguration();
  if (!db) {
    const current = await listExperiences();
    const valid = sources.map((s) =>
      current.find(
        (e) =>
          e.id === s.id &&
          (s.revision === undefined || e.revision === s.revision),
      ),
    );
    if (valid.some((e) => !e))
      throw new Error(
        "Some sources were withdrawn or edited. Refresh the library.",
      );
    return templateRoadmap(goal, valid as Experience[]);
  }
  const data = await invoke("roadmap", {
    goal,
    source_ids: sources.map((e) => e.id),
  });
  if (data.mode === "template")
    return {
      ...data.roadmap,
      mode: "Template · not AI generated",
      completed: [],
      goal,
    } as Roadmap;
  const content = roadmapSchema.parse(data.roadmap);
  const allowed = new Set(sources.map((e) => e.id));
  if (
    content.tasks.some(
      (t) =>
        t.week_number > goal.weeks ||
        t.source_ids.some((id) => !allowed.has(id)),
    )
  )
    throw new Error(
      "The generated roadmap contained invalid evidence references. Try again.",
    );
  return {
    ...content,
    id: crypto.randomUUID(),
    completed: [],
    source_experience_ids: sources.map((e) => e.id),
    mode: sources.length
      ? "AI generated · selected records supplied as evidence"
      : "AI generated · general suggestions, no experience evidence",
    goal,
  };
}
export async function sendFeedback(input: unknown, requestId: string) {
  checkConfiguration();
  const value = feedbackSchema.parse(input);
  if (db) {
    await invoke("feedback", { feedback: value, request_id: requestId });
    return;
  }
  saveLocal("feedback", [
    ...readLocal<unknown[]>("feedback", []),
    { ...value, id: requestId, at: new Date().toISOString(), mode: "demo" },
  ]);
}
export function exportReport() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          scope: "This browser only; no shared-server feedback included",
          events: readLocal("events", []),
          feedback: readLocal("feedback", []),
          helpfulness: helpfulnessSummary(),
          analytics_summary: analyticsSummary(),
          contextual_feedback: readLocal("helpfulness", []),
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "echopath-local-report.json";
  a.click();
  URL.revokeObjectURL(url);
}

export type PrivateContribution = {
  id: string;
  original: Submission;
  public_candidate: Submission;
  management_hash: string;
  privacy_reviewed: boolean;
  status: string;
  revision: number;
  created_at: string;
};
function privateRecords() {
  return readLocal<PrivateContribution[]>("private-contributions", []).filter(
    (r) =>
      submissionSchema.safeParse(r.original).success &&
      submissionSchema.safeParse(r.public_candidate).success &&
      typeof r.management_hash === "string",
  );
}
function writeRecords(records: PrivateContribution[]) {
  saveLocal("private-contributions", records);
}
function recordPublic(r: PrivateContribution) {
  const e: Experience = {
    ...publicCandidate(r.public_candidate),
    id: r.id,
    status: "published",
    created_at: r.created_at,
    insights: safeInsights(r.public_candidate),
    model_version: "demo-template",
  };
  return hydratePublic(r.id, publicPayload(e), r.revision, "local");
}
export function managementLink(id: string, token: string, path = "/manage") {
  return `${location.origin}${path}#id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
}
export function hashLink() {
  return Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
}
export type SubmissionOptions = {
  token: string;
  publicVersion: Submission;
  reviewed: boolean;
  reminderId?: string;
  reminderToken?: string;
};
export async function submitExperience(
  input: Submission,
  requestId: string,
  options: SubmissionOptions,
) {
  checkConfiguration();
  const original = submissionSchema.parse(input);
  if (!options)
    throw new Error(
      "A private management token and public-version review are required.",
    );
  const hash = await tokenHash(options.token);
  const candidate = publicCandidate({
    ...submissionSchema.parse(options.publicVersion),
    contributor_display_name: original.contributor_display_name,
    consent_to_publish: original.consent_to_publish,
  });
  if (original.consent_to_publish && !options.reviewed)
    throw new Error("Review the anonymized public version before publication.");
  if (db)
    return (await invoke("submit", {
      experience: original,
      request_id: requestId,
      management_token: options.token,
      public_version: candidate,
      privacy_reviewed: options.reviewed,
      reminder_id: options.reminderId,
      reminder_token: options.reminderToken,
    })) as { id: string; status: string; revision: number; processing: string };
  const records = privateRecords();
  const existing = records.find((r) => r.id === requestId);
  if (existing) {
    if (existing.management_hash !== hash)
      throw new Error("Invalid management token");
    return {
      id: requestId,
      status: existing.status,
      revision: existing.revision,
      processing: "Already saved in this browser",
    };
  }
  const record: PrivateContribution = {
    id: requestId,
    original,
    public_candidate: candidate,
    management_hash: hash,
    privacy_reviewed: options.reviewed,
    status: original.consent_to_publish ? "pending" : "draft",
    revision: 1,
    created_at: new Date().toISOString(),
  };
  writeRecords([...records, record]);
  if (options.reminderId && options.reminderToken)
    await manageReminder(options.reminderId, options.reminderToken, "complete");
  return {
    id: requestId,
    status: record.status,
    revision: 1,
    processing: "Template extraction · not AI generated",
  };
}
export async function manageContribution(
  id: string,
  token: string,
  operation: "read" | "edit" | "withdraw",
  revision?: number,
  original?: Submission,
  candidate?: Submission,
  reviewed = false,
): Promise<PrivateContribution> {
  checkConfiguration();
  const hash = await tokenHash(token);
  if (db)
    return await invoke("manage", {
      id,
      management_token: token,
      operation,
      revision,
      experience: original,
      public_version: candidate,
      privacy_reviewed: reviewed,
    });
  const records = privateRecords();
  const r = records.find((r) => r.id === id && r.management_hash === hash);
  if (!r) throw new Error("Invalid management link or token.");
  if (operation === "read") return r;
  if (revision !== r.revision)
    throw new Error("Revision conflict. Reload before editing.");
  if (operation === "withdraw") {
    r.status = "withdrawn";
    r.original = { ...r.original, consent_to_publish: false };
    r.privacy_reviewed = false;
  } else {
    if (!original || !candidate)
      throw new Error("Missing contribution content");
    r.original = submissionSchema.parse(original);
    r.public_candidate = publicCandidate({
      ...submissionSchema.parse(candidate),
      contributor_display_name: r.original.contributor_display_name,
      consent_to_publish: r.original.consent_to_publish,
    });
    if (r.original.consent_to_publish && !reviewed)
      throw new Error("Public review is required.");
    r.privacy_reviewed = reviewed;
    r.status = r.original.consent_to_publish ? "pending" : "draft";
  }
  r.revision++;
  writeRecords(records);
  return r;
}
export async function approveDemo(id: string, token: string) {
  if (db)
    throw new Error("Live publication is restricted to trusted moderation.");
  const hash = await tokenHash(token);
  const records = privateRecords();
  const r = records.find((r) => r.id === id && r.management_hash === hash);
  if (
    !r ||
    r.status !== "pending" ||
    !r.original.consent_to_publish ||
    !r.privacy_reviewed
  )
    throw new Error(
      "Only reviewed, consented pending contributions can be approved.",
    );
  r.status = "published";
  writeRecords(records);
  return r;
}
export async function recoverLegacyDemo() {
  if (db) throw new Error("Legacy recovery requires trusted administration.");
  const legacy = readLocal<Experience[]>("submissions", []).filter(
    (e) => submissionSchema.safeParse(e).success,
  );
  const links: { id: string; token: string; role: string }[] = [];
  for (const e of legacy) {
    if (privateRecords().some((r) => r.id === e.id)) continue;
    const token = newToken();
    await submitExperience({ ...e, consent_to_publish: false }, e.id, {
      token,
      publicVersion: publicCandidate(e),
      reviewed: false,
    });
    links.push({ id: e.id, token, role: e.role_title });
  }
  return links;
}
export async function synthesize(sources: Experience[]): Promise<Synthesis> {
  checkConfiguration();
  if (db)
    return await invoke("synthesis", {
      source_ids: sources.slice(0, 20).map((e) => e.id),
    });
  const current = await listExperiences();
  const selected = sources
    .slice(0, 20)
    .map((e) =>
      current.find(
        (c) =>
          c.id === e.id &&
          (e.revision === undefined || c.revision === e.revision),
      ),
    );
  if (selected.some((e) => !e))
    throw new Error(
      "Some sources were withdrawn or edited. Refresh the library.",
    );
  const result = aggregateExperiences(selected as Experience[]);
  saveLocal("synthesis-runs", [
    ...readLocal<{ id: string; source_ids: string[] }[]>(
      "synthesis-runs",
      [],
    ).slice(-99),
    { id: result.id, source_ids: result.source_ids },
  ]);
  return result;
}
export async function helpfulFeedback(input: Helpfulness, requestId: string) {
  checkConfiguration();
  const value = helpfulnessSchema.parse(input);
  if (db) {
    await invoke("helpfulness", { feedback: value, request_id: requestId });
    return;
  }
  if (
    value.target_type === "experience" &&
    !(await listExperiences()).some((e) => e.id === value.target_id)
  )
    throw new Error("This experience is no longer public.");
  if (
    value.target_type === "synthesis" &&
    !readLocal<{ id: string }[]>("synthesis-runs", []).some(
      (r) => r.id === value.target_id,
    )
  )
    throw new Error("Unknown synthesis reference.");
  const items = readLocal<(Helpfulness & { id: string; mode: string })[]>(
    "helpfulness",
    [],
  );
  if (!items.some((r) => r.id === requestId))
    saveLocal("helpfulness", [
      ...items,
      { ...value, id: requestId, mode: "demo" },
    ]);
}
export function helpfulnessSummary() {
  const items = readLocal<Helpfulness[]>("helpfulness", []);
  return {
    scope: "This browser only; demo helpfulness, not shared-server feedback",
    responses: items.length,
    yes: items.filter((i) => i.helpful).length,
    rate: items.length
      ? items.filter((i) => i.helpful).length / items.length
      : null,
  };
}
export function analyticsSummary() {
  const events = readLocal<
    { event: string; flow_id?: string; duration_ms?: number; mode: string }[]
  >("events", []);
  const starts = new Set(
    events
      .filter((e) => e.event === "submission_start" && e.flow_id)
      .map((e) => e.flow_id),
  );
  const completed = events.filter(
    (e) =>
      e.event === "submission_success" && e.flow_id && starts.has(e.flow_id),
  );
  const durations = completed
    .map((e) => e.duration_ms)
    .filter((n): n is number => typeof n === "number" && n >= 0)
    .sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  return {
    scope:
      "This browser only; demonstration and live events are labeled, not population research",
    submission_starts: starts.size,
    completed_flows: new Set(completed.map((e) => e.flow_id)).size,
    completion_rate: starts.size
      ? new Set(completed.map((e) => e.flow_id)).size / starts.size
      : null,
    median_session_completion_ms: durations.length
      ? durations.length % 2
        ? durations[mid]
        : (durations[mid - 1] + durations[mid]) / 2
      : null,
    searches: events.filter((e) => e.event === "experience_search").length,
    events_by_mode: {
      demo: events.filter((e) => e.mode === "demo").length,
      live: events.filter((e) => e.mode === "live").length,
    },
  };
}
export async function enrollReminder(
  input: ReminderInput,
  id: string,
  token: string,
) {
  checkConfiguration();
  const value = reminderSchema.parse(input);
  const hash = await tokenHash(token);
  if (db)
    return await invoke("reminder-enroll", {
      reminder: value,
      request_id: id,
      management_token: token,
    });
  const reminders = readLocal<Reminder[]>("reminders", []);
  const existing = reminders.find((r) => r.id === id);
  if (existing) {
    if (existing.management_hash !== hash)
      throw new Error("Enrollment conflict");
    return existing;
  }
  const reminder: Reminder = {
    ...value,
    id,
    management_hash: hash,
    status: "scheduled",
    attempts: 0,
    next_attempt_at: `${value.end_date}T09:00:00Z`,
  };
  saveLocal("reminders", [...reminders, reminder]);
  return reminder;
}
export async function manageReminder(
  id: string,
  token: string,
  operation: "read" | "unsubscribe" | "complete",
): Promise<Reminder> {
  checkConfiguration();
  const hash = await tokenHash(token);
  if (db)
    return await invoke("reminder-manage", {
      id,
      management_token: token,
      operation,
    });
  const reminders = readLocal<Reminder[]>("reminders", []);
  const reminder = reminders.find(
    (r) => r.id === id && r.management_hash === hash,
  );
  if (!reminder) throw new Error("Invalid reminder management link.");
  if (operation !== "read") {
    reminder.status =
      operation === "unsubscribe" ? "unsubscribed" : "completed";
    saveLocal("reminders", reminders);
  }
  return reminder;
}
export async function simulateReminder(
  id: string,
  token: string,
  now: Date,
  fail = false,
) {
  if (db) throw new Error("Simulation is available only in local demo mode.");
  await manageReminder(id, token, "read");
  const reminders = readLocal<Reminder[]>("reminders", []);
  const r = reminders.find((r) => r.id === id)!;
  if (!reminderEligible(r, now))
    return {
      eligible: false,
      reminder: r,
      message:
        "Not eligible: not due, already dispatched, opted out, completed, or retry limit reached.",
    };
  r.attempts++;
  if (fail) {
    r.status = r.attempts >= 3 ? "failed" : "retry";
    r.next_attempt_at = new Date(
      now.getTime() + 15 * 60000 * 2 ** (r.attempts - 1),
    ).toISOString();
    r.last_error = "Simulated provider failure";
  } else {
    r.status = "simulated";
    r.sent_at = now.toISOString();
  }
  saveLocal("reminders", reminders);
  return {
    eligible: true,
    reminder: r,
    message: fail
      ? "Simulated failure; no email sent."
      : "Simulated dispatch only. No email was sent.",
  };
}
export { newToken, publicCandidate, reminderMessage };
