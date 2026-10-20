import { z } from "zod";
export const experienceTypes = [
  "Internship",
  "Consulting Project",
  "Full-Time",
  "Other",
] as const;
const text = z
  .string()
  .trim()
  .min(3, "Please enter at least 3 characters.")
  .max(5000);
export const submissionSchema = z
  .object({
    experience_type: z.enum(experienceTypes),
    role_title: text.max(120),
    company: text.max(120),
    industry: text.max(100),
    role_category: text.max(100),
    year: z.coerce.number().int().min(2000).max(2100),
    duration: z.string().trim().max(80).default(""),
    work_arrangement: z.string().max(80).default(""),
    responsibilities: text,
    projects: z.string().trim().max(5000).default(""),
    typical_day: z.string().trim().max(5000).default(""),
    tools: text,
    challenges: z.string().trim().max(5000).default(""),
    solutions: z.string().trim().max(5000).default(""),
    valuable_skills: text,
    lessons_learned: z.string().trim().max(5000).default(""),
    advice: text,
    contributor_display_name: z.string().trim().max(80),
    anonymity_preference: z.enum([
      "Anonymous",
      "First name only",
      "Display name",
    ]),
    consent_to_publish: z.boolean(),
    outcomes: z.string().trim().max(5000).optional(),
    culture: z.string().trim().max(5000).optional(),
  })
  .superRefine((v, c) => {
    if (
      v.anonymity_preference !== "Anonymous" &&
      !v.contributor_display_name.trim()
    )
      c.addIssue({
        code: "custom",
        path: ["contributor_display_name"],
        message: "Enter a display name.",
      });
  });
