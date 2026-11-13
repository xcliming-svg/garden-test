# 프로젝트 기반 기술 및 초기 화면 선정 근거

- 최초 기록: 2026-11-12. 기존 AGENTS.md의 버전 선정·참조 근거를 이관했다.
- 아래 날짜와 출처는 당시 확인한 기록이며 현재 최신 버전을 새로 확인한 결과가 아니다.
- 실행 및 시스템 현행 상태는 [implementation.md](./implementation.md), 현재 devel 화면 규격은 [resolution-960x540.md](./resolution-960x540.md), 배포는 [deployment.md](./deployment.md)를 따른다.

## 버전 선택 정책

- 채택: **Phaser 3.90.0**, 정확한 버전으로 고정한다.
- 근거: Phaser 공식 릴리스 기록상 3.90.0은 2025-05-23 공개된 3.x 최종 계열 릴리스이며, npm 배포 지표에서 널리 다운로드되는 기존 메이저 버전이다.
- 2026-11-12 당시 확인 기록상 **Phaser 전체 최신 안정판은 4.2.1**이었다. 따라서 "Phaser 3.90.0이 최신"이라고 적지 않는다.
- 4.x 전환은 별도 요청과 마이그레이션 근거가 있을 때만 수행한다. 최신 API를 막연히 가져오거나 버전을 무단 업그레이드하지 않는다.
- 출처:
  - 공식 배포 아카이브: https://phaser.io/download/archive
  - 3.90.0 릴리스: https://phaser.io/news/2025/05/phaser-v390-released
  - npm 사용·배포 지표: https://www.npmjs.com/package/phaser?activeTab=versions

## 화면 구성을 선택한 직접 근거

1. **Phaser 공식 Scene 개념:** 로딩·메인 메뉴·게임 레벨 등 화면을 Scene으로 분리하며, `pause / resume`, `launch / stop`으로 중첩 화면을 표현할 수 있다.
   - https://docs.phaser.io/phaser/concepts/scenes
2. **실존 게임 Hades:** 메인 메뉴, 일시정지, 설정, 컨트롤, 확인 대화상자와 종료 메뉴의 사용 사례. 인터페이스 참조일 뿐 스타일/게임 메커니즘을 복제하지 않는다.
   - https://www.blackscreengaming.com/hades/menus/ (실제 메뉴 항목을 기록한 2차 자료)
   - https://store.steampowered.com/news/posts/?appgroupname=Hades&appids=1145360&enddate=1600356434&feed=steam_community_announcements (개발사 패치 노트의 Pause 메뉴 Quit/Give Up 구분)
3. **실존 게임 Dead Cells:** 공식 패치 노트에 Pause 메뉴의 Options, Restart, Quit, Info 접근이 명시되어 있다. 이번 범위에서 실행할 수 없는 Restart는 강제로 구현하지 않는다.
   - https://deadcells.com/patchnotes/7
4. **실존 게임 Slay the Spire:** 메인 메뉴와 Game Over 화면 사례; 자료는 화면 존재의 근거이며 세부 UI의 절대적인 표준을 의미하지 않는다.
   - https://www.mobygames.com/game/98734/slay-the-spire/screenshots/
5. **Steam 출시 요건:** Steamworks에서는 SteamPipe를 통한 콘텐츠 빌드와 앱 실행 옵션 등의 별도 설정이 필요하다. **웹에서 보인다는 사실과 Steam 출시 가능한 실행 파일이 있다는 사실은 다르다.**
   - https://partner.steamgames.com/doc/sdk
   - https://partner.steamgames.com/doc/sdk/uploading

게임 장르 전체에 반드시 들어가야 한다는 **강제 규격은 없다**. 이 저장소의 화면 목록은 확인된 공통 사례를 바탕으로 선정한 최소 인터페이스이며, 이후 구체 게임 기획은 사용자가 지정한다.

## 초기 개발 범위와 검증 이력

- 향후 Steam 출시를 고려한 로그라이크의 화면 구조를 먼저 구축했다. 실제 게임플레이·영속성·패키징은 별도 승인 전 미구현이다.
- 최초 씬 스켈레톤 작업에서는 사용자 요청으로 테스트를 실행하지 않았으며 이후 작업에 자동 적용되는 지시는 아니었다. 이후 JS 구문·모의 동작과 실제 Chromium 회귀 검증을 단계적으로 도입했다. 개별 실행 결과는 [changes.md](./changes.md) 및 [ui-scale-audit.md](./ui-scale-audit.md)를 참조한다.
- 초기 UI는 사용자 참조 기반으로 구성했지만 기존 게임의 콘텐츠·메커니즘을 복제하지 않는다.
- 웹 프로토타입은 Steam용 오프라인 실행 패키지가 아니다. Steam SDK 및 패키징은 별도 승인 대상이다.
