# API smoke-чекліст

Використовуйте цей чеклист після deploy, щоб перевірити основний backend flow:

`auth -> tournaments -> team registration -> rounds -> submissions -> evaluation -> leaderboard`

Base URL:

```bash
BASE_URL="https://falconarena.live"
```

Допоміжні змінні (унікальні email):

```bash
TS=$(date +%s)
ADMIN_EMAIL="admin@falconarena.live"
ADMIN_PASSWORD="change_me"
TEAM_EMAIL="team_${TS}@falconarena.live"
JURY_EMAIL="jury_${TS}@falconarena.live"
TEST_USER_PASSWORD="StrongPass123!"
```

## 1) Логін admin

```bash
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r '.accessToken')
```

## 2) Створіть користувача Team (admin)

```bash
curl -s -X POST "$BASE_URL/auth/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEAM_EMAIL\",\"fullName\":\"Team Captain\",\"password\":\"$TEST_USER_PASSWORD\",\"role\":\"TEAM\"}"
```

## 3) Створіть користувача Jury (admin)

```bash
curl -s -X POST "$BASE_URL/auth/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$JURY_EMAIL\",\"fullName\":\"Jury User\",\"password\":\"$TEST_USER_PASSWORD\",\"role\":\"JURY\"}"
```

## 4) Логін Team і Jury

```bash
TEAM_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEAM_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" | jq -r '.accessToken')

JURY_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$JURY_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" | jq -r '.accessToken')
```

## 5) Створіть турнір (admin)

```bash
TOURNAMENT_ID=$(curl -s -X POST "$BASE_URL/tournaments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "FalconArena Smoke Tournament",
    "description": "MVP API smoke run",
    "registrationOpenAt": "2025-01-01T00:00:00.000Z",
    "registrationCloseAt": "2030-01-01T00:00:00.000Z",
    "maxTeams": 100
  }' | jq -r '.id')
```

## 6) Відкрийте статус реєстрації (admin)

```bash
curl -s -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"REGISTRATION"}'
```

## 7) Зареєструйте команду (team)

```bash
curl -s -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/teams/register" \
  -H "Authorization: Bearer $TEAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Falcon Team $TS\",
    \"organization\": \"Falcon School\",
    \"contactHandle\": \"@falcon_team\",
    \"members\": [
      {\"fullName\":\"Member One\",\"email\":\"member1_${TS}@falconarena.live\"},
      {\"fullName\":\"Member Two\",\"email\":\"member2_${TS}@falconarena.live\"}
    ]
  }"
```

## 8) Створіть раунд (admin)

```bash
ROUND_ID=$(curl -s -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Round 1",
    "description": "Build and submit MVP",
    "mustHave": ["Auth", "Team registration", "Submission form"],
    "startsAt": "2025-01-01T00:00:00.000Z",
    "deadlineAt": "2030-01-01T00:00:00.000Z"
  }' | jq -r '.id')
```

## 9) Активуйте раунд (admin)

```bash
curl -s -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/$ROUND_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACTIVE"}'
```

## 10) Відправте сабміт (team)

```bash
curl -s -X POST "$BASE_URL/rounds/$ROUND_ID/submissions" \
  -H "Authorization: Bearer $TEAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/FalconCodersUA/FalconArena",
    "demoUrl": "https://youtu.be/dQw4w9WgXcQ",
    "liveDemoUrl": "https://falconarena.live",
    "shortSummary": "Smoke test submission"
  }'
```

## 11) Перегляд власного сабміту (team)

```bash
curl -s "$BASE_URL/rounds/$ROUND_ID/submissions/me" \
  -H "Authorization: Bearer $TEAM_TOKEN"
```

## 12) Розподіл оцінювання (admin)

```bash
curl -s -X POST "$BASE_URL/rounds/$ROUND_ID/assignments/distribute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"minReviewersPerSubmission":1,"resetExisting":true}'
```

## 13) Список призначень Jury

```bash
ASSIGNMENT_ID=$(curl -s "$BASE_URL/rounds/$ROUND_ID/assignments/me" \
  -H "Authorization: Bearer $JURY_TOKEN" | jq -r '.[0].id')
```

## 14) Надішліть оцінку (jury, шкала 0-100)

```bash
curl -s -X POST "$BASE_URL/rounds/$ROUND_ID/assignments/$ASSIGNMENT_ID/evaluation" \
  -H "Authorization: Bearer $JURY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scores": {
      "technicalBackend": 92,
      "technicalDatabase": 86,
      "technicalFrontend": 84,
      "mustHave": 95,
      "stability": 88,
      "usability": 90
    },
    "comment": "Solid MVP submission"
  }'
```

## 15) Завершіть оцінювання (admin)

```bash
curl -s -X POST "$BASE_URL/rounds/$ROUND_ID/finish-evaluation" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

## 16) Перевірка leaderboard

```bash
curl -s "$BASE_URL/tournaments/$TOURNAMENT_ID/leaderboard" | jq .
```

## Нотатки

- Потрібен `jq` для зручного парсингу token/id.
- Якщо `jq` відсутній, виконайте запити вручну та скопіюйте значення.
- Якщо крок падає, збережіть JSON відповіді і додайте його у коментар до issue/PR.
- Альтернатива скриптом: `BASE_URL=https://falconarena.live ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run smoke:mvp -w @falconarena/backend`
