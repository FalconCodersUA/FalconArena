# Ops Runbook (UA)

## Призначення

Цей runbook описує базові операційні дії для FalconArena у production/demo-середовищі:

- deploy
- post-deploy verification
- rollback
- backup / restore
- перевірка логів і health

Документ не замінює [deploy-quickstart.uk.md](/D:/MixProjects/FalconArena/docs/deploy-quickstart.uk.md), а продовжує його для щоденної експлуатації.
Окремий rehearsal-сценарій описаний у [backup-restore-drill.uk.md](/D:/MixProjects/FalconArena/docs/backup-restore-drill.uk.md).

## 1. Базовий deploy після merge у `main`

```bash
cd /opt/falconarena-deploy
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env pull
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env exec backend npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env exec backend npx prisma migrate status --schema apps/backend/prisma/schema.prisma
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build backend frontend
```

## 2. Post-deploy verification

Перевірити:

- `https://falconarena.live/health`
- логін ADMIN
- `/app/admin`
- `/app/profile`
- `/app/messages`
- `/app/leaderboard`

Якщо в релізі були Prisma-міграції, додатково перевірити критичний сценарій, який торкається нової таблиці або поля.

## 3. Перевірка логів

### Backend

```bash
cd /opt/falconarena-deploy
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env logs backend --tail=200
```

Тепер HTTP-логи мають містити:

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `userId`
- `userRole`

Кожен HTTP response також повертає `X-Request-Id`, що допомагає зв'язати помилку з логом.

## 4. Rollback

### Найпростіший rollback контейнерів

Якщо проблема не в міграції БД, а в останньому коді:

1. повернути git checkout на попередній стабільний commit або tag
2. перебудувати сервіси

```bash
cd /opt/falconarena-deploy
git log --oneline -n 5
git checkout <stable-commit>
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build backend frontend
```

### Важливо

- не робити rollback коду, якщо вже застосована несумісна міграція без розуміння наслідків;
- для ризикових міграцій спочатку робити backup.

## 5. Backup PostgreSQL

```bash
cd /opt/falconarena-deploy
sh infra/scripts/backup-all.sh
```

Або окремо тільки БД:

```bash
cd /opt/falconarena-deploy
sh infra/scripts/backup-db.sh
```

Рекомендується робити backup:

- перед великими міграціями
- перед ручними змінами даних
- перед демонстрацією, якщо дані критичні

## 6. Backup uploads/storage

```bash
cd /opt/falconarena-deploy
sh infra/scripts/backup-storage.sh
```

`storage` тепер живе в окремому Docker volume для backend uploads, тому його backup варто робити разом із БД.

Після повного backup set рекомендується:

```bash
cd /opt/falconarena-deploy
sh infra/scripts/verify-backup.sh <timestamp>
```

## 7. Restore PostgreSQL

```bash
cd /opt/falconarena-deploy
sh infra/scripts/restore-db.sh backups/<backup-file>.sql
```

Restore варто робити тільки після підтвердження, що поточні дані можна замінити.

## 8. Restore uploads/storage

```bash
cd /opt/falconarena-deploy
sh infra/scripts/restore-storage.sh backups/<storage-archive>.tar.gz
```

## 9. Incident checklist

Якщо production поводиться нестабільно:

1. перевірити `health`
2. перевірити `docker compose ps`
3. перевірити backend logs
4. перевірити, чи застосовані всі очікувані Prisma-міграції
5. перевірити останній merge/commit
6. за потреби переключитися на попередній стабільний commit і перебудувати сервіси

## 10. Рекомендований release checklist

Перед релізом:

1. `lint`
2. ключові тести зміненого блоку
3. перевірка документації, якщо змінився workflow
4. підтвердження Prisma-міграцій

Після релізу:

1. `health`
2. логін ADMIN
3. smoke 1-2 критичних сценаріїв
4. перевірка backend logs з `requestId`
