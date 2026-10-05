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
  { name: 'reply-detail', source: 'ok', tab: null, openDetail: true, fixed: true },
  { name: 'ledger', source: 'ok', tab: 'Ledger', wait: 'newest first' },
  { name: 'batch-dispatch', source: 'ok', tab: null, clip: 'Needs you', dispatchAll: true },
  { name: 'dispatched-row', source: 'ok', tab: null, clip: 'Needs you', dispatchRow: true },
  { name: 'chat-expanded', source: 'ok', tab: null, chat: true },
  { name: 'settings', source: 'ok', tab: 'Settings', wait: 'Basics', open: 'Advanced' },
  { name: 'team', source: 'ok', tab: 'Team', wait: 'Only the Radar Lead has a session' },
  { name: 'needs-login', source: 'needs_login', tab: null },
  { name: 'now-strip', source: 'ok', tab: null, clip: 'now-strip' },
  { name: 'fix-merged', source: 'ok', q: '&fix=merged', tab: null, clip: 'Needs you', openHandoffs: true },
  { name: 'investigate-row', source: 'ok', tab: null, clip: 'Needs you', investigateRow: true },
  { name: 'ask-lead-batch', source: 'ok', tab: null, clip: 'Needs you' },
]
const errors = []
// A row of the "Needs a decision" group, by its summary.
const decideRow = (page, summary) =>
  page.getByRole('region', { name: 'Needs a decision' }).getByTestId('need-row').filter({ hasText: summary })
