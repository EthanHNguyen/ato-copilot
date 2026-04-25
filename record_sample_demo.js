const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const docsDir = path.join(__dirname, 'docs');
  const videoDir = path.join(docsDir, 'videos');
  fs.mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1500);

    await page
      .getByTestId('evidence-file-input')
      .setInputFiles(path.join(__dirname, 'docs/sample-evidence/ato-test-evidence.csv'));

    await page.getByText('Control Analysis Deep Dive').waitFor({ timeout: 30000 });
    await page.getByText('AI-GENERATED REVIEWER INSIGHT').waitFor({ timeout: 5000 });
    await page.getByText('ato-test-evidence.csv').first().waitFor({ timeout: 5000 });
    await page.waitForTimeout(2500);

    await page.getByText('AU-6').click();
    await page.getByText('AU-6: Audit Review, Analysis, and Reporting').waitFor({ timeout: 5000 });
    await page.waitForTimeout(2500);

    await page.getByText('CM-6').click();
    await page.getByText('CM-6: Configuration Settings').waitFor({ timeout: 5000 });
    await page.waitForTimeout(2500);

    await page.getByText('AC-2').click();
    await page.getByText('AC-2: Account Management').waitFor({ timeout: 5000 });
    await page.waitForTimeout(2500);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const sourcePath = await video.path();
      fs.copyFileSync(sourcePath, path.join(docsDir, 'sample-evidence-demo.webm'));
    }
  }
})();
