# AI 자동 플레이·밸런스 시뮬레이션

> 후속 [초반 밀도 반복 최적화](./early-pace-search.md): 사전 gate, 탐색/재탐색/독립 시드 검증, 선정 manifest 및 실제 Phaser 참조 검증.

> 1차 도안/꽃 가중치/무기 성장·조합/군집 반복 실험 및 재실행: [초반 도안 밸런스 기준](./blueprint-balance-baseline.md).
2026-11-19 · 기준 main 8741ee2 · Phaser 3.90.0 / Node 22
이 시스템은 테스트 도구다. index.html의 일반 게임·lab.html 비교 모드는 그대로이며 테스트용 설정은 CLI의 독립 실행에서만 주입한다. 기본 밸런스 수치 변경 및 자동 적용, XP/강화/스테이지 구현은 하지 않는다. 후속 [도안 선택 및 1차 실험](./blueprint-balance-baseline.md)에서 일반 플레이의 메인 메뉴 도안 셀렉트 6종 및 별도 모델 전용 레벨/조합 실험을 추가했다.

## 새 세션 / AI의 첫 실행
1. 저장소 AGENTS.md, 이 문서, playable-run.md, weapon-balance-v1.md와 관련 최신 변경 이력을 읽고 git 상태/커밋을 확인한다.
2. Node.js 22 환경에서 저장소 루트로 이동한다. 빠른 모델 실행에는 npm 설치가 필요 없다.
3. 현재 소스에서 기본 설정을 내보내고 기준 조건을 먼저 실행한다. 이미 존재하는 결과 경로는 덮어쓰지 않는다.
```sh
node simulation/cli.mjs help
node simulation/cli.mjs defaults --output simulation/results/defaults.json
node simulation/cli.mjs agents
node simulation/cli.mjs run --seed 42 --agent normal --seconds 500 --trace --output simulation/results/baseline-42.json
node simulation/cli.mjs replay --input simulation/results/baseline-42.json
node simulation/cli.mjs batch --seed 1 --runs 100 --agent normal --workers 4 --seconds 1800 --output simulation/results/base-batch.json
node simulation/cli.mjs sweep --input simulation/experiments/example.json --seed 1 --runs 100 --workers 4 --output simulation/results/experiment.json
```
- seed는 uint32, batch는 연속 seed. run/batch/sweep은 기본 dt=.05초, --dt .016666666666666666 등 비교 가능; .001~.1초. --seconds는 실제 플레이 시간 상한이며 timeout은 실패와 별도. --workers는 병렬 worker 수(환경 CPU에 맞게 제한), 단일/병렬 동일 결과가 요구된다. 실행 시간 측정은 파일 기록의 wallSeconds이며 가속은 결과의 seconds/wallSeconds. 렌더링 없음; 목표 배속을 보장하지 않는다.
- --config는 부분 JSON override, 모든 미지 키와 구조 오류는 거부한다. 실행마다 새 독립 window/model/config. 외부 파라미터에 대한 승인과 실제 기본값 변경 승인은 별개다.
- --agent-config JSON은 reaction, drag(초), mistake(0~1). 동일 설정/seed/dt와 소스 해시의 run report에서 명령으로 재현 가능. 저장된 actions를 그대로 실행하는 replay는 실제 선택을 다시 계산하지 않고 결과를 비교한다.
- 결과는 simulation/results/에 기본 저장되며 Git 제외. --output으로 새 경로 지정 가능. report manifest에는 설정 전체, sourceHash, assetHash, configHash, seed, dt, 시간 제한, agent, geometry가 포함된다.
- AI는 직접 소스를 편집하여 매 시험값을 바꾸지 않는다. 먼저 config와 실험 목적을 기록하고 비교 명령을 실행한다. 결과를 바탕으로 후보를 제안하되 사용자가 승인하기 전 기본값/배포 게임에 적용하지 않는다.