// The reply row's original message, first line (the row shows this, not the Lead's summary).
const REPLY_FIRST = 'Does the CSV export keep my column filters?'
const rowButtons = (row) => row.getByTestId('need-actions').locator('button').allTextContents()
try {
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${s.name}] ${e.message}`))
    await page.goto(`http://127.0.0.1:5287/index.html?source=${s.source}${s.q || ''}`)
    await page.getByText('Slack connection:').first().waitFor({ timeout: 30000 })
    if (s.tab) {
      await page.getByRole('tab', { name: s.tab, exact: true }).click()
      await page.getByText(s.wait).first().waitFor()
      if (s.open) await page.getByText(s.open, { exact: true }).click()
    }
    if (s.chat) await page.getByRole('button', { name: 'What needs me today?' }).first().click()
    if (s.dispatchAll) {
      await page.getByRole('button', { name: /^Dispatch all fixes \(/ }).click()
      await page.getByTestId('fix-dispatched').nth(2).waitFor({ timeout: 5000 })
    }
    if (s.dispatchRow) {
      const row = decideRow(page, 'CSV export fails for files over ~50k rows')
      await row.getByRole('button', { name: 'Dispatch fix' }).click()
      await row.getByTestId('fix-dispatched').waitFor({ timeout: 5000 })
      await row.getByTestId('fix-toggle').click()
    }
    if (s.investigateRow) {
      const row = page.getByRole('region', { name: 'Reported more than once' }).getByTestId('need-row').first()
      await row.getByRole('button', { name: 'Investigate', exact: true }).click()
      await row.getByTestId('row-investigating').waitFor({ timeout: 5000 })
      await page.getByRole('region', { name: 'Needs a decision' }).getByRole('button', { name: 'Show 3 more' }).click()
      await decideRow(page, 'Charts flicker on window resize').getByTestId('row-toggle').click()
    }
    if (s.openDetail) await decideRow(page, REPLY_FIRST).getByRole('button', { name: 'Open', exact: true }).click()
    if (s.openHandled) await page.getByText(/^Handled \(/).click()
    if (s.openHandoffs) await page.getByText(/^Fixes in flight \(/).click()
    if (s.openReplied) await page.getByText(/^Replied \(/).click()
    await page.waitForTimeout(400)
    if (s.clip) {
      // One card only: the Card that holds this title (or the element with this test id).
      const card = s.clip === 'now-strip' ? page.getByTestId('now-strip')
        : page.getByText(s.clip, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
      const file = path.join(outDir, `${s.name}.png`)
      await card.screenshot({ path: file })
      console.log('wrote', file)
      await ctx.close()
      continue
    }
    if (s.fixed) {
      const file = path.join(outDir, `${s.name}.png`)
      await page.screenshot({ path: file })
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
  // DOM check: a hand-off row has ONE button, Dispatch fix, and a ▾ that shows the fix
  // title and task read-only. One click posts the dispatch exactly once, opens no dialog,
  // no toast and no chat, and the SAME row then reads "Dispatched · <session> · working"
  // with an Open session link that opens the session in place. The detail view still
  // shows the fix and Dispatch fix. A row dispatched earlier shows the same line.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[handoff] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const row = decideRow(page, 'CSV export fails for files over ~50k rows')
    await row.waitFor({ timeout: 30000 })
    const buttons = await rowButtons(row)
    await row.getByTestId('need-open').click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ timeout: 5000 })
    const fixLine = await dialog.textContent()
    const secondary = await dialog.getByTestId('detail-actions').locator('button').allTextContents()
    const detailOk = JSON.stringify(secondary) === JSON.stringify(['Dispatch fix', 'Done', 'Ignore', 'Why? Ask the lead'])
      && fixLine.includes('Fix: Raise the CSV export row limit (issue #412)') && fixLine.includes('Open in Slack')
    await page.keyboard.press('Escape')
    const escClosed = (await page.getByRole('dialog').count()) === 0
    const toggle = row.getByTestId('fix-toggle')
    const collapsed = (await toggle.getAttribute('aria-expanded')) === 'false' && (await row.getByTestId('fix-preview').count()) === 0
    await toggle.click()
    const preview = (await row.getByTestId('fix-preview').textContent()) || ''
    const previewOk = collapsed && preview.includes('Raise the CSV export row limit (issue #412)')
      && preview.includes('stream the export instead of building it in memory') && preview.includes('Exclude from batch')
      && (await row.getByTestId('fix-preview').locator('textarea').count()) === 0
    await toggle.click()
    await row.getByRole('button', { name: 'Dispatch fix' }).click()
    const line = row.getByTestId('fix-dispatched')
    await line.waitFor({ timeout: 5000 })
    const lineText = (await line.textContent()) || ''
    const posts = await page.evaluate(() => (window.__posts || []).filter((p) => p.path.includes('/items/handoff/dispatch')))
    const launched = await page.evaluate(() => window.__launched || [])
    const dialogs = await page.getByRole('dialog').count()
    const toasts = await page.getByTestId('dispatch-toast').count()
    const after = await rowButtons(row)
    const link = line.getByRole('link', { name: 'Open session' })
    const href = await link.getAttribute('href')
    const earlier = await decideRow(page, 'Dashboard renders blank after the latest update').getByTestId('fix-dispatched').textContent()
    // Unattended off: the new session asks for each tool and the row says so; a trusted one says nothing.
    const untrusted = (await row.getByTestId('fix-untrusted').textContent()) || ''
    const earlierUntrusted = await decideRow(page, 'Dashboard renders blank after the latest update').getByTestId('fix-untrusted').count()
    const headerGone = (await page.getByRole('button', { name: /^Dispatch all fixes \(/ }).count()) === 0
    const ok = JSON.stringify(buttons) === JSON.stringify(['Dispatch fix']) && detailOk && escClosed && previewOk
      && posts.length === 1 && posts[0].path.endsWith('/items/handoff/dispatch') && posts[0].body.key
      && launched.length === 0 && dialogs === 0 && toasts === 0
      && lineText.startsWith('Dispatched · Fix: Raise the CSV export row limit (issue #412) · working')
      && href === '/chat?sid=chat-99-1' && JSON.stringify(after) === JSON.stringify(['Done'])
      && earlier.includes('Dispatched · Fix: Roll back the dashboard bundle split · working · Open session')
      && headerGone && untrusted === 'Will ask you for each tool: unattended mode is off.' && earlierUntrusted === 0
    if (!ok) errors.push(`[dispatch] untrusted ${untrusted} ${earlierUntrusted} buttons ${JSON.stringify(buttons)} detail ${detailOk} esc ${escClosed} preview ${previewOk} ${preview} posts ${JSON.stringify(posts)} launched ${JSON.stringify(launched)} dialogs ${dialogs} toasts ${toasts} line ${lineText} href ${href} after ${JSON.stringify(after)} earlier ${earlier} headerGone ${headerGone}`)
    else console.log('check dispatch: ok', JSON.stringify(buttons), lineText, JSON.stringify(after))
    await link.click()
    const opened = await page.evaluate(() => window.__launched || [])
    if (!(opened.length === 1 && opened[0].slotKey === 'chat-99-1')) errors.push(`[dispatch] Open session opened ${JSON.stringify(opened)}`)
    else console.log('check open session: ok', JSON.stringify(opened))
    await ctx.close()
  }
  // DOM check: a failed dispatch shows the error in the row itself; Try again posts again
  // and the row then reads Dispatched.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[dispatch fail] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok&dispatch=fail_once')
    const row = decideRow(page, 'CSV export fails for files over ~50k rows')
    await row.waitFor({ timeout: 30000 })
    await row.getByRole('button', { name: 'Dispatch fix' }).click()
    const alert = row.getByRole('alert')
    await alert.waitFor({ timeout: 5000 })
    const alertText = (await alert.textContent()) || ''
    await alert.getByRole('button', { name: 'Try again' }).click()
    await row.getByTestId('fix-dispatched').waitFor({ timeout: 5000 })
    const posts = await page.evaluate(() => (window.__posts || []).filter((p) => p.path.endsWith('/items/handoff/dispatch')))
    const ok = alertText.includes('Could not dispatch that fix: the session store is busy. Nothing was sent.')
      && posts.length === 2 && (await row.getByRole('alert').count()) === 0
    if (!ok) errors.push(`[dispatch fail] ${alertText} posts ${posts.length}`)
    else console.log('check dispatch failure: ok', alertText)
    await ctx.close()
  }
  // DOM check: the "Needs a decision" header reads "Dispatch all fixes (2)"; ONE click posts
  // ONE batch with both keys, no panel and no dialog, and both rows then read
  // "Dispatched · batch of 2" with Open session. Excluding a row from its ▾ drops it: the
  // header reads (1) and posts only the other key. The fold groups the earlier batch.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[batch] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const decide = page.getByRole('region', { name: 'Needs a decision' })
    const all = decide.getByRole('button', { name: /^Dispatch all fixes \(/ })
    await all.waitFor({ timeout: 30000 })
    const label = (await all.textContent()).trim()
    await all.click()
    const lines = decide.getByTestId('fix-dispatched')
    await lines.nth(2).waitFor({ timeout: 5000 })
    const posts = await page.evaluate(() => (window.__posts || []).filter((p) => p.path.includes('/items/handoff/dispatch')))
    const csv = (await decideRow(page, 'CSV export fails for files over ~50k rows').getByTestId('fix-dispatched').textContent()) || ''
    await decide.getByRole('button', { name: 'Show 3 more' }).click()
    const search = (await decideRow(page, 'Search results take 10s+').getByTestId('fix-dispatched').textContent()) || ''
    const hrefs = await decide.getByTestId('fix-dispatched').getByRole('link', { name: 'Open session' }).evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    const dialogs = await page.getByRole('dialog').count()
    const replyButtons = await rowButtons(decideRow(page, REPLY_FIRST))
    await page.getByText(/^Fixes in flight \(/).click()
    const header = await page.getByTestId('fix-batch-header').allTextContents()
    const ok = label === 'Dispatch all fixes (2)'
      && posts.length === 1 && posts[0].path.endsWith('/dispatch-batch') && posts[0].body.keys.length === 2
      && csv.startsWith('Dispatched · batch of 2 · working · Open session') && search.startsWith('Dispatched · batch of 2 · working')
      && hrefs.filter((h) => h === '/chat?sid=chat-88-1').length === 2
      && dialogs === 0 && (await page.getByTestId('batch-panel').count()) === 0
      && (await decide.getByRole('button', { name: /^Dispatch all fixes \(/ }).count()) === 0
      && JSON.stringify(replyButtons) === JSON.stringify(['Open'])
      && header.length === 1 && header[0].includes('Fix batch: 2 problems') && header[0].includes('1 PRs found / 2')
    if (!ok) errors.push(`[batch] label ${label} posts ${JSON.stringify(posts)} csv ${csv} search ${search} hrefs ${JSON.stringify(hrefs)} dialogs ${dialogs} reply ${JSON.stringify(replyButtons)} header ${JSON.stringify(header)}`)
    else console.log('check batch: ok', label, csv, JSON.stringify(header))
    await ctx.close()
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[batch exclude] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const decide = page.getByRole('region', { name: 'Needs a decision' })
    const row = decideRow(page, 'CSV export fails for files over ~50k rows')
    await row.waitFor({ timeout: 30000 })
    await row.getByTestId('fix-toggle').click()
    await row.getByLabel('Exclude from batch').check()
    const all = decide.getByRole('button', { name: /^Dispatch all fixes \(/ })
    const label = (await all.textContent()).trim()
    await all.click()
    await decide.getByRole('button', { name: 'Show 3 more' }).click()
    await decideRow(page, 'Search results take 10s+').getByTestId('fix-dispatched').waitFor({ timeout: 5000 })
    const posts = await page.evaluate(() => (window.__posts || []).filter((p) => p.path.includes('/items/handoff/dispatch')))
    const left = await rowButtons(row)
    const ok = label === 'Dispatch all fixes (1)' && posts.length === 1 && posts[0].path.endsWith('/dispatch-batch')
      && JSON.stringify(posts[0].body.keys) === JSON.stringify(['C0DEMO1:1758703800.000100'])
      && JSON.stringify(left) === JSON.stringify(['Dispatch fix']) && (await row.getByTestId('fix-dispatched').count()) === 0
    if (!ok) errors.push(`[batch exclude] label ${label} posts ${JSON.stringify(posts)} left ${JSON.stringify(left)}`)
    else console.log('check batch exclude: ok', label, JSON.stringify(posts[0].body.keys))
    await ctx.close()
  }
  // DOM check: a reply row shows "Reply ready", the ORIGINAL message's first line and one
  // Open button, never the draft. Open shows a dialog: original -> replies -> draft -> Send
  // in DOM order, focus in the draft; Esc closes and focus returns to Open. Send posts the
  // send route exactly once, shows the sent reply's link, and the next click closes.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[reply] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const row = decideRow(page, REPLY_FIRST)
    await row.waitFor({ timeout: 30000 })
    const rowText = await row.textContent()
    const first = await row.getByTestId('need-first-line').textContent()
    const chip = await row.getByTestId('draft-stale').textContent()
    const rowOk = first === REPLY_FIRST && rowText.includes('Reply ready') && rowText.includes('hana')
      && chip === '1 new reply since draft'
      && !rowText.includes('Yes. The export uses') && !rowText.includes('Send')
      && JSON.stringify(await rowButtons(row)) === JSON.stringify(['Open'])
      && (await page.getByRole('textbox', { name: 'Reply to the thread, sent as you' }).count()) === 0
    const openBtn = row.getByRole('button', { name: 'Open', exact: true })
    await openBtn.click()
    const dialog = page.getByRole('dialog', { name: REPLY_FIRST })
    await dialog.waitFor({ timeout: 5000 })
    await page.waitForTimeout(100)
    const box = dialog.getByRole('textbox', { name: 'Reply to the thread, sent as you' })
    const focused = await box.evaluate((el) => el === document.activeElement)
    const draft = await box.inputValue()
    const order = await dialog.evaluate((d) => {
      const nodes = [
        d.querySelector('[data-testid="detail-original"]'),
        d.querySelector('[data-testid="detail-replies"]'),
        d.querySelector('[data-testid="detail-draft"]'),
        d.querySelector('[data-testid="draft-stale-warning"]'),
        [...d.querySelectorAll('button')].find((b) => b.textContent === 'Send to thread'),
      ]
      if (nodes.some((n) => !n)) return false
      return nodes.every((n, i) => i === 0 || nodes[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    const original = await dialog.getByTestId('detail-text').textContent()
    const replies = await dialog.getByTestId('detail-replies').textContent()
    const actions = await dialog.getByTestId('detail-actions').locator('button').allTextContents()
    const warning = await dialog.getByTestId('draft-stale-warning').textContent()
    const newReplies = await dialog.getByTestId('reply-new').allTextContents()
    const oldReplies = await dialog.getByTestId('reply-old').count()
    const thisBtn = await dialog.getByRole('button', { name: 'Re-analyze this' }).count()
    const staleOk = warning === '1 reply arrived after this draft — read it first' && newReplies.length === 1
      && newReplies[0].startsWith('new') && newReplies[0].includes('two hidden columns') && oldReplies === 1 && thisBtn === 1
    await page.keyboard.press('Escape')
    const escClosed = (await page.getByRole('dialog').count()) === 0
    const back = await openBtn.evaluate((el) => el === document.activeElement)
    await row.getByTestId('need-open').click()
    await dialog.waitFor({ timeout: 5000 })
    await dialog.getByRole('button', { name: 'Send to thread' }).click()
    await dialog.getByRole('status').filter({ hasText: 'Sent as you' }).waitFor({ timeout: 5000 })
    const link = await dialog.getByTestId('sent-link').getAttribute('href')
    const posts = await page.evaluate(() => window.__posts || [])
    const sends = posts.filter((p) => p.path.endsWith('/items/reply/send'))
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
    const closed = (await page.getByRole('dialog').count()) === 0
    const left = await decideRow(page, REPLY_FIRST).count()
    const ok = rowOk && staleOk && focused && order && draft.startsWith('Yes. The export uses')
      && original.includes('the file goes to #finance') && replies.includes('ivan') && replies.includes('not sure about hidden columns')
      && replies.includes('replies as of')
      && JSON.stringify(actions) === JSON.stringify(['Send to thread', 'Done without sending', 'Ignore', 'Why? Ask the lead'])
      && escClosed && back && sends.length === 1 && sends[0].body.key.startsWith('C0DEMO2:')
      && !posts.some((p) => p.path.endsWith('/items/reply/draft')) && link.includes('thread_ts=') && closed && left === 0
    if (!ok) errors.push(`[reply] row ${rowOk} ${JSON.stringify(rowText)} stale ${staleOk} ${warning} ${JSON.stringify(newReplies)} ${oldReplies} ${thisBtn} focused ${focused} order ${order} actions ${JSON.stringify(actions)} esc ${escClosed} back ${back} posts ${JSON.stringify(posts)} link ${link} closed ${closed} left ${left}`)
    else console.log('check reply: ok', first, JSON.stringify(actions), JSON.stringify(sends))
    await ctx.close()
  }
  // DOM check: the Needs-you header reads "Re-analyze 2 stale"; ONE click posts the
  // re-analyze route once with both stale keys and the button then reads Re-analyzing…,
  // disabled. The dispatched row shows when its thread last moved.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[reanalyze] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const btn = page.getByTestId('reanalyze')
    await btn.waitFor({ timeout: 30000 })
    const label = (await btn.textContent()).trim()
    const last = await decideRow(page, 'Dashboard renders blank after the latest update').getByTestId('last-reply').textContent()
    await btn.click()
    await page.getByTestId('reanalyze').filter({ hasText: 'Re-analyzing…' }).waitFor({ timeout: 5000 })
    const after = (await btn.textContent()).trim()
    const disabled = await btn.isDisabled()
    const posts = await page.evaluate(() => (window.__posts || []).filter((p) => p.path.endsWith('/items/reanalyze')))
    const others = await page.evaluate(() => (window.__posts || []).filter((p) => !p.path.endsWith('/items/reanalyze')).length)
    const ok = label === 'Re-analyze 2 stale' && after === 'Re-analyzing…' && disabled && posts.length === 1
      && posts[0].body.keys.length === 2 && others === 0 && last === ' · replies · last Sep 24 09:55'
    if (!ok) errors.push(`[reanalyze] label ${label} after ${after} disabled ${disabled} posts ${JSON.stringify(posts)} others ${others} last ${JSON.stringify(last)}`)
    else console.log('check reanalyze: ok', label, JSON.stringify(posts[0].body.keys), last)
    await ctx.close()
  }
  // DOM check: the Needs-you header's batch button reads "Ask Lead (5 of 23 waiting)";
  // ONE click posts the re-analyze route once with the 5 oldest waiting keys, then it
  // reads "Lead thinking…", disabled, and a second click sends nothing.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[ask-lead-batch] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const btn = page.getByTestId('ask-lead-batch')
    await btn.waitFor({ timeout: 30000 })
    const label = (await btn.textContent()).trim()
    await btn.click()
    await btn.filter({ hasText: 'Lead thinking…' }).waitFor({ timeout: 5000 })
    await btn.click({ force: true })
    const after = (await btn.textContent()).trim()
    const disabled = await btn.isDisabled()
    const posts = await page.evaluate(() => (window.__posts || []).filter((p) => p.path.endsWith('/items/reanalyze')))
    const want = Array.from({ length: 5 }, (_, i) => `C0DEMO0002:${1758700800 - 86400 + i * 900}.000300`)
    const ok = label === 'Ask Lead (5 of 23 waiting)' && after === 'Lead thinking…' && disabled && posts.length === 1
      && JSON.stringify(posts[0].body.keys) === JSON.stringify(want)
    if (!ok) errors.push(`[ask-lead-batch] label ${label} after ${after} disabled ${disabled} posts ${JSON.stringify(posts)}`)
    else console.log('check ask-lead-batch: ok', label, '->', after)
    await ctx.close()
  }
  // DOM check (?fix=merged): a dispatched fix whose PR merged sits in "decide" as
  // "Fix merged · PR #412" with Done, its row reads "PR #412 merged" with the link and
  // no session state, the Re-analyze count includes it, "Fixes in flight" leaves it
  // out and names the other PR's state, and the Ledger row carries "fix merged".
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[fix-merged] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok&fix=merged')
    const row = decideRow(page, 'Login loops back to sign-in after SSO')
    await row.waitFor({ timeout: 30000 })
    const reason = (await row.getByTestId('need-open').textContent()) || ''
    const line = ((await row.getByTestId('fix-dispatched').textContent()) || '').replace(/\s+/g, ' ')
    const href = await row.getByTestId('fix-pr-merged').getByRole('link').getAttribute('href')
    const buttons = await rowButtons(row)
    const label = ((await page.getByTestId('reanalyze').textContent()) || '').trim()
    await page.getByText(/^Fixes in flight \(/).click()
    const fold = (await page.getByTestId('fixes-in-flight').textContent()) || ''
    await page.getByRole('tab', { name: 'Ledger', exact: true }).click()
    const lrow = page.getByTestId('ledger-list').locator('li').filter({ hasText: 'Login loops back to sign-in after SSO' })
    await lrow.waitFor({ timeout: 5000 })
    const tag = await lrow.getByText('fix merged', { exact: true }).count()
    const ok = reason.includes('Fix merged · PR #412') && line.includes('PR #412 merged')
      && !line.includes('done') && href === 'https://github.com/example-org/example-app/pull/412'
      && JSON.stringify(buttons) === JSON.stringify(['Done']) && label === 'Re-analyze 3 stale'
      && !fold.includes('Stop the SSO login redirect loop') && fold.includes('PR #418 open') && tag === 1
    if (!ok) errors.push(`[fix-merged] reason ${JSON.stringify(reason)} line ${JSON.stringify(line)} href ${href} buttons ${JSON.stringify(buttons)} label ${label} fold ${JSON.stringify(fold)} tag ${tag}`)
    else console.log('check fix-merged: ok', JSON.stringify(line), label)
    await ctx.close()
  }
  // DOM check: a row without a draft opens the same view with the original message and
  // its replies, then its own actions; an unanswered question keeps Reply-in-Slack.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[detail] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const row = page.getByRole('region', { name: 'Questions nobody answered' }).getByTestId('need-row').first()
    await row.waitFor({ timeout: 30000 })
    await row.getByTestId('need-open').click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ timeout: 5000 })
    const text = await dialog.textContent()
    const actions = await dialog.getByTestId('detail-actions').locator('button').allTextContents()
    const ok = text.includes('Is there an SSO option for the free plan?') && text.includes('No replies yet')
      && text.includes('Reply opens the thread in Slack') && (await dialog.getByRole('textbox').count()) === 0
      && JSON.stringify(actions) === JSON.stringify(['Reply', 'Done', 'Ignore', 'Why? Ask the lead'])
    if (!ok) errors.push(`[detail] ${JSON.stringify(text)} actions ${JSON.stringify(actions)}`)
    else console.log('check detail (no draft): ok', JSON.stringify(actions))
    await ctx.close()
  }
  // DOM check: the Board reads Now strip, Today card, Needs you, chat bar, top to
  // bottom. The chat bar is the Board's last child and sticks to the bottom of the
  // panel, collapsed and opened; Collapse folds it back to one line. The Today card
  // holds the Lead's line, the digest's top items, its date and Digest now.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[order] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    await page.getByText('Needs you', { exact: true }).first().waitFor({ timeout: 30000 })
    const order = () => page.evaluate(() => {
      const board = document.querySelector('[data-testid="board"]')
      const needs = [...document.querySelectorAll('div')].find((d) => d.className.includes('rounded')
        && [...d.querySelectorAll('*')].some((e) => e.textContent === 'Needs you' && e.children.length === 0))
      const els = [
        document.querySelector('[data-testid="now-strip"]'),
        document.querySelector('[data-testid="connection-line"]'),
        document.querySelector('[data-testid="today-card"]'),
        needs,
        document.querySelector('[data-testid="chat-bar"]'),
      ]
      const inOrder = els.every(Boolean) && els.every((e, i) => i === 0
        || !!(els[i - 1].compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING))
      const bar = els[4]
      return {
        inOrder,
        last: !!board && board.lastElementChild === bar,
        sticky: !!bar && getComputedStyle(bar).position === 'sticky' && getComputedStyle(bar).bottom === '0px',
        expanded: bar?.dataset.expanded,
      }
    })
    const closed = await order()
    const card = page.getByTestId('today-card')
    const title = (await card.getByText('Today', { exact: true }).count()) === 1 ? 'Today' : ''
    const heading = await card.getByTestId('crew-today').textContent()
    const top = await card.getByTestId('digest-top').locator('li').allTextContents()
    const time = await card.getByTestId('digest-time').textContent()
    const digestBtn = await card.getByRole('button', { name: 'Digest now' }).count()
    const cardOk = title === 'Today' && heading.startsWith('Two p1 bugs need an owner') && top.length === 2
      && top[0].startsWith('• [p1/bug-report] CSV export') && time.includes('2025-09-23') && digestBtn === 1
      && (await page.getByRole('button', { name: 'Request digest' }).count()) === 0
    const bar = page.getByTestId('chat-bar')
    const barBox = await bar.boundingBox()
    // Pinned: just above the bottom edge of the panel that scrolls, not at the end of the content.
    const gap = await bar.evaluate((el) => {
      let sc = el.parentElement
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement
      const r = el.getBoundingClientRect()
      // A sticky box keeps clear of the panel's own bottom padding, then its `bottom` inset.
      const want = parseFloat(getComputedStyle(sc || el).paddingBottom) + parseFloat(getComputedStyle(el).bottom)
      return sc ? { gap: Math.round(sc.getBoundingClientRect().bottom - r.bottom), want, more: sc.scrollHeight > sc.clientHeight } : null
    })
    const pinned = !!gap && gap.more && Math.abs(gap.gap - gap.want) <= 1
    const leadDot = await bar.getByRole('textbox', { name: 'Ask the lead' }).count()
    await page.getByRole('button', { name: 'What needs me today?' }).first().click()
    await bar.getByRole('button', { name: 'Collapse' }).waitFor({ timeout: 5000 })
    const opened = await order()
    const openBox = await bar.boundingBox()
    const grewUp = !!openBox && !!barBox && openBox.y < barBox.y && Math.abs(openBox.y + openBox.height - (barBox.y + barBox.height)) <= 2
    await bar.getByRole('button', { name: 'Collapse' }).click()
    await bar.getByRole('textbox', { name: 'Ask the lead' }).waitFor({ timeout: 5000 })
    const folded = await order()
    const ok = closed.inOrder && closed.last && closed.sticky && closed.expanded === 'false' && cardOk && pinned && leadDot === 1
      && opened.inOrder && opened.last && opened.sticky && opened.expanded === 'true' && grewUp
      && folded.expanded === 'false'
    if (!ok) errors.push(`[order] closed ${JSON.stringify(closed)} card ${cardOk} ${title} | ${heading} | ${JSON.stringify(top)} | ${time} btn ${digestBtn} pinned ${pinned} ${JSON.stringify(gap)} opened ${JSON.stringify(opened)} ${JSON.stringify(openBox)} grewUp ${grewUp} folded ${JSON.stringify(folded)}`)
    else console.log('check order: ok', JSON.stringify(closed), JSON.stringify(top), time)
    await ctx.close()
  }
  // DOM check: with no digest the Today card is one line, "No digest yet", plus the button.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[digest empty] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok&today=empty&digest=empty')
    const card = page.getByTestId('today-card')
    await card.waitFor({ timeout: 30000 })
    const empty = await card.getByTestId('digest-empty').allTextContents()
    const ok = JSON.stringify(empty) === JSON.stringify(['No digest yet'])
      && (await card.getByRole('button', { name: 'Digest now' }).count()) === 1
      && (await card.getByTestId('digest-top').count()) === 0 && (await card.getByTestId('digest-time').count()) === 0
      && (await card.getByTestId('crew-today').count()) === 0
    if (!ok) errors.push(`[digest empty] ${JSON.stringify(empty)}`)
    else console.log('check digest empty: ok')
    await ctx.close()
  }
  // DOM check: the Board carries no ledger (no list, filter, Investigate or ledger card
  // title; "Ledger" is only the tab). Needs-you rows are priority, then newest first;
  // each group shows 5 rows and "Show N more" reveals the rest.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[board] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    await page.getByText('Needs you', { exact: true }).first().waitFor({ timeout: 30000 })
    const ledgerWords = await page.getByText('Ledger', { exact: true }).count()
    const tabOnly = ledgerWords === 1 && (await page.getByRole('tab', { name: 'Ledger', exact: true }).count()) === 1
    const noLedger = tabOnly && (await page.getByTestId('ledger-list').count()) === 0
      && (await page.locator('#sr-filter').count()) === 0
      && (await page.getByRole('textbox', { name: /GitHub repository to search/ }).count()) === 0
      && (await page.getByText('Tracked items').count()) === 0
    const decide = page.getByRole('region', { name: 'Needs a decision' })
    const before = await decide.getByTestId('need-row').count()
    const more = decide.getByRole('button', { name: 'Show 3 more' })
    const moreShown = (await more.count()) === 1
    await more.click()
    const rows = await decide.getByTestId('need-row').evaluateAll((els) =>
      els.map((e) => [e.dataset.priority, Number(e.dataset.ageHours), e.dataset.stale]))
    const rank = (p) => ({ p0: 0, p1: 1, p2: 2, p3: 3 })[p] ?? 4
    // Priority, then a stale draft first, then newest first.
    const key = ([p, age, stale]) => [rank(p), stale === '1' ? 0 : 1, age]
    let sorted = true
    for (let i = 1; i < rows.length; i++) {
      const a = key(rows[i - 1])
      const b = key(rows[i])
      const cmp = a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
      if (cmp > 0) sorted = false
    }
    const primaries = await decide.getByTestId('need-actions').locator('button:first-child').allTextContents()
    const ages = await decide.getByTestId('need-age').allTextContents()
    const noDecide = (await page.getByRole('button', { name: 'Decide', exact: true }).count()) === 0
    const ok = noLedger && before === 5 && moreShown && rows.length === 8 && sorted && noDecide
      && JSON.stringify(primaries) === JSON.stringify(['Dispatch fix', 'Done', 'Open', 'Done', 'Dispatch fix', 'Done', 'Open', 'Ask lead'])
      && rows.filter((r) => r[2] === '1').length === 1
      && ages.every((a) => / ago$/.test(a))
    if (!ok) errors.push(`[board] ledger words ${ledgerWords} noLedger ${noLedger} before ${before} more ${moreShown} rows ${JSON.stringify(rows)} sorted ${sorted} primaries ${JSON.stringify(primaries)} ages ${JSON.stringify(ages)}`)
    else console.log('check board: ok', JSON.stringify(rows), JSON.stringify(primaries))
    await ctx.close()
  }
  // DOM check: row actions. A cluster row's Investigate posts /investigate ONCE with the
  // cluster's keys and the row reads "Investigating…" and "Investigator · running";
  // an investigated bug's Ask lead posts /items/reanalyze ONCE with its one key and reads
  // "Lead thinking…"; a question with no draft shows Open; no row says Decide.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[row actions] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    await page.getByText('Needs you', { exact: true }).first().waitFor({ timeout: 30000 })
    const posts = () => page.evaluate(() => window.__posts || [])
    const cluster = page.getByRole('region', { name: 'Reported more than once' }).getByTestId('need-row').first()
    const clusterBtn = await rowButtons(cluster)
    await cluster.getByRole('button', { name: 'Investigate', exact: true }).click()
    await cluster.getByTestId('row-investigating').waitFor({ timeout: 5000 })
    const invBtn = cluster.getByTestId('need-actions').locator('button').first()
    const invLabel = (await invBtn.textContent()).trim()
    const invOff = await invBtn.isDisabled()
    const invLine = (await cluster.getByTestId('row-investigating').textContent()).trim()
    const inv = (await posts()).filter((p) => p.path.endsWith('/investigate'))
    const decide = page.getByRole('region', { name: 'Needs a decision' })
    await decide.getByRole('button', { name: 'Show 3 more' }).click()
    const bug = decideRow(page, 'Charts flicker on window resize')
    const bugBtn = await rowButtons(bug)
    const bugLine = (await bug.getByTestId('row-investigated').textContent()).trim()
    await bug.getByTestId('row-toggle').click()
    const links = await bug.getByTestId('row-links').locator('a').count()
    await bug.getByRole('button', { name: 'Ask lead', exact: true }).click()
    await bug.getByText('Lead thinking…').waitFor({ timeout: 5000 })
    const ra = (await posts()).filter((p) => p.path.endsWith('/items/reanalyze'))
    const question = decideRow(page, 'Where to export the audit log')
    const qBtn = await rowButtons(question)
    const decideAnywhere = await page.getByText('Decide', { exact: true }).count()
    const ok = JSON.stringify(clusterBtn) === JSON.stringify(['Investigate'])
      && inv.length === 1 && inv[0].body.keys.length === 2 && invLabel === 'Investigating…' && invOff
      && /^Investigator · running · since \d\d:\d\d$/.test(invLine)
      && JSON.stringify(bugBtn) === JSON.stringify(['Ask lead']) && bugLine === 'Investigated · 2 links' && links === 2
      && ra.length === 1 && ra[0].body.keys.length === 1
      && JSON.stringify(qBtn) === JSON.stringify(['Open']) && decideAnywhere === 0
    if (!ok) errors.push(`[row actions] cluster ${JSON.stringify(clusterBtn)} inv ${JSON.stringify(inv)} label ${invLabel} off ${invOff} line ${invLine} bug ${JSON.stringify(bugBtn)} ${bugLine} links ${links} ra ${JSON.stringify(ra)} q ${JSON.stringify(qBtn)} decide ${decideAnywhere}`)
    else console.log('check row actions: ok', invLine, '|', bugLine)
    await ctx.close()
  }
  // DOM check: the Ledger tab lists every item newest first, with its filters and
  // Investigate; Priority and Needs me narrow the list on the client.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[ledger] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    await page.getByText('Slack connection:').first().waitFor({ timeout: 30000 })
    await page.getByRole('tab', { name: 'Ledger', exact: true }).click()
    const list = page.getByTestId('ledger-list')
    await list.waitFor({ timeout: 5000 })
    const ts = await list.getByTestId('ledger-ts').evaluateAll((els) => els.map((e) => Number(e.dataset.ts)))
    const newest = ts.length >= 6 && ts.every((t, i) => i === 0 || ts[i - 1] >= t)
    const investigate = (await page.getByRole('button', { name: /^Investigate/ }).count()) === 1
      && (await page.getByRole('textbox', { name: /GitHub repository to search/ }).count()) === 1
    await page.locator('#sr-priority').selectOption('p1')
    const p1 = await list.locator('li').count()
    await page.locator('#sr-priority').selectOption('')
    await page.getByLabel('Needs me').check()
    const mine = await list.locator('li').count()
    const count = await page.getByTestId('ledger-count').textContent()
    await page.getByLabel('Needs me').uncheck()
    await list.locator('input[type=checkbox]').first().check()
    const armed = await page.getByRole('button', { name: 'Investigate 1' }).isEnabled()
    const ok = newest && investigate && p1 === 2 && mine === 5 && count.startsWith(`5 of ${ts.length}`) && armed
    if (!ok) errors.push(`[ledger] ts ${JSON.stringify(ts)} investigate ${investigate} p1 ${p1} mine ${mine} count ${count} armed ${armed}`)
    else console.log('check ledger: ok', ts.length, 'rows newest first; p1', p1, 'needs me', mine)
    await ctx.close()
  }
  // DOM check: the Now strip names a running Investigator with a pulsing dot, the Team
  // tab shows the same row through the same component, and the open chat carries the
  // running line; a click on the Investigator opens the Activity tab filtered.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[now] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const strip = page.getByTestId('now-strip')
    await strip.waitFor({ timeout: 30000 })
    const inv = strip.locator('[data-member="investigator"]')
    const invText = await inv.textContent()
    const invPulse = await inv.locator('.sr-pulse').count()
    const watPulse = await strip.locator('[data-member="watcher"] .sr-pulse').count()
    const leadText = await strip.locator('[data-member="lead"]').textContent()
    const watText = await strip.locator('[data-member="watcher"]').textContent()
    const polText = await strip.locator('[data-member="poller"]').textContent()
    const HM = '\\d{2}:\\d{2}'
    const stripOk = invText.includes('Investigator') && invText.includes('1 running') && invPulse === 1
      && watPulse === 0 && new RegExp(`^Radar Leadlast wake ${HM}$`).test(leadText.trim())
      && new RegExp(`^Thread Watcherlast run ${HM}–${HM}$`).test(watText.trim())
      && new RegExp(`^Pollerlast ${HM} · next in 4m$`).test(polText.trim())
      && (await strip.locator('[data-member]').count()) === 4
    await page.getByRole('button', { name: 'What needs me today?' }).first().click()
    const running = page.getByTestId('chat-running')
    await running.waitFor({ timeout: 5000 })
    const runText = await running.textContent()
    const runOk = /^Investigator running · Re-check 9 items .* · 3m$/.test(runText.trim())
    await page.getByRole('tab', { name: 'Team', exact: true }).click()
    const team = page.getByTestId('team-status-investigator')
    await team.waitFor({ timeout: 5000 })
    const teamText = await team.textContent()
    const teamWat = (await page.getByTestId('team-status-watcher').textContent()).trim()
    const teamOk = teamText.includes('1 running') && (await team.locator('.sr-pulse').count()) === 1
      && (await page.getByTestId('now-strip').count()) === 0
      && new RegExp(`^idle since ${HM} · last run ${HM}–${HM}$`).test(teamWat)
    await page.getByRole('tab', { name: 'Settings', exact: true }).click()
    const cadence = (await page.getByTestId('poll-cadence').textContent()).trim()
    if (cadence !== 'Runs by itself every 300 s; a manual Poll just runs one cycle now.') errors.push(`[now] cadence ${cadence}`)
    else console.log('check cadence: ok')
    await page.getByRole('tab', { name: 'Board', exact: true }).click()
    await page.getByTestId('now-strip').locator('[data-member="investigator"]').click()
    await page.getByText('Showing the crew and its members only.').waitFor({ timeout: 5000 })
    const activityOk = (await page.getByRole('tab', { name: 'Activity', exact: true }).getAttribute('aria-selected')) === 'true'
    await page.waitForTimeout(5600) // one fast tick while someone works
    const fastPolls = await page.evaluate(() => (window.__gets || []).filter((g) => g.endsWith('/now')).length)
    if (!(stripOk && runOk && teamOk && activityOk && fastPolls >= 1)) {
      errors.push(`[now] strip ${stripOk} ${invText} | ${leadText} | ${watText} | ${polText} pulse ${invPulse}/${watPulse}; chat ${runOk} ${runText}; team ${teamOk} ${teamText} / ${teamWat}; activity ${activityOk}; /now polls ${fastPolls}`)
    } else console.log('check now: ok', JSON.stringify([invText, leadText, watText, polText, runText.trim(), teamText, teamWat, fastPolls]))
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
