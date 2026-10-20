import { afterEach, expect, it, vi } from "vitest";
import { demoExperiences } from "../src/data";
const state = vi.hoisted(() => ({ records: [] as Record<string, unknown>[] }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: async () => ({ data: state.records, error: null }),
      }),
    }),
  }),
}));
async function load(relation: unknown) {
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fake-public-key");
  vi.resetModules();
  const insight = Array.isArray(relation) ? relation[0] : relation;
  state.records = [
    {
      id: demoExperiences[0].id,
      revision: 1,
      content: {
        ...demoExperiences[0],
        insights: insight,
        model_version: "test-model",
      },
    },
  ];
  const { listExperiences } = await import("../src/store");
  return listExperiences();
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it.each([false, true])(
  "reads validated live insights from object or array relation (array=%s)",
  async (array) => {
    const insight = {
      ...demoExperiences[0].insights,
      model_version: "test-model",
    };
    const result = await load(array ? [insight] : insight);
    expect(result).toHaveLength(1);
    expect(result[0].insights?.technical_skills).toEqual([
      "SQL",
      "Python",
      "Tableau",
    ]);
    expect(result[0].model_version).toBe("test-model");
    expect(result[0].provenance).toBe("published");
  },
);
it("keeps the original published experience accessible when stored insights are invalid", async () => {
  const result = await load({ technical_skills: "bad shape" });
  expect(result[0].responsibilities).toBe(demoExperiences[0].responsibilities);
  expect(result[0].responsibilities).toBeTruthy();
});
