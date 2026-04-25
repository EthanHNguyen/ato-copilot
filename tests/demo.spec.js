const { test, expect } = require('@playwright/test');
const path = require('path');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const evidencePayload = {
  name: 'agent-evidence-package.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([
    'control,artifact,evidence,reviewer,status',
    'AC-2,Q1 access review,Quarterly access review completed and inactive accounts are disabled after 30 days.,IAM team,partial',
    'AU-6,SIEM audit report,Weekly audit log review performed by designated SOC analyst with signed monthly summary.,SOC analyst,complete',
    'CM-6,SCAP scan,SCAP STIG baseline scan shows configuration benchmark compliance and approved deviations for exceptions.,Configuration manager,complete',
  ].join('\n')),
};

test('should run the agent review and show cited AC-2 gaps', async ({ page }) => {
  await page.goto(baseUrl);

  await expect(page.getByText('INITIATE PACKAGE SCAN')).toBeVisible();
  await page.getByTestId('evidence-file-input').setInputFiles(evidencePayload);

  await expect(page.getByText('Control Analysis Deep Dive')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Agent Plan')).toBeVisible();
  await expect(page.getByText('Tool Trace')).toBeVisible();
  await expect(page.getByText('Evidence Claims')).toBeVisible();
  await expect(page.getByText('AC-2: Account Management')).toBeVisible();
  await expect(page.getByText('Temporary account lifecycle', { exact: true })).toBeVisible();

  await page.screenshot({
    path: path.resolve(__dirname, '../docs/demo-screenshot.png'),
    fullPage: true,
  });
});
