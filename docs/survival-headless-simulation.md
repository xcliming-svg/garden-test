# Garden Survivors — 현행 생존 전용 헤드리스 전투 시뮬레이션 기반

작성일: 2026-11-22. 기준: `xcliming-svg/garden-test` `main`의 `e67f896e2539d2f7f0afd37502560984469fad7a`.
최종 로컬 회귀 검사 시 **실행 소스 SHA-256**: `5817b3cc2a0fd63bde41ba27582162e5f437ac16e08c82698ed0daac1af3939f`, **에셋 SHA-256**: `d61c8de421f49a987e063b620bfc800c6297537b9f81da065affb8b6c42179d0`. 검증 당시 작업 브랜치의 새 커밋 전이므로 결과의 `sourceCommit`은 기준 부모 커밋을 가리키며, 정확한 테스트 코드 버전은 함께 기록된 소스 지문으로 구분한다. 커밋 뒤 재실행 시 `sourceCommit`은 새 기능 브랜치 커밋으로 갱신된다.
구현/검증은 `feature/survival-headless-parity-20261122` 작업 브랜치에서 진행하며, **기준 `main`의 밸런스 상수는 수정하지 않는다.**
본 문서는 사용법과 검증 결과를 제공한다. 구체적 목표/경고선은 [밸런스 목표](./balance-goals-benchmark.md), [변경 프로토콜](./balance-change-protocol.md), [의존관계](./balance-dependencies-guardrails.md)를 따른다.

## 1. 도구 구분 및 적용 범위

| 경로 | 용도 | 현재 생존 전투 정확도 |
| --- | --- | --- |
| `simulation/cli.mjs` | 이전 도안·카드/스테이지용 | **현행 생존 전투에 사용 금지**. `GardenSimulationConfig` 로딩으로 다른 게임 경로를 타게 됨 |
| `simulation/garden-economy-balance.mjs` | 경제·출현 근사 정책 비교 | **충돌·명중·이동·실제 물 수집을 재현하지 않음** |
| `simulation/survival-runtime.mjs` | **현행 생존 헤드리스 전투 엔진** | 실제 게임 모듈 공유, 브라우저 기하 측정/동치 시험 필요 |
| `simulation/survival-browser.mjs` | **실제 Phaser 씬 참조 경로** | 고정 시드/스텝으로 실제 브라우저의 전투·정원 상태를 비교 |
| `simulation/survival-cli.mjs` | 단일 시드 실행·기하 캡처·동치 검증 | `--parity` 시 결과·행동·이벤트 비교와 불일치 시 비정상 종료 |
| `simulation/survival-batch.mjs` | 독립 시드×정책 반복·`--check`·`--summary` | 기하 미측정 시 근사로 명시, 브라우저 동치는 별도로 수행 |

헤드리스 경로는 `index.html`에서 **현재 실제로 로드하는 `src/*.js` 순서**를 읽어 동일한 코드 자체를 실행한다. `GardenSimulationConfig`를 주입하지 않으며 `GardenRunRules.survival` 및 `GardenEconomy.enabled`를 검증한다. `GardenRunRules`의 출현·경제, `GardenEnemyPreview.createPopulation`, `GardenHeroWeaponPreview.create`, `GardenRelicCollection.create`, `GardenEconomy.create`, `GardenWeaponBalance.target`, `GardenPebbleBoundary.layout`, `GardenGameLayout.patrolPosition`을 재사용한다. 렌더링용 객체만 생략하며 업데이트/세부 스텝 순서를 실제 Phaser 씬과 맞춘다.

브라우저 경로는 원본 `index.html`과 `src/*.js`를 제공한다. 테스트 서버가 메모리 내에서 `main.js`/ `scenes.js`에 참조 훅을 삽입하지만 저장소의 브라우저 구현 자체는 바꾸지 않는다. 일반 실시간 `update`를 동결한 뒤 `scene.events.emit('update', 0, dt*1000)`으로 실제 Phaser 업데이트 리스너를 전진시킨다.

