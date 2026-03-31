# Backup / Restore Drill

Цей документ потрібен для ручного rehearsal перед реальним пілотом.

Мета:

- перевірити, що backup БД реально створюється;
- перевірити, що uploads/storage теж зберігаються окремо;
- перевірити, що команда restore відома команді до першого інциденту.

## 1. Перед початком

На сервері має бути актуальний репозиторій у:

```bash
/opt/falconarena-deploy
```

Сервіси мають бути запущені:

```bash
cd /opt/falconarena-deploy
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env ps
```

## 2. Створити backup PostgreSQL

```bash
cd /opt/falconarena-deploy
sh infra/scripts/backup-db.sh
```

Очікуваний результат:

- у `/opt/falconarena-deploy/backups` з'явився файл `falconarena-db-<timestamp>.sql`

## 3. Створити backup uploads/storage

```bash
cd /opt/falconarena-deploy
sh infra/scripts/backup-storage.sh
```

Очікуваний результат:

- у `/opt/falconarena-deploy/backups` з'явився файл `falconarena-storage-<timestamp>.tar.gz`

## 4. Що перевірити після backup

1. У каталозі `backups` є обидва файли.
2. Файли не нульового розміру.
3. Якщо в системі вже були аватари або інші upload-файли, archive `storage` не порожній.

Приклад:

```bash
cd /opt/falconarena-deploy
ls -lh backups
```

## 5. Dry-run restore plan

Restore у production робити тільки після підтвердження, що поточні дані можна замінити.

Команди:

```bash
cd /opt/falconarena-deploy
sh infra/scripts/restore-db.sh backups/<db-backup-file>.sql
sh infra/scripts/restore-storage.sh backups/<storage-backup-file>.tar.gz
```

## 6. Коли це робити

- перед ризиковими Prisma-міграціями;
- перед великими ручними змінами даних;
- перед публічним демо або запуском реального турніру;
- після будь-якої зміни storage strategy.

## 7. Мінімум для галочки

- backup БД створюється;
- backup storage створюється;
- команда restore задокументована;
- команда знає, де лежать останні backup-файли.
