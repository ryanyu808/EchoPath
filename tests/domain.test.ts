import { describe, it, expect } from "vitest";
import { demoExperiences } from "../src/data";
import {
  extractTemplate,
  filterExperiences,
  goalSchema,
  insightSchema,
  submissionSchema,
  templateRoadmap,
  displayName,
  roadmapSchema,
} from "../src/domain";
describe("experience discovery", () => {
  it("searches content case insensitively and combines filters", () => {
    expect(
      filterExperiences(
        demoExperiences,
        "sql",
        { industry: "Technology" },
        "recent",
      ),
    ).toHaveLength(2);
    expect(
      filterExperiences(demoExperiences, "reconciliation", {}, "recent")[0]
        .company,
    ).toBe("Aster Financial");
    expect(
      filterExperiences(
        demoExperiences,
        "",
        { experience_type: "Consulting Project", skills: "SQL" },
        "recent",
      ),
    ).toHaveLength(1);
  });
  it("sorts companies and clears filters", () => {
    const sorted = filterExperiences(demoExperiences, "", {}, "company");
    expect(sorted[0].company).toBe("Aster Financial");
    expect(sorted).toHaveLength(10);
    expect(
      filterExperiences(demoExperiences, "unfindable", {}, "recent"),
    ).toHaveLength(0);
  });
  it("has unique valid fictional samples and complete insights", () => {
    expect(new Set(demoExperiences.map((e) => e.id)).size).toBe(10);
    demoExperiences.forEach((e) => {
      expect(submissionSchema.safeParse(e).success).toBe(true);
      expect(insightSchema.safeParse(e.insights).success).toBe(true);
      expect(e.provenance).toBe("fictional");
    });
  });
});
describe("validation and privacy", () => {
  it("rejects missing content, supports private consent, and validates legacy names", () => {
    expect(submissionSchema.safeParse({}).success).toBe(false);
    expect(
      submissionSchema.safeParse({
        ...demoExperiences[0],
        consent_to_publish: false,
      }).success,
    ).toBe(true);
    expect(
      submissionSchema.safeParse({
        ...demoExperiences[0],
        anonymity_preference: "Display name",
        contributor_display_name: "",
      }).success,
    ).toBe(false);
  });
  it("displays only allowed contributor identity", () => {
    expect(
      displayName({
        ...demoExperiences[0],
        contributor_display_name: "Alex Sample",
        anonymity_preference: "First name only",
      }),
    ).toBe("Anonymous contributor");
    expect(displayName(demoExperiences[0])).toBe("Anonymous contributor");
  });
  it("validates AI extraction output and preserves literal evidence in templates", () => {
    expect(insightSchema.safeParse({ technical_skills: "SQL" }).success).toBe(
      false,
    );
    expect(
      insightSchema.safeParse({
        ...demoExperiences[0].insights,
        key_lessons: 42,
      }).success,
    ).toBe(false);
    expect(extractTemplate(demoExperiences[0]).key_lessons).toEqual([
      demoExperiences[0].lessons_learned,
    ]);
  });
});
describe("grounded roadmaps", () => {
  const goal = goalSchema.parse({
    target_role: "Business Analyst",
    target_industry: "Technology",
    existing_skills: "Excel",
    target_skills: "SQL",
    weeks: 4,
  });
  it("works without evidence and labels general suggestions", () => {
    const r = templateRoadmap(goal, []);
    expect(r.summary).toContain("No experience evidence");
    expect(r.tasks).toHaveLength(4);
    expect(r.tasks.every((t) => t.source_ids.length === 0)).toBe(true);
    expect(roadmapSchema.safeParse(r).success).toBe(true);
  });
  it("references only selected records and uses their actual advice", () => {
    const r = templateRoadmap(goal, [demoExperiences[0]]);
    expect(r.source_experience_ids).toEqual(["demo-1"]);
    expect(r.tasks[0].description).toContain(demoExperiences[0].advice);
    expect(
      r.tasks.every((t) => t.source_ids.every((id) => id === "demo-1")),
    ).toBe(true);
  });
  it("rejects unsupported duration and invalid roadmap shape", () => {
    expect(goalSchema.safeParse({ ...goal, weeks: 0 }).success).toBe(false);
    expect(roadmapSchema.safeParse({ tasks: [] }).success).toBe(false);
  });
});
