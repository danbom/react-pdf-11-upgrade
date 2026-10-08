// node scripts/run.mjs <legacy|legacy-worker|legacy-main> <next 명령과 인자...>
// PDFJS_BUILD를 정해서 next를 실행합니다. Windows에서도 npm 스크립트가 같게 돌도록 node로 감쌌어요.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const [mode, ...args] = process.argv.slice(2)
if (!['legacy', 'legacy-worker', 'legacy-main'].includes(mode)) {
  console.error('사용법: node scripts/run.mjs <legacy|legacy-worker|legacy-main> <build|start|dev> [인자...]')
  process.exit(1)
}
const next = createRequire(import.meta.url).resolve('next/dist/bin/next')
const r = spawnSync(process.execPath, [next, ...args], { stdio: 'inherit', env: { ...process.env, PDFJS_BUILD: mode } })
process.exit(r.status ?? 1)
