# Smoke-чекліст платформи

Цей сценарій потрібен для швидкої перевірки готовності платформи перед показом або після деплою.

## Автоматичний smoke

Запуск:

```bash
BASE_URL=https://falconarena.live \
ADMIN_EMAIL=admin@falconarena.live \
ADMIN_PASSWORD=your-password \
TEST_USER_PASSWORD=StrongPass123! \
npm run smoke:platform -w @falconarena/backend
```

Окремий жорсткий e2e для головного турнірного сценарію:

```bash
BASE_URL=https://falconarena.live \
ADMIN_EMAIL=admin@falconarena.live \
ADMIN_PASSWORD=your-password \
TEST_USER_PASSWORD=StrongPass123! \
npm run test:e2e:admin-team-jury-leaderboard -w @falconarena/backend
```

Що перевіряє цей e2e:

1. `ADMIN` створює `TEAM` і `JURY`.
2. `TEAM` реєструє команду в новому турнірі.
3. `ADMIN` створює та активує раунд.
4. `TEAM` подає сабміт.
5. `ADMIN` розподіляє призначення на `JURY`.
6. `JURY` виставляє оцінювання.
7. `ADMIN` завершує оцінювання.
8. `Leaderboard` містить команду на `rank = 1` з очікуваним `averageScore/totalScore`.
9. `CSV export` повертає коректний рядок з цією командою.

Окремий e2e для фінального сценарію `archive -> certificates -> export`:

```bash
BASE_URL=https://falconarena.live \
ADMIN_EMAIL=admin@falconarena.live \
ADMIN_PASSWORD=your-password \
TEST_USER_PASSWORD=StrongPass123! \
npm run test:e2e:archive-certificate-export -w @falconarena/backend
```

Що перевіряє цей e2e:

1. Турнір проходить повний цикл до `FINISHED`.
2. `Archive` містить фінальні підсумки, раунди й сабміти.
3. Шаблон сертифіката доступний і оновлюється.
4. Сертифікат участі та сертифікат переможця реально генеруються.
5. `CSV export` містить фінальний рядок архівного турніру.
6. `Google Sheets export` перевіряється, якщо webhook уже налаштований в системі.

Що перевіряє скрипт:

1. `ADMIN` входить у систему.
2. Публічні системні дефолти доступні.
3. `ADMIN` створює тестових `TEAM` і `JURY` користувачів.
4. Створюється турнір.
5. Для турніру створюється подія розкладу.
6. Турнір переводиться в `REGISTRATION`.
7. Створюється оголошення, і `TEAM` бачить його як unread.
8. `TEAM` реєструє команду.
9. `TEAM` створює особистий діалог з `JURY`, надсилає повідомлення, unread/read для діалогу працює.
10. `ADMIN` створює раунд з `mustHave`, `technologyRequirements`, `additionalMaterials`.
11. Раунд активується, турнір переходить у `RUNNING`.
12. `TEAM` подає сабміт і отримує персональне сповіщення.
13. `ADMIN` розподіляє оцінювання на `JURY`.
14. `JURY` виставляє оцінку.
15. `ADMIN` завершує оцінювання.
16. Турнір переходить у `FINISHED`.
17. Доступні `leaderboard` та `archive`.
18. Доступні сертифікат участі та сертифікат переможця.
19. Фінальне сповіщення веде в `archive`.

## Короткий ручний smoke для демо

1. Увійти під `ADMIN`.
2. Відкрити `/app/integrations` і переконатися, що системні налаштування відкриваються.
3. Відкрити `/app/admin` і перевірити швидкі дії, створення турніру та раунду.
4. Відкрити `/app/tournaments` і перейти в `Деталі турніру`.
5. Увійти під `TEAM`, перевірити `/app/team`, `Повідомлення`, `Профіль`.
6. Увійти під `JURY`, перевірити `/app/jury`, призначені роботи та `Повідомлення`.
7. Під `ADMIN` відкрити `/app/leaderboard` і `/app/archive`.
8. В `archive` перевірити сертифікат участі та сертифікат переможця.

## Коли запускати

- після merge в `main`
- після застосування Prisma migrations на сервері
- перед демонстрацією або захистом
