# 시스템별 변경 이력

각 구현 변경의 결과를 시스템 단위로 기록한다. 대화 원문 또는 코드 diff의 복제가 아니라 **어떤 시스템에 무엇이 적용되었으며, 무엇이 아직 구현되지 않았는지**를 설명한다. 최신 구현 상태는 [implementation.md](./implementation.md)를 참조한다.

## 2026-11-12 — 구현 기준선 확립

**기준 커밋:** [74caa36](https://github.com/xcliming-svg/garden-test/commit/74caa3657ff11565a4080fedcfd71faadf85c86f) (`main`)

최초 정리 시점까지의 화면 구현을 다음과 같이 시스템 단위로 정리한다. 아래 커밋 링크는 실제 개발 이력을 참조하기 위한 것이며 별도의 기능 추가를 승인하지 않는다.

| 시스템 | 적용된 변경 | 관련 커밋 |
| --- | --- | --- |
| 씬 및 메뉴 | Phaser 기반 화면 구조, 크레딧 제거, 도감 씬, ESC 및 하위 화면 전환 | [d2de6e9](https://github.com/xcliming-svg/garden-test/commit/d2de6e9223c84f86dd26bf27a5c43535970a99b7)까지 |
| 전장·정원·도안 | 640×360 논리 화면, 10×10 정원과 접이식 도안, 정적 오브젝트, 하단 슬롯 | [af814cb](https://github.com/xcliming-svg/garden-test/commit/af814cbc62ccbb9bc5f165aaf9f4671e471334f3) |
| 렌더링 | 창 최대 16:9 렌더링, 카메라 배율과 UI 글자 해상도 분리 | [2263ac5](https://github.com/xcliming-svg/garden-test/commit/2263ac5c8c74c5beb7ea9f0f1751c31150eaa6b1) |
| UI 정렬 | 레이블·값 중심 정렬, 메뉴 간격, 공통 패딩, 세 자리 비용 대응 | [f8f736b](https://github.com/xcliming-svg/garden-test/commit/f8f736b505922d9c5dc916745bfffaec4a3a5762) |
| HUD·도안·슬롯 | 콘텐츠 기반 컬럼 폭, 잔여 공간 게이지, 도안 패딩 4px, 비용 가로 배치 | [ced778d](https://github.com/xcliming-svg/garden-test/commit/ced778d3312b3e34a828256ca9348ba2f522a193) |
| 확장 슬롯 | 999 표시 예시 및 자릿수와 무관한 공통 글자 크기 | [74caa36](https://github.com/xcliming-svg/garden-test/commit/74caa3657ff11565a4080fedcfd71faadf85c86f) |

**미구현:** 게임플레이, 실제 에셋, 데이터 바인딩, 게임 저장, Steam 패키징.

**검증:** 실행·자동·빌드 테스트 미실행(당시 사용자 지시). 개발 브랜치의 다섯 커밋은 `main`에 fast-forward 병합되었다.

## 2026-11-12 — 개발 문서 관리 체계 적용

| 시스템 | 적용 내용 |
| --- | --- |
| 문서 관리 | `docs/` 디렉터리를 추가하고 확정 설계와 적용 구현을 구분한 현행 문서 및 변경 이력을 구성 |
| 개발 규칙 | 구현 변경과 해당 문서의 동시 갱신을 커밋 전 필수 확인 사항으로 추가 |
| 인수인계 | 루트 README에서 개발 문서로 연결하고 기존 에셋 상세 규격을 유지 |

**검증:** 저장소 소스와 기존 문서를 대조하여 작성. 런타임 소스 변경 없음. 실행 테스트 대상 아님.

## 이후 기록 규칙

새 변경은 날짜와 작업 제목, 영향을 받은 시스템, 확정 설계 또는 실제 적용 내용, 미구현/제약, 검증 상태를 기록한다. 커밋 메시지 또는 브랜치/PR 참조를 사용해 추적할 수 있게 하되, 같은 커밋의 SHA를 그 커밋 내부에 억지로 기록하지 않는다. 필요한 경우 후속 변경에서 이미 생성된 커밋 링크를 보완한다. 현행 문서에는 최신 상태를 반영하고, 이력은 기존 기록을 유지한다.