무기·적 ID/적 등급/상품·강화는 경제 상품과 실제 무기·적 레지스트리에서 동적으로 수집한다. 한 쪽에만 추가된 무기, 누락된 모션/피격 모델, 중복 ID, 돌멩이 외 다중 발사 강화는 즉시 오류로 중단한다. 신규 모듈은 `index.html`에 등록되면 헤드리스 소스 로더가 자동 인식한다. **새 전투 메커니즘의 의미·물리/충돌 검증은 자동으로 승인되는 것이 아니며, 해당 기능의 브라우저 동치 테스트를 추가해야 한다.**

`src/enemy-preview.js`의 변경은 오직 선택적 이벤트 계측 두 건(`survival_enemy_spawn`, `survival_enemy_kill`)이다. 생존 모드의 `GardenSimulationEvent`가 지정됐을 때만 발행되며, HP·속도·공격력·출현 빈도나 기존 동작은 수정하지 않는다.

## 2. 확정 규칙과 미확정 규칙

- 무기 10종 중 **돌멩이만** `volley` 강화 가능. 나머지 9종 다중 발사 강화는 0. 돌멩이 동시 발사 최대 4개는 **현행 임시 구현**이며 최종 상한으로 승인된 값이 아니다.
- 꽃밭은 해바라기/장미/수국/라벤더 **4종**. 각 꽃밭 수확량은 확장 단계별 `1→4→9→16→25`, MAX 물주기 요구량은 `1→2→3→4→5`회. 물통 MAX 100, 한 방울 20.
- 물요정의 재도입·전투/수집 효과 및 강화 상한은 **미정**. 본 도구의 현재 게임 기준 계산에 물요정의 임의 효과를 추가하지 않는다. 재투입 시 소스 재검토, 계측, 브라우저 동치 재인증 전까지 최종 밸런스를 발표하지 않는다.
- 현재 고정된 수치가 승인된 최종 밸런스를 뜻하지 않는다. 사용자 승인 전 `main` 수치를 변경하거나 현재 근사 결과로 목표 달성을 선언하지 않는다.

## 3. 설치 및 실행

작업 루트에서 실행한다. 본 개발기 검증 환경은 **Node.js v24.13.1**, `phaser@3.90.0`, `playwright@1.51.1`, Chrome 채널이다. 프로젝트 문서의 Node 22 권장과 실제 검증 버전이 다르므로 CI/Node 22 재검증이 추가로 필요하다. `node_modules` 및 `simulation/results/`는 Git 추적에서 제외한다.

```powershell
npm install --no-save --package-lock=false phaser@3.90.0 playwright@1.51.1

# 기존 도구의 선행 사전 검증: 두 번째 도구는 경제 근사 모델일 뿐
node simulation/survival-preflight.mjs
node tests/garden-economy-model.mjs
node simulation/garden-economy-balance.mjs simulation/experiments/garden-economy-10x10.json --check
node simulation/garden-economy-balance.mjs simulation/experiments/garden-economy-10x10.json --summary

# 새 실제 브라우저로부터 적/투사체 SVG 기하 측정. 소스 지문 변경 시 재실행
node simulation/survival-cli.mjs --capture --output simulation/results/survival-geometry.json

# 단일 헤드리스 실행. 기하 파일이 없으면 'unmeasured-approximation'으로 취급
node simulation/survival-cli.mjs --seed 42 --seconds 600 --dt 0.05 --policy focused --geometry simulation/results/survival-geometry.json --output simulation/results/single.json

# 같은 시드·설정에서 실제 Phaser 브라우저와 체크포인트·행동·이벤트를 대조
node simulation/survival-cli.mjs --seed 42 --seconds 600 --dt 0.05 --policy focused --parity --output simulation/results/parity.json

# 실험 JSON의 시드×정책 전체 실행, 반복성 검사, 요약, 원시 실행 보고서
node simulation/survival-batch.mjs simulation/experiments/survival-headless-smoke-10min.json --geometry simulation/results/survival-geometry.json --check --summary --output simulation/results/batch.json

# 모델 / 701스텝 실제 씬 / 60초 두 정책 / 600초 복수 시드 회귀
node tests/survival-headless.mjs
node tests/survival-parity-steps.mjs
node tests/survival-parity.mjs
node tests/survival-parity-long.mjs
```

