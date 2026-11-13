# 임시 잔디 UI 색상 비교

정식 채택하지 않는 테스트 전용. 기존 게임 코드·레이아웃·스프라이트·16색 팔레트는 변경하지 않는다. 이 폴더의 index.html에서만 색상 역할을 재정의하고 잔디/흙 패턴을 JS로 렌더링한다. type 없음/잘못된 값은 이전 잔디 시안을 유지한다.

| type | 시안 | 색감 참고 |
| --- | --- | --- |
| 1 | Golden Farm | Stardew Valley 황금빛 목재 UI |
| 2 | Spring Storybook | Fields of Mistria 크림/분홍 UI |
| 3 | Rustic Woodland | Roots of Pacha 자연 흙/목재 톤 |
| 4 | Mint Garden | Garden Story 민트/청록 톤 |

참고(2026-11-13): [Stardew Valley 인벤토리](https://www.mobygames.com/game/80992/stardew-valley/screenshots/windows/1159829/), [Fields of Mistria 공식 프레스킷](https://www.fieldsofmistria.com/presskit), [Roots of Pacha 스크린샷](https://rootsofpacha.wiki.gg/wiki/Category:Screenshots), [Garden Story 스크린샷](https://www.nintendolife.com/games/switch-eshop/garden_story). 색 조합만 참고했으며 외부 게임 이미지/에셋은 포함하지 않았다. 선호 순위의 객관적 통계는 아니다.

검증: [Chromium 23/23](https://github.com/xcliming-svg/garden-test/actions/runs/43418430754), 테스트 커밋 46b726b. 원본 화면 보존, 이전 잔디 기본, 네 가지 시안의 기존 좌표/크기, 흙/공유선, UI 색상 역할, 꽃 심기, 아이템 장착, FHD, 페이지 오류 확인. 다른 브라우저·OS 및 실제 이용자 선호도는 미검증. 삭제 대상은 이 폴더뿐이다.

## Type 1 추가 조정

기본 정원 공유선은 완전 투명(잔디 노출), 꽃 드래그 활성선은 기존 금빛을 유지한다. 정원 내부 면과 타일 기하/판정은 유지한다. Fusion Pixel Regular의 글리프·크기는 유지하고 Type 1 텍스트 그림자만 제거한다. 기본 #3B291D, 보조 #604024, 비활성 #49311F, 제목 #2E1F16, 어두운 메뉴 #FFF1D3, 잔디 라벨 #20170F, 증가 #375321, 감소 #80242F. 다른 시안은 유지한다. 원본 게임 파일을 수정하지 않는다.
