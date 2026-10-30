# 남측·북측 독립 웹앱

회사 시스템에서 아래 두 URL을 각각 웹앱 주소로 등록한다.

| 앱 | 웹 주소 | GitHub 저장소 |
|---|---|---|
| 사이트원 · 서리풀 남측 | https://deugyi.github.io/siteone-south/ | https://github.com/deugyi/siteone-south |
| 사이트원 · 서리풀 북측 | https://deugyi.github.io/siteone-north/ | https://github.com/deugyi/siteone-north |

기존 https://deugyi.github.io/kds-check/ 는 구조 검토 프로그램 및 통합 진입점으로 유지한다.

## 적용 범위

- 각 저장소는 자체 `main`과 GitHub Pages 배포를 사용한다. 수정·배포가 다른 앱에 자동 반영되지는 않는다.
- 남측 앱은 남측 도면 기반 시공 현황과 실적 보고를 제공한다.
- 공정별 진행현황(협력사 아침계획·실적 접수, 감독자 승인, 카카오 채널 설정)은 추후 개발 과제로 운영 앱에서 제외했다. 두 앱 모두 해당 메뉴·화면·접수 스크립트를 생성 결과에 포함하지 않는다. 원본 템플릿·관련 소스·기존 서버 기록은 보존하며, 기존 통합 저장소에서 후속 개발을 이어갈 수 있다. 도면 기반 실적 보고·엑셀 출력은 유지한다.
- 북측 앱은 북측 시공 현황 전용 진입점이다. 현재 북측 도면·시공기록은 준비 중이며, 남측 자료를 대신 표시하거나 남측 도면을 미리 읽지 않는다. 북측 자체 도면 연결은 별도 후속 작업이다.
- iframe이나 URL 리다이렉트만으로 화면을 감싸지 않고 각 주소에서 직접 실행한다. 상대경로는 자신의 저장소 안에서 해석된다.
- 로그인 계정·승인·데이터 서버는 기존 것을 사용한다. 주소·저장소 분리는 데이터베이스나 사용자 권한의 분리를 뜻하지 않는다. 데이터 복제·이관·기존 기록 수정은 수행하지 않는다.

## 로그인 복귀

승인된 기존 Google OAuth 반환 주소 `https://deugyi.github.io/kds-check/`를 유지한다. 로그인 전에 현장 식별자와 시간을 같은 탭의 sessionStorage에 저장하고, 기존 주소에서 Supabase SDK의 PKCE 코드 교환 및 계정 확인이 끝난 뒤 원래 앱 주소로 복귀한다. 복귀 상태는 한 번만 사용하며 15분 후 만료한다. 임의의 외부 URL이나 다른 경로를 복귀 대상으로 받지 않는다.

추가 인증키 발급, OAuth 허용 URL 확대 또는 권한 정책 변경은 없다. 두 앱은 같은 `deugyi.github.io` origin을 사용하므로 기존 SDK의 로그인 세션을 공유한다. 회사 시스템 내부 웹뷰의 외부 Google 로그인·쿠키 정책은 해당 시스템에서 확인해야 한다. 회사 SSO 연동을 구현한 것은 아니다.

## 각 저장소 수정 방법

전용 저장소의 `app-target.json`은 `{"site":"south"}` 또는 `{"site":"north"}`다. 공통 화면 원본은 `app-template.html`이며, 각 앱의 `index.html`은 다음 순서로 만든다.

```text
npm ci
npm run build:sites
npm test
git add .
git commit
git push
```

`index.html`을 직접 편집하면 다음 생성 때 덮어쓰므로 `app-template.html`과 관련 JS/CSS를 수정한다. 생성 결과의 최신 여부는 `npm test`에서 검사한다. 두 앱 모두 추후 과제인 공정별 진행현황 스크립트를 로드하지 않으며, 북측은 남측 도면 UI도 로드하지 않는다. 북측 도면 추가 시 북측용 drawing ID·저장 API 범위와 UI 연결을 함께 구성해야 한다.

독립 복제 시점 이후의 공통 수정은 두 저장소에 각각 반영해야 한다. 기존 통합 저장소의 로그인 복귀 처리도 유지한다. 복구는 각 저장소의 문제 커밋을 revert하여 재배포한다.

공식 참고: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Supabase 로그인 반환 URL](https://supabase.com/docs/guides/auth/redirect-urls).
