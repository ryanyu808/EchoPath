import { z } from "zod";
import {
  type Experience,
  type Submission,
  type Insight,
  insightSchema,
  submissionSchema,
  extractTemplate,
  searchableTags,
  normalizeTag,
} from "./domain.ts";
export const tokenSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Use a valid 256-bit management token.");
export function newToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function tokenHash(token: string) {
  tokenSchema.parse(token);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export const publicFields = [
  "experience_type",
  "role_title",
  "company",
  "industry",
  "role_category",
  "year",
  "duration",
  "work_arrangement",
  "responsibilities",
  "projects",
  "typical_day",
  "tools",
  "challenges",
  "solutions",
  "valuable_skills",
  "lessons_learned",
  "advice",
  "outcomes",
  "culture",
] as const;
export function sensitiveWarnings(input: unknown): string[] {
  const content = typeof input === "string" ? input : JSON.stringify(input);
  const numericContent = content
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[date]")
    .replace(
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      "[date]",
    )
    .replace(
      /\b(?:Python|PostgreSQL|Postgres|Node(?:\.js)?|SQL Server|Tableau|Power BI|R)\s+v?\d+(?:\.\d+){0,3}\b/gi,
      "[software version]",
    );
  const flags: string[] = [];
  if (/\b\d[\d,.]*\s+(?:customers?|clients?|users?)\b/i.test(content))
    flags.push(
      "An exact customer or client count needs confidentiality review.",
    );
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(content))
    flags.push(
      "An email address could identify someone. Remove it from the public version.",
    );
  if (
    /(?:\+\d[\d ()-]{8,}\d|\b(?:\(\d{3}\)|\d{3})[- .]\d{3}[- .]\d{4}\b)/.test(
      numericContent,
    )
  )
    flags.push("A possible phone number or long identifier needs review.");
  if (
    /(?:[$€£]\s*\d[\d,.]*(?:\s*(?:million|billion|thousand|[kmb])\b)?|\b(?:revenue|budget|profit|sales|cost|arr|customers?|clients?|users?|conversion|retention|internal metrics?)\b[^.!?\n]{0,45}\b\d+(?:[,.]\d+)*(?:\s*%|\s*(?:million|billion|thousand))?)/i.test(
      numericContent,
    )
  )
    flags.push(
      "An exact financial figure, customer count, or internal metric may be confidential. Use a range or qualitative description if needed.",
    );
  if (
    /\b(?:my name is|manager named|supervisor named|client named|confidential client|client contact|employee id|student id)\b/i.test(
      content,
    )
  )
    flags.push(
      "Potentially identifying or confidential client information needs review.",
    );
  return flags;
}
export function redactText(value: string, privateName = "") {
  let s = value
    .replace(/\b[a-f0-9]{64}\b/gi, "[private token removed]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[contact removed]")
    .replace(
      /(?:\+\d[\d ()-]{8,}\d|\b\d{3}[- .]\d{3}[- .]\d{4}\b)/g,
      "[identifier removed]",
    )
    .replace(
      /\b(my name is|manager named|supervisor named|client named)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g,
      "[identity removed]",
    );
  if (privateName.trim().length >= 2) {
    const parts = [privateName, ...privateName.split(/\s+/)].filter(
      (p) => p.length >= 2,
    );
    for (const part of parts) {
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      s = s.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[identity removed]");
    }
  }
  return s;
}
export function publicCandidate(input: Submission): Submission {
  const parsed = input;
  const result = {
    ...parsed,
    anonymity_preference: "Anonymous" as const,
    contributor_display_name: "",
  };
  for (const key of publicFields) {
    if (typeof result[key] === "string")
      (result as Record<string, unknown>)[key] = redactText(
        String(result[key]),
        parsed.contributor_display_name,
      );
  }
  return result;
}
export function publicPayload(e: Experience) {
  const payload: Record<string, unknown> = {};
  for (const field of publicFields) payload[field] = e[field] ?? "";
  payload.insights = e.insights;
  payload.model_version = e.model_version;
  payload.search_tags = searchableTags(e);
  payload.created_at = e.created_at;
  return payload;
}
export function hydratePublic(
  id: string,
  content: Record<string, unknown>,
  revision = 1,
  provenance: Experience["provenance"] = "published",
): Experience {
  const base = submissionSchema.parse({
    ...content,
    anonymity_preference: "Anonymous",
    contributor_display_name: "",
    consent_to_publish: true,
  });
  return {
    ...base,
    id,
    status: "published",
    created_at: String(content.created_at ?? new Date().toISOString()),
    insights: insightSchema.safeParse(content.insights).success
      ? insightSchema.parse(content.insights)
      : undefined,
    model_version: String(content.model_version ?? "rules-no-ai"),
    search_tags: Array.isArray(content.search_tags)
      ? (content.search_tags as string[])
      : [],
    revision,
    provenance,
  };
}
// Only source-supported tags and literal approved passages can enter public insights.
export function safeInsights(e: Submission, ai?: Insight): Insight {
  const fallback = extractTemplate(e);
  if (!ai) return fallback;
  const corpus = publicFields
    .map((k) => String(e[k] ?? ""))
    .join(" ")
    .toLowerCase();
  const anchored = (items: string[]) =>
    [...new Set(items.map(normalizeTag))]
      .filter(
        (s) =>
          corpus.includes(s.toLowerCase()) ||
          publicFields.some((k) =>
            normalizeTag(String(e[k] ?? ""))
              .toLowerCase()
              .includes(s.toLowerCase()),
          ),
      )
      .slice(0, 30);
  return {
    ...fallback,
    technical_skills: anchored(ai.technical_skills),
    business_skills: anchored(ai.business_skills),
    tools: anchored(ai.tools),
    role_categories: anchored(ai.role_categories ?? []),
    industries: anchored(ai.industries ?? []),
  };
}
const passage = z.object({
  text: z.string().max(2000),
  source_ids: z.array(z.string()).min(1).max(20),
});
export const synthesisAISchema = z.object({
  responsibilities: z.array(passage).max(6),
  challenges: z.array(passage).max(6),
  advice: z.array(passage).max(6),
});
export type Passage = z.infer<typeof passage>;
export type Synthesis = {
  id: string;
  mode: string;
  source_ids: string[];
  source_count: number;
  skills: { tag: string; count: number }[];
  tools: { tag: string; count: number }[];
  responsibilities: Passage[];
  challenges: Passage[];
  advice: Passage[];
  differences: { source_id: string; text: string }[];
  limitation: string;
};
export function aggregateExperiences(
  sources: Experience[],
  mode = "Demo synthesis · deterministic aggregation, not AI",
): Synthesis {
  const frequencies = (get: (e: Experience) => string[]) => {
    const counts = new Map<string, { tag: string; count: number }>();
    for (const e of sources) {
      for (const tag of new Set(
        get(e)
          .map(normalizeTag)
          .map((t) => t.toLowerCase()),
      )) {
        const label = get(e)
          .map(normalizeTag)
          .find((t) => t.toLowerCase() === tag)!;
        counts.set(tag, {
          tag: label,
          count: (counts.get(tag)?.count ?? 0) + 1,
        });
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 8);
  };
  const excerpts = (key: "responsibilities" | "challenges" | "advice") =>
    sources
      .filter((e) => e[key])
      .slice(0, 6)
      .map((e) => ({ text: e[key].slice(0, 2000), source_ids: [e.id] }));
  return {
    id: crypto.randomUUID(),
    mode,
    source_ids: sources.map((e) => e.id),
    source_count: sources.length,
    skills: frequencies((e) =>
      searchableTags(e).filter(
        (t) =>
          !(e.insights?.industries ?? []).includes(t) &&
          !(e.insights?.role_categories ?? []).includes(t),
      ),
    ),
    tools: frequencies((e) =>
      [...e.tools.split(/[,;\n]/), ...(e.insights?.tools ?? [])]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    responsibilities: excerpts("responsibilities"),
    challenges: excerpts("challenges"),
    advice: excerpts("advice"),
    differences: sources.slice(0, 6).map((e) => ({
      source_id: e.id,
      text: `${e.company} (${e.role_title}): ${e.tools || "tools not specified"}; ${e.work_arrangement || "work arrangement not specified"}.`,
    })),
    limitation:
      sources.length < 2
        ? "Insufficient evidence for recurring patterns: fewer than two matching approved experiences."
        : sources.length > 20
          ? "Showing a bounded set of matching experiences. Counts apply only to the displayed sources."
          : "Counts are distinct matching experiences, not students or industry-wide statistics.",
  };
}
export function groundedSynthesis(
  ai: z.infer<typeof synthesisAISchema>,
  sources: Experience[],
) {
  for (const entries of Object.values(ai)) {
    for (const p of entries) {
      if (
        p.source_ids.some(
          (id) =>
            !sources.some(
              (e) =>
                e.id === id &&
                publicFields.some((k) => String(e[k] ?? "").includes(p.text)),
            ),
        )
      )
        throw new Error("Unsupported synthesis passage");
    }
  }
  return ai;
}
export const reminderSchema = z.object({
  experience_type: z.enum([
    "Internship",
    "Consulting Project",
    "Full-Time",
    "Other",
  ]),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (s) =>
        !Number.isNaN(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s,
      "Choose a valid date",
    ),
  email: z.email().max(254),
  consent: z.literal(true, { error: "Reminder consent is required." }),
});
export type ReminderInput = z.infer<typeof reminderSchema>;
export type Reminder = ReminderInput & {
  id: string;
  management_hash: string;
  unsubscribe_hash?: string;
  status:
    | "scheduled"
    | "processing"
    | "retry"
    | "sent"
    | "simulated"
    | "unsubscribed"
    | "completed"
    | "failed";
  attempts: number;
  next_attempt_at: string;
  lease_until?: string;
  claim_token?: string;
  sent_at?: string;
  last_error?: string;
};
export function reminderEligible(r: Reminder, now: Date) {
  return (
    ["scheduled", "retry", "processing"].includes(r.status) &&
    r.attempts < 3 &&
    Date.parse(r.next_attempt_at) <= now.getTime() &&
    (!r.lease_until || Date.parse(r.lease_until) <= now.getTime())
  );
}
export function reminderMessage(
  r: Pick<Reminder, "id" | "experience_type">,
  origin: string,
  token: string,
) {
  return {
    subject: "Your experience could help the next MSBA student",
    text: `Your ${r.experience_type} is wrapping up. Share a short, anonymous debrief on EchoPath.\n\nShare: ${origin}/share#reminder=${r.id}&token=${token}\nManage or unsubscribe: ${origin}/reminders#id=${r.id}&token=${token}\n\nIndependent student prototype; not an official USC service.`,
  };
}
export const helpfulnessSchema = z.object({
  target_type: z.enum(["experience", "synthesis"]),
  target_id: z.string().min(1).max(100),
  helpful: z.boolean(),
  comment: z.string().trim().max(2000).default(""),
});
export type Helpfulness = z.infer<typeof helpfulnessSchema>;
