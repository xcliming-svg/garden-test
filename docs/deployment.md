# GitHub Pages — main/devel 동시 배포

- 2026-11-12: main `7198cba`에서 `devel` 생성 후 `feature/resolution-960x540`의 `b18a6c6`을 fast-forward 병합했다. main의 게임 소스는 변경하지 않는다.
- [배포 워크플로](../.github/workflows/deploy-pages.yml)는 main 또는 devel push 시 main/devel 최신 커밋을 각각 가져와 정적 실행 파일만 하나의 Pages artifact에 조립한다. 원본 브랜치 간 파일 복제나 main 병합을 수행하지 않는다. `assets/fonts`의 라이선스 파일도 함께 복사한다.

| 배포 위치 | 소스 | 실행 주소 |
| --- | --- | --- |
| 루트 | main | https://xcliming-svg.github.io/garden-test/ |
| /devel/ | devel | https://xcliming-svg.github.io/garden-test/devel/ |

각 경로의 `version.txt`는 배포에 사용한 Git SHA를 기록한다. 두 페이지의 JS와 CSS는 각각 상대 경로로 로드한다.

## 초기 설정

1. [Settings → Pages](https://github.com/xcliming-svg/garden-test/settings/pages)에서 Source를 GitHub Actions로 변경한다. 기존 branch-based main 배포 설정에서는 사용자 정의 워크플로 배포가 완료되지 않을 수 있다.
2. [Settings → Environments](https://github.com/xcliming-svg/garden-test/settings/environments)에서 github-pages 환경이 main에 한정돼 있다면 devel 배포도 허용한다.
3. [Actions](https://github.com/xcliming-svg/garden-test/actions)에서 main 또는 devel의 Deploy main and devel to GitHub Pages 실행을 확인한다. 설정 변경 전에 실패한 경우 해당 실행의 재실행 또는 devel에 새 push로 배포한다.
4. 두 경로의 version.txt 및 실제 게임 시작을 확인한다.

## 자동 갱신 범위

2026-11-16: main 배포 워크플로의 push 대상에 main을 추가했다. main 또는 devel에 push하면 두 버전이 최신 상태로 함께 배포된다. main에서 실행한 배포는 두 버전의 로컬 JS URL에 각각 커밋 SHA를 추가한다. main 배포 수정을 devel에도 통합하여 양쪽 브랜치에서 동일한 자동 배포 및 JS 캐시 갱신을 적용한다. 게임 소스 및 에셋은 변경하지 않는다.

2026-11-18: `src/svg-palette.js`는 배포된 자신의 스크립트 URL의 40자리 SHA(`v`)를 SVG 경로에도 붙인다. 원본 색상 비교 모드에도 동일하게 적용하며, 로컬에서 버전 없는 스크립트를 실행하는 경우 기존 상대 경로를 유지한다. 신규 배포마다 SVG 캐시 키가 달라지므로 오래된 색상 자산을 재사용하는 문제를 방지한다.

## 근거

- GitHub 공식 문서 (2026-11-12 확인): [사용자 정의 Pages 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [게시 소스 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
- 기본 Pages는 하나의 브랜치/폴더를 게시 대상으로 선택한다. 따라서 하나의 artifact에 두 브랜치를 별도 경로로 조립한다.
- 이 설정은 2개 Pages 사이트를 만드는 것이 아니다. 게임플레이나 UI 규격, GitHub Pages의 실제 계정 설정을 변경하지 않는다. CDN 연결이 필요한 기존 실행 조건은 동일하다.
