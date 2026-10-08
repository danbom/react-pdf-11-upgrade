import type { NextConfig } from 'next'

// 기본 빌드(npm run build)는 react-pdf 11을 그대로 씁니다. pdfjs-dist의 modern 빌드가 들어가요.
//
// PDFJS_BUILD=legacy(npm run build:legacy)로 빌드하면 pdfjs-dist를 legacy 빌드로 바꿔 끼웁니다.
// 경로 세 개를 모두 바꿔야 Chrome 145 아래에서도 열려요.
//   - 'pdfjs-dist'                   react-pdf가 메인 스레드에서 import하는 본체
//   - 'pdfjs-dist/web/pdf_viewer.mjs' react-pdf 11의 LinkService가 import하는 뷰어 모듈
//   - 워커                            app/lab.tsx의 new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)
//
// 아래 두 값은 글에서 비교한 "반쪽짜리" 설정이에요. 둘 다 Chrome 140과 143에서 멈춥니다.
//   PDFJS_BUILD=legacy-worker  워커만 legacy (react-pdf README의 방법)
//   PDFJS_BUILD=legacy-main    메인 스레드만 legacy
const mode = process.env.PDFJS_BUILD ?? 'modern'
const main = mode === 'legacy' || mode === 'legacy-main'
const worker = mode === 'legacy' || mode === 'legacy-worker'

const resolveAlias: Record<string, string> = {}
if (main) {
  resolveAlias['pdfjs-dist'] = 'pdfjs-dist/legacy/build/pdf.mjs'
  resolveAlias['pdfjs-dist/web/pdf_viewer.mjs'] = 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
}
if (worker) {
  resolveAlias['pdfjs-dist/build/pdf.worker.min.mjs'] = 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
}

const nextConfig: NextConfig = {
  // 빌드끼리 덮어쓰지 않게 폴더를 나눠요. modern은 .next, legacy는 .next-legacy
  distDir: mode === 'modern' ? '.next' : `.next-${mode}`,
  env: { NEXT_PUBLIC_PDFJS_BUILD: mode },
  turbopack: { resolveAlias },
}

export default nextConfig
