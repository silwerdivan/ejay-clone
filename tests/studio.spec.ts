import { test, expect, type Page } from '@playwright/test'

const block = (page: Page, loopId: string) => page.locator(`[data-testid="timeline-block"][data-loop-id="${loopId}"]`)
const add = (page: Page, name: string) => page.getByRole('button', { name: `Add ${name} to`, exact: false })

async function drag(page: Page, source: ReturnType<Page['locator']>, target: ReturnType<Page['locator']>) {
  await source.scrollIntoViewIfNeeded()
  await target.scrollIntoViewIfNeeded()
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('Drag geometry unavailable')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(100)
}

test.beforeEach(async ({ page }) => { await page.goto('/') })

test('opens the complete prefilled studio without requesting sound', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { __soundRequests: number }
    state.__soundRequests = 0
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      state.__soundRequests++
      return start.apply(this, args)
    }
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Find your groove. Keep the night moving.' })).toBeVisible()
  await expect(page.getByTestId('timeline-block')).toHaveCount(14)
  await expect(page.locator('[data-loop-id]').filter({ has: page.locator('.library-loop-copy') })).toHaveCount(16)
  for (const lane of ['drums', 'bass', 'synth', 'vocals']) {
    await expect(page.getByTestId(`lane-${lane}`)).toBeVisible()
    await expect(page.locator(`[data-testid="bar-${lane}-0"]`)).toBeVisible()
    await expect(page.locator(`[data-testid="bar-${lane}-7"]`)).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByTestId('playhead')).toHaveAttribute('data-position', '0')
  expect(await page.evaluate(() => (window as unknown as { __soundRequests: number }).__soundRequests)).toBe(0)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __soundRequests: number }).__soundRequests)).toBeGreaterThan(0)
})

test('adds by mouse and keyboard to the first free one-bar slot', async ({ page }) => {
  await add(page, 'Soft focus').click()
  await expect(block(page, 'soft-focus')).toHaveAttribute('data-bar', '1')
  await expect(block(page, 'soft-focus')).toHaveAttribute('data-lane', 'drums')
  await add(page, 'Sub current').focus()
  await page.keyboard.press('Enter')
  await expect(block(page, 'sub-current')).toHaveAttribute('data-bar', '1')
  await expect(page.getByTestId('timeline-block')).toHaveCount(16)
})

test('reports a full lane without changing the arrangement', async ({ page }) => {
  for (const name of ['Soft focus', 'After hours', 'Night drive', 'Silver break']) await add(page, name).click()
  await expect(page.locator('[data-testid="timeline-block"][data-lane="drums"]')).toHaveCount(8)
  await add(page, 'Soft focus').click()
  await expect(page.locator('.status-bar')).toContainText('Drums is full')
  await expect(page.locator('[data-testid="timeline-block"][data-lane="drums"]')).toHaveCount(8)
})

test('drags library loops and moves blocks with lane and overlap validation', async ({ page }) => {
  await drag(page, add(page, 'Soft focus'), page.getByTestId('bar-drums-3'))
  await expect(block(page, 'soft-focus')).toHaveAttribute('data-bar', '3')

  await drag(page, block(page, 'night-drive').first(), page.getByTestId('bar-drums-1'))
  await expect(block(page, 'night-drive').first()).toHaveAttribute('data-bar', '1')
  await expect(page.getByTestId('bar-drums-0').getByTestId('timeline-block')).toHaveCount(0)

  await drag(page, block(page, 'night-drive').first(), page.getByTestId('bar-drums-2'))
  await expect(block(page, 'night-drive').first()).toHaveAttribute('data-bar', '1')
  await expect(page.locator('.status-bar')).toContainText('occupied')

  await drag(page, block(page, 'night-drive').first(), page.getByTestId('bar-bass-5'))
  await expect(block(page, 'night-drive').first()).toHaveAttribute('data-lane', 'drums')
  await expect(page.locator('.status-bar')).toContainText('belongs in the Drums lane')
})

test('cancelling a drag preserves the arrangement', async ({ page }) => {
  const source = block(page, 'night-drive').first()
  const bounds = await source.boundingBox()
  if (!bounds) throw new Error('Block geometry unavailable')
  await page.mouse.move(bounds.x + 20, bounds.y + 20)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 40, bounds.y + 25, { steps: 5 })
  await page.mouse.move(10, 10, { steps: 5 })
  await page.mouse.up()
  await expect(source).toHaveAttribute('data-bar', '0')
  await expect(page.getByTestId('timeline-block')).toHaveCount(14)
})

