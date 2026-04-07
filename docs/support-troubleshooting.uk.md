# Підтримка та діагностика

## Призначення

Цей документ допомагає швидко локалізувати типові проблеми FalconArena без довгого ручного дебагу.

Порядок дій:

1. Перевірити симптом
2. Перевірити `/health`
3. Перевірити backend logs
4. Перевірити останній deploy / migration
5. Застосувати вузьке виправлення або rollback

## 1. Login не працює

Симптоми:

- `401 Unauthorized`
- `Too many requests`
- форма логіну зависає або показує помилку

Що перевірити:

- правильність email / password
- чи не спрацював rate limit після багатьох спроб
- backend logs з `requestId`

Що робити:

- зачекати 60 секунд, якщо це rate limiting
- перевірити, що користувач існує в БД
- для admin seed перевірити актуальний password

## 2. `/app/admin` або інші сторінки падають

Симптоми:

- runtime error у браузері
- білий екран
- помилки загрузки даних

Що перевірити:

- чи відповідає `/health`
- чи немає `500` у network tab
- чи всі очікувані міграції застосовані

Що робити:

- перевірити останній merge
- перевірити backend logs
- якщо проблема почалась після релізу, розглянути rollback коду

## 3. Prisma migrate deploy не проходить

Симптоми:

- `No pending migrations` не з'являється
- помилка під час `prisma migrate deploy`

Що перевірити:

- чи правильний `DATABASE_URL`
- чи є доступ до postgres-контейнера
- чи не пошкоджена історія міграцій

Що робити:

- не форсити виправлення в production навмання
- перед ризиковими діями зробити backup
- орієнтуватися на [ops-runbook.uk.md](/D:/MixProjects/FalconArena/docs/ops-runbook.uk.md)

## 4. Google Sheets export не працює

Симптоми:

- кнопка експорту падає помилкою
- `Last export status` = `failed`
- таблиця не відкривається

Що перевірити:

- `/app/integrations`
- `Google Sheets` webhook URL
- `Test connection`
- `Last export message`

Що робити:

- якщо `Test connection` already fails, проблема в webhook або secret
- якщо `Test connection` green, але export fails, перевірити payload handling на стороні webhook
- перевірити, чи webhook повертає `200 OK`

## 5. Email test / delivery не працює

Симптоми:

- `Send test email` повертає failed
- `Last delivery status` = `failed`
- листи не доходять

Що перевірити:

- `/app/integrations`
- provider
- sender email
- API key
- `Last delivery message`

Що робити:

- для `console` provider перевіряти backend logs
- для `resend` перевірити ключ і sender domain
- спочатку добитися успішного `Send test email`, потім вже перевіряти реальні notification flows

## 6. TEAM не може зареєструвати команду

Симптоми:

- форма не зберігається
- приходить validation error

Що перевірити:

- статус турніру
- registration window
- min/max team members
- чи не досягнуто `max teams`
- чи унікальні email всередині команди

Що робити:

- перевірити defaults у `/app/integrations`
- перевірити статус турніру в `/app/admin`

## 7. JURY не бачить assignments

Симптоми:

- пустий список у `/app/jury`
- не видно submission для оцінювання

Що перевірити:

- чи був виконаний `distribute assignments`
- чи є активний/правильний раунд
- чи користувач справді має роль `JURY`

Що робити:

- повторно перевірити розподіл в `/app/admin`
- перевірити `activity feed` та backend logs

## 8. Leaderboard порожній

Симптоми:

- немає рядків у `/app/leaderboard`
- архів теж порожній по балам

Що перевірити:

- чи є хоча б одне збережене evaluation
- чи завершено evaluation flow
- чи вибраний правильний турнір

Що робити:

- перевірити `JURY` submissions/evaluations
- перевірити `finish evaluation`

## 9. Сертифікати не відкриваються або виглядають порожніми

Що перевірити:

- турнір завершений
- шаблон сертифіката збережений
- для winner certificate команда має `rank = 1`

Що робити:

- перевірити archive/leaderboard
- перевірити шаблон у `/app/archive`

## 10. Що прикладати до технічного розбору

Якщо проблему треба передати на глибший розбір, підготуйте:

- URL сторінки
- роль користувача
- що саме робили крок за кроком
- текст помилки
- `X-Request-Id`, якщо він є у response
- фрагмент backend logs
- commit / deploy, після якого це зламалось
