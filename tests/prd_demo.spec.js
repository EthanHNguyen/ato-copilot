import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const evidencePayload = {
  name: 'prd-evidence-package.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([
    'control,artifact,evidence,reviewer,status',
    'AC-2,Q1 access review,Quarterly access review completed and inactive accounts are disabled after 30 days.,IAM team,partial',
    'AU-6,SIEM audit report,Weekly audit log review performed by designated SOC analyst with signed monthly summary.,SOC analyst,complete',
    'CM-6,SCAP scan,SCAP STIG baseline scan shows configuration benchmark compliance and approved deviations for exceptions.,Configuration manager,complete',
  ].join('\n')),
};

test('ATO-copilot End-to-End PRD Workflow', async ({ page }) => {
  // 1. Navigate to the app
  await page.goto(baseUrl);
  
  // 2. Upload an evidence package
  await page.getByTestId('evidence-file-input').setInputFiles(evidencePayload);
  
  // 3. Wait for the result card to appear (Deep Dive section)
  await expect(page.locator('text=Control Analysis Deep Dive')).toBeVisible({ timeout: 10000 });
  
  // 4. Verify Status Labels
  await expect(page.locator('text=[!] NEEDS PREP').first()).toBeVisible();
  await expect(page.locator('text=[✓] READY').first()).toBeVisible();
  
  // 5. Verify Deep Dive details
  await expect(page.locator('text=Predicted Reviewer Question')).toBeVisible();
  await expect(page.locator('text=Recommended Action')).toBeVisible();
  
  // 6. Verify Trust Layer (Reasoning Trace)
  await expect(page.locator('text=Reasoning Trace')).toBeVisible();
  
  // 7. Take Screenshot
  await page.screenshot({ path: 'docs/final-prd-demo.png', fullPage: true });
});
