const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: {
      dir: 'test-results/videos/',
      size: { width: 1280, height: 720 }
    }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');
    
    console.log('Clicking INITIATE PACKAGE SCAN...');
    await page.click('text=INITIATE PACKAGE SCAN');
    
    console.log('Waiting for Control Analysis Deep Dive...');
    await page.waitForSelector('text=Control Analysis Deep Dive', { timeout: 15000 });
    
    console.log('Verifying status labels...');
    if (!(await page.isVisible('text=[!] NEEDS PREP'))) throw new Error('[!] NEEDS PREP not found');
    if (!(await page.isVisible('text=[✓] READY'))) throw new Error('[✓] READY not found');
    
    console.log('Verifying deep dive details...');
    if (!(await page.isVisible('text=Predicted Reviewer Question'))) throw new Error('Predicted Reviewer Question not found');
    if (!(await page.isVisible('text=Recommended Action'))) throw new Error('Recommended Action not found');
    
    console.log('Verifying Reasoning Trace...');
    if (!(await page.isVisible('text=Reasoning Trace'))) throw new Error('Reasoning Trace not found');

    // Wait a bit to show the results in the video
    await page.waitForTimeout(3000);
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'docs/final-prd-demo.png', fullPage: true });

  } catch (error) {
    console.error('Error during recording:', error);
    process.exit(1);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const videoPath = await video.path();
      const finalPath = path.join(__dirname, 'docs/demo-video-terminal.webm');
      fs.copyFileSync(videoPath, finalPath);
      console.log(`Video saved to ${finalPath}`);
    }
  }
})();