`--parity` 실행은 해당 시드의 기하를 브라우저에서 새로 캡처한다. `--geometry` 파일은 포함된 소스 지문과 에셋 지문이 다른 순간 거절하므로 잘못된 SVG 측정값으로 비교하지 않는다. 시간은 `dt` 정수배여야 하고, 최대 10,800초(3시간)까지 허용한다. 비교 실패는 **PASS가 아니라 diff 목록+exit code 1**로 보고한다.

## 4. 정책과 관측 지표

정책은 실제 사람이 아닌 **완벽하게 실행되는 결정론적 UI 의사결정**이다. `idle`은 물주기·확장·구매를 하지 않으며, `focused`, `casual`, `distracted`는 각각 0.25/2/8초 간격으로 MAX 물주기, 확장 가능 시 확장, 구매 가능 시 구매, 그다음 강화 순서로 결정한다. 선택 함수 `selectSurvivalAction`을 Node와 브라우저가 공유한다. 이름이 비슷하더라도 과거 경제 근사 시뮬레이션의 행동 정책과 동일하다고 해석해서는 안 된다.

모든 보고서에 `schemaVersion`, `mode`, `sourceCommit`, `sourceHash`, `assetHash`, seed, dt, 실행 시간, 정책, 기하 측정 여부, 가정, 제한을 포함한다. 배치 보고서는 실험 파일 SHA-256과 `workingTreeModified`도 포함한다. 전투 지표는 출현·생존 적·처치·무기별 발사/명중/유효 피해/처치/감속/넉백, 적 종별 출현/처치/출현 HP/처치 소요시간 합계, 실제 드롭 발생·흡수·소멸, 물주기/수확/꽃 재고, 구매·강화, 정원 HP 및 이동/순찰 좌표다. 이벤트는 `survival_enemy_spawn`, `survival_enemy_kill`, `weapon_fire`, `weapon_hit`, `drop_roll`, `relic_spawn`, `water_collect`, `garden_water_collect`, `garden_water_use`, `garden_harvest` 등을 계수한다.

## 5. 현재까지의 실행 및 회귀 증거

기준 코드: `main e67f896`에서 별도 브랜치 작업, 초기 검증 `node v24.13.1`, `dt=0.05초`. 최초 선행 `survival-preflight`, 기존 경제 모델 테스트, 경제 `--check`(36개 시나리오), 경제 `--summary`(12시드×3정책) 모두 통과. **경제 보고서는 실제 전투 정확도의 근거가 아니다.**

