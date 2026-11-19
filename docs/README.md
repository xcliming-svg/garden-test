# 개발 문서

> **현행 devel 기본 실험:** [9×9 요정 화단 생존](./fairy-flowerbeds.md). 기존 50스테이지는 비교/역사 기록이며 main은 미변경.

> **이전 devel 실험:** [나뭇잎 요정 직접 이동 및 꽃 운반](./fairy-flower-carry.md). main 미통합.

> **이전 devel 50스테이지:** [V3 대칭 도안·규모 기반 캠페인](./campaign-v3-playable.md). 아래 6도안/단일 레벨 설명은 기존 비교용 규격 및 역사적 기록이다.

> **50스테이지 개별 무기·레벨 해금 계획:** [전체 해금 탐색 범위 및 비교 규격](./campaign-gear-unlock-plan.md). 연구 계획이며 확정된 스테이지 설정 아님.

> **50스테이지 장비 성장 연구:** [16칸 사용자 피드백·1,001회 반복 검증](./stage-gear-curve.md). 정사각형 선정값 devel 시험 적용.

> **devel 초반 전투 밀도 시험 적용:** [도안별 선정값 및 검증 한계](./early-pace-trial.md).

> **초반 도안 및 성장 실험:** [579회 밸런스 비교·도안 선택·후속 판단](./blueprint-balance-baseline.md).

> **devel 기본 플레이:** [플레이 통합 규격](./playable-run.md)이 게임 동작 및 임시 밸런스의 최신 기준이다. 아래 미리보기 문서는 `lab.html`에 보존된 비교 동작을 설명한다.

> **장착 무기 밸런스 v1 (devel):** `?enemies=1&weapons=1`에서 무기별 피해·사거리·쿨타임·레벨, 적 HP, 높이별 상성, 예측 조준 및 중복 10슬롯을 적용한다. `weaponSlots`, `weaponLevel`, `enemyCount`, `balanceWave`, `weaponLoadout` 비교 가능. [현행 밸런스 규격 및 시험 결과](./weapon-balance-v1.md). 기본 적 없는 모션과 기존 구슬 전투는 유지한다.

> **devel 나뭇잎 요정 장착 무기:** 기본 새 게임은 적 없이 시작하며 하단 슬롯에 장착한 무기는 나뭇잎 요정만 자동 발사한다. 여러 무기 독립 발사 및 교체 반영. 신발·방패는 공격 없음. 셀렉트는 무장착 시 시각 비교 전용. `?enemies=1&weapons=1`에서 실제 적 피해/감속·처치 드롭 확인. 기존 명시적 전투 비교는 유지. [무기 규격](./hero-weapon-preview.md). 보석 획득 판정과 무기 360° 조준은 분리하며, 바퀴는 정원 관통 금지, 설치형은 정원 외부의 안전한 위치만 허용한다.


> **보석/하트 전투 획득:** `?enemies=1`에서 실제 적 처치 드롭, 자석 보석 획득 및 꽃별 에너지 회복을 확인한다. [현행 아이템 규격](./item-cards.md). 기본 정적 카드 비교와 레거시 `?combat=1`은 유지.

- [SVG 아이템 카드 및 바닥 유산](./item-cards.md): 꽃 6종·일반 13종(물방울 요정 포함)·보석/하트 2종 배치, 툴팁·색상·크기·검증.


> **카드 복원 비교:** 기본 새 게임은 기존 꽃 카드 3개·아이템 카드 5개와 요정 11명 순찰을 표시하고 적/자동 공격을 숨긴다. 꽃은 인접 빈 칸에 배치, 아이템은 일반 슬롯에 임시 장착/교체한다. `?enemies=1`은 기존 군집·자동 공격, `?attack=0`은 비전투 군집, `?densitySim=1`은 밀집 비교, `?cards=0`은 카드 없는 순찰이다. `?combat=1` 기존 전투 유지. 실제 아이템 효과·드롭·보상 아님.

> **devel 외곽선 비교:** 돌담 없음·요정 전면, 요정 전체 stone↔paper 1px 밀집 디졸브, 적 외곽선 없음. `densitySim=1` 밀집→해소, `full=1` 100칸. 명시 `outlineColor`는 정적 비교, `outlineWidth`, `outline=0` 유지.

