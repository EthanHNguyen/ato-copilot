const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const docsDir = path.resolve(__dirname, '../docs');
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const evidencePayload = {
  name: 'demo-evidence-package.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([
    'control,artifact,evidence,reviewer,status',
    'AC-2,Q1 access review,Quarterly access review completed and inactive accounts are disabled after 30 days.,IAM team,partial',
    'AU-6,SIEM audit report,Weekly audit log review performed by designated SOC analyst with signed monthly summary.,SOC analyst,complete',
    'CM-6,SCAP scan,SCAP STIG baseline scan shows configuration benchmark compliance and approved deviations for exceptions.,Configuration manager,complete',
  ].join('\n')),
};

test.beforeAll(() => {
  fs.mkdirSync(docsDir, { recursive: true });
});

test('initiate package scan completes without crashing', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(baseUrl);
  await expect(page.getByText('INITIATE PACKAGE SCAN')).toBeVisible();
  await expect(page.getByText('DEMO DATA -- NO CUI')).toHaveCount(2);
  await page.screenshot({
    path: path.join(docsDir, 'package-scan-before.png'),
    fullPage: true,
  });

  await page.getByTestId('evidence-file-input').setInputFiles(evidencePayload);
  await page.waitForFunction(() => {
    const bodyText = document.body.innerText.toLowerCase();
    return bodyText.includes('running heuristic scan') ||
      bodyText.includes('control analysis deep dive');
  });
  await page.screenshot({
    path: path.join(docsDir, 'package-scan-loading.png'),
    fullPage: true,
  });

  await expect(page.getByText('Control Analysis Deep Dive')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('AC-2: Account Management')).toBeVisible();
  await expect(page.getByText('Predicted Reviewer Question')).toBeVisible();
  await expect(page.getByText('Recommended Action')).toBeVisible();
  await page.screenshot({
    path: path.join(docsDir, 'package-scan-complete.png'),
    fullPage: true,
  });

  expect(pageErrors).toEqual([]);
});

test('invalid scan responses show an error instead of crashing', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('http://localhost:8000/analyze', route => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'simulated scan failure' }),
    });
  });

  await page.goto(baseUrl);
  await page.getByTestId('evidence-file-input').setInputFiles(evidencePayload);
  await expect(page.getByText('Package scan failed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('INITIATE PACKAGE SCAN')).toBeVisible();
  await page.screenshot({
    path: path.join(docsDir, 'package-scan-error.png'),
    fullPage: true,
  });

  expect(pageErrors).toEqual([]);
});
