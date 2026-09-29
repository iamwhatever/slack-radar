// Render the three mockups to PNG at 1280x900 with Playwright's Chromium.
//   KIROCREW_WEBSITE=/path/to/KiroCrew/website node design/mockups/shoot.mjs
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const site = process.env.KIROCREW_WEBSITE
if (!site) throw new Error('set KIROCREW_WEBSITE to a KiroCrew/website checkout (for playwright-core)')
const pw = createRequire(path.join(site, 'package.json'))('playwright-core')
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const name of ['a-board-first', 'b-workbench-first', 'c-digest-first']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(pathToFileURL(path.join(here, `${name}.html`)).href)
    await page.screenshot({ path: path.join(here, `${name}.png`) })
    console.log('wrote', `${name}.png`)
    await page.close()
  }
} finally {
  await browser.close()
}