## 실행 모드와 신뢰 수준
| 경로 | 역할 |
| --- | --- |
| model (기본) | 기존 source IIFE를 실제 index.html 로드 순서로 격리 로드. 적, 무기, 이동·피해, 보상, 경제, 도안 계산, 순찰 기하를 실제 함수로 호출. 고정 dt, 무렌더링, 병렬 가능. |
| browser | 실제 index.html/Phaser 씬을 로컬 전용 서버로 열고 실제 Scene UPDATE 리스너를 고정 dt로 호출. 실제 드래그·구매·제거 이벤트 핸들러 사용. 래스터 충돌 크기, 게임 UI와 모델 조립의 참조 경로. |
| 기존 브라우저 테스트 | 실제 포인터, 화면/픽셀/일시정지/결과 팝업 등. AI 합성 이벤트만으로는 UI 가독성·히트 영역·사람 조작성을 보증하지 못한다. |
두 엔진은 공격/적 모델/도안 규칙 등 공유하지만 model은 UI와 상태 갱신의 orchestration을 별도로 조립한다. 완전한 공통 엔진 리팩터링은 이번 작업 범위에서 하지 않았다. 동치가 확인된 구간 이외에는 model 결과를 실제 게임과 완전 동일하다고 주장하지 않는다. 코드 변경 시 양쪽 회귀 검증 필요. model 기본은 기존 테스트의 근사 에셋 크기(defaultSize 및 적 span)이고, measured geometry 사용을 권장한다.
```sh
npm install --no-save --package-lock=false playwright@1.51.1 phaser@3.90.0
# Chrome 설치 환경. 없으면 npx playwright install chromium 후 --browser chromium.
node simulation/cli.mjs capture-geometry --output simulation/results/geometry.json
node simulation/cli.mjs run --engine browser --agent normal --seed 42 --seconds 120 --output simulation/results/browser-42.json
node simulation/cli.mjs run --geometry simulation/results/geometry.json --agent normal --seed 42 --seconds 120 --output simulation/results/measured-42.json
node tests/simulation-browser.mjs
```
geometry에는 12종 적 실제 알파 경계 너비/높이, 무기·물풍선 효과 11종 단위 span 크기·스프링클러 pivot/노즐, 물방울 요정 높이 비율. 소스/에셋 지문이 다르면 오류; 변경 후 다시 측정. browser는 실제 UI 렌더 로직 비용이 있어 대량 batch 대신 소수 검증으로 사용. 실시간 UPDATE는 테스트 서버에서만 막으며 브라우저의 원본 src 파일 및 웹 배포 파일은 변환하지 않는다. Playwright 시뮬레이션은 실제 Scene 이벤트를 호출하는 합성 입력으로 포인터 회귀 테스트와 구분한다.

## 설정 스키마
`defaults` 명령의 JSON이 현재 소스에 대응하는 전체 키의 기준이다. 객체는 부분 병합, 배열은 전체 교체. 단위는 논리 px, 게임 초, 실제 피해/에너지. 예:
```json
{
  "schemaVersion": 1,
  "run": {
    "dropWeights": [0.65, 0.10, 0.22, 0.03],
    "neededFlowerBias": 0.75,
    "growthSeconds": 8
  },
  "weapons": {"rock": {"damage": [10, 13, 16], "cooldown": [0.8, 0.75, 0.7]}},
  "enemyHp": {"3_caterpillar": 10}
}
```
위 예는 실험값이며 기본 보석/꽃 확률을 바꾸지 않는다.

