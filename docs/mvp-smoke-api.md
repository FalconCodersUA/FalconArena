# MVP API Smoke Test

Use this checklist after deployment to verify the core backend flow:

`auth -> tournaments -> team registration -> rounds -> submissions -> evaluation -> leaderboard`

Base URL:

```bash
BASE_URL="https://falconarena.live"
```

Optional helper (for unique emails):

```bash
TS=$(date +%s)
ADMIN_EMAIL="admin_${TS}@falconarena.live"
TEAM_EMAIL="team_${TS}@falconarena.live"
JURY_EMAIL="jury_${TS}@falconarena.live"
PASSWORD="StrongPass123!"
```

## 1) Register admin user

```bash
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"fullName\":\"Admin User\",\"password\":\"$PASSWORD\",\"role\":\"ADMIN\"}"
```

## 2) Register team captain user

```bash
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEAM_EMAIL\",\"fullName\":\"Team Captain\",\"password\":\"$PASSWORD\",\"role\":\"TEAM\"}"
```

## 3) Register jury user

```bash
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$JURY_EMAIL\",\"fullName\":\"Jury User\",\"password\":\"$PASSWORD\",\"role\":\"JURY\"}"
```

## 4) Login admin, team, and jury

```bash
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken')

TEAM_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEAM_EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken')

JURY_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$JURY_EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken')
```

## 5) Create tournament (admin)

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

## 6) Open registration status (admin)

```bash
curl -s -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"REGISTRATION"}'
```

## 7) Register team in tournament (team)

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

## 8) Create round (admin)

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

## 9) Activate round (admin)

```bash
curl -s -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/$ROUND_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACTIVE"}'
```

## 10) Submit project (team)

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

## 11) Read own submission (team)

```bash
curl -s "$BASE_URL/rounds/$ROUND_ID/submissions/me" \
  -H "Authorization: Bearer $TEAM_TOKEN"
```

## 12) Distribute assignments (admin)

```bash
curl -s -X POST "$BASE_URL/rounds/$ROUND_ID/assignments/distribute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"minReviewersPerSubmission":1,"resetExisting":true}'
```

## 13) List my assignments (jury)

```bash
ASSIGNMENT_ID=$(curl -s "$BASE_URL/rounds/$ROUND_ID/assignments/me" \
  -H "Authorization: Bearer $JURY_TOKEN" | jq -r '.[0].id')
```

## 14) Submit evaluation (jury, 0-100 scale)

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

## 15) Finish evaluation (admin)

```bash
curl -s -X POST "$BASE_URL/rounds/$ROUND_ID/finish-evaluation" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

## 16) Read leaderboard

```bash
curl -s "$BASE_URL/tournaments/$TOURNAMENT_ID/leaderboard" | jq .
```

## Notes

- Requires `jq` for token/id extraction.
- If `jq` is missing, run each request and copy IDs/tokens manually.
- If any step fails, save response JSON and include it in issue/PR comment.
- Script alternative (no `jq`): `BASE_URL=https://falconarena.live npm run smoke:mvp -w @falconarena/backend`