> **devel 자동 공격 비교:** 기본 실행에 새싹 요정 5발 빨강·물 요정 2발 노랑 자동 발사 및 적 피격/처치가 추가됐다. `?attack=0`은 이전 비전투 군집 비교, 요정 전면 기본, `?full=1`은 100칸으로 조합 가능하다. [공격 규격](./enemy-preview.md). 꽃 피해·실제 웨이브·보상 미구현.

> **Garden 20 v10 (main/devel):** [공통 색상 가이드](./ui-color-guide.md)가 최신 색상 규격이다. 기존 16개 재질색과 어두운 UI 4색을 적용하고 나머지 고정 UI 색을 기존 16색에 통합하며, SVG 원본은 보존하며 `?svgcolors=original`에서 원본 색상을 표시한다. 아래 이전 팔레트 수치와 색상 관련 기록은 역사적 기준이다.

> **devel 군집 전투 미리보기:** 적 12종 가시 긴 변 24~40px, 시간에 따라 동시 목표 1→200마리(120초). 12종 최초 순환 뒤 레벨별 출현 비중 60/30/10%. 초기 4칸 및 `?full=1` 100칸. 꽃과 요정의 기본 크기·속도·모션 유지. 실제 전투/충돌/웨이브 규칙 아님. [무작위 출현 및 모션 규격](./enemy-preview.md).

> **devel 요정 순찰:** [현행 11명 요정 순찰](./fairy-patrol.md) 우선. 기본 화면 전투 없음, 이전 전투는 `?combat=1`.

> **devel 꽃 성장·피격 SVG:** [현행 SVG 비교](./flower-growth-svg.md) 우선. 이전 꽃 머리 화면은 `?flowerheads=1`.

> **main/devel 현행 실행 화면:** [꽃·수호자·애벌레 비교 화면](./flower-head-preview.md)의 규격과 검증 기록을 우선 참조한다. 기존 정원·아이템 UI 데모 문서는 이전 상태의 기록을 포함한다.

> **현재 devel 기준:** 현재 단일 디자인 좌표계와 세부 UI 규격은 [960×540 현행 규격](./resolution-960x540.md)이 우선한다. 아래 640×360 및 1280×720 수치·확정 이력은 과거 main 기준 기록이며 현재 devel에 적용하지 않는다. main 변경이나 게임플레이 구현을 승인하는 문서가 아니다.


이 디렉터리는 대화에서 확정된 설계와 저장소에 실제로 적용된 구현을 시스템 단위로 관리한다. 대화 전문, 작업 지시 문장, 단순 커밋 메시지의 모음이 아니다.

