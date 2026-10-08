'use client'

import { useEffect } from 'react'

// Suspense 폴백. 뜰 때마다 이벤트를 보내서, 화면 위 칸에 PDF를 연 뒤 폴백이 몇 번 떴는지 셀 수 있게 해요.
export function Fallback({ text }: { text: string }) {
  useEffect(() => {
    window.dispatchEvent(new Event('viewer-fallback'))
  }, [])
  return <p className="loading">{text}</p>
}
