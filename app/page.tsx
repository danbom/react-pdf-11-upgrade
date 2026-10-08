'use client'

import dynamic from 'next/dynamic'
import { Fallback } from './fallback'

// next/dynamic의 loading은 Suspense fallback으로도 쓰여요.
// react-pdf 11에서 Document나 Page가 suspend하면, 안쪽에 다른 경계가 없을 때 이 문구가 뷰어 전체를 대신합니다.
// pdf.js는 서버에서 평가되면 죽어서(1편 내용) ssr: false는 그대로 둡니다.
// react-pdf 11에서는 그 오류 문구가 DOMMatrix is not defined에서 window is not defined로 바뀌었어요.
const Lab = dynamic(() => import('./lab'), { ssr: false, loading: () => <Fallback text="뷰어 불러오는 중…" /> })

export default function Page() {
  return (
    <main>
      <h1>react-pdf 11로 올릴 때 챙길 것</h1>
      <p className="sub">
        300쪽 PDF를 보이는 쪽만 그리는 뷰어(4편)를 react-pdf 11.0.0으로 띄웠어요. 위 칸에서 이 브라우저에 pdf.js 6이 쓰는 메서드가
        있는지 보고, Suspense를 다루는 방법을 바꿔 가며 스크롤하거나 150쪽으로 가 보세요.
      </p>
      <Lab />
    </main>
  )
}