| 문서 | 역할 |
| --- | --- |
| [simulation-design.md](./simulation-design.md) | AI 자동 플레이, 외부 밸런스 설정, 실행·병렬 실험·재현·로그·검증 및 재미 평가 기준 |
| [blueprint-balance-baseline.md](./blueprint-balance-baseline.md) | 도안 선택 6종, 1차 579회 기준 실험, 꽃 희귀도/성장/무기 조합/고밀도 검증 및 후속 기준 |
| [flower-removal-defense-pressure.md](./flower-removal-defense-pressure.md) | 만개 후 오배치 표시, 3초 제거, 슬롯 흰색 및 무조작 방어 압박 |
| [blueprint-feedback.md](./blueprint-feedback.md) | 첫 난이도 플레이 피드백, 도안·보상·결과 팝업 및 10×10 시간 추정 |
| [survivor-progression.md](./survivor-progression.md) | 기본 플레이 아이템 공급·웨이브 적용 규격 및 검증 |
| [survivor-progression-research.md](./survivor-progression-research.md) | 상용 서바이버라이크 공개 규칙·MIT 프로젝트 소스 조사 및 당시 제안 |
| [playable-presentation.md](./playable-presentation.md) | 전장 렌더링 깊이 전체, 저속 도입부/적 해금, 카드 배치와 승패 팝업 |
| [playable-run.md](./playable-run.md) | 실제 게임 루프·초기 장비·드롭·도안·성장·적 지속 공격·슬롯·승패 및 검증 |
| [weapon-balance-v1.md](./weapon-balance-v1.md) | 무기/적 스탯, 상성, 10슬롯 조합 및 실제 모델 시험 |
| [project-foundations.md](./project-foundations.md) | 엔진 버전 선정 근거, 초기 화면 구성의 참고 자료 및 개발 단계 이력 |
| [deployment.md](./deployment.md) | main/devel GitHub Pages 배포 구성, 초기 설정 및 검증 방법 |
| [resolution-960x540.md](./resolution-960x540.md) | 현재 devel 실험 규격, 변경 범위 및 검증 |
| [ui-spacing-guide.md](./ui-spacing-guide.md) | 용도별 공통 간격 3/5/10/20px, 패딩·정렬 및 예외 적용 가이드 |
| [ui-color-guide.md](./ui-color-guide.md) | Garden 20 v10 공통 UI·에셋 색상 원본, 명도/소재/상태 규칙, 신규 객체 제작 및 검증 |
| [ui-scale-audit.md](./ui-scale-audit.md) | 960×540 논리 규격·실제 화면 간격·배율 감사 |
| [ui-metrics-benchmark.md](./ui-metrics-benchmark.md) | 실제 브라우저 10개 UI 시안 비교, 측정 기준, 순위 및 J안 선정 |
| [implementation.md](./implementation.md) | 현재 게임의 설계 및 구현 상태. 시스템별 적용 사항, 확정된 미구현 사항, 코드 위치 |
| [ui-spec.md](./ui-spec.md) | 공통 UI 상태·조작 규칙 및 과거 main 디자인 규격; devel 세부 수치는 960×540 현행 규격 우선 |
| [ui-decisions.md](./ui-decisions.md) | 2026-11-12 UI 디자인 확정 기록. 레이아웃, HUD, Garden 32, 보더, 폰트·렌더링 최종 결정 및 제약 |
| [changes.md](./changes.md) | 커밋별 시스템 변경 요약 및 검증 상태. 현재 기준 정리 이후 지속적으로 갱신 |
| [fairy-patrol.md](./fairy-patrol.md) | 요정 11명 순찰 및 눈·걷기 표현 현행 규격 |
| [enemy-preview.md](./enemy-preview.md) | 적 동물 12종 무작위 등장, 크기, 이동·공격 및 표정 |
| [movement-speed.md](./movement-speed.md) | 요정·적 기본 및 최대 이동 속도, 유사 게임 참고 근거, 강화·표정 연동용 보존 규격 |
| [flower-head-preview.md](./flower-head-preview.md) | 별도 브랜치의 꽃 머리 크기 비교 및 검증 |

상세 좌표·색상·PNG 크기는 [ASSET_SPECS.md](../ASSET_SPECS.md), 실행 방법은 [README.md](../README.md), 개발 범위 및 문서 갱신 규칙은 [AGENTS.md](../AGENTS.md)를 참조한다.

## 문서 읽기 기준

- **확정 설계:** 사용자와 합의한 목표나 규격. 코드에 없으면 구현 완료를 뜻하지 않는다.
- **적용 구현:** 현재 저장소 소스에 존재하는 기능이나 UI. 실행 검증 여부와 구분한다.
- **미구현·미정:** 확정 설계의 남은 작업 또는 아직 결정하지 않은 사항. 추가 개발을 승인하는 목록이 아니다.

devel 현행 UI의 크기·색·좌표·패딩은 resolution-960x540.md에서 먼저 확인한다. 공통 색상 설계 및 신규 에셋 제작 기준은 ui-color-guide.md, 용도별 공통 간격 설계 기준은 ui-spacing-guide.md, 배율과 가시 간격 검사 기준은 ui-scale-audit.md, 에셋 상세 규격은 ASSET_SPECS.md, 씬 계약과 모듈 책임은 implementation.md, 최초 엔진 선정 및 외부 자료는 project-foundations.md에 둔다. 변경 이력에는 대체된 시안도 남기되 현행 문서와 구분한다. AGENTS.md는 저장소 전체에 적용되는 지속적인 개발 원칙 및 작업 절차만 관리한다.

구현 변경 시 해당 시스템의 현행 문서를 갱신하고 변경 이력에도 동일 작업의 효과를 기록한다. 변경 없는 시스템을 반복해서 기록하지 않는다. 과거 설계가 대체되면 현행 문서에는 최신 확정안을 유지한다.
