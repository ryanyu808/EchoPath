import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("skills synthesis, source counts and contextual feedback work together", async ({
  page,
}) => {
  await page.goto("/experiences");
  await page.getByRole("textbox", { name: "Search experiences" }).fill("SQL");
  await expect(page.locator(".experience-card")).toHaveCount(6);
  const matching = await page.locator(".experience-card").count();
  await page
    .getByRole("button", { name: "Synthesize matching experiences" })
    .click();
  await expect(page.locator(".synthesis-result")).toBeVisible();
  await expect(
    page.getByText(`${matching} contributing experiences`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo synthesis · deterministic aggregation, not AI", {
      exact: true,
    }),
  ).toBeVisible();
  const panel = page.getByRole("region", {
    name: "Helpfulness feedback for synthesis",
  });
  await panel.getByRole("button", { name: "Yes", exact: true }).click();
  await panel
    .getByLabel("Optional comment")
    .fill("The source references help.");
  await panel
    .getByRole("button", { name: "Save helpfulness feedback" })
    .click();
  await expect(
    panel.getByText(/Thanks. Your feedback is private/),
  ).toBeVisible();
  await page.locator(".experience-card").first().click();
  const detail = page.getByRole("region", {
    name: "Helpfulness feedback for experience",
  });
  await detail.getByRole("button", { name: "No", exact: true }).click();
  await detail
    .getByRole("button", { name: "Save helpfulness feedback" })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("echopath:helpfulness") || "[]").length,
    ),
  ).toBe(2);
});
test("draft resume, anonymous approval, editing and withdrawal preserve the privacy boundary", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/share");
  await page
    .getByRole("textbox", { name: /Role title/ })
    .fill("Drafted analytics role");
  await page.reload();
  await expect(page.getByRole("textbox", { name: /Role title/ })).toHaveValue(
    "Drafted analytics role",
  );
  await page
    .getByRole("button", { name: "Fill fictional demo example" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("textbox", { name: /What were your main responsibilities/ })
    .fill("I used SQL with manager named Jane Doe to validate reports.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("textbox", {
      name: "What business outcomes did your work support? Optional",
    })
    .fill("Revenue increased $125000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText(/An exact financial figure/)).toBeVisible();
  await page
    .getByRole("checkbox", { name: /I consent to anonymous publication/ })
    .check();
  await page
    .getByRole("checkbox", { name: /I reviewed this public version/ })
    .check();
  await page
    .getByRole("button", { name: "Submit experience", exact: true })
    .click();
  const link = await page
    .getByRole("textbox", { name: /Save your private management link/ })
    .inputValue();
  const id = new URLSearchParams(new URL(link).hash.slice(1)).get("id");
  await page
    .getByRole("button", { name: "Simulate approval & view insights" })
    .click();
  await expect(
    page.getByText("Anonymous contributor", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Jane Doe", { exact: false })).toHaveCount(0);
  await page.goto(link);
  await expect(
    page.getByRole("heading", {
      name: "Business Analytics Intern",
      exact: true,
      level: 2,
    }),
  ).toBeVisible();
  await page
    .getByText("Review and edit original answers (private)", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Original: Role title", exact: true })
    .fill("Revised Analytics Intern");
  await page.getByText("Edit the public wording", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Public: Role title", exact: true })
    .fill("Revised Analytics Intern");
  await page
    .getByRole("checkbox", { name: /I reviewed this public version/ })
    .check();
  await page
    .getByRole("button", { name: "Save changes & sharing choice" })
    .click();
  await expect(page.getByText("pending · revision 2")).toBeVisible();
  await page.goto(`/experiences/${id}`);
  await expect(
    page.getByRole("heading", { name: "Experience not found" }),
  ).toBeVisible();
  await page.goto(link);
  await page
    .getByRole("button", { name: "Simulate moderator approval" })
    .click();
  await expect(page.getByText("published · revision 2")).toBeVisible();
  await page
    .getByRole("button", { name: "Withdraw contribution", exact: true })
    .click();
  await expect(page.getByText("withdrawn · revision 3")).toBeVisible();
  await page.goto(`/experiences/${id}`);
  await expect(
    page.getByRole("heading", { name: "Experience not found" }),
  ).toBeVisible();
});
test("reminder demo previews, retries and suppresses dispatch without sending email", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/reminders");
  await page
    .getByLabel("Expected end date", { exact: true })
    .fill("2026-10-19");
  await page
    .getByLabel("Contact email", { exact: true })
    .fill("tester@example.com");
  await page
    .getByRole("checkbox", {
      name: /I consent to an experience-debrief reminder/,
    })
    .check();
  await page.getByRole("button", { name: "Schedule my reminder" }).click();
  await expect(
    page.getByRole("heading", { name: "Your reminder", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Advance demo clock to next due time" })
    .click();
  await page.getByRole("button", { name: "Simulate provider failure" }).click();
  await expect(page.getByText("retry", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Advance demo clock to next due time" })
    .click();
  await page
    .getByRole("button", { name: "Simulate dispatch — no email" })
    .click();
  await expect(
    page.getByText("Simulated dispatch only. No email was sent.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simulate dispatch — no email" })
    .click();
  await expect(page.getByText(/Not eligible: not due/)).toBeVisible();
  await page
    .getByRole("link", { name: "Share now & suppress reminder" })
    .click();
  await page
    .getByRole("button", { name: "Fill fictional demo example" })
    .click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit experience", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your local demo submission is saved." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("echopath:reminders") || "[]")[0]
          .status,
    ),
  ).toBe("completed");
});
test("new interactive states retain accessible controls and mobile layout", async ({
  page,
}) => {
  for (const path of ["/reminders", "/manage", "/share"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.goto("/experiences");
  await page
    .getByRole("button", { name: "Synthesize matching experiences" })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/synthesis-${test.info().project.name}.png`,
    fullPage: true,
  });
});
