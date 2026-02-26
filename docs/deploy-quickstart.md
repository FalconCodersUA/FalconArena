# Deploy Quickstart

## 1) One-time Ubuntu setup

Run on Ubuntu:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
mkdir -p /opt/falconarena-deploy
```

Log out and log in again after adding user to docker group.

## 2) Create GitHub token for server pull

In GitHub, create a fine-grained personal access token:

- `GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens`
- Token owner: your account that can read this repository
- Repository access: `Only selected repositories` -> `FalconArena`
- Permissions: `Contents: Read-only`
- Copy token value once and store it safely

This token will be used by deploy workflow when it runs `git pull` on Ubuntu.

## 3) Allow GitHub Actions to connect to Ubuntu

Create deployment key pair on your local machine:

```bash
ssh-keygen -t ed25519 -f ./falconarena_actions_ssh -N ""
```

Add public key to Ubuntu:

```bash
cat falconarena_actions_ssh.pub
```

Copy output and append it to `/home/<deploy-user>/.ssh/authorized_keys` on Ubuntu.

## 4) Configure GitHub repository secrets

In `GitHub -> Repo -> Settings -> Secrets and variables -> Actions`, add:

- `SSH_HOST` = Ubuntu public IP
- `SSH_USER` = Ubuntu deploy user
- `SSH_PRIVATE_KEY` = content of `falconarena_actions_ssh`
- `SSH_PORT` = `22`
- `DEPLOY_PATH` = `/opt/falconarena-deploy`
- `GH_PULL_USERNAME` = GitHub username that created token
- `GH_PULL_TOKEN` = fine-grained token from step 2
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `VITE_API_URL` = `https://falconarena.live`

## 5) Domain and firewall

- DNS `A` record for `falconarena.live` must point to Ubuntu IP.
- Open ports on server/security group: `22`, `80`, `443`.
- Do not expose `5432` and `6379` publicly.
- If port `80` is already busy from an old container, remove it before first deploy:

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
docker stop caddy-caddy-1 || true
docker rm caddy-caddy-1 || true
```

## 6) First deploy test

Use this flow:

1. Push branch `feature/*`
2. Open PR to `main`
3. Wait for `CI` (lint + build)
4. Merge PR into `main`
5. Check workflow `Deploy` in GitHub Actions

After success, open:

- `https://falconarena.live`
- `https://falconarena.live/health`
