import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'react-pdf 11로 올릴 때 챙길 것',
  description: 'react-pdf 11.0.0에서 브라우저 하한과 Suspense 기본값이 화면에 주는 영향을 확인합니다',
}

// pdf.js보다 먼저 실행해서 이 브라우저가 원래 가진 메서드를 적어 둡니다.
// legacy 빌드는 core-js로 빠진 메서드를 채우기 때문에, pdf.js를 불러온 뒤에 재면 있는 것처럼 보여요.
const NATIVE =
  "window.__native={goic:typeof Map.prototype.getOrInsertComputed==='function',sp:typeof Math.sumPrecise==='function'}"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NATIVE }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
