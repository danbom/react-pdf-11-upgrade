// node scripts/measure-scroll.mjs <url> <브라우저>
// <브라우저>는 Chrome 실행 파일 경로나 @sparticuz/chromium을 설치한 폴더예요(scripts/lib/launch.mjs).
//
// 1. 열고 2.5초 뒤 40쪽, 80쪽, 120쪽으로 차례로 스크롤해서, 그 쪽 캔버스가 붙기까지 걸린 시간을 잽니다.
//    4초 안에 안 붙거나 스크롤 위치가 50px 넘게 바뀌면 그때의 scrollY를 적어요.
// 2. 새로 열고 「150쪽으로 가기」를 누른 뒤 2.5초 기다려서, 화면 가운데에 몇 쪽이 있는지 봅니다.
// 3. 위 두 과정에서 폴백(뷰어 불러오는 중… / PDF 여는 중…)이 뜬 횟수(화면의 「PDF를 연 뒤 폴백이 뜬 횟수」)를 읽어요.
//
// 예) npm run measure -- "http://localhost:3000/?suspense=transition" ./c153
import { launch } from './lib/launch.mjs'

const [url, target] = process.argv.slice(2)
if (!url || !target) {
  console.error('사용법: node scripts/measure-scroll.mjs <url> <브라우저>')
  process.exit(1)
}

const browser = await launch(target)
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const fallbacks = () =>
  page.evaluate(() => {
    const span = [...document.querySelectorAll('span')].find((s) => s.textContent.startsWith('PDF를 연 뒤 폴백이 뜬 횟수'))
    return Number(span?.querySelector('b')?.textContent ?? NaN)
  })

// 1. 스크롤
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(2500)
const scrolls = []
for (const n of [40, 80, 120]) {
  scrolls.push(
    await page.evaluate(
      (n) =>
        new Promise((resolve) => {
          const slot = document.querySelector(`[data-page="${n}"]`)
          const y = slot.getBoundingClientRect().top + window.scrollY - 100
          const t0 = performance.now()
          window.scrollTo(0, y)
          let lost = false
          const tick = () => {
            if (Math.abs(window.scrollY - y) > 50) lost = true
            const c = slot.querySelector('canvas')
            const ms = Math.round(performance.now() - t0)
            if (c && c.width > 0 && slot.offsetParent !== null) return resolve(`${n}쪽 ${ms}ms${lost ? ` (scrollY ${Math.round(window.scrollY)})` : ''}`)
            if (ms > 4000) return resolve(`${n}쪽 4초 안에 안 붙음 (scrollY ${Math.round(window.scrollY)})`)
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }),
      n,
    ),
  )
  await page.waitForTimeout(600)
}
const scrollFallbacks = await fallbacks()

// 2. 150쪽으로 가기
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.getByRole('button', { name: '150쪽으로 가기' }).click()
await page.waitForTimeout(2500)
const jump = await page.evaluate(() => {
  const at = document.elementFromPoint(640, 600)?.closest('[data-page]')?.getAttribute('data-page') ?? '없음'
  const span = [...document.querySelectorAll('span')].find((s) => s.textContent.startsWith('150쪽까지'))
  return `가운데 ${at}쪽, 150쪽까지 ${span?.querySelector('b')?.textContent ?? '-'}, scrollY ${Math.round(window.scrollY)}`
})
const jumpFallbacks = await fallbacks()

console.log(`Chromium ${browser.version()} | ${url}`)
console.log(`  스크롤: ${scrolls.join(', ')}, 폴백 ${scrollFallbacks}번`)
console.log(`  150쪽으로 가기: ${jump}, 폴백 ${jumpFallbacks}번`)
await browser.close()