| 테스트 | 시드/정책 | 측정된 주요 결과 | 판정 |
| --- | --- | --- | --- |
| 헤드리스 결정론성 | 42, idle, 60초 ×2 | 결과·행동·이벤트 반복 일치 | PASS |
| 매 스텝 Phaser 비교 | 42, idle, 35초/701 체크포인트 | 위치·드롭·적·무기·경제 이벤트 일치 | PASS |
| Phaser 60초 | 42, idle 및 focused | 양쪽 정책 매 체크포인트 동치 | PASS |
| Phaser 180초 | 42, focused | 91 출현·87 처치, 물 84 수집, 꽃 16 수확 | PASS |
| Phaser 600초 | 42, focused | 312 출현·310 처치, 453 발사·438 명중, 물 306 수집, 꽃밭 2단계, 돌멩이/부메랑/바퀴, 구매 2회·강화 2회 | PASS |
| Phaser 600초 | 17, casual | 312 출현·309 처치, 484 발사·467 명중, 물 302 수집, 꽃밭 2단계, 돌멩이/부메랑/물풍선, 구매 2회·강화 1회 | PASS |
| Phaser 1200초 | 42, focused | 661 출현·659 처치, 1315 발사·1082 명중, 돌멩이/부메랑/물풍선/바퀴 | PASS |
| 헤드리스 3600초 | 42, focused | 2694 출현·2689 처치, 6종 무기 및 12종 적 등장 | **모델 실행만 확인** (브라우저 미비교) |
| 헤드리스 10800초 | 42, focused | 11164 출현·11160 처치, 10종 무기/12종 적 모두 모델을 통해 실행 | **모델 실행만 확인** (브라우저 미비교) |
| 배치 실험 | 시드 17/42 × focused/casual, 각 600초 | 4회 실행 및 한 조합 반복 재현; 정원 확장·구매·강화 발생 | PASS (모델 재현성) |

위 600초 두 사례에서 실제 Phaser 쪽과 헤드리스 쪽은 설정·행동·체크포인트·무기/적 종별 집계가 동일하다. **이는 관측된 정책/시드/시간에 대한 기계적 동치이지, 일반 사람의 생존율이나 실제 게임의 3시간 성능 측정은 아니다.** 실행 중 생성되는 상세 JSON에는 결과의 각 수치·사용한 지문과 가정·검증 한계가 포함된다. 3600/10800초 실행에서 정원 HP가 1200으로 남았다는 사실도 **이 인공 정책·현재 임시 수치 하에서의 모델 결과**일 뿐, 난이도의 적정성이나 1~3시간의 재미가 보장된다는 뜻은 아니다. 문서상의 수치는 승인된 밸런스 목표가 아니다.

실패→수정→재실행 이력: (1) 초기 브라우저 참조에서 Phaser 씬 객체 전체를 `page.evaluate`로 반환하여 메모리 과다 사용; 반환값 제거. (2) 헤드리스 보상 드롭 경로가 실제 `run.rewardDrop` 이벤트를 건너뛰었음; 실제 콜백 사용. (3) 순찰 초기 거리 0과 실제 게임의 가로 변 중심 출발점이 다름; 최초 거리 초기화 수정 후 701스텝 일치. (4) 스프링클러 발사체 기하 측정 시 노즐 오프셋의 스케일도 함께 적용. 각각 관련 테스트를 반복 실행했다.

## 6. 재검증 의무와 현재 한계

새 무기·적·강화·삭제가 발생하면 **해당 커밋에서 기하를 재측정**, 레지스트리 계약/모델 테스트 통과, 새로운 조합과 60초/600초 브라우저 비교, 독립 시드×정책 배치, 10/30/60/120/180분 목표별 관측을 다시 수행한다. 돌멩이의 임시 상한이나 물요정 기능 확정에는 별도 승인·요구사항/테스트가 필요하다. 과거 버전 결과를 새 코드 결과로 옮겨 쓰지 않는다.

신규 GitHub Actions `.github/workflows/survival-headless-parity.yml`은 Node 22 기반에서 모델/기존 경제 회귀, 701스텝/60초/600초 브라우저 동치, 기하 캡처와 배치를 자동 재실행하도록 구성했다. **로컬의 Node 24 검증은 CI Node 22 실행 성공으로 간주하지 않으며, 원격 실행 상태는 별도 확인해야 한다.**

검증하지 않은 항목은 사람의 회피/물주기 반응·실수·재미·반복 몰입, 사용자 입력 지연/터치 오차, GPU 렌더링 성능, 전 무기·적 조합 개별 동치, 장기 60/120/180분 브라우저 패리티, 확정되지 않은 물요정 기능 및 강화 상한이다. 이를 실제 게임 전체 시뮬레이션의 검증 완료나 최종 밸런스 확정으로 표현하지 않는다.
