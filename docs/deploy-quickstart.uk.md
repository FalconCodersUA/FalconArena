# Deploy Quickstart (UA)

## 1) Разове налаштування Ubuntu

Виконайте на Ubuntu:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
mkdir -p /opt/falconarena-deploy
```

Після додавання користувача в docker group вийдіть із сесії і зайдіть знову.

## 2) Створіть GitHub token для `git pull` на сервері

У GitHub створіть fine-grained personal access token:

- `GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens`
- Token owner: ваш акаунт, який має доступ на читання репозиторію
- Repository access: `Only selected repositories` -> `FalconArena`
- Permissions: `Contents: Read-only`
- Скопіюйте токен один раз і збережіть безпечно

Цей токен використовується deploy workflow для `git pull` на Ubuntu.

## 3) Дайте GitHub Actions доступ до Ubuntu

Створіть deployment key pair локально:

```bash
ssh-keygen -t ed25519 -f ./falconarena_actions_ssh -N ""
```

Додайте public key на Ubuntu:

```bash
cat falconarena_actions_ssh.pub
```

Вставте вміст у `/home/<deploy-user>/.ssh/authorized_keys`.

## 4) Налаштуйте GitHub repository secrets

У `GitHub -> Repo -> Settings -> Secrets and variables -> Actions` додайте:

- `SSH_HOST` = публічний IP Ubuntu
- `SSH_USER` = deploy-користувач Ubuntu
- `SSH_PRIVATE_KEY` = вміст `falconarena_actions_ssh`
- `SSH_PORT` = `22`
- `DEPLOY_PATH` = `/opt/falconarena-deploy`
- `GH_PULL_USERNAME` = GitHub username, що створив token
- `GH_PULL_TOKEN` = token з кроку 2
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `VITE_API_URL` = `https://falconarena.live`
- `PRISMA_SYNC_MODE` = `dbpush` (після baseline переключити на `migrate`)

## 5) Домен і firewall

- DNS `A` запис для `falconarena.live` має вказувати на IP Ubuntu.
- Відкрийте порти `22`, `80`, `443`.
- Не відкривайте публічно `5432` і `6379`.
- Якщо порт `80` зайнятий старим контейнером, видаліть його перед першим deploy:

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
docker stop caddy-caddy-1 || true
docker rm caddy-caddy-1 || true
```

## 6) Перша перевірка deploy

Потік роботи:

1. Push у `feature/*`
2. Відкрити PR у `main`
3. Дочекатися `CI` (lint + build)
4. Merge PR у `main`
5. Перевірити workflow `Deploy` у GitHub Actions

Після успіху відкрийте:

- `https://falconarena.live`
- `https://falconarena.live/health`

## 7) Baseline міграцій для існуючої БД

Якщо production БД була створена через Prisma `db push`, один раз додайте історію міграцій перед жорстким runtime режимом `migrate deploy`:

```bash
cd /opt/falconarena-deploy
npm run prisma:migrate:resolve:init -w @falconarena/backend
npm run prisma:migrate:deploy -w @falconarena/backend
```

Після цього оновіть GitHub secret `PRISMA_SYNC_MODE`: `dbpush` -> `migrate`.

Це потрібно виконати один раз для кожного середовища.
