'use client'

import { Component, memo, type ReactNode, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { Fallback } from './fallback'

// 워커는 1편처럼 번들러가 해석하게 둡니다. legacy로 빌드하면 next.config.ts의 alias가 이 경로를 legacy 워커로 바꿔요.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// Suspense를 다루는 다섯 가지 방법. 주소로 고릅니다(?suspense=transition).
//   default     react-pdf 11을 올리기만 한 상태. 가장 가까운 경계는 next/dynamic의 loading이에요
//   off         <Document suspense={false}>. 10.x처럼 loading prop을 씁니다
//   outer       <Document> 바깥에 <Suspense>를 하나 둡니다
//   transition  outer + 쪽을 마운트하는 업데이트를 startTransition으로 감쌉니다
//   page        outer + <Page>마다 <Suspense>를 둡니다
type Fix = 'default' | 'off' | 'outer' | 'transition' | 'page'
const FIXES: { key: Fix; label: string }[] = [
  { key: 'default', label: '기본값' },
  { key: 'off', label: 'suspense={false}' },
  { key: 'outer', label: 'Document 바깥 <Suspense>' },
  { key: 'transition', label: '+ startTransition' },
  { key: 'page', label: '+ 쪽마다 <Suspense>' },
]

type Size = { width: number; height: number }

const FILE = '/long.pdf'
const SCALE = 1
const JUMP_TO = 150
const BUILD = process.env.NEXT_PUBLIC_PDFJS_BUILD ?? 'modern'

declare global {
  interface Window {
    __native?: { goic: boolean; sp: boolean }
  }
}

// 보이는 쪽만 그리기(4편): 자리(div)는 처음부터 전부 깔고, 화면 위아래 한 화면 안에 들어온 쪽만 <Page>를 마운트합니다.
// react-pdf 11에서는 새로 마운트된 <Page>가 쪽을 받아 오는 동안 suspend해요.
const LazyPage = memo(function LazyPage(props: { n: number; size: Size; fix: Fix; onRender: (n: number) => void }) {
  const { n, size, fix, onRender } = props
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = entry.isIntersecting
        // transition 안의 업데이트가 suspend하면, React는 새 쪽이 준비될 때까지 지금 화면을 그대로 둡니다.
        if (fix === 'transition') startTransition(() => setNear(v))
        else setNear(v)
      },
      { rootMargin: '100% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [fix])
  const render = useCallback(() => onRender(n), [n, onRender])
  const placeholder = <span className="num">{n}</span>
  const page = <Page pageNumber={n} scale={SCALE} renderAnnotationLayer={false} onRenderSuccess={render} />
  return (
    <div ref={ref} className="slot" data-page={n} style={size}>
      {!near ? placeholder : fix === 'page' ? <Suspense fallback={placeholder}>{page}</Suspense> : page}
    </div>
  )
})

// Suspense 모드에서는 불러오기 오류가 가장 가까운 Error Boundary로 갑니다.
// 없으면 Next.js 오류 화면(This page couldn't load)이 떠서, 여기서 받아 문구를 보여 줘요.
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) return <p className="error">PDF를 열지 못했어요: {this.state.error.message}</p>
    return this.props.children
  }
}

export default function Lab() {
  const [fix, setFix] = useState<Fix | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [size, setSize] = useState<Size | null>(null)
  const [fallbacks, setFallbacks] = useState(0)
  const [y, setY] = useState(0)
  const [jumpMs, setJumpMs] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const jumpStart = useRef<number | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('suspense')
    setFix(FIXES.some((f) => f.key === q) ? (q as Fix) : 'default')
    // PDF를 다 연 뒤에 폴백(뷰어 불러오는 중… / PDF 여는 중…)이 뜬 횟수를 셉니다. 처음 열 때 뜨는 건 세지 않아요.
    const onFallback = () => {
      if (loaded.current) setFallbacks((c) => c + 1)
    }
    window.addEventListener('viewer-fallback', onFallback)
    // 스크롤 위치는 0.25초마다 읽어요. 스크롤할 때마다 다시 그리면 재는 값이 흔들립니다.
    const id = setInterval(() => setY(Math.round(window.scrollY)), 250)
    return () => {
      window.removeEventListener('viewer-fallback', onFallback)
      clearInterval(id)
    }
  }, [])

  const onRender = useCallback((n: number) => {
    if (n === JUMP_TO && jumpStart.current !== null) {
      setJumpMs(Math.round(performance.now() - jumpStart.current))
      jumpStart.current = null
    }
  }, [])

  const jump = () => {
    const el = document.querySelector(`[data-page="${JUMP_TO}"]`)
    if (!el) return
    setJumpMs(null)
    jumpStart.current = performance.now()
    el.scrollIntoView({ block: 'start' })
  }

  if (!fix) return null
  const native = window.__native
  const has = (v?: boolean) => (v === undefined ? '-' : v ? '있음' : '없음')
  const pages = Array.from({ length: numPages }, (_, i) => i + 1)

  const doc = (
    <Document
      file={FILE}
      suspense={fix === 'off' ? false : undefined}
      loading="PDF 여는 중…"
      onLoadError={(e) => setLoadError(e.message)}
      onLoadSuccess={async (pdf) => {
        // 자리 크기는 1쪽에서 한 번만 잽니다. 이 PDF는 모든 쪽 크기가 같아요.
        const first = await pdf.getPage(1)
        const vp = first.getViewport({ scale: SCALE })
        setSize({ width: Math.floor(vp.width), height: Math.floor(vp.height) })
        setNumPages(pdf.numPages)
        loaded.current = true
      }}
    >
      <div className="list">
        {size && pages.map((n) => <LazyPage key={n} n={n} size={size} fix={fix} onRender={onRender} />)}
      </div>
    </Document>
  )
  const outer = fix === 'outer' || fix === 'transition' || fix === 'page'

  return (
    <>
      <div className="panel sticky">
        <table>
          <tbody>
            <tr>
              <th>이 브라우저</th>
              <td>
                Map.prototype.getOrInsertComputed <b>{has(native?.goic)}</b>, Math.sumPrecise <b>{has(native?.sp)}</b>
              </td>
            </tr>
            <tr>
              <th>pdf.js</th>
              <td>
                {pdfjs.version}, <b>{BUILD}</b> 빌드
              </td>
            </tr>
          </tbody>
        </table>
        <div className="row">
          <strong>Suspense</strong>
          {FIXES.map((f) => (
            <a key={f.key} className="btn" aria-current={fix === f.key ? 'page' : undefined} href={`?suspense=${f.key}`}>
              {f.label}
            </a>
          ))}
        </div>
        <div className="row">
          <button onClick={jump} disabled={!numPages}>
            {JUMP_TO}쪽으로 가기
          </button>
          <span>
            {JUMP_TO}쪽까지 <b>{jumpMs === null ? '-' : `${jumpMs}ms`}</b>
          </span>
          <span>
            PDF를 연 뒤 폴백이 뜬 횟수 <b>{fallbacks}</b>
          </span>
          <span className="mute">scrollY {y}</span>
        </div>
        {loadError && <p className="error">PDF를 열지 못했어요: {loadError}</p>}
      </div>

      <Boundary>{outer ? <Suspense fallback={<Fallback text="PDF 여는 중…" />}>{doc}</Suspense> : doc}</Boundary>
    </>
  )
}