| 키 | 의미 / 소스 |
| --- | --- |
| initial, blueprint | [cellId, 꽃 이름] 행 배열. 0~99, row=floor(id/10), col=id%10. 초기 꽃은 도안과 일치, 전체 도안이 초기 집합에서 연결 가능해야 한다. run-rules.js. 16칸~100칸 및 비대칭/좁은 연결부 실험. |
| run | 초기/최대 슬롯(1~10), 비용, 보석 시작량/획득 가치, 성장/제거/수명, 4종 드롭 [gem,heart,flower,item], 일반 카드 간격, 필요 꽃 가중치, 적 기본 피해/레벨 피해, 시작 무기, cap. |
| waves, enemyUnlocks | [start,interval,cap,batch,[[id,weight]...]]; [time,id]. 0초 시작, 해금 이전 출현 불가, 정렬 및 정수 가중치 검증. |
| itemUnlocks | [time,[itemId...]], 시작 0초, 중복 ID 금지. 기존 장착 아이템만. |
| weapons, projectiles, heightLimits | 무기 range/레벨별 damage 및 cooldown/slow/범위/지속 등과 실제 모션 속도·수명·스팬, 지상/스프링클러/바퀴 높이 판정. weapon-balance.js, hero-weapon-preview.js. 현재 실전 드롭은 Lv.1이며 레벨 2~3 설정은 기존 모델용 보존 값. |
| enemyHp, enemyDamage, enemyMotion | 적별 HP/선택적 피해 override/이동 속도·공격 준비/타격/회복/대기/높이 모션. enemy-motion.js, enemy-preview.js. enemyDamage 미지정 종은 run 기본+레벨당 피해. |
| fairy, passives | 기본/최대 속도, 신발 이동 속도, 방패 방어력. 동료는 실제 물방울 카드 장착으로 추가. |
| relic | 최대 에너지, 회복량, 보석/하트 수명, 자석 범위·각도·속도·가속 등. 현재 플레이 하트 확률은 run.dropWeights가 결정하며 relic.heartChance는 lab 전용 이전 규칙 값. |
아직 고정: 전장의 실제 960×540 공간, 공격 종류/조준 휴리스틱/경로 선택 정책, 동료 공격 종류, 3단계 성장/승패 구조, 특정 내부 충돌 수식 및 UI. 새로운 메커니즘은 수치만으로 만들지 않는다. 이후 추가 설정은 기본값 보존과 검증/문서 갱신 필수.

## AI 정책
idle, random, beginner, normal, expert, garden-first, combat-first, economy-first 및 후속 rock-only, speed-first, diverse 11종. 규칙 기반이며 실사람 수준으로 보정되지 않았다. UI에서 인지 가능한 도안, 꽃 상태(3단계 체력 표현), 카드, 장착·보석, 후보 위치를 관찰한다. 카드 나이는 관찰 기억의 근사; 미래 난수/미출현 카드/내부 HP를 보지 않는다. 판단 간격, 드래그 시간, 실수율, 선택 우선순위를 각각 조절한다. idle은 아무 행동 없음. random은 합법 후보의 무작위 선택 및 틀린 꽃 배치. expert는 연결부를 고려한 배치와 더 빠른 판단. RL/최적화 탐색/LLM 프레임 호출은 미구현; AI 세션은 실험 설계자·분석자 역할.
행동: DRAG_START(cardId), DRAG_END(cell 또는 slot), DRAG_CANCEL, BUY_SLOT, UPROOT_START(cell), UPROOT_CANCEL, WAIT. 실제 규칙을 지켜야 하며 카드 생성/직접 재화 증가/공격 피해 삽입을 하지 않는다. 실행 중 배치 후보 변화, 카드 소멸, 장착 제한, 제거 소요 시간 및 적에 의한 제거를 처리한다.