export type Submission = z.infer<typeof submissionSchema>;
const strings = z.array(z.string().max(2000)).max(30);
export const insightSchema = z.object({
  technical_skills: strings,
  business_skills: strings,
  tools: strings,
  main_responsibilities: strings,
  key_challenges: strings,
  key_lessons: strings,
  preparation_recommendations: strings,
  role_categories: strings.default([]),
  industries: strings.default([]),
});
export const extractionSchema = insightSchema.extend({
  role_categories: strings,
  industries: strings,
});
export type Insight = z.infer<typeof insightSchema>;
export type Experience = Submission & {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  insights?: Insight;
  model_version?: string;
  provenance?: "fictional" | "local" | "published";
  search_tags?: string[];
  revision?: number;
};
export const goalSchema = z.object({
  target_role: text.max(120),
  target_industry: text.max(100),
  existing_skills: z.string().max(500),
  target_skills: z.string().max(500),
  weeks: z.coerce.number().int().min(1).max(12),
});
export type Goal = z.infer<typeof goalSchema>;
export const roadmapSchema = z.object({
  summary: z.string().max(3000),
  skills: strings,
  technical_preparation: strings,
  business_preparation: strings,
  practice_projects: strings,
  interview_preparation: strings,
  tasks: z
    .array(
      z.object({
        title: z.string().max(200),
        description: z.string().max(2000),
        week_number: z.number().int().min(1).max(12),
        source_ids: z.array(z.string()).max(10),
      }),
    )
    .min(1)
    .max(36),
});
export type Roadmap = z.infer<typeof roadmapSchema> & {
  id: string;
  source_experience_ids: string[];
  completed: string[];
  mode: string;
  goal: Goal;
};
export const savedRoadmapSchema = roadmapSchema.extend({
  id: z.string(),
  source_experience_ids: z.array(z.string()),
  completed: z.array(z.string()),
  mode: z.string(),
  goal: goalSchema,
});
export const feedbackSchema = z.object({
  usefulness: z.coerce.number().int().min(1).max(5),
  findability: z.coerce.number().int().min(1).max(5),
  confusing: z.string().trim().max(3000),
  improve: z.string().trim().max(3000),
});
export const split = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
export const displayName = (_e: Experience) => {
  void _e;
  return "Anonymous contributor";
};
export function normalizeTag(value: string) {
  const key = value.trim().replace(/\s+/g, " ").toLowerCase();
  const aliases: Record<string, string> = {
    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",
    "ms excel": "Excel",
    "microsoft excel": "Excel",
    excel: "Excel",
    powerbi: "Power BI",
    "power bi": "Power BI",
    sql: "SQL",
    python: "Python",
    tableau: "Tableau",
  };
  return aliases[key] ?? value.trim().replace(/\s+/g, " ");
}
export function searchableTags(e: Experience) {
  return [
    ...new Map(
      [
        ...split(e.tools),
        ...split(e.valuable_skills),
        ...(e.insights?.technical_skills ?? []),
        ...(e.insights?.business_skills ?? []),
        ...(e.insights?.tools ?? []),
        ...(e.insights?.role_categories ?? []),
        ...(e.insights?.industries ?? []),
        ...(e.search_tags ?? []),
      ].map((s) => {
        const n = normalizeTag(s);
        return [n.toLowerCase(), n];
      }),
    ).values(),
  ].filter(Boolean);
}
export function skillTags(e: Experience) {
  const categories = [
    e.industry,
    e.role_category,
    ...(e.insights?.role_categories ?? []),
    ...(e.insights?.industries ?? []),
  ].map((s) => normalizeTag(s).toLowerCase());
  return searchableTags(e).filter((s) => !categories.includes(s.toLowerCase()));
}
export function extractTemplate(e: Submission): Insight {
  const excerpt = (s: string) => (s.length > 1999 ? s.slice(0, 1998) + "…" : s);
  const list = (s: string) => split(s).slice(0, 30).map(excerpt);
  return {
    technical_skills: list(e.tools),
    business_skills: list(e.valuable_skills),
    tools: list(e.tools),
    main_responsibilities: [excerpt(e.responsibilities)].filter(Boolean),
    key_challenges: [excerpt(e.challenges)].filter(Boolean),
    key_lessons: [excerpt(e.lessons_learned)].filter(Boolean),
    preparation_recommendations: [excerpt(e.advice)],
    role_categories: [e.role_category],
    industries: [e.industry],
  };
}
export function filterExperiences(
  items: Experience[],
  q: string,
  filters: Record<string, string>,
  sort: string,
) {
  const normalized = (s: string) =>
    normalizeTag(s)
      .toLowerCase()
      .replace(/\binternships?\b/g, "intern")
      .replace(/\banalytics\b/g, "analytic");
  const query = normalizeTag(q)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalized);
  return items
    .filter(
      (e) =>
        (!query.length ||
          query.every((term) =>
            normalized(
              [
                e.role_title,
                e.company,
                e.industry,
                e.tools,
                e.valuable_skills,
                e.responsibilities,
                e.lessons_learned,
                e.advice,
                ...searchableTags(e),
              ].join(" "),
            ).includes(term),
          )) &&
        Object.entries(filters).every(
          ([key, value]) =>
            !value ||
            (key === "skills"
              ? skillTags(e).some(
                  (s) =>
                    normalizeTag(s).toLowerCase() ===
                    normalizeTag(value).toLowerCase(),
                )
              : key === "role_category"
                ? [
                    e.role_category,
                    ...(e.insights?.role_categories ?? []),
                  ].some((s) => s.toLowerCase() === value.toLowerCase())
                : key === "industry"
                  ? [e.industry, ...(e.insights?.industries ?? [])].some(
                      (s) => s.toLowerCase() === value.toLowerCase(),
                    )
                  : String(e[key as keyof Experience]) === value),
        ),
    )
    .sort((a, b) =>
      sort === "company"
        ? a.company.localeCompare(b.company)
        : sort === "role"
          ? a.role_title.localeCompare(b.role_title)
          : b.year - a.year || b.created_at.localeCompare(a.created_at),
    );
}
export function templateRoadmap(goal: Goal, sources: Experience[]): Roadmap {
  const skills = [
    ...new Set([
      ...split(goal.target_skills),
      ...sources.flatMap((e) => split(e.tools)),
    ]),
  ]
    .filter(
      (s) =>
        !split(goal.existing_skills).some(
          (k) => k.toLowerCase() === s.toLowerCase(),
        ),
    )
    .slice(0, 8);
  const focus = skills.length
    ? skills
    : ["business problem framing", "data analysis"];
  const tasks = Array.from({ length: goal.weeks }, (_, i) => {
    const source = sources.length ? sources[i % sources.length] : undefined;
    const skill = focus[i % focus.length];
    return {
      title:
        i === goal.weeks - 1
          ? "Present your work and rehearse your story"
          : `Practice ${skill} with a business question`,
      description:
        i === goal.weeks - 1
          ? `Prepare a five-minute presentation for a ${goal.target_role} interview. Explain the question, approach, limitations, and recommendation. Ask a peer for feedback.`
          : `Use a public or synthetic dataset in ${goal.target_industry}. Practice ${skill}, answer three stakeholder questions, and write a one-page recommendation. ${source ? `Contributor advice${source.advice.length > 900 ? " (excerpt)" : ""} from ${source.company}: ${source.advice.slice(0, 900)}` : "General recommendation: document assumptions and check your results with a peer."}`,
      week_number: i + 1,
      source_ids: source && i !== goal.weeks - 1 ? [source.id] : [],
    };
  });
  return {
    ...roadmapSchema.parse({
      summary: `A ${goal.weeks}-week preparation plan for ${goal.target_role}. ${sources.length ? "Selected experiences supply the cited advice. Weekly exercises are general template suggestions." : "No experience evidence selected. All recommendations below are general template suggestions."}`,
      skills: focus,
      technical_preparation: focus.map(
        (s) =>
          `Practice ${s} on public data; document your approach and validate the result.`,
      ),
      business_preparation: [
        "Write a problem statement, success metric, and stakeholder decision before starting an analysis.",
      ],
      practice_projects: [
        `Build a small ${goal.target_industry} analysis with a reproducible workflow and one-page executive brief.`,
      ],
      interview_preparation: [
        "Rehearse a two-minute project story covering your decision, tradeoffs, and measurable result.",
      ],
      tasks,
    }),
    id: crypto.randomUUID(),
    source_experience_ids: sources.map((e) => e.id),
    completed: [],
    mode: "Template · not AI generated",
    goal,
  };
}
