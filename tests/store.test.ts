import { beforeEach, expect, it, vi } from "vitest";
import { demoExperiences } from "../src/data";
import {
  listExperiences,
  readLocal,
  sendFeedback,
  submitExperience,
  track,
  approveDemo,
  publicCandidate,
} from "../src/store";
beforeEach(() => localStorage.clear());
it("persists a local submission once and sanitizes identity", async () => {
  const input = {
    ...demoExperiences[0],
    contributor_display_name: "Private Name",
  };
  const options = {
    token: "a".repeat(64),
    publicVersion: publicCandidate(input),
    reviewed: true,
  };
  await submitExperience(input, "test-id", options);
  await submitExperience(input, "test-id", options);
  expect(await listExperiences()).toHaveLength(10);
  await approveDemo("test-id", options.token);
  const entries = await listExperiences();
  expect(entries).toHaveLength(11);
  expect(entries[0].contributor_display_name).toBe("");
  expect(entries[0].provenance).toBe("local");
  expect(entries[0].model_version).toBe("demo-template");
});
it("stores valid feedback privately in this browser and rejects invalid ratings", async () => {
  await sendFeedback(
    { usefulness: 4, findability: 5, confusing: "", improve: "More examples" },
    "feedback-id",
  );
  expect(readLocal<unknown[]>("feedback", [])).toHaveLength(1);
  await expect(sendFeedback({ usefulness: 8 }, "bad")).rejects.toThrow();
});
it("labels local analytics and never captures query contents", () => {
  track("experience_search");
  const events = readLocal<Record<string, string>[]>("events", []);
  expect(events[0].mode).toBe("demo");
  expect(Object.keys(events[0]).sort()).toEqual(["at", "event", "mode"]);
});
it("recovers from malformed browser data", async () => {
  localStorage.setItem("echopath:submissions", "broken");
  expect(await listExperiences()).toHaveLength(10);
  localStorage.setItem("echopath:submissions", '{"wrong":"shape"}');
  expect(await listExperiences()).toHaveLength(10);
  localStorage.setItem("echopath:submissions", "[{}]");
  expect(await listExperiences()).toHaveLength(10);
});
it("reports browser storage failures instead of claiming a save", async () => {
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  try {
    await expect(
      submitExperience(demoExperiences[0], "failed-id", {
        token: "a".repeat(64),
        publicVersion: publicCandidate(demoExperiences[0]),
        reviewed: true,
      }),
    ).rejects.toThrow("Browser storage is unavailable");
  } finally {
    spy.mockRestore();
  }
});
