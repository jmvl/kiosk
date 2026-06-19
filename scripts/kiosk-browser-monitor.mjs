import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const targetUrl = process.argv[2] ?? 'http://192.168.1.117:8787/player';
const outDir = process.argv[3] ?? 'qa-artifacts/kiosk-browser-monitor';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const consoleMessages = [];
const failedRequests = [];
page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => consoleMessages.push({ type: 'pageerror', text: error.message }));
page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));

async function shot(name) {
  const path = join(outDir, `${String(Date.now())}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

await page.goto(targetUrl, { waitUntil: 'networkidle' });
const idleScreenshot = await shot('idle');
await page.getByRole('button', { name: /TEMP: start game/i }).click();
await page.getByRole('button', { name: /Une pizza Ristorante/i }).click();
await page.getByRole('button', { name: /Faire tourner/i }).click();
await page.waitForTimeout(900);
const spinScreenshot = await shot('spin-window');
const spinCanvasCount = await page.locator('canvas').count();
const spinIframeCount = await page.locator('iframe').count();
await page.waitForFunction(() => !document.body.innerText.includes('La roue tourne'), null, { timeout: 20000 }).catch(() => null);
const resultScreenshot = await shot('result');
const bodyText = await page.locator('body').innerText();
const canvasCount = await page.locator('canvas').count();
const iframeCount = await page.locator('iframe').count();
await browser.close();

const errorMessages = consoleMessages.filter((message) => ['error', 'pageerror'].includes(message.type));
const summary = {
  targetUrl,
  screenshots: { idle: idleScreenshot, spin: spinScreenshot, result: resultScreenshot },
  canvasCount,
  iframeCount,
  spinCanvasCount,
  spinIframeCount,
  bodyText,
  consoleMessages,
  failedRequests,
  verdict: errorMessages.length === 0 && failedRequests.length === 0 && spinCanvasCount > 0 ? 'PASS' : 'FAIL',
};
console.log(JSON.stringify(summary, null, 2));
if (summary.verdict !== 'PASS') process.exitCode = 1;
