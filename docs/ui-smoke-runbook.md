# UI Smoke Runbook (10-15 min)

Short post-deploy manual scenario to quickly confirm core UI behavior.

## 1. Preconditions

- Deployment finished successfully.
- Migrations are applied (`No pending migrations`).
- At least one `ADMIN` account exists.

## 2. Basic page availability

Open:

- `/app/login`
- `/app/register`
- `/app/tournaments`
- `/app/leaderboard`

Expected:

- pages open without runtime errors;
- top bar has explicit `Back`, `Home`, and `Dashboard`/`Register` navigation.

## 3. Login and role dashboards

1. Sign in as `ADMIN`.
2. Check `/app/admin`:
 - no crash;
 - metrics widgets render;
 - when there is no data, clear empty-state text is shown instead of misleading zero charts.
3. Check `/app/profile`:
 - `Edit / Preferences / Security` tabs open;
 - `Save` works and shows system feedback (toast + inline notice).

## 4. Key actions and notifications

Confirm toast notifications on success/error for:

- `ADMIN`: tournament creation, round creation, status updates, assignment distribution.
- `JURY`: evaluation save.
- `TEAM`: team registration, submission save.
- `PROFILE`: settings save.

## 5. API routes via proxy

Without token:

- `GET /dashboard/admin/metrics` -> `401` JSON
- `GET /dashboard/jury/metrics` -> `401` JSON
- `GET /dashboard/team/metrics` -> `401` JSON
- `GET /profile/settings` -> `401` JSON

This confirms Caddy routes requests to backend instead of returning frontend HTML.

## 6. What to attach to report

- screenshot of `/app/admin` after login;
- screenshot of `/app/profile` after `Save`;
- short API check log for the 4 routes above.
