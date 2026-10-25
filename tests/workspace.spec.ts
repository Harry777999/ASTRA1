import { expect, test } from "@playwright/test";

test("renders a real WebGL scene and calculates the USN scenario", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Большие идеи/ }),
  ).toBeVisible();
  await expect(page.locator('[data-testid="world"] canvas')).toBeVisible();
  await expect(page.locator(".world-label")).toHaveCount(6);
  await page.screenshot({
    path: "test-results/astra-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Запустить симуляцию" }).click();
  await expect(
    page.getByText("Симуляция рассчитана", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Цена подписки").fill("5000");
  await page.getByLabel("Цена подписки").press("Tab");
  await expect(page.getByLabel("Цена подписки")).toHaveValue("5000");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("astra-project-v1")!),
  );
  expect(stored.assumptions.price).toBe(5000);
  await page.getByLabel("Горизонт прогноза").fill("1");
  const breakdown = page.locator(".finance-breakdown");
  // First month: 59 customers × ₽5,000 = ₽295,000; USN = ₽17,700.
  await expect(breakdown).toContainText(/17\s*700/);
  await expect(breakdown).toContainText(/157\s*600/);
  expect(errors).toEqual([]);
});

test("adds, connects, deletes and restores a block, then persists it", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить блок", exact: true })
    .click();
  await page.getByRole("button", { name: /Юридический блок.*Бюджет/ }).click();
  await expect(page.locator(".world-label")).toHaveCount(7);
  await page.getByLabel("Блок назначения").selectOption("subscription");
  await page.getByRole("button", { name: "Добавить выбранную связь" }).click();
  await expect(page.locator(".edge-list")).toContainText("Подписка");
  await page.getByRole("button", { name: "Удалить блок", exact: true }).click();
  await expect(page.locator(".world-label")).toHaveCount(6);
  await page.getByRole("button", { name: "Отменить изменение" }).click();
  await expect(page.locator(".world-label")).toHaveCount(7);
  await page.reload();
  await expect(page.locator(".world-label")).toHaveCount(7);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("astra-project-v1")!),
  );
  expect(saved.connections).toHaveLength(6);
});

test("broken revenue funnel shows zero revenue; reconnecting restores it", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".world-label")
    .filter({ hasText: "SaaS-продукт" })
    .click();
  await page.getByRole("button", { name: "Удалить связь с Подписка" }).click();
  await expect(page.locator(".metric").first()).toContainText(/0\s*₽/);
  await page.getByRole("button", { name: "Соединить на карте" }).click();
  await page.locator(".world-label").filter({ hasText: "Подписка" }).click();
  await expect(page.locator(".metric").last()).toContainText("воронка собрана");
  await expect(page.locator(".edge-list")).toContainText("Подписка");
});

test("invalid import preserves data and valid export can be restored", async ({
  page,
}) => {
  await page.goto("/");
  const before = await page.evaluate(() =>
    localStorage.getItem("astra-project-v1"),
  );
  await page
    .getByLabel("Импорт JSON проекта")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1}'),
    });
  await expect(page.getByRole("status")).toContainText("Неверный формат");
  expect(
    await page.evaluate(() => localStorage.getItem("astra-project-v1")),
  ).toBe(before);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт", exact: true }).click();
  const file = await download;
  const filePath = await file.path();
  expect(file.suggestedFilename()).toBe("astra-project.json");
  await page.getByLabel("Импорт JSON проекта").setInputFiles(filePath!);
  await expect(page.getByRole("status")).toContainText("Проект импортирован");
  expect(
    await page.evaluate(() => localStorage.getItem("astra-project-v1")),
  ).toBe(before);
});

test("local advisors apply only an explicit scenario and T-Bank remains disconnected", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Разделы проекта" })
    .getByRole("button", { name: /Агенты/ })
    .click();
  await page.getByRole("button", { name: "Проверить модель" }).click();
  await expect(page.getByText("Проверка готова")).toHaveCount(3);
  await page.getByRole("button", { name: "Применить сценарий" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("astra-project-v1")!).assumptions.churn,
    ),
  ).toBe(4);
  await page.getByRole("button", { name: "Отменить изменение" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("astra-project-v1")!).assumptions.churn,
    ),
  ).toBe(5);
  await page
    .getByRole("navigation", { name: "Разделы проекта" })
    .getByRole("button", { name: "Подключения" })
    .click();
  await page.getByRole("button", { name: "План подключения" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Настоящие запросы в банк не отправляются",
  );
});

test("mobile layout remains usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".world-label")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/astra-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Добавить блок", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page
    .getByRole("button", { name: "Экономика", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Экономика вашего бизнеса" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
