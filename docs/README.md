# 개발 문서

> **현재 devel 기준:** 현재 단일 디자인 좌표계와 세부 UI 규격은 [960×540 현행 규격](./resolution-960x540.md)이 우선한다. 아래 640×360 및 1280×720 수치·확정 이력은 과거 main 기준 기록이며 현재 devel에 적용하지 않는다. main 변경이나 게임플레이 구현을 승인하는 문서가 아니다.


이 디렉터리는 대화에서 확정된 설계와 저장소에 실제로 적용된 구현을 시스템 단위로 관리한다. 대화 전문, 작업 지시 문장, 단순 커밋 메시지의 모음이 아니다.

| 문서 | 역할 |
| --- | --- |
| [project-foundations.md](./project-foundations.md) | 엔진 버전 선정 근거, 초기 화면 구성의 참고 자료 및 개발 단계 이력 |
| [deployment.md](./deployment.md) | main/devel GitHub Pages 배포 구성, 초기 설정 및 검증 방법 |
| [resolution-960x540.md](./resolution-960x540.md) | 현재 devel 실험 규격, 변경 범위 및 검증 |
| [ui-scale-audit.md](./ui-scale-audit.md) | 960×540 논리 규격·실제 화면 간격·배율 감사 |
| [ui-metrics-benchmark.md](./ui-metrics-benchmark.md) | 실제 브라우저 10개 UI 시안 비교, 측정 기준, 순위 및 J안 선정 |
| [implementation.md](./implementation.md) | 현재 게임의 설계 및 구현 상태. 시스템별 적용 사항, 확정된 미구현 사항, 코드 위치 |
| [ui-spec.md](./ui-spec.md) | 공통 UI 상태·조작 규칙 및 과거 main 디자인 규격; devel 세부 수치는 960×540 현행 규격 우선 |
| [ui-decisions.md](./ui-decisions.md) | 2026-11-12 UI 디자인 확정 기록. 레이아웃, HUD, Garden 32, 보더, 폰트·렌더링 최종 결정 및 제약 |
| [changes.md](./changes.md) | 커밋별 시스템 변경 요약 및 검증 상태. 현재 기준 정리 이후 지속적으로 갱신 |

상세 좌표·색상·PNG 크기는 [ASSET_SPECS.md](../ASSET_SPECS.md), 실행 방법은 [README.md](../README.md), 개발 범위 및 문서 갱신 규칙은 [AGENTS.md](../AGENTS.md)를 참조한다.

## 문서 읽기 기준

- **확정 설계:** 사용자와 합의한 목표나 규격. 코드에 없으면 구현 완료를 뜻하지 않는다.
- **적용 구현:** 현재 저장소 소스에 존재하는 기능이나 UI. 실행 검증 여부와 구분한다.
- **미구현·미정:** 확정 설계의 남은 작업 또는 아직 결정하지 않은 사항. 추가 개발을 승인하는 목록이 아니다.

devel 현행 UI의 크기·색·좌표·패딩은 resolution-960x540.md에서 먼저 확인한다. 배율과 가시 간격 검사 기준은 ui-scale-audit.md, 에셋 상세 규격은 ASSET_SPECS.md, 씬 계약과 모듈 책임은 implementation.md, 최초 엔진 선정 및 외부 자료는 project-foundations.md에 둔다. 변경 이력에는 대체된 시안도 남기되 현행 문서와 구분한다. AGENTS.md는 저장소 전체에 적용되는 지속적인 개발 원칙 및 작업 절차만 관리한다.

구현 변경 시 해당 시스템의 현행 문서를 갱신하고 변경 이력에도 동일 작업의 효과를 기록한다. 변경 없는 시스템을 반복해서 기록하지 않는다. 과거 설계가 대체되면 현행 문서에는 최신 확정안을 유지한다.
