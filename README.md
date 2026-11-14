# 안개골: 바람나침반 — 시각 검토 01

Godot 4.6.3 / GDScript. 이번 산출물은 **1단계 타이틀·마을·포미/마루 대화 UI 검토본**입니다. 공식 인물 스탠딩을 포함한 장면의 최종 승인본이나 ACT 1–5 완성 게임이 아닙니다.

## 실행

Godot 4.x 프로젝트 관리자에서 이 폴더의 `project.godot`를 가져온 다음 F6가 아닌 F5로 실행합니다. 폰트와 원본 배경을 처음 한 번 자동으로 import합니다. 별도 플러그인이나 인터넷 연결은 필요하지 않습니다.

```sh
godot --editor --path .
godot --path .
godot --headless --path . -- --self-test
godot --resolution 1920x1080 --path . -- --capture
```

`--capture`는 실제 화면 렌더러와 디스플레이가 필요합니다. Godot `--headless`의 더미 렌더러로는 시각 검증을 할 수 없습니다. Windows export 템플릿·exe는 포함하지 않으며 Windows export는 미검증입니다.

프로젝트 내 자산 경로는 모두 `res://` 상대 경로입니다. 사용자 디렉터리가 읽기 전용인 검증 환경에서만 XDG_DATA_HOME / XDG_CONFIG_HOME / XDG_CACHE_HOME을 쓰기 가능한 임시 경로로 지정했습니다. 최종 프로젝트에는 호스트 절대 경로를 넣지 않았습니다.

## 조작과 구현 범위

- 새로운 이야기: 마을 독백 두 줄과 PRD에 있는 포미/마루 예문 네 줄.
- 클릭 / Space / Enter: 타이핑 즉시 완료, 다음 입력으로 한 줄 진행.
- H: UI 숨김/복구. Esc: 설정 열기/닫기, 숨김 상태 복구.
- 대화 기록, 자동 진행, 텍스트 속도 설정, 타이틀 복귀.
- 버튼 키보드 포커스와 커스텀 스타일. 기본 Godot 테마를 최종 화면으로 사용하지 않음.
- 논리 캔버스 1920×1080, 기본 창 1280×720. `canvas_items` 비율 확대 방식. 16:9 기준 UI 배치.
- 문장 본문 32px, 한글 지원 Noto Sans CJK; 타이틀 Noto Serif CJK. SIL OFL 관련 라이선스는 `assets/fonts/LICENSE.txt`.
- 배경을 비율 유지 cover로 표시. 색상 재가공·블러·건축 변경 없음. 원본은 1672×941, 검증 캡처는 1920×1080.

## 자산 연결

`data/assets.json`에 배경과 인물 자산 경로를 중앙화했습니다. 현재 배경은 사용자 첨부 ZIP의 `assets/reference/village_visual_target.png`를 그대로 사용합니다.

대화에 앞서 올라온 공식 캐릭터 시트는 대화에서 확인했으나 이번 ZIP / 로컬 첨부에는 원본 파일이 없습니다. 새 인물 생성, 시트 전체 배치, 복잡한 시트의 단순 크롭을 하지 않았습니다. 누락 상태는 UI에 표시하며 인물 없는 검토본을 완성 초상화 장면으로 간주하지 않습니다.

우선 필요한 파일:

- `assets/reference/characters/` 아래 공식 포미·마루 시트 원본.
- `assets/portraits/pomi/ch_pomi_neutral.png` (투명 배경).
- `assets/portraits/maru/ch_maru_smile.png` (투명 배경).
- 포미 나머지 표정(경계/놀람/작은 미소), 마루 나머지 표정(중립/단호).
- `assets/backgrounds/bg_bakery_day.png` — 현 대화 검토본은 **임시 마을 배경**이라고 표시함.

