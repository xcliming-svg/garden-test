# 서바이버라이크 성장·웨이브 구조 조사

2026-11-19 확인 · 기준 Garden devel 6d8d5d1. 조사 당시 기준. 후속 사용자 승인에 따른 구현은 [성장·웨이브 적용 규격](./survivor-progression.md) 참조. 아래 수치와 제안은 조사 당시 기록이다.

## 현행 문제

- `src/run-rules.js`: 적 처치당 독립적인 1회 상호배타 보상 추첨. 보석 55%, 하트 15%, 꽃 18%, 일반 카드 12%. `src/run-drops.js`: 일반 카드 13종 균등 선택. 9종 직접 공격 무기, 끈끈이 감속 1종, 물방울 요정 1종(돌멩이 공격), 신발·방패 2종. 직접 피해 10종(약 9.23%/처치), 공격/제어 포함 11종(약 10.15%/처치).
- 60킬 기대값: 보석 33, 하트 9, 꽃 10.8, 일반 7.2, 직접 피해 카드 5.54, 제어 포함 공격 카드 6.09. **기대값이며 획득/장착 실제 수가 아님**. 300킬이면 일반 36, 공격/제어 30.46. 보상 속도는 처치 속도에 비례한다. 새 무기 종류 제한·등장 시간·보유 장비 우대·드롭 간격·무기 레벨업 없음.
- 시작 장착 돌멩이 1, 빈 슬롯 3, 보석 구매로 최대 10. 공격 수단을 빠르게 늘릴 수 있고, 적 기본 HP는 공격 타입별 8~12 × 종 레벨; 시간에 따른 동일 종 HP 증가 없음.
- 적 출현 간격 첫 180초 3초, 최초 상한 3마리 및 30초마다 +1. 종 해금 첫 3분 애벌레, 이후 풍뎅이(3분), 메뚜기(5분) 등 2분마다. 해금 종 누적 가중 선택(레벨별 6/3/1); 새 종 우선 1회. 이 때문에 후반 종 구성이 모두 섞이고, 해당 레벨에 더 많은 종이 해금되면 레벨별 총 확률도 바뀐다. 최저 이동 속도 유지.
- 앞선 3분 간이 모델 시험 3회: 57~58킬, 꽃/일반 카드 합계 15~19개. 실제 유저 조작이 없는 근사 시험이지 완성된 밸런스 검증이 아니다.

## 상용 게임 공개 규칙 비교

상용 원작의 공식 소스 코드를 검토한 것은 아니다. 아래는 공개 커뮤니티 위키의 플레이 규칙/데이터이며 버전·스테이지·난이도에 따라 다르다.

### Vampire Survivors

