# 서리풀 현장 로그인·서버 기록

계산기는 공개이며 현장 3개 메뉴만 Google 로그인과 관리자 승인을 요구한다. Supabase의 행 수준 보안(RLS)이 도면/기록 접근을 제한한다. 프런트엔드 버튼 숨김만으로 보호하지 않는다.

## 설치

1. `supabase/seoripul.sql`을 새 Supabase 프로젝트에서 한 번 실행한다. 기존 객체를 교체하지 않는다.
2. 대시보드에서 `seoripul_private.settings`에 최초 관리자 이메일을 소문자로 입력한다. 이 값은 공개 소스에 넣지 않는다. 최초 관리자도 실제 Google 로그인과 이메일 확인을 통과해야 한다.
3. 기존 도면 JSON을 `site_drawings`의 id/document에 등록한다. id는 JSON id와 같아야 한다. 도면과 현장 기록을 정적 호스팅 폴더에 배포하지 않는다.
4. Google Cloud에 웹 OAuth 클라이언트를 구성한다. JavaScript origin은 `https://deugyi.github.io`, callback은 `https://qbrwzldrlwtiawgzwvit.supabase.co/auth/v1/callback`이다. Google Client ID/Secret은 Supabase Google 제공자 설정에만 입력한다. Secret을 프런트엔드/저장소에 넣지 않는다.
5. Supabase Site URL 및 Redirect URL을 `https://deugyi.github.io/kds-check/`로 지정한다. Google OAuth 테스트 모드에서는 이용자를 테스트 사용자로 등록해야 한다. 외부 이용자 확대 전 게시 상태를 확인한다.
6. `site-config.js`에는 프로젝트 URL과 브라우저 공개용 publishable key만 쓴다. service_role/secret key를 쓰지 않는다.
7. 관리자/미승인/조회 전용/입력 사용자로 실제 로그인 시험 후 배포한다.

## 권한과 기록

- pending: 승인 대기. 자기 가입 상태만 조회 가능.
- viewer: 도면과 모든 PRD 기록 조회 가능.
- editor: 조회 및 PRD 날짜·메모 저장 가능.
- admin: editor 기능 및 사용자 승인/조회·입력·이용중지 지정. 화면에서 다른 관리자를 만들거나 최초 관리자를 강등하지 않는다.
- blocked: 도면/기록 조회·수정 불가.

구글에서 확인된 이메일과 실제 auth.users/auth.identities를 서버에서 대조한다. 클라이언트가 주장하는 이메일이나 사용자 메타데이터로 관리자 권한을 얻지 못한다. 기록은 실제 도면의 공 키를 확인한 전용 함수로만 저장한다. 테이블 직접 쓰기, 익명 접근은 허용하지 않는다.

같은 공의 동시 변경은 버전 비교로 충돌을 알린다. 실패/충돌 시 입력을 남긴다. `최신 기록`은 미저장 입력이 있으면 버릴지 확인한다. 최신 기록은 화면 사용 중 30초마다 조회하되 입력 중에는 적용하지 않는다. 권한은 현장 이용 중 60초마다 확인하며 저장 시에도 서버에서 확인한다. 오프라인 작업의 영속 저장은 제공하지 않는다.

기존 localStorage 기록은 `기존 브라우저 기록 가져오기`를 사용해 명시적으로 이전한다. 이미 서버에 기록이 있는 공은 건너뛰며 브라우저 원본을 삭제하지 않는다. 변경 전후 내용과 수정자/시각을 비공개 감사 테이블에 남긴다.

## 도면 공개 이력

이전 버전의 도면 JSON은 공개 GitHub 저장소와 Pages로 이미 배포되었다. 현재 파일을 제거해도 과거 Git 이력·캐시·다운로드 사본은 회수되지 않는다. 새 서버 기록은 별도 비공개 저장소에만 저장한다. 과거 도면의 완전한 비공개 전환은 별도 저장소/이력 정책이 필요하다.

## 검증

- `node --test tests/prd*.test.cjs tests/rc-beam-ui.test.cjs tests/report-print.test.cjs`
- 테스트 도면은 실제 현장 좌표와 무관한 합성 도면이다. 비공개 실도면 검증은 `PRD_DRAWING_FIXTURE` 환경변수에 로컬 JSON 경로를 지정한다.
- PostgreSQL 권한 검증: npm의 `@electric-sql/pglite` 0.5.8을 설치하거나 `PGLITE_MODULE`에 모듈 경로를 지정하고 `node --test supabase/security.test.cjs` 실행. Supabase auth 테이블의 최소 대체 스키마를 만들고 실제 PostgreSQL에서 SQL/RLS/역할/충돌/입력 검사를 실행한다. 실제 Google OAuth 왕복 검증을 대체하지 않는다.

근거: [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