후속 단계의 누락 자산: 광장/저녁 산책길/새벽 숲 배경, 카루비야·딱따구리·소렌·미로의 각 표정 스탠딩, 나침반 클로즈업·얼굴 없는 숲 실루엣 CG, BGM 3곡·클릭/종/바람/나뭇가지/나침반 SFX. 마을 이미지를 제외한 다른 배경이나 캐릭터를 임의로 생성하지 않았습니다.

## 검증 결과

`qa/`에 Godot 실제 OpenGL 렌더러로 생성한 PNG 네 장이 있습니다. 모두 1920×1080임을 별도 이미지 검사로 확인했습니다.

1. `01_title_1920x1080.png` — 타이틀·버튼·한글·일러스트 가림을 직접 열어 확인.
2. `02_pomi_ui_1920x1080.png` — 포미 독백 UI. 초상화는 미연결.
3. `03_pomi_maru_ui_1920x1080.png` — 마루 화자와 PRD 대사. 두 인물 초상화는 미연결.
4. `04_village_no_ui_1920x1080.png` — 원본 배경 전체 화면 / UI 숨김 상태를 직접 열어 확인.

Godot 4.6.3 import 및 실행 성공. 최초 import에서 호스트 홈 경로 쓰기 오류가 있었으나 쓰기 가능한 XDG 경로로 실행해 해결했습니다. Xorg dummy display + Mesa llvmpipe / OpenGL 호환 렌더러에서 캡처. 검증 실행은 Dummy 오디오 드라이버를 명시했습니다. VSync 미지원 경고는 남아 있으며 렌더링은 성공했습니다. `qa/capture.log`와 `qa/self-test.log` 참조.

`--self-test` 통과: 타이핑 첫 입력 완료/다음 입력 한 줄 진행, H 입력 이벤트 숨김/복구, 모달이 대사 진행 차단, 기록·설정 열기/닫기, 여섯 대사 표시, 끝 지점 검토 안내, 타이틀 복귀 및 자동 모드 초기화.

## 아직 승인하거나 검증하지 않은 항목

- 포미 단독/포미+마루 **초상화 포함** 장면의 미감, 시선·크기·공통 기준선·색온도·알파 경계·의상 일치: 공식 자산 미확보.
- 대화/인물/배경 전환 크로스페이드와 표정 전환 시간: 후속 작업.
- 선택지 UI·키보드 선택·플래그·분기 합류: 미구현.
- ACT 1–5 전체 플레이, 12–18분 분량, 배달 완료 조건, 모든 경로 엔딩 도달: 미구현/미검증.
- 읽은 문장만 스킵, 저장/불러오기/손상 복구, 100줄 이상 기록 실측, 오디오·볼륨·전체 화면 설정: 미구현/미검증. 이어하기 버튼은 비활성 상태.
- 저녁과 숲 실루엣 스크린샷, 숲 엔딩 컷신: 자산 및 장면 미구현.
- 16:9 외 화면 비율 및 다양한 실제 Windows 장치 입력/성능: 미검증.

`AGENTS.md`의 “Phase 1 ... STOP for visual review.”에 따라 이 단계에서 제작을 멈춥니다. 인물 자산을 연결한 2단계 검토와 ACT 1–5 구현은 진행하지 않았습니다. 원본 요청 문서는 이 폴더에 보존했습니다.

## 웹 배포

Web export 설정은 `export_presets.cfg`에 있습니다. Godot 4.6.3 export templates를 설치한 뒤 `godot --headless --path . --export-release Web`으로 빌드합니다. 멀티스레드를 끄므로 별도 COOP/COEP 헤더가 필요하지 않습니다.

정적 웹 빌드는 `gh-pages` 브랜치에 배포됩니다. GitHub 저장소 Settings → Pages → Deploy from a branch → `gh-pages` / `(root)` → Save로 활성화합니다. 예정 주소는 https://oreum06.github.io/angaedemo2/ 입니다. Pages 활성화 권한이 연결 앱에 없어 소유자의 설정 변경이 필요합니다.