## 로그 해석
- run report result: victory/defeat/timeout, 실제 종료시간, 필요한/완성된/최고 완성 칸, 처치/출현/최대 동시 적, DPS/발사/명중, 꽃 피해·회복·과잉 회복·방패 피해 감소, 꽃 상실·오배치·완성도 퇴행, 재화·구매·장착, 첫 처치/첫 유효 꽃/첫 일반 카드, 최장 진행/실행된 선택/선택 가능 기회 공백, 마지막 칸 진입 후 종료까지, 기회가 존재한 시간. lastCellWait는 마지막 필요 칸을 획득한 순수 대기시간이 아니라 필요한 칸 수-1에 마지막으로 도달한 이후 종료까지의 proxy(성장/재손실 포함, 미도달 null).
- counts/byWeapon/byEnemy/byItem/cardStats: 이벤트 수·무기 피해/과잉 피해/킬/감속·밀치기, 적 종류별 출현·공격·킬, 카드 생성/사용/소멸. 카드 reason: usable, connection_blocked, not_needed, equippable, no_valid_slot. everUsable로 생성부터 소멸까지 한 번이라도 사용 가능했는지 확인.
- timeline: 게임 시간 초 단위 스냅샷(첫 tick 포함), 에너지 min/mean/p25, 성장/오배치, 적·공격·피해, 장비·보석·순찰·카드. actions: 행동 시각, 대상, 성공 여부/거부 이유. --trace는 개별 이벤트 전체 추가. model 이벤트는 고정 tick 기준이며 frame 이하의 시간 분해능은 보장하지 않는다.
- batch: 모든 종료 종류, 승률 95% Wilson 구간, 분포 N/평균/P10/P50/P90/P95/min/max, 승리한 런의 완성 시간 별도, null 제외 N. sweep: 첫 variant 기준 동일 seed의 비교. 동일 seed여도 처치 수/순서가 달라지므로 완전히 동일한 보상 경로는 아니다.
- browser report는 실제 씬의 공통 이벤트와 상태·행동 기록을 제공하며 model의 모든 파생 지표를 아직 계산하지 않는다. 결과 형식의 geometry를 확인. 감속 적용 횟수는 피해 방지량의 인과 추정이 아니다. 감속으로 방지한 공격은 paired ablation 실험으로 추정해야 한다.

## 밸런스 평가 / 실험 원칙
재미 자체는 자동 측정되지 않는다. 설계 가설: 목표 명확성, 성장/진행 피드백, 유효 선택, 긴장·회복, 변화, 공정한 실패. 아래 숫자는 연구에서 확정된 보편적인 적정값이 아니라 이전 설계 제안의 실험용 출발점이다. 실제 사람 테스트로 보정한다.
| 항목 | 초기 비교 가설 | 검토할 지표 |
| --- | --- | --- |
| 첫 처치/유효 꽃/첫 장비 | 5~20 / 10~40 / 20~60초 | firstKill, firstUsableFlower, firstItem |
| 의미 있는 행동/기회 간격 | 10~30초, 60초 이상 조사 | maxChoiceGap, maxOpportunityGap, actions |
| 진행 정체 | 20~60초, 90초 이상 조사 | maxProgressGap, cardStats, timeline |
| 도안 완료 시간 | 16칸 4~7분, 25칸 6~10분, 36칸 8~15분, 64칸 12~20분, 100칸 15~25분 | winTime, 승률·timeout, 진행도 분포 |
| 마지막 칸 정체 | 전체 시간의 5~15% 가설 | lastCellWait(근사), trace |
| 방어 압박 | idle 생존과 active 회복 비교, 긴 무피해/회복 불가 구간 조사 | flowerDamage/Heal/Lost, peakEnemies, energy timeline |
현재 16칸 실플레이 4:30, 113킬 기록은 1건이며 모집단 평균 아님. 시뮬레이션 승률이나 승리 시간으로 재미를 확정하지 않는다.

AI 실험 절차: (1) 기본 설정·도안·정책·seed/dt 고정 (2) 각 설정의 샘플 100회 탐색 (3) 공급/적 스탯/장착·경제 등 한 변수 또는 명시적 관련 조합만 변경 (4) 동일 seed 비교 후 후보 1000회 및 독립 seed/다른 도안·정책 검증 (5) browser 측정 크기·실제 포인터 회귀·dt 수렴 검증 (6) 사람 테스트(PXI 설문과 실제 행동 로그; 별도 지루함/재플레이 질문) (7) 승인 후에만 실제 기본값 적용. 복합 재미 점수와 자동 최적값 반영 금지. 관찰된 편향·불확실성·시간초과 및 실험 실행 실패를 숨기지 않는다.
문제→원인 추적: 꽃 공급 부족은 처치량/드롭률, 꽃이 많지만 배치 차단은 도안 연결성/필요 꽃 가중치, 장비 선택 부족은 일반 드롭/간격, 슬롯 불필요는 아이템 공급과 비용/장비 실효성, 확장 후 전투 악화는 순찰 길이·실제 DPS·이동/무기 범위, 갑작스러운 실패는 웨이브·피해/회복 비율. 바꾸기 전에 해당 로그로 원인을 분리한다.

