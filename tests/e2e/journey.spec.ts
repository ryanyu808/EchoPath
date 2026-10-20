import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("complete demo journey: landing, search, detail, roadmap, contribution, feedback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Learn from the paths/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore experiences", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Find a path that inspires yours." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search experiences" })
    .fill("northstar");
  await expect(page.locator(".experience-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Industry", exact: true })
    .selectOption("Technology");
  await expect(page.locator(".experience-card")).toHaveCount(1);
  await page.locator(".experience-card").click();
  await expect(
    page.getByRole("heading", {
      name: "Business Analytics Intern",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("TEMPLATE-EXTRACTED INSIGHTS")).toBeVisible();
  await page
    .getByRole("link", { name: "Build my preparation roadmap" })
    .click();
  await page.getByRole("button", { name: "Build my roadmap" }).click();
  await expect(
    page.getByRole("heading", { name: "Your path to Business Analyst." }),
  ).toBeVisible();
  await expect(
    page.getByText("Template · not AI generated", { exact: true }),
  ).toBeVisible();
  await page.locator(".milestone input").first().check();
  await page.reload();
  await expect(page.locator(".milestone input").first()).toBeChecked();
  await page.goto("/share");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Please enter at least 3 characters.").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fill fictional demo example" })
    .click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /I consent to anonymous publication/ })
    .check();
  await page
    .getByRole("button", { name: "Submit experience", exact: true })
    .click();
  await expect(
    page.getByText(
      "Review the anonymized public version before requesting publication.",
    ),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: /I reviewed this public version/ })
    .check();
  await page
    .getByRole("button", { name: "Submit experience", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your local demo submission is saved." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simulate approval & view insights" })
    .click();
  await expect(
    page.getByText("Browser-local submission", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Business Analytics Intern",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Give feedback" }).click();
  await page.getByLabel("How useful was EchoPath?").selectOption("5");
  await page.getByLabel("Was the information easy to find?").selectOption("4");
  await page
    .getByLabel("What would you improve?")
    .fill("More operations examples");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("echopath:feedback") || "[]").length,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});
test("all fictional detail routes, empty states, about, and responsive layout", async ({
  page,
}) => {
  await page.goto("/experiences");
  await expect(page.locator(".experience-card")).toHaveCount(10);
  await page
    .getByRole("combobox", { name: "Experience type", exact: true })
    .selectOption("Consulting Project");
  await expect(page.locator(".experience-card")).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "Search experiences" })
    .fill("no-such-record");
  await expect(page.getByText("No paths found just yet.")).toBeVisible();
  await page.getByRole("button", { name: "Reset search & filters" }).click();
  await expect(page.locator(".experience-card")).toHaveCount(10);
  for (let i = 1; i <= 10; i++) {
    await page.goto(`/experiences/demo-${i}`);
    await expect(
      page.getByRole("heading", { name: "What I actually did" }),
    ).toBeVisible();
  }
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: /Good advice shouldn’t/ }),
  ).toBeVisible();
  for (const route of [
    "/",
    "/experiences",
    "/share",
    "/roadmap",
    "/about",
    "/reminders",
    "/manage",
  ]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.screenshot({
    path: `test-results/landing-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("landing and library pass automated accessibility checks", async ({
  page,
}) => {
  for (const route of ["/", "/experiences", "/share", "/roadmap", "/about"]) {
    await page.goto(route);
    await expect(page.locator(".skeleton")).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(",")).join(";")}`,
      ),
    ).toEqual([]);
  }
});
