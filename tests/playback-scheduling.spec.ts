import { test, expect } from '@playwright/test'

test('demo clips stay in their arranged bars during main-thread stalls', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { __events: Array<{ clip: string; when: number }> }
    state.__events = []
    const requestUrls = new WeakMap<ArrayBuffer, string>()
    const clipUrls = new WeakMap<AudioBuffer, string>()
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      const arrayBuffer = response.arrayBuffer.bind(response)
      response.arrayBuffer = async () => {
        const data = await arrayBuffer()
        requestUrls.set(data, response.url)
        return data
      }
      return response
    }
    const decode = BaseAudioContext.prototype.decodeAudioData
    BaseAudioContext.prototype.decodeAudioData = function (...args) {
      const result = decode.apply(this, args)
      void result.then((buffer) => {
        const url = requestUrls.get(args[0])
        if (url) clipUrls.set(buffer, url)
      })
      return result
    }
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      const url = clipUrls.get(this.buffer!)
      if (url) state.__events.push({ clip: url.split('/').pop()!, when: args[0] ?? 0 })
      return start.apply(this, args)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.evaluate(() => {
    setInterval(() => {
      const until = performance.now() + 250
      while (performance.now() < until) { /* Simulate a busy page. */ }
    }, 1000)
  })
  await page.waitForTimeout(15_000)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const events = await page.evaluate(() => (window as unknown as { __events: Array<{ clip: string; when: number }> }).__events)
  const counts = events.reduce<Record<string, number>>((result, event) => {
    result[event.clip] = (result[event.clip] ?? 0) + 1
    return result
  }, {})
  expect(counts).toEqual({
    'night-drive.wav': 2,
    'after-hours.wav': 1,
    'silver-break.wav': 1,
    'low-end-theory.wav': 2,
    'roller.wav': 1,
    'elastic.wav': 1,
    'glass-city.wav': 1,
    'neon-arc.wav': 1,
    'slow-orbit.wav': 1,
    'feel-the-night.wav': 1,
    'dont-stop.wav': 1,
    'higher.wav': 1,
  })
  const base = events.find((event) => event.clip === 'feel-the-night.wav')!.when
  const synthEvents = events.filter((event) => event.clip === 'neon-arc.wav' || event.clip === 'slow-orbit.wav')
    .map((event) => ({ clip: event.clip, bar: Math.floor((event.when - base + 0.5) / 2) }))
  expect(synthEvents).toEqual([
    { clip: 'neon-arc.wav', bar: 3 },
    { clip: 'slow-orbit.wav', bar: 5 },
  ])
})
