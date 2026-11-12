# GitHub Pages — main/devel 동시 배포

- 2026-11-12: main `7198cba`에서 `devel` 생성 후 `feature/resolution-960x540`의 `b18a6c6`을 fast-forward 병합했다. main의 게임 소스는 변경하지 않는다.
- [배포 워크플로](../.github/workflows/deploy-pages.yml)는 devel push 시 main/devel 최신 커밋을 각각 가져와 정적 실행 파일만 하나의 Pages artifact에 조립한다. 원본 브랜치 간 파일 복제나 main 병합을 수행하지 않는다. `assets/fonts`의 라이선스 파일도 함께 복사한다.

| 배포 위치 | 소스 | 실행 주소 |
| --- | --- | --- |
| 루트 | main | https://xcliming-svg.github.io/garden-test/ |
| /devel/ | devel | https://xcliming-svg.github.io/garden-test/devel/ |

각 경로의 `version.txt`는 배포에 사용한 Git SHA를 기록한다. 두 페이지의 JS와 CSS는 각각 상대 경로로 로드한다.

## 초기 설정

1. [Settings → Pages](https://github.com/xcliming-svg/garden-test/settings/pages)에서 Source를 GitHub Actions로 변경한다. 기존 branch-based main 배포 설정에서는 사용자 정의 워크플로 배포가 완료되지 않을 수 있다.
2. [Settings → Environments](https://github.com/xcliming-svg/garden-test/settings/environments)에서 github-pages 환경이 main에 한정돼 있다면 devel 배포도 허용한다.
3. [Actions](https://github.com/xcliming-svg/garden-test/actions)에서 devel의 Deploy main and devel to GitHub Pages 실행을 확인한다. 설정 변경 전에 실패한 경우 해당 실행의 재실행 또는 devel에 새 push로 배포한다.
4. 두 경로의 version.txt 및 실제 게임 시작을 확인한다.

## 자동 갱신 범위

워크플로는 main을 수정하지 않기 위해 devel에만 둔다. devel에 push하면 두 버전이 최신 상태로 함께 배포된다. main만 변경된 경우 다음 devel push(또는 이전 실행 재실행)가 있어야 루트 사이트에 반영된다. main push 독립 배포까지 필요하다면 main에도 동일한 배포 워크플로를 추가하는 별도 변경이 필요하다.

## 근거

- GitHub 공식 문서 (2026-11-12 확인): [사용자 정의 Pages 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [게시 소스 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
- 기본 Pages는 하나의 브랜치/폴더를 게시 대상으로 선택한다. 따라서 하나의 artifact에 두 브랜치를 별도 경로로 조립한다.
- 이 설정은 2개 Pages 사이트를 만드는 것이 아니다. 게임플레이나 UI 규격, GitHub Pages의 실제 계정 설정을 변경하지 않는다. CDN 연결이 필요한 기존 실행 조건은 동일하다.
