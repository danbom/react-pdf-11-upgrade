# react-pdf-11-upgrade

react-pdf를 11.0.0으로 올렸을 때 화면에서 바로 드러나는 두 가지, **브라우저 하한**과 **Suspense 기본값**을 한 화면에서 확인하는 최소 예제예요.
블로그 글 「브라우저에서 문서 다루기 #6」의 재현 저장소입니다.

> 라이브 데모는 아직 없어요. 로컬에서 `npm run build && npm start`로 확인하세요.

## 결론 먼저

### 1. pdfjs-dist를 통째로 legacy로 바꿔야 Chrome 145 아래에서 열려요

react-pdf 11.0.0은 pdfjs-dist 6.3.289의 modern 빌드를 import해요. 이 빌드는 `Map.prototype.getOrInsertComputed`(Chrome 145부터)와 `Math.sumPrecise`(Chrome 147부터)를 polyfill 없이 불러요.

| pdf.js 빌드 (`PDFJS_BUILD`) | Chromium 140 | 143 | 147 | 153 |
| --- | --- | --- | --- | --- |
| `modern`(올리기만 한 상태) | 멈춤 ① | 멈춤 ① | 열림 | 열림 |
| `legacy-worker`(워커만 legacy, react-pdf README의 방법) | 멈춤 ② | 멈춤 ② | 열림 | 열림 |
| `legacy-main`(메인 스레드만 legacy) | 멈춤 ① | 멈춤 ① | 열림 | 열림 |
| **`legacy`(세 경로 모두 legacy)** | **열림** | **열림** | 열림 | 열림 |

- ① 워커에서 `this._requestsByChunk.getOrInsertComputed is not a function`. PDF를 범위 요청으로 나눠 받는 코드예요(이 PDF는 656KB)
- ② 메인 스레드의 `getOptionalContentConfig`에서 `this[#se].getOrInsertComputed is not a function`

`next.config.ts`에서 경로 세 개를 legacy로 바꾸면 돼요. 컴포넌트 코드는 바꾸지 않아요.

```ts
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.mjs',
      'pdfjs-dist/web/pdf_viewer.mjs': 'pdfjs-dist/legacy/web/pdf_viewer.mjs',
      'pdfjs-dist/build/pdf.worker.min.mjs': 'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    },
  },
}
```

- `'pdfjs-dist'`는 정확히 그 이름일 때만 바뀌었어요. `pdfjs-dist/legacy/…` 같은 하위 경로까지 따라 바뀌지는 않아요
- 워커 줄은 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`에도 적용됐어요. 빌드에 나온 워커 파일이 legacy 워커와 같은 파일인지 해시로 확인했어요
- 대가: `gzip -9`로 압축해 보면 pdf.js 묶음이 195.6KB → 230.1KB, 워커가 374.2KB → 391.0KB로 커졌어요

### 2. Suspense 기본값은 「보이는 쪽만」 뷰어를 맨 위로 되돌려요

react-pdf 11은 `Document`와 `Page`가 기본으로 suspend해요. 이 예제처럼 뷰어를 `next/dynamic`으로 감쌌다면 가장 가까운 Suspense 경계는 `loading`이에요.

Chromium 153에서 3번씩 잰 범위예요.

| Suspense (`?suspense=`) | 툴바 | 1쪽 | 40쪽, 80쪽, 120쪽으로 스크롤 | 150쪽으로 가기 |
| --- | --- | --- | --- | --- |
| `default`(올리기만 한 상태) | 0.63~0.69초 | 0.70~0.75초 | 9번 모두 맨 위(scrollY 0)로 돌아감 | 1쪽에 남음 |
| `off`(`<Document suspense={false}>`) | 0.38~0.40초 | 0.63~0.69초 | 0.01~0.05초 | 0.11~0.12초 |
| `outer`(Document 바깥에 `<Suspense>`) | 0.38~0.40초 | 0.72~0.79초 | 9번 모두 맨 위로 돌아감 | 1쪽에 남음 |
| `transition`(outer + `startTransition`) | 0.36~0.47초 | 0.72~0.80초 | 0.03~0.24초 | 0.05~0.14초 |
| `page`(outer + 쪽마다 `<Suspense>`) | 0.37~0.41초 | 1.01~1.31초 | 0.32~0.33초 | 0.40~0.45초 |

- 툴바와 1쪽은 페이지를 연 뒤 「150쪽으로 가기」 버튼과 1쪽 캔버스가 뜬 시각이에요
- 스크롤은 그 쪽 자리로 스크롤한 뒤 캔버스가 붙기까지, 150쪽으로 가기는 버튼을 누른 뒤 150쪽의 `onRenderSuccess`까지예요
- 새로 마운트된 `<Page>`가 transition 밖에서 suspend하면, React가 이미 보이던 목록을 숨기고 폴백을 보여 줘요. 높이 24만 px짜리 목록이 잠깐 사라지면서 스크롤 위치가 0이 돼요
- 쪽마다 경계를 두면 쪽이 0.3초쯤 늦게 떠요. React는 suspend된 내용을 300ms에 한 번까지만 드러내요(React 문서 Suspense의 Caveats)
- legacy 빌드에서도 같아요. Chromium 143에서 `default`는 맨 위로 돌아갔고, `transition`은 위치를 지켰어요

## 실행

```bash
npm install
npm run build && npm start               # modern (http://localhost:3000)
npm run build:legacy && npm run start:legacy   # legacy (http://localhost:3001)
npm run versions                          # next / react-pdf / pdfjs-dist 버전 확인
```

`legacy-worker`, `legacy-main`은 `node scripts/run.mjs legacy-worker build --turbopack`처럼 빌드하고 `node scripts/run.mjs legacy-worker start`로 띄워요.
빌드끼리 덮어쓰지 않게 `.next`, `.next-legacy`, `.next-legacy-worker`, `.next-legacy-main`에 따로 나와요.

## 화면에서 볼 것

- 맨 위 칸에 **이 브라우저**가 `Map.prototype.getOrInsertComputed`와 `Math.sumPrecise`를 갖고 있는지 나와요. pdf.js보다 먼저 실행한 스크립트로 쟀어요. legacy 빌드는 core-js로 빠진 메서드를 전역에 채우기 때문에, pdf.js를 불러온 뒤에 재면 있는 것처럼 보여요
- 「없음」인 브라우저에서 modern 빌드는 「PDF를 열지 못했어요: …」가 떠요. 데모는 Error Boundary로 받아서 문구를 보여 줘요. 받지 않으면 Next.js의 「This page couldn't load」 화면이 떠요
- **Suspense** 줄에서 다루는 방법을 바꿔 가며 스크롤하거나 「150쪽으로 가기」를 눌러 보세요. 「PDF를 연 뒤 폴백이 뜬 횟수」가 올라가면 목록이 잠깐 사라졌다는 뜻이에요

## 측정 스크립트

```bash
# 브라우저마다 열리는지, 툴바와 1쪽이 언제 뜨는지
npm run check -- http://localhost:3000 ./c140 ./c143 ./c147 ./c153