- [레벨업](https://vampire.survivors.wiki/w/Level_up): 경험치 수집 후 레벨업에서 일시정지 및 3~4개 선택지 중 하나. 미보유 무기/패시브 획득, 보유 항목 강화, 최고 레벨 및 6개 종류 슬롯 제한으로 후보 필터링. 레벨 1→2 필요 XP 5, 다음 15/25/35… 이후 다른 증가량 및 특정 레벨 예외.
- [무기](https://vampire.survivors.wiki/w/Weapon): 시작 무기 및 레벨업 중심, 무기별 희귀도 가중치와 해금 조건. 동일 무기는 일반적으로 중복 획득 대신 레벨 상승. 예외 보상·맵 배치 아이템·보물상자 존재.
- [적](https://vampire.survivors.wiki/w/Enemies), [Mad Forest](https://vampire.survivors.wiki/w/Mad_Forest): 1분마다 웨이브 스케줄 교체, 정해진 생존 최소 목표와 출현 검사 간격, 최대 생존 한도. 보스/이벤트 별도. Mad Forest 일반 0/1/2/3/4/5분은 각각 박쥐/좀비+박쥐/박쥐/해골/해골+유령/진흙 인간, 최소 15/30/50/40/30/10, 검사 간격 1/1/0.5/0.25/0.5/1초. Garden의 **최대** 생존 상한과 구별. 수치를 그대로 복사하지 않는다.

### Brotato

- [웨이브](https://brotato.wiki.spellsandguns.com/Waves): 기본 20개, 초기 20/25/30/35/40초, 9~19웨이브 60초, 마지막 90초. 종료 후 상자 보상, 레벨업 능력치 선택, 상점.
- [재료](https://brotato.wiki.spellsandguns.com/Materials), [XP](https://brotato.wiki.spellsandguns.com/Experience): 재료 픽업 시 XP와 구매 재화 둘 다 증가. XP는 소비 재화와 분리. 레벨업 시 최대 체력 +1, 능력치 선택은 웨이브 종료 때. 요구 XP는 현재 표시 레벨에 3을 더해 제곱(초기 16/25/36…). 1~4웨이브 일반 재료 기본 드롭 100%, 이후 감소하며 하한 50%, 예외 적용.
- [상점](https://brotato.wiki.spellsandguns.com/Shop): 무기 구입은 상점 경유, 최대 4개 진열. 첫 두 상점 무기 2개+아이템 2개, 3~5번째 최소 무기 1개. 일반 슬롯 무기 35%/아이템 65%. 무기 후보에서 보유 무기 20%, 동일 계열 15%, 전체 65%; 초반 동일 계열 추가 보정. 티어별 최소 웨이브 및 가격 상승. 무기를 처치마다 직접 뿌리는 구조 아님.
- [적](https://brotato.wiki.spellsandguns.com/Enemies): 종별 첫 출현 웨이브, 체력·피해 웨이브 증가량, 속도는 일반 모드에서 웨이브와 무관. 최대 100 동시 적 및 별도 엘리트/보스. 동일 스테이지라도 Danger 차이 존재.

## 실제 공개 소스 코드 검토 (MIT)

### Nightfall — Godot survivor-like
- [라이선스](https://github.com/nykadamec/nightfall/blob/main/LICENSE): 코드 MIT, 자체 아트 CC0. [Spawner](https://github.com/nykadamec/nightfall/blob/main/scripts/systems/spawner.gd)와 [WaveTable](https://github.com/nykadamec/nightfall/blob/main/scripts/resources/wave_table.gd), [early_waves](https://github.com/nykadamec/nightfall/blob/main/resources/waves/early_waves.tres).
- 간격 = max(0.45, 1.6 − 경과분×0.35)초, 동시 적 최대 35, 0/20/45/75초에 종 해금. 45초에 배치 크기 2, 120초에 3. 보스 600초 별도 생성. 데이터 기반 스폰 매개변수와 실제 생성기 분리. 해금 풀 내 무작위 선택.
- [RunState](https://github.com/nykadamec/nightfall/blob/main/scripts/autoload/run_state.gd): 레벨 1부터 다음 레벨 필요 XP = 현재 레벨×10, 남는 XP 유지. [LevelUpScreen](https://github.com/nykadamec/nightfall/blob/main/scripts/ui/level_up_screen.gd): 레벨업 이벤트에서 게임 정지, 3개 고유 후보, 해금/최고 레벨 필터, 기존 무기 강화 또는 신규 무기/패시브. 
- 교훈: 스폰 간격·동시 제한·배치 크기를 각각 제어하고 무기 획득은 성장 이벤트로 제한. 수치는 이 프로젝트의 값이며 Garden에 적용한 값이 아니다.

### BrotatoLike — Godot 학습 프로젝트
- [라이선스](https://github.com/SarutobiSasuke8/BrotatoLike/blob/master/LICENSE): MIT. [WaveRules](https://github.com/SarutobiSasuke8/BrotatoLike/blob/master/scripts/logic/WaveRules.gd): 60초 웨이브, 첫 생성 지연 1.5초, 생성 간격 max(0.3, 2.0 − 웨이브×0.1)초. 일반/빠른/탱커 60/25/15%, 이 예제 자체는 종 단계 해금 없음.
- [EnemyScaling](https://github.com/SarutobiSasuke8/BrotatoLike/blob/master/scripts/logic/EnemyScaling.gd): HP 배율 1+웨이브×0.15, 피해 1+웨이브×0.10, 속도는 타입 고정. [XpCurve](https://github.com/SarutobiSasuke8/BrotatoLike/blob/master/scripts/logic/XpCurve.gd): 초기 XP 10, 다음 기준 기존×1.4 내림, 넘친 XP 보존.
- [GameState](https://github.com/SarutobiSasuke8/BrotatoLike/blob/master/scripts/GameState.gd), [README](https://github.com/SarutobiSasuke8/BrotatoLike): 재화·XP·웨이브·스탯 분리. 웨이브 종료 시 상점에서 선택지 3개, 비용 지불. 순수 계산 함수를 씬에서 분리해 테스트할 수 있는 구조.
- 교훈: 레벨 곡선·적 스탯·상점 비용·웨이브를 독립적으로 실험한다. 본 게임의 공식 Brotato 수치로 혼동하지 않는다.

### zombie-survivors-1 — Phaser 3 / TypeScript 프로토타입
- [라이선스](https://github.com/Stavros-oncade/zombie-survivors-1/blob/main/LICENSE): MIT. [EnemySpawnSystem](https://github.com/Stavros-oncade/zombie-survivors-1/blob/main/src/game/systems/EnemySpawnSystem.ts): 초기 일반 적, 난이도 >1일 때 빠른 적, >2일 때 탱커 풀 진입; 반복 타이머의 간격 감소 및 최저값.
- [ExperienceSystem](https://github.com/Stavros-oncade/zombie-survivors-1/blob/main/src/game/systems/ExperienceSystem.ts): 초기 요구량×성장 배율^(레벨−1), XP 초과분 유지, 레벨업 콜백 분리. [WeaponSystem](https://github.com/Stavros-oncade/zombie-survivors-1/blob/main/src/game/systems/WeaponSystem.ts): 기본 장착 무기와 전투 업데이트 분리.
- 교훈: Garden과 같은 Phaser에서도 생성기·성장·무기 모듈 분리 가능. 완성된 상용 밸런스의 근거가 아닌 구조 참고용.

## Garden 설계 방향 (제안, 미승인)

### 단기: 기존 단일 드롭·카드 드래그·슬롯 유지
1. 일반 카드 12%를 3% 시험값으로 낮추고 보석 64%, 하트 15%, 꽃 18% 유지(합계 100). 전 종류 균등이면 직접 피해 약 2.31%/킬, 공격/제어 2.54%/킬. 60킬 기준 일반 1.8장, 공격/제어 1.52장 기대. 수치는 분석용 예시이며 확정 아님.
2. 확률만 조정하면 후반 공급 급증 및 초반 무기 부족이 가능하다. 일반 카드에 최소 생성 간격(예: 20~30초), 첫 성장 보상 보장(예: 30~60초 구간 1회), 최대 대기시간을 별도 검토. 제한 중 일반 카드 당첨을 보석으로 대체하되 단일 드롭 유지. 보석·꽃 경제 변화 측정.
3. 초반 2~3종만 공격 풀에 허용(돌멩이, 부메랑 등은 예시), 기존 무기 강화·동일 계열 가중, 후반 순차 해금. 끈끈이/물방울 요정/신발/방패의 분류·가중 분리. 적의 공중/지상 상성 대응을 막지 않도록 공중 대응 무기 보장 고려. 무기 종류와 드롭 수는 별개의 제어 변수.
4. 꽃 카드는 승리 목표 필수 자원이므로 무기와 함께 일괄 희귀화하지 않는다. 도안 필요 꽃 공급, 배치 가능성, 카드 만료, 회복 조건을 고려. 16칸 도안에서 초기 4칸 제외 최소 12장의 맞는 꽃 필요.

### 중기: 성장 이벤트와 적 스케줄 독립화
- 보석 획득 누적값/XP와 구매 잔액 분리(예: 획득 1보석=1XP, 소비 시 XP 불변). XP 곡선은 시작 빠른 성장, 점차 요구량 상승. 성장 시 하나의 선택/보상만 지급(신규 장착 또는 기존 Lv.2/3, 지원 아이템). 현행 드래그 유지 여부 및 레벨업 팝업 도입은 설계 승인 후 결정.
- 30~60초 단위 데이터 기반 웨이브를 만들고 각 웨이브에 신규 출현 풀, 종별 비율, 생성 간격, 배치 수, 동시 상한, HP·피해 배율 정의. 현재처럼 모든 해금 종 누적을 강제하지 않는다. 약한 다수 → 강한 소수 → 혼합 등 밀도 변화. 적은 기존처럼 살아 있는 꽃을 계속 공격하고 웨이브 전환 때 살아 있는 적을 삭제하지 않는다. 이동 속도 최소 시작 및 기존 무기 상성 유지.
- 첫 3분 애벌레 도입 요구를 보존하는 예: 0~30초 3초 간격/3마리 상한 → 30~90초 2.5초/5마리 → 90~180초 2초/7마리. 3분 이후 풍뎅이 중심 소수 혼합. **예시**이며 실제 적용 전 종별 이동 시간·기본 돌멩이 처리율·정원 피해/카드 공급을 함께 검증한다.
- 난이도는 시간·적 수·체력·피해와 성장 속도의 관계로 튜닝. 같은 무기의 중복 장착과 레벨업의 효과가 다르므로 중복 허용 정책은 별도 결정. 기존 슬롯 구매·정원 완성 승리 조건·승패 팝업 유지.

## 검증 계획 (미실행)
- 적 처치/출현/무기 선택 간격, 무기 종류 수, 장착 슬롯·레벨, 보석 수입/소비, 꽃 공급/만료/배치, 꽃 손상/생존, 도안 완료 시간 분포 기록.
- 초기 돌멩이만·실제 드래그 플레이·전략적 장착·카드 운 최악/평균/최상 조건 및 여러 시드 비교. 실제 플레이가 3분 이전에 너무 쉬워지거나 손상 누적으로 종료되지 않는지 확인. 드롭 부족으로 승리가 불가능해지는지도 검사.
- 숫자를 직접 이식하지 않고 Garden의 960×540·고정 정원 방어·자동 순찰·성장 시간·보석 비용에 맞춘다. 타 프로젝트 코드를 반입하지 않았다.