### 연구·유사 게임 근거 (2026-11-19 확인)
- Sweetser & Wyeth (2005), GameFlow, https://doi.org/10.1145/1077246.1077253 — 목표/피드백/도전/기술/통제 등의 평가 요소. 초기 검증은 RTS 전문가 평가; Garden의 시간 기준을 정해 주지 않는다.
- Ryan, Rigby, Przybylski (2006), https://doi.org/10.1007/s11031-006-9051-8 — 자율성·유능감과 즐거움/동기 관련성. 수치 기준으로 직접 대체 불가.
- Holmgard 등 (2019), https://doi.org/10.1109/TG.2018.2808198 — procedural persona를 자동 플레이테스트에 사용. Garden의 단순 휴리스틱은 해당 연구의 MCTS/evolution 구현이 아니다.
- Vanden Abeele 등 (2020), https://doi.org/10.1016/j.ijhcs.2019.102370 및 https://playerexperienceinventory.org/docs — PXI는 실제 사람의 경험을 평가하는 공개 도구. 검증된 원문/채점법 유지, Garden 추가 질문 별도.
- Brotato 공식 Steam https://store.steampowered.com/app/1942280/Brotato/ — 30분 미만 런, 20~90초 웨이브, 웨이브 사이 성장 선택. Garden의 최적 시간 증거는 아님.
- Vampire Survivors 공식 Steam https://store.steampowered.com/app/1794680/Vampire_Survivors/ — 시간 생존과 런 성장, 자동 공격 장르 사례. 공식 설명에서 Garden 최적 런 시간/보상 간격은 도출할 수 없다.

## 검증 및 남은 한계
- 2026-11-19 [AI simulation verification](https://github.com/xcliming-svg/garden-test/actions/runs/44439181237), 코드 커밋 `1922933`의 전체 작업 성공: 기존 플레이 35,173개·무기 29,081개·렐릭 1,655개·밸런스 74,418개 체크, 신규 모델 81개 체크, CLI 단일/배치/스윕/행동 재현 통과. 실제 Phaser 두 번의 동일 조건 재현 및 측정 geometry 적용 모델과 60초(seed 42, dt=.05, idle) 비교에서 결과·완성 칸·처치·출현·발사·명중·피해·보석 일치. normal 120초 실제 브라우저 카드 행동 성공. 기존 실제 포인터 플레이 회귀 960×540/1280×720 통과.
- 기존 카드·꽃·색상·플레이 검증 성공. 기존 이동 속도 브라우저 테스트의 30초 Game 진입 대기 시간 초과는 [변경 전 main 8741ee2](https://github.com/xcliming-svg/garden-test/actions/runs/44434109139)에서도 동일한 테스트 35행에서 발생했으며 [이번 실행](https://github.com/xcliming-svg/garden-test/actions/runs/44439181270)에서도 관찰되어 재실행. 이 검사의 실패 원인 자체는 수정 범위가 아니다.
- seed 42 normal 기본 설정(근사 geometry) 단일 런은 CI에서 게임 시간 202.35초를 약 0.113초의 모델 실행으로 처리했다. 해당 장비·조건의 단일 스모크 결과이며 대형 도안/장시간/1000회 성능을 보장하지 않는다.
- 기존 에셋, Phaser 버전 및 배포 경로 유지. 테스트 코드는 별도 simulation/ 디렉터리이며 일반 index.html 또는 lab.html에서 로드하지 않는다.
- 결과 지문 확인 및 같은 seed/action 재현이 필수. 새 src 함수/상태 갱신·공격 방식 추가 시 fast orchestrator 및 로그·config 스키마와 parity 테스트도 갱신한다.
- 모델의 공격/보상/진행 동작은 검사했으나 아직 인간 재미 모델, 최적화 엔진, 모든 가능한 조합의 브라우저 동치, 실제 사람 반응, 장시간 성능/1000회 벤치마크까지 보장하지 않는다.
