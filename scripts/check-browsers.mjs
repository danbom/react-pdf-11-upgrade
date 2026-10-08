// node scripts/check-browsers.mjs <url> <브라우저> [<브라우저> ...] [--polyfill=goic|all]
// <브라우저>는 Chrome 실행 파일 경로나 @sparticuz/chromium을 설치한 폴더예요(scripts/lib/launch.mjs).
// 브라우저마다 url을 열고 5초 동안 지켜봐요. 툴바(150쪽으로 가기 버튼)와 1쪽 캔버스가 언제 떴는지,
// 오류 문구가 떴는지, pdf.js가 남긴 경고(Warning: …)가 있는지 한 줄로 찍습니다.
//
// --polyfill을 주면 앱 코드는 그대로 두고, 메인 스레드와 워커 양쪽에 polyfill을 넣은 것처럼 흉내 내요.
//   goic  Map과 WeakMap의 getOrInsertComputed와 getOrInsert만 채워요
//   all   거기에 Math.sumPrecise까지 채워요(정밀 합이 아니라 단순 합이에요)
//
// 예) npm run build && npm start
//     npm run check -- http://localhost:3000 ./c140 ./c143 ./c147 ./c153
import { launch } from './lib/launch.mjs'

const args = process.argv.slice(2)
const polyfill = args.find((a) => a.startsWith('--polyfill='))?.split('=')[1]
const [url, ...targets] = args.filter((a) => !a.startsWith('--'))
if (!url || targets.length === 0 || (polyfill && !['goic', 'all'].includes(polyfill))) {
  console.error('사용법: node scripts/check-browsers.mjs <url> <브라우저> [<브라우저> ...] [--polyfill=goic|all]')
  process.exit(1)
}

const GOIC = `for (const C of [Map, WeakMap]) {
  if (typeof C.prototype.getOrInsertComputed !== 'function')
    Object.defineProperty(C.prototype, 'getOrInsertComputed', { configurable: true, writable: true, value(k, f) { if (this.has(k)) return this.get(k); const v = f(k); this.set(k, v); return v } })
  if (typeof C.prototype.getOrInsert !== 'function')
    Object.defineProperty(C.prototype, 'getOrInsert', { configurable: true, writable: true, value(k, v) { if (this.has(k)) return this.get(k); this.set(k, v); return v } })
}
`
const SUM = `if (typeof Math.sumPrecise !== 'function') Math.sumPrecise = (xs) => { let s = 0; for (const x of xs) s += x; return s }
`
const FAILED = /PDF를 열지 못했어요: .*|This page couldn.t load|Application error/

for (const target of targets) {
  const browser = await launch(target)
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  if (polyfill) {
    const code = polyfill === 'all' ? GOIC + SUM : GOIC
    await page.addInitScript(code)
    // 워커는 페이지와 다른 전역을 써서 addInitScript가 닿지 않아요. 워커 파일 앞에 같은 코드를 붙여 내려보냅니다.
    await page.route(/pdf\.worker[^/]*\.mjs/, async (route) => {
      const res = await route.fetch()
      await route.fulfill({ response: res, body: code + (await res.text()) })
    })
  }
  const errors = new Set()
  const warnings = new Set()
  page.on('pageerror', (e) => errors.add(e.message))
  page.on('console', (m) => {
    const text = m.text()
    if (text.startsWith('Warning:')) warnings.add(text)
  })

  const t0 = Date.now()
  await page.goto(url)
  let toolbar = null
  let firstCanvas = null
  let failed = null
  while (Date.now() - t0 < 5000) {
    const s = await page
      .evaluate((re) => {
        const button = [...document.querySelectorAll('button')].some((b) => b.offsetParent !== null)
        const canvas = [...document.querySelectorAll('.react-pdf__Page__canvas')].some((c) => c.width > 0)
        const failed = document.body.innerText.match(new RegExp(re))?.[0] ?? null
        return { button, canvas, failed }
      }, FAILED.source)
      .catch(() => null)
    if (s?.button && toolbar === null) toolbar = Date.now() - t0
    if (s?.canvas && firstCanvas === null) firstCanvas = Date.now() - t0
    if (s?.failed) {
      failed = s.failed
      break
    }
    await page.waitForTimeout(50)
  }

  const sec = (ms) => (ms === null ? '-' : `${(ms / 1000).toFixed(2)}초`)
  const result = failed ? `멈춤: ${failed}` : firstCanvas !== null ? `열림, 툴바 ${sec(toolbar)}, 1쪽 ${sec(firstCanvas)}` : '5초 안에 1쪽이 안 그려짐'
  console.log([`Chromium ${browser.version()}`, result, ...warnings, ...[...errors].map((e) => `pageerror: ${e}`)].join(' | '))
  await browser.close()
}
