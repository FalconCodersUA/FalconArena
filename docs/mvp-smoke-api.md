# MVP API Smoke Test

Use this checklist after deployment to verify the core backend flow:

`auth -> tournaments -> team registration -> rounds -> submissions`

Base URL:

```bash
BASE_URL="https://falconarena.live"
```

Optional helper (for unique emails):

```bash
TS=$(date +%s)
ADMIN_EMAIL="admin_${TS}@falconarena.live"
TEAM_EMAIL="team_${TS}@falconarena.live"
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

## 3) Login admin and team, store tokens

```bash
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken')

TEAM_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEAM_EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken')
```

## 4) Create tournament (admin)

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

## 5) Open registration status (admin)

```bash
curl -s -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"REGISTRATION"}'
```

## 6) Register team in tournament (team)

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

## 7) Create round (admin)

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

## 8) Activate round (admin)

```bash
curl -s -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/$ROUND_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACTIVE"}'
```

## 9) Submit project (team)

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

## 10) Read own submission (team)

```bash
curl -s "$BASE_URL/rounds/$ROUND_ID/submissions/me" \
  -H "Authorization: Bearer $TEAM_TOKEN"
```

## Notes

- Requires `jq` for token/id extraction.
- If `jq` is missing, run each request and copy IDs/tokens manually.
- If any step fails, save response JSON and include it in issue/PR comment.
