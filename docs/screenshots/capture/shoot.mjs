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
  { name: 'batch-dispatch', source: 'ok', tab: null, clip: 'Needs you', openBatch: true },
  { name: 'chat-expanded', source: 'ok', tab: null, chat: true },
  { name: 'settings', source: 'ok', tab: 'Settings', wait: 'Basics', open: 'Advanced' },
  { name: 'team', source: 'ok', tab: 'Team', wait: 'Only the Radar Lead has a session' },
  { name: 'needs-login', source: 'needs_login', tab: null },
  { name: 'now-strip', source: 'ok', tab: null, clip: 'now-strip' },
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
    await page.goto(`http://127.0.0.1:5287/index.html?source=${s.source}`)
    await page.getByText('Slack connection:').first().waitFor({ timeout: 30000 })
    if (s.tab) {
      await page.getByRole('tab', { name: s.tab, exact: true }).click()
      await page.getByText(s.wait).first().waitFor()
      if (s.open) await page.getByText(s.open, { exact: true }).click()
    }
    if (s.chat) await page.getByRole('button', { name: 'What needs me today?' }).first().click()
    if (s.openBatch) await page.getByRole('button', { name: /^Dispatch all fixes \(/ }).click()
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
  // DOM check: a hand-off row shows Dispatch fix + Ignore (Done in the menu); one click
  // posts the dispatch once, opens no chat, and a toast links the new session. The
  // dispatched row shows its session and state instead of the buttons.
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
    const toggled = JSON.stringify(secondary) === JSON.stringify(['Dispatch fix', 'Done', 'Ignore', 'Why? Ask the lead'])
      && fixLine.includes('Fix: Raise the CSV export row limit (issue #412)') && fixLine.includes('Open in Slack')
      && fixLine.includes('Export to CSV fails on large files')
    await page.keyboard.press('Escape')
    const escClosed = (await page.getByRole('dialog').count()) === 0
    await row.getByRole('button', { name: 'Dispatch fix' }).click()
    const toast = page.getByTestId('dispatch-toast')
    await toast.waitFor({ timeout: 5000 })
    const toastText = await toast.textContent()
    const posts = await page.evaluate(() => (window.__posts || []).filter((p) => p.path.endsWith('/items/handoff/dispatch')))
    const launched = await page.evaluate(() => window.__launched || [])
    const progress = await page.getByTestId('fix-in-progress').allTextContents()
    const toastLink = await toast.getByRole('link').getAttribute('href')
    const ok = JSON.stringify(buttons) === JSON.stringify(['Dispatch fix']) && toggled && escClosed
      && posts.length === 1 && launched.length === 0
      && toastText.includes('Fix dispatched to a conductor') && toastLink === '/chat?sid=chat-99-1'
      && progress.length === 1 && progress[0].includes('Fix: Roll back the dashboard bundle split') && progress[0].includes('working')
    if (!ok) errors.push(`[dispatch] esc ${escClosed} buttons ${JSON.stringify(buttons)} secondary ${JSON.stringify(secondary)} ${fixLine} posts ${JSON.stringify(posts)} launched ${JSON.stringify(launched)} toast ${toastText} ${toastLink} progress ${JSON.stringify(progress)}`)
    else console.log('check dispatch: ok', JSON.stringify(buttons), toastText, JSON.stringify(progress))
    await toast.getByRole('link').click()
    const opened = await page.evaluate(() => window.__launched || [])
    if (!(opened.length === 1 && opened[0].slotKey === 'chat-99-1')) errors.push(`[dispatch] toast link opened ${JSON.stringify(opened)}`)
    else console.log('check toast link: ok', JSON.stringify(opened))
    await ctx.close()
  }
  // DOM check: two undispatched hand-offs put "Dispatch all fixes (2)" in the header.
  // It opens an inline panel listing both, checked; unchecking one relabels the primary
  // button; the primary posts ONE batch with the checked keys and a toast links it.
  // The fold groups the earlier batch under one header with its PR count.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-US' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[batch] ${e.message}`))
    await page.goto('http://127.0.0.1:5287/index.html?source=ok')
    const open = page.getByRole('button', { name: /^Dispatch all fixes \(/ })
    await open.waitFor({ timeout: 30000 })
    const label = (await open.textContent()).trim()
    await open.click()
    const panel = page.getByTestId('batch-panel')
    await panel.waitFor({ timeout: 5000 })
    const listed = await panel.locator('li').count()
    const checked = await panel.locator('input[type=checkbox]:checked').count()
    const primary = panel.getByRole('button', { name: /to one conductor$/ })
    const text2 = (await primary.textContent()).trim()
    await panel.locator('input[type=checkbox]').nth(1).uncheck()
    const text1 = (await primary.textContent()).trim()
    await panel.locator('input[type=checkbox]').nth(1).check()
    await primary.click()
    const toast = page.getByTestId('dispatch-toast')
    await toast.waitFor({ timeout: 5000 })
    const toastText = await toast.textContent()
    const posts = await page.evaluate(() => (window.__posts || []).filter((p) => p.path.includes('/items/handoff/dispatch')))
    const replyButtons = await rowButtons(decideRow(page, REPLY_FIRST))
    await page.getByText(/^Fixes in flight \(/).click()
    const header = await page.getByTestId('fix-batch-header').allTextContents()
    const ok = label === 'Dispatch all fixes (2)' && listed === 2 && checked === 2
      && text2 === 'Dispatch 2 to one conductor' && text1 === 'Dispatch 1 to one conductor'
      && posts.length === 1 && posts[0].path.endsWith('/dispatch-batch') && posts[0].body.keys.length === 2
      && toastText.includes('Fixes dispatched to one conductor') && toastText.includes('Fix batch: 2 problems')
      && (await page.getByTestId('batch-panel').count()) === 0
      && JSON.stringify(replyButtons) === JSON.stringify(['Open'])
      && header.length === 1 && header[0].includes('Fix batch: 2 problems') && header[0].includes('1 PRs found / 2')
    if (!ok) errors.push(`[batch] label ${label} listed ${listed} checked ${checked} ${text2} / ${text1} posts ${JSON.stringify(posts)} toast ${toastText} reply ${JSON.stringify(replyButtons)} header ${JSON.stringify(header)}`)
    else console.log('check batch: ok', label, listed, text2, text1, JSON.stringify(header))
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
    const rowOk = first === REPLY_FIRST && rowText.includes('Reply ready') && rowText.includes('hana')
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
        [...d.querySelectorAll('button')].find((b) => b.textContent === 'Send to thread'),
      ]
      if (nodes.some((n) => !n)) return false
      return nodes.every((n, i) => i === 0 || nodes[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    const original = await dialog.getByTestId('detail-text').textContent()
    const replies = await dialog.getByTestId('detail-replies').textContent()
    const actions = await dialog.getByTestId('detail-actions').locator('button').allTextContents()
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
    const ok = rowOk && focused && order && draft.startsWith('Yes. The export uses')
      && original.includes('the file goes to #finance') && replies.includes('ivan') && replies.includes('not sure about hidden columns')
      && replies.includes('replies as of')
      && JSON.stringify(actions) === JSON.stringify(['Send to thread', 'Done without sending', 'Ignore', 'Why? Ask the lead'])
      && escClosed && back && sends.length === 1 && sends[0].body.key.startsWith('C0DEMO2:')
      && !posts.some((p) => p.path.endsWith('/items/reply/draft')) && link.includes('thread_ts=') && closed && left === 0
    if (!ok) errors.push(`[reply] row ${rowOk} ${JSON.stringify(rowText)} focused ${focused} order ${order} actions ${JSON.stringify(actions)} esc ${escClosed} back ${back} posts ${JSON.stringify(posts)} link ${link} closed ${closed} left ${left}`)
    else console.log('check reply: ok', first, JSON.stringify(actions), JSON.stringify(sends))
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
      && (await page.getByRole('button', { name: /^Investigate/ }).count()) === 0
      && (await page.getByText('Tracked items').count()) === 0
    const decide = page.getByRole('region', { name: 'Needs a decision' })
    const before = await decide.getByTestId('need-row').count()
    const more = decide.getByRole('button', { name: 'Show 2 more' })
    const moreShown = (await more.count()) === 1
    await more.click()
    const rows = await decide.getByTestId('need-row').evaluateAll((els) =>
      els.map((e) => [e.dataset.priority, Number(e.dataset.ageHours)]))
    const rank = (p) => ({ p0: 0, p1: 1, p2: 2, p3: 3 })[p] ?? 4
    let sorted = true
    for (let i = 1; i < rows.length; i++) {
      const [pa, aa] = rows[i - 1]
      const [pb, ab] = rows[i]
      if (rank(pa) > rank(pb) || (rank(pa) === rank(pb) && aa > ab)) sorted = false
    }
    const primaries = await decide.getByTestId('need-actions').locator('button:first-child').allTextContents()
    const ages = await decide.getByTestId('need-age').allTextContents()
    const ok = noLedger && before === 5 && moreShown && rows.length === 7 && sorted
      && JSON.stringify(primaries) === JSON.stringify(['Dispatch fix', 'Done', 'Done', 'Open', 'Dispatch fix', 'Done', 'Decide'])
      && ages.every((a) => / ago$/.test(a))
    if (!ok) errors.push(`[board] ledger words ${ledgerWords} noLedger ${noLedger} before ${before} more ${moreShown} rows ${JSON.stringify(rows)} sorted ${sorted} primaries ${JSON.stringify(primaries)} ages ${JSON.stringify(ages)}`)
    else console.log('check board: ok', JSON.stringify(rows), JSON.stringify(primaries))
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
