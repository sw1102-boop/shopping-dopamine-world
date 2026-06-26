# 쇼핑 도파민 월드 🛒

레트로 아케이드 스타일의 "30초 만에 백화점 털기" 드래그 캐치 게임.
떨어지는 명품을 쇼핑백으로 받고, 영수증 폭탄은 피하세요. 종료 후 "탕진 영수증"이 발급됩니다.

- 순수 정적 사이트 (HTML / CSS / JavaScript)
- 별도 빌드 과정 없음 → 그대로 정적 호스팅 가능

## 로컬에서 실행

`index.html` 을 브라우저로 열면 됩니다.

## 폴더 구조

```
index.html
css/        style.css, reset.css
js/         main.js
img/        lotte-logo.png
```

## GitHub Pages 배포

1. GitHub에 새 저장소(repository)를 만든다. (예: `shopping-dopamine-world`)
2. 이 폴더를 push 한다. (아래 "배포 명령" 참고)
3. 저장소 → **Settings → Pages** 이동
4. **Source** 를 `Deploy from a branch` 로 두고, Branch 를 `main` / `/(root)` 선택 후 Save
5. 1~2분 뒤 `https://<아이디>.github.io/<저장소이름>/` 으로 외부 접속 가능

### 배포 명령 (git 설치 후)

```bash
git init
git add .
git commit -m "쇼핑 도파민 월드 최초 배포"
git branch -M main
git remote add origin https://github.com/<아이디>/<저장소이름>.git
git push -u origin main
```