test('selects, duplicates into the first free slot, and deletes only the target', async ({ page }) => {
  const source = block(page, 'glass-city')
  await source.click()
  await expect(source).toHaveAttribute('aria-pressed', 'true')
  await source.getByRole('button', { name: 'Duplicate Glass city at bar 2' }).click()
  await expect(block(page, 'glass-city')).toHaveCount(2)
  await expect(page.locator('[data-testid="timeline-block"][data-loop-id="glass-city"][data-bar="0"]')).toBeVisible()
  await page.locator('[data-testid="timeline-block"][data-loop-id="glass-city"][data-bar="0"]').getByRole('button', { name: 'Delete Glass city at bar 1' }).click()
  await expect(block(page, 'glass-city')).toHaveCount(1)
  await expect(block(page, 'neon-arc')).toBeVisible()
  await expect(block(page, 'glass-city')).toHaveAttribute('data-bar', '1')
})

test('duplication rejects a full lane', async ({ page }) => {
  for (const name of ['Polaroid', 'Neon arc', 'Glass city', 'Slow orbit', 'Polaroid']) await add(page, name).click()
  await expect(page.locator('[data-testid="timeline-block"][data-lane="synth"]')).toHaveCount(8)
  const source = block(page, 'glass-city').first()
  await source.hover()
  await source.getByRole('button', { name: /Duplicate Glass city/ }).click()
  await expect(page.locator('.status-bar')).toContainText('No free position for a duplicate')
  await expect(page.locator('[data-testid="timeline-block"][data-lane="synth"]')).toHaveCount(8)
})

test('persists additions and moves as compact arrangement-only state', async ({ page }) => {
  await add(page, 'Soft focus').click()
  await drag(page, block(page, 'soft-focus'), page.getByTestId('bar-drums-5'))
  await page.reload()
  await expect(block(page, 'soft-focus')).toHaveAttribute('data-bar', '5')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse-eight-arrangement-v1')!))
  expect(saved).toHaveLength(15)
  expect(saved.every((item: object) => JSON.stringify(Object.keys(item).sort()) === '["bar","id","loopId"]')).toBe(true)
  expect(JSON.stringify(saved)).not.toContain('audio')
})

test('persists duplication and deletion workflows', async ({ page }) => {
  const source = block(page, 'glass-city')
  await source.click()
  await source.getByRole('button', { name: 'Duplicate Glass city at bar 2' }).click()
  await block(page, 'neon-arc').click()
  await block(page, 'neon-arc').getByRole('button', { name: 'Delete Neon arc at bar 4' }).click()
  await page.reload()
  await expect(block(page, 'glass-city')).toHaveCount(2)
  await expect(block(page, 'neon-arc')).toHaveCount(0)
  await expect(page.getByTestId('timeline-block')).toHaveCount(14)
})

test('malformed and incompatible saved arrangements safely restore the demo', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pulse-eight-arrangement-v1', '{broken'))
  await page.reload()
  await expect(page.getByTestId('timeline-block')).toHaveCount(14)
  await page.evaluate(() => localStorage.setItem('pulse-eight-arrangement-v1', JSON.stringify([{ id: 'bad', loopId: 'night-drive', bar: 99 }])))
  await page.reload()
  await expect(page.getByTestId('timeline-block')).toHaveCount(14)
  await page.evaluate(() => localStorage.setItem('pulse-eight-arrangement-v1', JSON.stringify([
    { id: 'one', loopId: 'night-drive', bar: 0 }, { id: 'two', loopId: 'after-hours', bar: 0 },
  ])))
  await page.reload()
  await expect(page.getByTestId('timeline-block')).toHaveCount(14)
})

test('transport plays, pauses, restarts, and loops with a visible playhead', async ({ page }) => {
  test.setTimeout(35_000)
  const playhead = page.getByTestId('playhead')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(async () => Number(await playhead.getAttribute('data-position'))).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  const paused = Number(await playhead.getAttribute('data-position'))
  expect(paused).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Restart from bar one' }).click()
  await expect(playhead).toHaveAttribute('data-position', '0')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => Number(await playhead.getAttribute('data-position')), { timeout: 20_000 }).toBeGreaterThan(14)
  await expect.poll(async () => Number(await playhead.getAttribute('data-position')), { timeout: 5_000 }).toBeLessThan(4)
})

test('reset stops playback, clears edits, and persists the curated demo', async ({ page }) => {
  await add(page, 'Soft focus').click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByTestId('timeline-block')).toHaveCount(14)
  await expect(block(page, 'soft-focus')).toHaveCount(0)
  await expect(page.getByTestId('playhead')).toHaveAttribute('data-position', '0')
  await page.reload()
  await expect(page.getByTestId('timeline-block')).toHaveCount(14)
})

test('audio failures are visible and transport remains recoverable', async ({ page }) => {
  await page.route('**/audio/*.wav', (route) => route.abort())
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.status-bar')).toContainText('Audio couldn’t load')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await page.unroute('**/audio/*.wav')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('keyboard focus is visible on transport and library controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Play', exact: true }).focus()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeFocused()
  expect(await page.getByRole('button', { name: 'Play', exact: true }).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
  await add(page, 'Soft focus').focus()
  await expect(add(page, 'Soft focus')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(block(page, 'soft-focus')).toBeVisible()
})
