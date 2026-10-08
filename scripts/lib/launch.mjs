// 브라우저 띄우기.
// 인자가 @sparticuz/chromium을 설치한 폴더면 그 안의 Chromium을, 아니면 Chrome 실행 파일 경로로 보고 띄웁니다.
// 글의 숫자는 리눅스에서 @sparticuz/chromium 140.0.0, 143.0.4, 147.0.2, 153.0.0을 폴더 네 개에 따로 설치해서 쟀어요.
//   mkdir c143 && cd c143 && npm init -y && npm i @sparticuz/chromium@143.0.4
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

export async function launch(target) {
  const pkg = join(target, 'node_modules', '@sparticuz', 'chromium', 'package.json')
  if (!existsSync(pkg)) return chromium.launch({ executablePath: target, headless: true })

  // @sparticuz/chromium은 바이너리를 임시 폴더(os.tmpdir())에 풀고, 이미 있으면 그걸 다시 씁니다.
  // 버전을 바꿔 가며 띄우면 먼저 푼 버전이 뜨니, 폴더마다 따로 풀리게 TMPDIR을 잠깐 바꿔요.
  const prev = process.env.TMPDIR
  process.env.TMPDIR = resolve(target, '.tmp')
  mkdirSync(process.env.TMPDIR, { recursive: true })
  try {
    const wanted = JSON.parse(readFileSync(pkg, 'utf8')).version.split('.')[0]
    const sparticuz = (await import(createRequire(resolve(target, 'package.json')).resolve('@sparticuz/chromium'))).default
    const browser = await chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true })
    if (browser.version().split('.')[0] !== wanted) {
      await browser.close()
      throw new Error(`@sparticuz/chromium ${wanted}을 띄웠는데 Chromium ${browser.version()}이 떴어요.`)
    }
    return browser
  } finally {
    if (prev === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = prev
  }
}
