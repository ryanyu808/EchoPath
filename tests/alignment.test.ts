import { beforeEach, expect, it } from "vitest";
import { demoExperiences } from "../src/data";
import {
  filterExperiences,
  insightSchema,
  submissionSchema,
} from "../src/domain";
import {
  aggregateExperiences,
  groundedSynthesis,
  publicCandidate,
  publicPayload,
  safeInsights,
  sensitiveWarnings,
  reminderEligible,
  reminderSchema,
  tokenHash,
  newToken,
  type Reminder,
} from "../supabase/functions/_shared/alignment";
import {
  approveDemo,
  enrollReminder,
  helpfulFeedback,
  helpfulnessSummary,
  listExperiences,
  manageContribution,
  manageReminder,
  publicCandidate as candidate,
  readLocal,
  simulateReminder,
  submitExperience,
  synthesize,
  generateRoadmap,
} from "../src/store";
const token = "a".repeat(64);
const other = "b".repeat(64);
const sample = demoExperiences[0];
beforeEach(() => localStorage.clear());
it("streamlined intake permits optional detail and private saves but validates essential answers", () => {
  const e = {
    ...sample,
    projects: "",
    typical_day: "",
    challenges: "",
    solutions: "",
    lessons_learned: "",
    duration: "",
    consent_to_publish: false,
  };
  expect(submissionSchema.safeParse(e).success).toBe(true);
  expect(submissionSchema.safeParse({ ...e, tools: "" }).success).toBe(false);
  expect(submissionSchema.safeParse({ ...e, advice: "" }).success).toBe(false);
});
it("extracted tags and normalized aliases actually affect search and skill filtering", () => {
  const e = {
    ...sample,
    tools: "Postgres, MS Excel, PowerBI",
    valuable_skills: "Teamwork",
    responsibilities: "Used SQL and Tableau to review activation",
    insights: {
      ...sample.insights!,
      technical_skills: ["Tableau"],
      role_categories: [],
      industries: [],
    },
  };
  for (const q of [
    "PostgreSQL",
    "MS Excel",
    "Microsoft Excel",
    "Power BI",
    "Tableau",
  ])
    expect(filterExperiences([e], q, {}, "recent")).toHaveLength(1);
  expect(
    filterExperiences([e], "", { skills: "Tableau" }, "recent"),
  ).toHaveLength(1);
  expect(
    filterExperiences([sample], "Business Analytics Internship", {}, "recent"),
  ).toHaveLength(1);
});
it("flags exact confidential information without flagging ordinary dates or versions", () => {
  for (const s of [
    "Revenue was $120,000",
    "confidential budget 300000",
    "We served 2450 customers",
    "retention increased 12.5%",
    "client named Jane Smith",
    "jane@example.com",
  ])
    expect(sensitiveWarnings(s).length).toBeGreaterThan(0);
  for (const s of [
    "Python 3.11 and PostgreSQL 16",
    "I started on 2026-10-20",
    "We met on October 20, 2026",
    "I used 3 tools",
    "Client kickoff on 2026-10-20",
    "Budget planning meeting on October 20, 2026",
    "Customer analysis used Python 3.11",
  ])
    expect(sensitiveWarnings(s)).toEqual([]);
});
it("public payload excludes identity, contacts and tokens while preserving private wording", () => {
  const original = {
    ...sample,
    contributor_display_name: "Jane Smith",
    responsibilities:
      "Jane Smith analyzed reports. Email jane@example.com for details.",
  };
  const copy = publicCandidate(original);
  expect(original.responsibilities).toContain("jane@example.com");
  const payload = publicPayload({
    ...original,
    ...copy,
    insights: safeInsights(copy),
  });
  const raw = JSON.stringify(payload);
  expect(raw).not.toContain("Jane");
  expect(raw).not.toContain("jane@example");
  expect(payload).not.toHaveProperty("contributor_display_name");
  expect(payload).not.toHaveProperty("management_token");
});
it("AI cannot insert unsupported names, metrics or narrative into public insights", () => {
  const ai = insightSchema.parse({
    ...sample.insights,
    technical_skills: ["SQL", "Private Client Alice"],
    key_lessons: ["Alice generated $999999 revenue"],
    role_categories: [],
    industries: [],
  });
  const result = safeInsights(sample, ai);
  expect(result.technical_skills).toContain("SQL");
  expect(JSON.stringify(result)).not.toContain("Alice");
  expect(result.key_lessons).toEqual([sample.lessons_learned]);
});
it("synthesis counts distinct actual records and rejects unsupported passages", () => {
  const sources = [sample, demoExperiences[1]];
  const aggregate = aggregateExperiences(sources);
  expect(aggregate.source_count).toBe(2);
  expect(aggregate.skills.find((s) => s.tag === "Python")?.count).toBe(2);
  expect(aggregateExperiences([]).source_count).toBe(0);
  expect(aggregateExperiences([sample]).limitation).toContain(
    "Insufficient evidence",
  );
  expect(() =>
    groundedSynthesis(
      {
        responsibilities: [],
        challenges: [],
        advice: [{ text: "Invented quote", source_ids: [sample.id] }],
      },
      sources,
    ),
  ).toThrow("Unsupported");
});
it("management tokens are high entropy, hashed and scoped; edits and withdrawal invalidate publication", async () => {
  expect(newToken()).toMatch(/^[a-f0-9]{64}$/);
  expect(await tokenHash(token)).not.toBe(token);
  await submitExperience(sample, "own", {
    token,
    publicVersion: candidate(sample),
    reviewed: true,
  });
  await expect(manageContribution("own", other, "read")).rejects.toThrow(
    "Invalid",
  );
  expect(await listExperiences()).toHaveLength(10);
  await approveDemo("own", token);
  const sources = (await listExperiences()).filter((e) => e.id === "own");
  expect(sources).toHaveLength(1);
  await manageContribution(
    "own",
    token,
    "edit",
    1,
    { ...sample, role_title: "Revised Analytics Role" },
    candidate({ ...sample, role_title: "Revised Analytics Role" }),
    true,
  );
  expect(await listExperiences()).toHaveLength(10);
  await expect(approveDemo("own", other)).rejects.toThrow();
  await approveDemo("own", token);
  await expect(manageContribution("own", token, "withdraw", 1)).rejects.toThrow(
    "Revision conflict",
  );
  await manageContribution("own", token, "withdraw", 2);
  expect(await listExperiences()).toHaveLength(10);
  await expect(synthesize(sources)).rejects.toThrow("withdrawn");
  await expect(
    generateRoadmap(
      {
        target_role: "Analyst",
        target_industry: "Technology",
        existing_skills: "",
        target_skills: "SQL",
        weeks: 2,
      },
      sources,
    ),
  ).rejects.toThrow("withdrawn");
  const records = readLocal<Record<string, unknown>[]>(
    "private-contributions",
    [],
  );
  expect(records[0].management_hash).toBe(await tokenHash(token));
  expect(records[0]).not.toHaveProperty("management_token");
});
it("private contribution never appears in seeker data and review is required for publication", async () => {
  await submitExperience({ ...sample, consent_to_publish: false }, "private", {
    token,
    publicVersion: candidate(sample),
    reviewed: false,
  });
  expect(await listExperiences()).toHaveLength(10);
  await expect(approveDemo("private", token)).rejects.toThrow();
  await expect(
    submitExperience(sample, "bad", {
      token: other,
      publicVersion: candidate(sample),
      reviewed: false,
    }),
  ).rejects.toThrow("Review");
});
it("reminder eligibility, retries, duplicate prevention and opt-out are explicit demo behavior", async () => {
  const input = reminderSchema.parse({
    experience_type: "Internship",
    end_date: "2026-10-20",
    email: "test@example.com",
    consent: true,
  });
  await enrollReminder(input, "reminder", token);
  await enrollReminder(input, "reminder", token);
  expect(readLocal<Reminder[]>("reminders", [])).toHaveLength(1);
  await expect(manageReminder("reminder", other, "read")).rejects.toThrow(
    "Invalid",
  );
  const before = await simulateReminder(
    "reminder",
    token,
    new Date("2026-10-19T12:00:00Z"),
  );
  expect(before.eligible).toBe(false);
  const failure = await simulateReminder(
    "reminder",
    token,
    new Date("2026-10-20T09:01:00Z"),
    true,
  );
  expect(failure.reminder.status).toBe("retry");
  expect(
    reminderEligible(failure.reminder, new Date("2026-10-20T09:02:00Z")),
  ).toBe(false);
  const success = await simulateReminder(
    "reminder",
    token,
    new Date("2026-10-20T10:00:00Z"),
  );
  expect(success.message).toContain("No email");
  expect(success.reminder.status).toBe("simulated");
  expect(
    (
      await simulateReminder(
        "reminder",
        token,
        new Date("2026-10-21T10:00:00Z"),
      )
    ).eligible,
  ).toBe(false);
  await manageReminder("reminder", token, "unsubscribe");
  expect((await manageReminder("reminder", token, "read")).status).toBe(
    "unsubscribed",
  );
});
it("submission through a reminder link suppresses future dispatch", async () => {
  await enrollReminder(
    {
      experience_type: "Internship",
      end_date: "2026-10-20",
      email: "test@example.com",
      consent: true,
    },
    "r",
    token,
  );
  await submitExperience(sample, "s", {
    token: other,
    publicVersion: candidate(sample),
    reviewed: true,
    reminderId: "r",
    reminderToken: token,
  });
  expect((await manageReminder("r", token, "read")).status).toBe("completed");
  expect(
    (await simulateReminder("r", token, new Date("2026-10-21"))).eligible,
  ).toBe(false);
});
it("helpfulness references existing content, is private and does not invent rates", async () => {
  expect(helpfulnessSummary().rate).toBeNull();
  const result = await synthesize([sample]);
  await helpfulFeedback(
    {
      target_type: "synthesis",
      target_id: result.id,
      helpful: true,
      comment: "Useful",
    },
    "feedback",
  );
  await helpfulFeedback(
    {
      target_type: "synthesis",
      target_id: result.id,
      helpful: true,
      comment: "Useful",
    },
    "feedback",
  );
  expect(helpfulnessSummary()).toMatchObject({ responses: 1, yes: 1, rate: 1 });
  await expect(
    helpfulFeedback(
      {
        target_type: "experience",
        target_id: "withdrawn",
        helpful: false,
        comment: "",
      },
      "bad",
    ),
  ).rejects.toThrow("no longer public");
});

it("private capability strings cannot be copied into public fields", () => {
  const copy = publicCandidate({
    ...sample,
    advice: "My management token is " + token,
  });
  expect(JSON.stringify(publicPayload({ ...sample, ...copy }))).not.toContain(
    token,
  );
});