# 스크롤과 150쪽으로 가기
npm run measure -- "http://localhost:3000/?suspense=transition" ./c153
```

- 브라우저 자리에는 Chrome 실행 파일 경로를 줘도 되고, `@sparticuz/chromium`을 설치한 폴더를 줘도 돼요. 글의 숫자는 리눅스에서 `@sparticuz/chromium` 140.0.0, 143.0.4, 147.0.2, 153.0.0을 폴더 네 개에 따로 설치해서 쟀어요(`mkdir c143 && cd c143 && npm init -y && npm i @sparticuz/chromium@143.0.4`)
- `check`에 `--polyfill=goic`이나 `--polyfill=all`을 붙이면, 앱 코드는 그대로 두고 메인 스레드와 워커 양쪽에 polyfill을 넣은 것처럼 흉내 내요

## 확인한 버전

```
Next.js     16.4.0 (Turbopack, next build)
react-pdf   11.0.0
pdfjs-dist  6.3.289
Chromium    140.0.7339.0, 143.0.7499.0, 147.0.7727.0, 153.0.8010.0 (headless, 1280×900)
```

- react-pdf 10.5.0이 쓰던 pdfjs-dist 5.4.296에는 `getOrInsertComputed` 호출이 없고, `Math.sumPrecise`가 없으면 채우는 코드가 들어 있었어요. 6.3.289에서 그 코드가 빠졌어요
- react-pdf 11의 `LinkService`는 `pdfjs-dist/web/pdf_viewer.mjs`를 import해요. 그래서 서버에서 평가될 때 오류가 `DOMMatrix is not defined`가 아니라 `window is not defined`로 바뀌었어요. `ssr: false`는 여전히 필요해요([1편 저장소](https://github.com/danbom/nextjs-pdfjs-minimal))

## 테스트 PDF 다시 만들기

```bash
python3 scripts/make-long-pdf.py   # public/long.pdf 를 다시 씁니다 (4편, 5편과 같은 300쪽 문서)
```

## 만든 방법

이 저장소는 에이전트(Claude)와 같이 만들었어요. 어떤 문제를 다룰지와 어디까지 공개할지는 제가 정했고, 코드는 에이전트가 쓰고 제가 읽고 검토했어요. 글에 쓴 숫자는 모두 이 코드로 실제로 돌려 본 값이고, 틀린 곳이 있다면 책임은 저에게 있어요.
