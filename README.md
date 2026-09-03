# 배구 전술 보드

로그인 없이 쓰는 배구 전술 보드. 컷(장면)을 만들고 재생하고, 파일로 백업한다.

**프로그램을 모르는 사람은 `docs/`부터 읽으면 된다.**

- [docs/README.md](docs/README.md) — 문서 목차
- [docs/overview.md](docs/overview.md) — 이 앱이 뭔가
- [docs/features.md](docs/features.md) — 지금 있는 기능
- [docs/file-structure.md](docs/file-structure.md) — 폴더 지도
- [docs/start-plan.md](docs/start-plan.md) — 2026-08-25 시작 계획
- [docs/3d-player-pose-plan.md](docs/3d-player-pose-plan.md) — 3D 자세 계획

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173/`

## 한 줄

전술은 기기의 IndexedDB에만 남는다. 서버 없음. 옮기려면 `.vpb` 백업.
