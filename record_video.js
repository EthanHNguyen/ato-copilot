const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  // Ensure docs directory exists
  const docsDir = path.join(__dirname, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: {
      dir: 'docs/videos/',
      size: { width: 1280, height: 720 }
    }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3005...');
    await page.goto('http://localhost:3005');

    console.log('Clicking upload...');
    await page.click('text=Upload Control Evidence');

    console.log('Waiting for analysis to complete...');
    await page.waitForSelector('text=Analysis Complete', { timeout: 30000 });

    // Wait to reach 15 seconds total
    console.log('Waiting to complete 15 seconds...');
    await page.waitForTimeout(10000); 

  } catch (error) {
    console.error('Error during recording:', error);
  } finally {
    await context.close();
    await browser.close();

    // Find the recorded video and move it to the final destination
    const videoFile = await page.video().path();
    const finalPath = path.join(__dirname, 'docs/demo-video.webm');
    fs.renameSync(videoFile, finalPath);
    console.log(`Video saved to ${finalPath}`);
    
    // Clean up videos directory if empty
    const videoDir = path.join(__dirname, 'docs/videos/');
    if (fs.existsSync(videoDir) && fs.readdirSync(videoDir).length === 0) {
      fs.rmdirSync(videoDir);
    }
  }
})();
