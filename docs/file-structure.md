# 파일 구조

저장소 루트는 `배구 전술 웹_앱`이다. 앱 코드의 중심은 `src/`다.

```
배구 전술 웹_앱/
├── docs/                    ← 지금 읽고 있는 설명서
├── src/                     ← 앱 소스
├── public/                  ← 빌드에 그대로 복사 (모델, 개인정보 페이지)
├── android/                 ← Capacitor 안드로이드 프로젝트
├── store/                   ← 스토어 문구·스크린샷·아이콘
├── tools/                   ← 3D 모델 검사·변환 스크립트 (앱에 안 들어감)
├── .cursor/rules/           ← 에디터(Cursor)용 디자인 규칙
├── package.json
├── vite.config.ts
├── capacitor.config.ts      ← 앱 id: kr.volleyball.playbook
└── 배구 전술 보드 시작 계획.txt   ← 원본 계획서 (정리본은 docs/start-plan.md)
```

## src — 화면

| 파일 | 역할 |
|---|---|
| `App.tsx` | 라우팅. 홈 / 앨범 / 에디터 / 프리셋 편집 / 갤러리 / 기록 |
| `screens/HomeScreen.tsx` | 전술 프로젝트·프리셋 목록, 백업 |
| `screens/AlbumScreen.tsx` | 한 프로젝트 안의 전술 카드 |
| `screens/EditorScreen.tsx` | 전술 편집 본체. 모드 전환, 타임라인, 저장 |
| `screens/CourtCanvas.tsx` | 2D 코트 그리기·터치 |
| `screens/Court3DView.tsx` | 3D 코트, 피규어, 공 |
| `screens/GalleryScreen.tsx` | 캡처·GIF 목록 |
| `screens/MatchScreen.tsx` | 경기 기록 |
| `screens/PresetEditorScreen.tsx` | 대형 프리셋 편집 |
| `screens/CourtThumb.tsx` | 홈 카드용 미니 코트 |

## src — 데이터와 규칙

| 파일 | 역할 |
|---|---|
| `types/play.ts` | 전술·장면·선수·공·백업 파일 타입 |
| `types/match.ts` | 경기 기록 타입 |
| `lib/db.ts` | IndexedDB. plays, albums, presets, captures, covers, matches |
| `lib/backup.ts` | `.vpb` 저장·불러오기 |
| `lib/defaultPlay.ts` | 새 전술 기본 배치, 장면 이름 |
| `lib/interpolate.ts` | 장면 사이 위치 보간 |
| `lib/playerPose.ts` | 자세가 어느 장면 구간에서 유지되는지 |
| `lib/ballFlight.ts` | 공 높이, 비행, 리시브/스파이크 손 위치 |
| `lib/court3d.ts` | 2D 정규화 좌표 ↔ 3D 미터 |
| `lib/formations.ts` | 기본 대형 프리셋 |
| `lib/matchRules.ts` | 점수·로테이션·교체 규칙 |
| `lib/inspect.ts` | 책임 범위, 낙하 부채 |
| `lib/exportMovie.ts` | GIF·영상 |
| `design/tokens.css` | 색. Canvas/3D hex는 `design/tokens.ts`와 같아야 함 |

## src — 모달·부품

`src/components/` 는 선수/공/콘/텍스트 편집, 백업 불러오기, 장면 이름 등 모달.  
`src/components/match/` 는 경기 기록 UI.

## public

```
public/
├── privacy.html              개인정보 처리방침 (스토어 URL)
├── tactical-dark-preview.html  다크 UI 느낌 확인용
└── models/
    ├── player-receive.glb    리시브 자세
    ├── player-spike.glb      스파이크 자세
    ├── volleyball.glb
    └── volleyball_net.glb
```

없는 선수 모델: `player-idle.glb`, `player-set.glb`, `player-block.glb`.

## 그 밖의 폴더

| 경로 | 역할 |
|---|---|
| `store/play-ko.txt` | Play 스토어 제목·설명·빌드 메모 |
| `store/screenshots/` | 스토어 스크린샷 |
| `.github/workflows/pages.yml` | master push → GitHub Pages |
| `tools/` | Mixamo/GLB 검사, FBX 변환. 런타임 아님 |
| `.cursor/rules/tactical-dark.mdc` | 딥 블랙 UI, 우리팀 빨강 / 상대 파랑 |

## 데이터가 사는 곳

코드가 아니라 **기기 안**이다.

- IndexedDB 이름: `volleyball-playbook`
- 전술 JSON은 `.vpb`로 내보낼 수 있음
- 캡처·GIF·커버 사진은 DB의 blob. 백업 파일에는 안 넣음
- 경기 기록은 백업에 포함
