# 새 세션 인계 — 현재 생존 게임 시뮬레이션 시작 (2026-11-22)

> **이 문서는 구현 이전의 인계 및 적용 범위 판별 기록입니다.** 후속 구현은 별도 기능 브랜치의 [생존 헤드리스 실전 전투 엔진·Phaser 동일 시드 대조·배치 실행 및 검증 한계](./survival-headless-simulation.md)를 참조합니다. 아래의 기존 CLI/경제 근사 적용 한계는 그대로 유효합니다.

이 문서와 [밸런스 변경 프로토콜](./balance-change-protocol.md), [게임 목표](./balance-goals-benchmark.md), [전체 수치](./balance-parameter-inventory.md), [수치 의존관계](./balance-dependencies-guardrails.md)를 함께 읽는다.

## 1. 도구 사용 가능 여부 — 검증 완료/미완료를 구분

| 이름 | 저장소 파일 | 현행 생존에 쓸 수 있는가 | 한계 |
|---|---|---|---|
| **생존 모드 사전 점검** | \`simulation/survival-preflight.mjs\` | **예** | 실제 규칙, 10종 무기 상한, 결정론적 경제 이벤트, 실험 파일/소스 적합성 검사. 전투 결과는 계산하지 않음 |
| **현재 꽃 경제 3시간 근사** | \`simulation/garden-economy-balance.mjs\` | **경제 추정만 가능** | 현재 \`run-rules\` 적 출현 주기·\`garden-economy\` 모델·무기 명목 DPS를 사용하지만 **적 이동/충돌/투사체 명중/드롭 자석/물요정을 직접 실행하지 않음**. 플레이 주의·처치율은 가정 |
| **기존 범용 AI 시뮬레이터** | \`simulation/cli.mjs\`, \`engine.mjs\`, \`models.mjs\`, \`agents.mjs\`, \`browser.mjs\` | **과거 도안/카드 모드에만 유효** | \`GardenSimulationConfig\`를 삽입하여 현재 \`GardenRunRules.survival\` 경로를 비활성화함. \`SOURCE_ORDER\`에 \`garden-economy\`가 없고 구형 도안·카드 수집 모델을 재생함 |
| **현재 모델 회귀** | \`tests/garden-economy-model.mjs\` | **예** | MAX 물주기·생산·구매·돌멩이 전용 다중 발사 제한·이벤트 일관성; 실제 전투 전체 아님 |
| **현재 실제 Phaser/Chrome 브라우저 회귀** | \`tests/garden-economy-browser.mjs\` | **예** | 실제 모드에서 꽃/상점/성장/무기 적용 확인. 전체 3시간 자동 플레이가 아님 |
| **과거 시뮬레이션 브라우저** | \`tests/simulation-browser.mjs\` | **아니오, 과거 카드 경로** | 이 검사를 통과해도 현재 생존 모드 검증 완료로 간주하지 않음 |

**중요:** '예전 시뮬 소스가 있다'는 기억은 사실이다. 그러나 **그 소스를 지금 그대로 실행해 현행 무기 상한이나 물요정·MAX 물주기·장시간 난이도를 검증했다는 결론은 잘못**이다. 기존 과거 실험은 폐기하지 않고 별도 모드로 유지한다.

## 2. 현재 환경을 검증하는 정확한 명령

저장소 \`xcliming-svg/garden-test\`의 \`main\`을 사용한다. Node.js **22**를 사용한다. 아래 명령은 **저장소 루트에서** 실행한다.

\`\`\`sh
git fetch origin
git switch main
git pull --ff-only origin main
git status --short
node simulation/survival-preflight.mjs
node tests/garden-economy-model.mjs
node simulation/garden-economy-balance.mjs simulation/experiments/garden-economy-10x10.json --check
node simulation/garden-economy-balance.mjs simulation/experiments/garden-economy-10x10.json --summary
\`\`\`

위의 마지막 결과는 **경제 근사치**다. 기준 값을 고정하려면 결과와 시드·커밋 해시를 별도 파일에 기록하고, 변경 후 동일 조건으로 비교한다. \`--summary\`는 현재 저장된 12개 시드 × 집중/보통/간헐 3개 정책을 사용한다.

Phaser/브라우저 실제 동작 검사(로컬 Node/Chrome 사용 가능할 때):

\`\`\`sh
npm install --no-save --package-lock=false phaser@3.90.0 playwright@1.51.1
node tests/garden-economy-browser.mjs
\`\`\`

CI: \`.github/workflows/main-garden-economy.yml\`은 \`main\`, \`devel\` 푸시 시 사전 점검·모델·3시간 경제 근사·브라우저를 검사한다. GitHub Actions에서 **성공 여부와 로그를 검증**한 뒤 결과를 인용한다. 로컬에서 실행하지 않은 검사는 실행했다고 말하지 않는다.

구형 시뮬레이터 확인용으로만 \`node simulation/cli.mjs help\`를 사용할 수 있다. \`simulation/cli.mjs batch --seconds 7200\` 결과를 **현재 생존 게임의 2시간 생존율**로 표시하지 않는다.

## 3. 다음 세션의 첫 구현 과제 — 헤드리스 전투 모델

현재 새 물요정 복귀를 예정하고 있으므로, **완전한 장시간 밸런스 수치 확정 전에 다음 구현 단계가 필요**하다.

1. **모드 분리**: 브라우저와 헤드리스에서 동일하게 \`GardenRunRules.survival===true\`를 유지한다. 기존 \`GardenSimulationConfig\`가 있는 순간 구형 도안 규칙으로 바뀌는 문제를 해결할 안전한 **생존 전용 시뮬레이션 설정 주입** 방법을 설계한다. 옛 시뮬 엔진을 파괴하지 말고 별도 \`survival\` 실행 경로를 만들 것.
2. **실제 로직 재사용**: \`GardenEnemyPreview.createPopulation\`, \`GardenHeroWeaponPreview.create\`, \`GardenRelicCollection.create\`, \`GardenEconomy.create\`, \`GardenRunRules\`, 실제 게임 순찰 기하를 headless에서 사용한다. 충돌·발사·HP·이벤트를 **별도 근사 공식으로 복제하지 않는다**.
3. **검증 가능한 이벤트**: 현재 생존 경제 모델은 \`GardenSimulationEvent\`에 \`garden_water_collect\`, \`garden_water_use\`, \`garden_bloom\`, \`garden_harvest\`, \`garden_expand\`, \`garden_purchase\`, \`garden_upgrade\`, \`garden_damage\`, \`garden_heal\`을 선택적으로 발행한다. 기존 \`enemy_spawn\`·\`enemy_kill\`·\`weapon_fire\`·\`weapon_hit\`과 같은 시계로 정합성을 검증한다. 실제 게임으로 측정할 수 없는 지표는 **미측정**으로 둔다.
4. **에이전트**: 집중·보통·간헐 플레이의 물주기/구매/업그레이드 정책. 물통 MAX 상태에서만 1회 물주기, 4종 화폐별 재고 독립, 1~5회 개화, 돌멩이 전용 volley 상한을 지킨다.
5. **출력과 재현성**: 실행 소스/자산 SHA, 실험 설정, 게임 버전, 시드, dt, 정책/에이전트, 모델 vs 브라우저, 메트릭 단위를 함께 기록한다. 동일 시드·같은 엔진/설정은 동일 결과여야 한다.
6. **브라우저 참조**: 최소 0·5·10·30·60분에 동일 시드의 적 출현·처치·탄 발사/적중·물 획득·정원 HP를 대조한다. 실제 충돌 파라미터/씬 업데이트 순서 차이가 있으면 원인을 분석한다. 동치 확보 전에는 headless 생존 시간으로 밸런스를 확정하지 않는다.
7. **물요정 복귀**: 정식 스펙(수/역할/수급·물주기/공격/상점/스택/최대치)을 승인하고 브라우저에 적용한 뒤 **헤드리스에서도 같은 효과가 발생하는지** 검증. 이 과정 후에야 1~3시간 종합 조정 실시.
8. **대량 실험**: 처음엔 12개 시드·3정책 스모크 → 100~300개 시드 탐색 → 독립 시드 재현/시간 간격 수렴 → 장시간 2~3시간 게임플레이/프레임 검증. 측정으로 확인하지 않은 재미는 수치가 아닌 사람 플레이 평가로 남긴다.

## 4. 콘텐츠가 추가·변경·삭제되는 경우

- **추가**: 밸런스 ID, 허용 범위, UI, 전투 실제 적용, 경제/상점, 데이터 파일, 테스트, 로그 메트릭을 함께 등록. 새 무기는 명시적 승인 없이는 \`volley=0\`.
- **수정**: 어떤 수치·이벤트가 바뀌었는지 실험 버전·변경 로그에 남기고 **같은 시드/정책**으로 이전판 대비 평가. 브라우저/헤드리스 결과가 달라졌다면 디버그.
- **삭제**: 상점/강화/아트/적 분포/시나리오/수집된 이벤트의 참조를 추적하여 고아 ID를 방지. 역사적 로그를 새 코드의 성능 자료로 재해석하지 않는다.
- **물요정**: 아직 정식 능력·상한 미확정. 어떤 기능을 할지 가정한 결과를 승인한 밸런스로 기록하지 않는다.

## 5. 다른 ChatGPT 세션에 그대로 전달할 작업 지시

> **프로젝트:** GitHub \`xcliming-svg/garden-test\`의 최신 \`main\` 브랜치. 게임은 단일 난이도 무한 생존. 이전 채팅의 내용에 의존하지 말고 \`AGENTS.md\`, \`docs/survival-simulation-handoff.md\`, \`docs/balance-change-protocol.md\`, \`docs/balance-parameter-inventory.md\`, \`docs/balance-goals-benchmark.md\`를 먼저 읽어라.
>
> **첫 실행:** \`node simulation/survival-preflight.mjs\` → \`node tests/garden-economy-model.mjs\` → \`node simulation/garden-economy-balance.mjs simulation/experiments/garden-economy-10x10.json --check\` → \`--summary\`. 성공/실패와 커밋 SHA를 보고하라.
>
> **중요:** \`simulation/cli.mjs\`는 옛 도안/카드 경로이고, \`garden-economy-balance.mjs\`도 전투/드롭 수집을 가정한 경제 모델이다. 이를 '실제 3시간 생존 자동 플레이'라고 간주하지 말아라. **먼저 실전 생존 전용 headless 전투 경로와 브라우저 동치성 계측을 설계하고 테스트·수정 반복**하라. 그다음 물요정 정식 복귀 스펙을 점검하고 신규/삭제 콘텐츠를 허용하는 버전드 실험·변경 프로토콜을 확립하라.
>
> **규칙:** 돌멩이만 다중 투사체 강화 가능(기존 기술 상한 4개는 임시), 나머지 무기는 volley 금지, 단 광역/왕복/연쇄 고유 동작은 보존. 화단 4종, 동시 확장 1→4→9→16→25, MAX 물통으로 각각 1→5회 개화, \`main\` 무단 변경 금지. 비교 게임의 수치를 추측해 적지 말고, 결과를 목표값으로 제안하되 사용자의 승인 전에 기본 밸런스 수치를 바꾸지 말라.
>
> **산출물:** 실행 가능 명령, 소스/자산 버전·가정, 계측 지표, 같은 시드 재현성, 브라우저 비교 결과, 1~3시간 KPI 초안과 개선 후보. 작업별 검증 통과·한계·다음 과제를 구분해 보고하라.

이 문서는 후속 세션에서 시뮬레이션 작업을 **실제로 시작**하기 위한 실행 지침이며, **현재 단계에서 아직 없는 종합 전투 시뮬레이터가 이미 구현되었다고 주장하지 않는다**.
