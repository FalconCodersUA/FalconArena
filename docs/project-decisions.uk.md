# Архітектурні рішення

## Підтверджений стек

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Async-ready infrastructure: Redis
- Runtime packaging: Docker Compose
- CI/CD: GitHub Actions

## Структура репозиторію

- `apps/frontend`
- `apps/backend`
- `infra/docker-compose`
- `.github/workflows`

## Командний workflow

- Основна гілка: `main`
- Гілки розробки: `feature/*`
- Інтеграція: Pull Request у `main`
- Режим малої команди: self-review за шаблоном PR + обов'язкові CI checks

## CI/CD контракт

- PR у `main`: `lint + build`
- Push/merge у `main`: deploy на Ubuntu через SSH
- Середовище: `production` (або label `demo`)

## Пріоритети delivery

1. Auth + RBAC (`ADMIN`, `TEAM`, `JURY`, optional `ORGANIZER`)
2. Створення турніру та логіка вікна реєстрації
3. Реєстрація команд і валідації
4. Активація раундів/завдань і контроль дедлайнів
5. Сабміти і блокування після дедлайну
6. Розподіл на журі та форма оцінювання
7. Leaderboard і агрегація балів
