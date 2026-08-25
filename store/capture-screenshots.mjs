import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "screenshots");
const url = process.env.APP_URL ?? "http://localhost:5173/";

function launchBrowser() {
  const channels = ["msedge", "chrome", "chrome-beta"];
  const errors = [];
  return (async () => {
    for (const channel of channels) {
      try {
        return await chromium.launch({ channel, headless: true });
      } catch (err) {
        errors.push(`${channel}: ${err instanceof Error ? err.message : err}`);
      }
    }
    throw new Error(`브라우저를 찾지 못했습니다.\n${errors.join("\n")}`);
  })();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    locale: "ko-KR",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("volleyball-playbook");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      }),
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "새 전술 앨범" }).click();
  await page.getByPlaceholder("예: 리시브 훈련").fill("리시브 훈련");
  await page.getByRole("button", { name: "만들기" }).click();
  await page.getByRole("button", { name: "새 전술" }).click();
  await page.getByPlaceholder("예: A퀵 페이크 공격").fill("A퀵 페이크");
  await page.getByRole("button", { name: "만들기" }).click();
  await page.getByRole("button", { name: "저장" }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(outDir, "02-editor-half.png"),
    type: "png",
  });
  await page.getByRole("button", { name: "뒤로" }).click();
  const leaveSkip = page.getByRole("button", { name: "저장 안 함" });
  const leaveSave = page.getByRole("button", { name: "저장" });
  if (await leaveSkip.isVisible().catch(() => false)) {
    await leaveSave.click();
  }
  await page.getByRole("button", { name: "← 뒤로" }).click();
  await page.getByRole("heading", { name: "전술 보드" }).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "01-home.png"),
    type: "png",
  });
  await page.getByRole("button", { name: "백업 저장" }).click();
  await page.getByText("백업 파일(.vpb)을 저장했습니다").waitFor();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(outDir, "03-backup-save.png"),
    type: "png",
  });
  await browser.close();
  console.log(`saved ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
