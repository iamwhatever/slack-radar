// Render the README screenshots from FAKE demo data (fake-sdk.tsx). Nothing here talks
// to a gateway, a ledger or Slack.
//
// Needs a KiroCrew checkout for the host UI components, theme and toolchain:
//   KIROCREW_WEBSITE=/path/to/KiroCrew/website node docs/screenshots/capture/shoot.mjs
// Optional: CHROMIUM_PATH=/path/to/chrome (else Playwright's cached browser).
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(here, '..')
const site = process.env.KIROCREW_WEBSITE
if (!site) throw new Error('set KIROCREW_WEBSITE to a KiroCrew/website checkout')
const req = createRequire(path.join(site, 'package.json'))
const load = async (m) => import(pathToFileURL(req.resolve(m)).href)

const { createServer } = await load('vite')
const react = (await load('@vitejs/plugin-react')).default
const tailwindcss = (await load('@tailwindcss/vite')).default
const pw = await load('playwright-core')
const chromium = pw.chromium || pw.default.chromium
const nm = path.join(site, 'node_modules')

const server = await createServer({
  configFile: false,
  root: here,
  logLevel: 'warn',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@kirocrew\/app-sdk\/ui$/, replacement: path.join(site, 'src/components/ui.tsx') },
      { find: /^@kirocrew\/app-sdk$/, replacement: path.join(here, 'fake-sdk.tsx') },
      { find: /^@host\//, replacement: path.join(site, 'src') + '/' },
      // One React for the app and the host components.
      { find: /^react$/, replacement: path.join(nm, 'react') },
      { find: /^react\/(.*)$/, replacement: path.join(nm, 'react') + '/$1' },
      { find: /^react-dom$/, replacement: path.join(nm, 'react-dom') },
      { find: /^react-dom\/(.*)$/, replacement: path.join(nm, 'react-dom') + '/$1' },
    ],
  },
  server: { port: 5287, strictPort: true, host: '127.0.0.1', fs: { allow: [path.resolve(here, '../../..'), site] } },
})
await server.listen()
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

const shots = [
  { name: 'board', source: 'ok', tab: null },
  { name: 'needs-you', source: 'ok', tab: null, clip: 'Needs you', openHandled: true, openHandoffs: true, openReplied: true },
  { name: 'chat-expanded', source: 'ok', tab: null, chat: true },
  { name: 'settings', source: 'ok', tab: 'Settings', wait: 'Basics', open: 'Advanced' },
  { name: 'team', source: 'ok', tab: 'Team', wait: 'Only the Radar Lead has a session' },
  { name: 'needs-login', source: 'needs_login', tab: null },
]
const errors = []
try {
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${s.name}] ${e.message}`))
    await page.goto(`http://127.0.0.1:5287/index.html?source=${s.source}`)
    await page.getByText('Slack connection:').first().waitFor({ timeout: 30000 })
    if (s.tab) {
      await page.getByRole('tab', { name: s.tab, exact: true }).click()
      await page.getByText(s.wait).first().waitFor()
      if (s.open) await page.getByText(s.open, { exact: true }).click()
    }
    if (s.chat) await page.getByRole('button', { name: 'What needs me today?' }).first().click()
    if (s.openHandled) await page.getByText(/^Handled \(/).click()
    if (s.openHandoffs) await page.getByText(/^Fixes handed off \(/).click()
    if (s.openReplied) await page.getByText(/^Replied \(/).click()
    await page.waitForTimeout(400)
    if (s.clip) {
      // One card only: the Card that holds this title.
      const card = page.getByText(s.clip, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
      const file = path.join(outDir, `${s.name}.png`)
      await card.screenshot({ path: file })
      console.log('wrote', file)
      await ctx.close()
      continue
    }
    // The page scrolls inside its own container; capture the full content height.
    const h = await page.evaluate(() => Math.max(...[...document.querySelectorAll('*')].map((e) => e.scrollHeight)))
    await page.setViewportSize({ width: 1280, height: Math.min(Math.max(h + 40, 900), 2400) })
    await page.waitForTimeout(200)
    const file = path.join(outDir, `${s.name}.png`)
    await page.screenshot({ path: file })
    console.log('wrote', file)
    await ctx.close()
  }
  // DOM checks: the Lead's line renders as text when set and not at all when empty.
  for (const [q, want] of [['', 'set'], ['&today=empty', 'empty']]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[today ${want}] ${e.message}`))
    await page.goto(`http://127.0.0.1:5287/index.html?source=ok${q}`)
    await page.getByText('Needs you', { exact: true }).first().waitFor({ timeout: 30000 })
    const lines = await page.getByTestId('crew-today').allTextContents()
    const ok = want === 'set' ? lines.length === 1 && lines[0].startsWith('Two p1 bugs need an owner') : lines.length === 0
    if (!ok) errors.push(`[today ${want}] crew-today lines: ${JSON.stringify(lines)}`)
    else console.log(`check today ${want}: ok`, JSON.stringify(lines))
    await ctx.close()
  }
  // DOM check: a hand-off row shows Start fix session + Ignore (Done in the menu), and
  // clicking it opens a draft-only chat carrying the prompt.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[handoff] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const row = page.getByText('Fix: Raise the CSV export row limit (issue #412)').locator('xpath=ancestor::li[1]')
    await row.waitFor({ timeout: 30000 })
    const buttons = await row.locator(':scope > div > div:last-child > button').allTextContents()
    await row.getByRole('button', { name: 'Start fix session' }).click()
    const launched = await page.evaluate(() => window.__launched || [])
    const ok = JSON.stringify(buttons) === JSON.stringify(['Start fix session', 'Ignore'])
      && launched.length === 1 && launched[0].autoSend === false
      && launched[0].message.includes('Do not merge; open a PR for review')
    if (!ok) errors.push(`[handoff] buttons ${JSON.stringify(buttons)} launched ${JSON.stringify(launched)}`)
    else console.log('check handoff: ok', JSON.stringify(buttons))
    await ctx.close()
  }
  // DOM check: a reply row shows the draft in a textbox with Send to thread + Ignore;
  // Send posts the send route for that key, the row leaves and "Sent as you" shows.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[reply] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const box = page.getByRole('textbox', { name: 'Reply to the thread, sent as you' })
    await box.waitFor({ timeout: 30000 })
    const row = box.locator('xpath=ancestor::li[1]')
    const draft = await box.inputValue()
    const buttons = await row.locator(':scope > div > div:last-child > button').allTextContents()
    await row.getByRole('button', { name: 'Send to thread' }).click()
    await page.getByRole('status').filter({ hasText: 'Sent as you' }).waitFor({ timeout: 5000 })
    const posts = await page.evaluate(() => window.__posts || [])
    const sends = posts.filter((p) => p.path.endsWith('/items/reply/send'))
    const left = await page.getByRole('textbox', { name: 'Reply to the thread, sent as you' }).count()
    const ok = JSON.stringify(buttons) === JSON.stringify(['Send to thread', 'Ignore'])
      && draft.startsWith('Yes. The export uses') && sends.length === 1 && sends[0].body.key.startsWith('C0DEMO2:')
      && !posts.some((p) => p.path.endsWith('/items/reply/draft')) && left === 0
    if (!ok) errors.push(`[reply] buttons ${JSON.stringify(buttons)} posts ${JSON.stringify(posts)} left ${left}`)
    else console.log('check reply: ok', JSON.stringify(buttons), JSON.stringify(sends))
    await ctx.close()
  }
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
