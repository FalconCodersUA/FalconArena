const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TOURNAMENT_TITLE = 'Star For Life Tech 2026';
const DEMO_DOMAIN = 'star-for-life.demo.falconarena.local';
const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');
const mode = isApply ? 'apply' : 'dry-run';

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

function fixedDate(value) {
  return new Date(`${value}T09:00:00.000Z`);
}

function daysAgo(days, hour = 10) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function userEmail(key) {
  return `${key}@${DEMO_DOMAIN}`;
}

const users = [
  {
    key: 'organizer',
    email: userEmail('organizer'),
    fullName: 'Марія Демченко',
    role: 'ORGANIZER',
  },
  ...[
    'Олена Коваль',
    'Андрій Мельник',
    'Ірина Савчук',
    'Дмитро Романюк',
    'Наталія Гнатюк',
    'Тарас Литвин',
  ].map((fullName, index) => ({
    key: `jury.${index + 1}`,
    email: userEmail(`jury.${index + 1}`),
    fullName,
    role: 'JURY',
  })),
  ...[
    'Артем Лисенко',
    'Софія Шевчук',
    'Максим Бондар',
    'Дарина Кравець',
    'Богдан Ткаченко',
    'Вікторія Мороз',
    'Олексій Руденко',
    'Анна Черненко',
    'Микита Павленко',
    'Катерина Іваненко',
    'Роман Клименко',
    'Юлія Захарова',
    'Назар Кравченко',
    'Леся Бойко',
    'Павло Мороз',
    'Оксана Литвин',
  ].map((fullName, index) => ({
    key: `captain.${index + 1}`,
    email: userEmail(`captain.${index + 1}`),
    fullName,
    role: 'TEAM',
  })),
];

const teams = [
  ['Harbor Bytes', 'Odesa Polytechnic'],
  ['Black Sea Devs', 'ONMU'],
  ['Kernel Crew', 'Hillel Odesa'],
  ['Data Wings', 'KSE'],
  ['Lviv Logic Lab', 'LPNU'],
  ['Dnipro Flow', 'Dnipro Polytechnic'],
  ['Kyiv Product Unit', 'KPI'],
  ['Kharkiv Cloud', 'NURE'],
  ['Vinnytsia Sprint', 'VNTU'],
  ['Chernihiv Signals', 'Polytechnic College'],
  ['Uzhhorod API Team', 'UzhNU'],
  ['Poltava Metrics', 'PNTU'],
  ['Ternopil Stack', 'TNEU'],
  ['Rivne Release', 'NUWEE'],
  ['Zaporizhzhia Core', 'Zaporizhzhia Polytechnic'],
  ['Mykolaiv Builders', 'NUK'],
].map(([name, organization], index) => ({
  name,
  organization,
  captainKey: `captain.${index + 1}`,
  members: 4 + (index % 3),
}));

const rounds = [
  {
    title: 'Discovery та концепція',
    description: 'Команди формують проблему, цільову аудиторію, MVP і перший план перевірки гіпотез.',
    status: 'EVALUATED',
    startsAt: fixedDate('2026-05-01'),
    deadlineAt: fixedDate('2026-05-07'),
    submissions: 'LOCKED',
    evaluatedRatio: 1,
  },
  {
    title: 'Архітектура MVP',
    description: 'Команди описують структуру продукту, основні інтеграції, модель даних і ризики реалізації.',
    status: 'SUBMISSION_CLOSED',
    startsAt: fixedDate('2026-05-08'),
    deadlineAt: fixedDate('2026-05-14'),
    submissions: 'LOCKED',
    evaluatedRatio: 0.45,
  },
  {
    title: 'Активний продуктовий спринт',
    description: 'Команди готують робочий прототип, демонстраційний сценарій і короткий звіт про прогрес.',
    status: 'ACTIVE',
    startsAt: fixedDate('2026-05-15'),
    deadlineAt: fixedDate('2026-05-28'),
    submissions: 'SUBMITTED',
    evaluatedRatio: 0.2,
    draftTail: 4,
  },
  {
    title: 'Інтеграції та дані',
    description: 'Команди підключають зовнішні сервіси, перевіряють якість даних і стабільність ключових сценаріїв.',
    status: 'DRAFT',
    startsAt: fixedDate('2026-06-01'),
    deadlineAt: fixedDate('2026-06-14'),
  },
  {
    title: 'Кабінети ролей',
    description: 'Команди демонструють роботу продукту для різних ролей і пояснюють операційний сценарій.',
    status: 'DRAFT',
    startsAt: fixedDate('2026-06-15'),
    deadlineAt: fixedDate('2026-06-28'),
  },
  {
    title: 'Аналітика та моніторинг',
    description: 'Команди додають метрики, контроль якості, сповіщення і прозорий статус системи.',
    status: 'DRAFT',
    startsAt: fixedDate('2026-07-01'),
    deadlineAt: fixedDate('2026-07-14'),
  },
  {
    title: 'Публічний демо-реліз',
    description: 'Команди готують стабільну демонстраційну версію, опис релізу і матеріали для журі.',
    status: 'DRAFT',
    startsAt: fixedDate('2026-07-15'),
    deadlineAt: fixedDate('2026-07-28'),
  },
  {
    title: 'Фінальне полірування',
    description: 'Команди виправляють критичні зауваження, покращують UX і готують фінальну презентацію.',
    status: 'DRAFT',
    startsAt: fixedDate('2026-08-01'),
    deadlineAt: fixedDate('2026-08-14'),
  },
  {
    title: 'Фінальний захист',
    description: 'Команди здають фінальний пакет матеріалів, презентацію, демо та підсумкову документацію.',
    status: 'DRAFT',
    startsAt: fixedDate('2026-08-17'),
    deadlineAt: fixedDate('2026-08-31'),
  },
];

function memberList(teamName, count) {
  const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return Array.from({ length: count }, (_, index) => ({
    fullName: `Учасник ${index + 1} ${teamName}`,
    email: userEmail(`${slug}.member.${index + 1}`),
  }));
}

function submissionPayload(teamName, roundTitle, index) {
  const slug = `${teamName}-${roundTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    repoUrl: `https://github.com/falconarena-demo/${slug}`,
    demoUrl: `https://youtu.be/star-demo-${index}`,
    liveDemoUrl: `https://demo.falconarena.live/${slug}`,
    shortSummary: `${teamName} підготувала рішення для етапу "${roundTitle}".`,
  };
}

function scorePayload(seed) {
  return {
    technicalBackend: 76 + (seed % 17),
    technicalDatabase: 74 + ((seed + 3) % 18),
    technicalFrontend: 78 + ((seed + 5) % 16),
    mustHave: 80 + ((seed + 7) % 15),
    stability: 73 + ((seed + 11) % 18),
    usability: 77 + ((seed + 13) % 17),
  };
}

function averageScore(scores) {
  const values = Object.values(scores);
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function recentSubmissionDate(roundIndex, teamIndex) {
  if (roundIndex === 0) {
    return daysAgo(6 - (teamIndex % 2), 9 + (teamIndex % 6));
  }

  if (roundIndex === 1) {
    return daysAgo(4 - (teamIndex % 3), 10 + (teamIndex % 5));
  }

  return daysAgo(teamIndex % 3, 11 + (teamIndex % 6));
}

function recentEvaluationDate(roundIndex, teamIndex, juryIndex) {
  const offset = roundIndex === 0 ? 5 - ((teamIndex + juryIndex) % 5) : 2 - ((teamIndex + juryIndex) % 3);
  return daysAgo(Math.max(0, offset), 12 + ((teamIndex + juryIndex) % 7));
}

function weeklyScheduleEvents() {
  const events = [];
  let cursor = fixedDate('2026-05-04');
  let index = 1;
  const end = fixedDate('2026-08-31');

  while (cursor <= end) {
    const weekStart = new Date(cursor);
    events.push({
      title: `Тижневий синк ${index}`,
      description: 'Команди, організатори та ментори синхронізують прогрес, ризики та наступні кроки.',
      type: 'CONSULTATION',
      startsAt: weekStart,
      endsAt: addHours(weekStart, 1),
      location: 'Online',
    });

    if (index % 2 === 0) {
      const reviewDate = addDays(weekStart, 3);
      events.push({
        title: `Огляд прогресу ${index / 2}`,
        description: 'Проміжна перевірка матеріалів, демо та готовності до наступного етапу.',
        type: 'ROUND',
        startsAt: reviewDate,
        endsAt: addHours(reviewDate, 2),
        location: 'Demo room',
      });
    }

    if (index % 3 === 0) {
      const deadlineDate = addDays(weekStart, 5);
      events.push({
        title: `Контрольний дедлайн ${index / 3}`,
        description: 'Фіксація проміжних матеріалів для організаторів і журі.',
        type: 'DEADLINE',
        startsAt: deadlineDate,
        endsAt: null,
        location: null,
      });
    }

    cursor = addDays(cursor, 7);
    index += 1;
  }

  events.push({
    title: 'Фінальний дедлайн Star For Life Tech 2026',
    description: 'Останній день подання фінальних матеріалів, презентацій і демо.',
    type: 'DEADLINE',
    startsAt: fixedDate('2026-08-31'),
    endsAt: null,
    location: null,
  });

  return events;
}

function requireApplyApproval() {
  if (!isDryRun && !isApply) {
    throw new Error('Use --dry-run or --apply.');
  }

  if (isDryRun && isApply) {
    throw new Error('Use only one mode: --dry-run or --apply.');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('Set DATABASE_URL before running this seed script.');
  }

  if (mode !== 'apply') {
    return;
  }

  if (process.env.ALLOW_STAR_FOR_LIFE_SEED !== '1') {
    throw new Error('Set ALLOW_STAR_FOR_LIFE_SEED=1 to run apply mode.');
  }

  if (!process.env.STAR_FOR_LIFE_PASSWORD || process.env.STAR_FOR_LIFE_PASSWORD.length < 12) {
    throw new Error('Set STAR_FOR_LIFE_PASSWORD with at least 12 characters.');
  }
}

async function collectExisting() {
  const tournaments = await prisma.tournament.findMany({
    where: { title: TOURNAMENT_TITLE },
    select: { id: true, title: true },
  });
  const tournamentIds = tournaments.map((item) => item.id);

  const [usersCount, auditLogsCount, notificationsCount] = await Promise.all([
    prisma.user.count({
      where: {
        email: { endsWith: `@${DEMO_DOMAIN}`, mode: 'insensitive' },
      },
    }),
    prisma.auditLog.count({
      where: {
        OR: [
          ...(tournamentIds.length ? [{ tournamentId: { in: tournamentIds } }] : []),
          { entityLabel: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
          { title: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
          { description: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
        ],
      },
    }),
    prisma.notification.count({
      where: {
        OR: [
          { title: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
          { body: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
          ...(tournamentIds.map((id) => ({ linkUrl: { contains: id, mode: 'insensitive' } }))),
        ],
      },
    }),
  ]);

  return {
    tournaments,
    tournamentIds,
    counts: {
      tournaments: tournaments.length,
      users: usersCount,
      auditLogs: auditLogsCount,
      notifications: notificationsCount,
    },
  };
}

function plannedCounts() {
  const submissionRounds = rounds.filter((round) => round.submissions);
  const submissions = submissionRounds.length * teams.length;
  const assignments = submissionRounds.reduce((sum, _round, roundIndex) => (
    sum + teams.reduce((teamSum, _team, teamIndex) => teamSum + (teamIndex % 4 === 0 ? 3 : 2), 0)
  ), 0);
  const evaluations = submissionRounds.reduce((sum, round, roundIndex) => {
    const targetTeams = Math.ceil(teams.length * round.evaluatedRatio);
    return sum + Array.from({ length: targetTeams }, (_, teamIndex) => (
      teamIndex % 4 === 0 ? 3 : 2
    )).reduce((teamSum, value) => teamSum + value, 0);
  }, 0);

  return {
    tournaments: 1,
    users: users.length,
    teams: teams.length,
    teamMembers: teams.reduce((sum, team) => sum + team.members, 0),
    rounds: rounds.length,
    submissions,
    assignments,
    evaluations,
    scheduleEvents: weeklyScheduleEvents().length,
    announcements: 3,
    notifications: 5,
    auditLogs: 12,
  };
}

function printSummary(existing) {
  console.log(`Mode: ${mode}`);
  console.log(`Tournament: ${TOURNAMENT_TITLE}`);
  console.log(`Demo user domain: ${DEMO_DOMAIN}`);
  console.log('Existing scoped data that will be replaced in apply mode:');
  console.table(existing.counts);
  console.log('Planned dataset:');
  console.table(plannedCounts());
}

async function cleanup(existing) {
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { title: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
        { body: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
        ...existing.tournamentIds.map((id) => ({ linkUrl: { contains: id, mode: 'insensitive' } })),
      ],
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        ...(existing.tournamentIds.length ? [{ tournamentId: { in: existing.tournamentIds } }] : []),
        { entityLabel: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
        { title: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
        { description: { contains: TOURNAMENT_TITLE, mode: 'insensitive' } },
      ],
    },
  });

  if (existing.tournamentIds.length > 0) {
    await prisma.tournament.deleteMany({
      where: { id: { in: existing.tournamentIds } },
    });
  }
}

async function createUsers(passwordHash) {
  const entries = new Map();

  for (const user of users) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
        blockedByUserId: null,
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
      },
    });
    entries.set(user.key, saved);
  }

  return entries;
}

async function createTournament(userMap, adminId) {
  const organizer = userMap.get('organizer');
  const tournament = await prisma.tournament.create({
    data: {
      title: TOURNAMENT_TITLE,
      description:
        'Великий демонстраційний турнір для показу повного циклу FalconArena: реєстрації, команд, раундів, сабмітів, оцінювання, графіків активності та фінального захисту.',
      startsAt: fixedDate('2026-05-01'),
      registrationOpenAt: fixedDate('2026-04-01'),
      registrationCloseAt: fixedDate('2026-04-30'),
      maxTeams: 24,
      status: 'RUNNING',
      createdById: adminId ?? organizer.id,
    },
  });

  await prisma.tournamentJury.createMany({
    data: users
      .filter((user) => user.role === 'JURY')
      .map((user) => ({
        tournamentId: tournament.id,
        userId: userMap.get(user.key).id,
      })),
    skipDuplicates: true,
  });

  await prisma.announcement.createMany({
    data: [
      {
        tournamentId: tournament.id,
        title: `${TOURNAMENT_TITLE}: активний продуктовий спринт`,
        body: 'Команди працюють над прототипами, а журі вже бачить призначені роботи та проміжні результати.',
        audience: 'ALL',
        visibility: 'PUBLIC',
        isPinned: true,
        isActive: true,
        createdById: organizer.id,
        publishedAt: daysAgo(2, 9),
      },
      {
        tournamentId: tournament.id,
        title: `${TOURNAMENT_TITLE}: консультації щотижня`,
        body: 'У календарі турніру додані регулярні синки, контрольні дедлайни та проміжні огляди до кінця літа.',
        audience: 'TEAM',
        visibility: 'AUTHENTICATED',
        isPinned: false,
        isActive: true,
        createdById: organizer.id,
        publishedAt: daysAgo(1, 13),
      },
      {
        tournamentId: tournament.id,
        title: `${TOURNAMENT_TITLE}: фокус для журі`,
        body: 'Частина робіт уже оцінена, частина залишається у черзі, щоб показати реальний процес перевірки.',
        audience: 'JURY',
        visibility: 'AUTHENTICATED',
        isPinned: false,
        isActive: true,
        createdById: organizer.id,
        publishedAt: daysAgo(0, 11),
      },
    ],
  });

  await prisma.tournamentScheduleEvent.createMany({
    data: weeklyScheduleEvents().map((event) => ({
      tournamentId: tournament.id,
      ...event,
    })),
  });

  const createdTeams = [];
  for (const teamSpec of teams) {
    const team = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        name: teamSpec.name,
        organization: teamSpec.organization,
        contactHandle: `@${teamSpec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        captainId: userMap.get(teamSpec.captainKey).id,
        createdAt: fixedDate('2026-04-12'),
        members: {
          create: memberList(teamSpec.name, teamSpec.members),
        },
      },
    });
    createdTeams.push(team);
  }

  const createdRounds = [];
  for (const [roundIndex, roundSpec] of rounds.entries()) {
    const round = await prisma.round.create({
      data: {
        tournamentId: tournament.id,
        sequence: roundIndex + 1,
        title: roundSpec.title,
        description: roundSpec.description,
        mustHave: [
          'GitHub repository',
          'Demo video',
          'Short product summary',
          'Responsive user flow',
        ],
        technologyRequirements: [
          'Documented API or data layer',
          'Responsive frontend',
          'Error handling for core flows',
          'Clear launch instructions',
        ],
        additionalMaterials: [
          'README with launch steps',
          'Screenshots or live demo link',
          'Short progress summary',
        ],
        startsAt: roundSpec.startsAt,
        deadlineAt: roundSpec.deadlineAt,
        status: roundSpec.status,
      },
    });
    createdRounds.push(round);

    if (!roundSpec.submissions) {
      continue;
    }

    const evaluatedTeamLimit = Math.ceil(createdTeams.length * roundSpec.evaluatedRatio);
    for (const [teamIndex, team] of createdTeams.entries()) {
      const isDraftTail =
        roundSpec.draftTail && teamIndex >= createdTeams.length - roundSpec.draftTail;
      const submittedAt = isDraftTail ? null : recentSubmissionDate(roundIndex, teamIndex);
      const submission = await prisma.submission.create({
        data: {
          roundId: round.id,
          teamId: team.id,
          ...submissionPayload(team.name, round.title, roundIndex * 100 + teamIndex + 1),
          status: isDraftTail ? 'DRAFT' : roundSpec.submissions,
          submittedAt,
          createdAt: submittedAt ?? daysAgo(teamIndex % 3, 9),
        },
      });

      const assignmentCount = teamIndex % 4 === 0 ? 3 : 2;
      for (let juryIndex = 0; juryIndex < assignmentCount; juryIndex += 1) {
        const juryKey = `jury.${((teamIndex + juryIndex) % 6) + 1}`;
        const assignment = await prisma.evaluationAssignment.create({
          data: {
            roundId: round.id,
            submissionId: submission.id,
            juryId: userMap.get(juryKey).id,
            assignedAt: daysAgo((teamIndex + juryIndex) % 7, 8 + juryIndex),
          },
        });

        if (teamIndex < evaluatedTeamLimit) {
          const scores = scorePayload(roundIndex * 40 + teamIndex * 5 + juryIndex);
          await prisma.evaluation.create({
            data: {
              assignmentId: assignment.id,
              juryId: userMap.get(juryKey).id,
              scores,
              totalScore: averageScore(scores),
              comment: 'Оцінка демонструє роботу кабінету журі, лідерборду та історії активності.',
              createdAt: recentEvaluationDate(roundIndex, teamIndex, juryIndex),
            },
          });
        }
      }
    }
  }

  await createNotifications(tournament, createdRounds);
  await createAuditLogs(tournament, organizer, createdRounds);

  return tournament;
}

async function createNotifications(tournament, createdRounds) {
  const activeRound = createdRounds.find((round) => round.status === 'ACTIVE') ?? createdRounds[0];
  await prisma.notification.createMany({
    data: [
      {
        audience: 'ADMIN',
        type: 'GENERAL',
        title: `${TOURNAMENT_TITLE}: демо-турнір готовий`,
        body: 'Створено команди, раунди, сабміти, оцінки, події календаря та активність для дашбордів.',
        linkUrl: `/app/tournaments/${tournament.id}`,
        createdAt: daysAgo(0, 10),
      },
      {
        audience: 'JURY',
        type: 'ROUND_STARTED',
        title: `${TOURNAMENT_TITLE}: активний раунд відкрито`,
        body: `Раунд "${activeRound.title}" доступний для перегляду призначених робіт.`,
        linkUrl: `/app/tournaments/${tournament.id}`,
        createdAt: daysAgo(1, 15),
      },
      {
        audience: 'TEAM',
        type: 'DEADLINE_REMINDER',
        title: `${TOURNAMENT_TITLE}: нагадування про дедлайн`,
        body: 'До завершення активного спринту залишилось небагато часу. Перевірте матеріали перед поданням.',
        linkUrl: `/app/tournaments/${tournament.id}`,
        createdAt: daysAgo(2, 12),
      },
      {
        audience: 'ORGANIZER',
        type: 'SUBMISSION_RECEIVED',
        title: `${TOURNAMENT_TITLE}: нові сабміти`,
        body: 'Команди активно подають матеріали, а статистика вже доступна на дашборді.',
        linkUrl: `/app/tournaments/${tournament.id}`,
        createdAt: daysAgo(3, 16),
      },
      {
        audience: 'ALL',
        type: 'GENERAL',
        title: `${TOURNAMENT_TITLE}: календар оновлено`,
        body: 'Додано щотижневі консультації, проміжні огляди та дедлайни до 31 серпня 2026 року.',
        linkUrl: `/app/tournaments/${tournament.id}`,
        createdAt: daysAgo(4, 11),
      },
    ],
  });
}

async function createAuditLogs(tournament, organizer, createdRounds) {
  const actions = [
    ['tournament.created', 'Створено демо-турнір', 'Організатор підготував повний цикл турніру для демонстрації.'],
    ['team.created', 'Зареєстровано команди', 'До турніру додано 16 команд з учасниками та капітанами.'],
    ['round.created', 'Додано раунди', 'Раунди охоплюють discovery, MVP, інтеграції, аналітику та фінальний захист.'],
    ['schedule.created', 'Заплановано події', 'Календар містить щотижневі синки та контрольні дедлайни до кінця літа.'],
    ['submission.created', 'Отримано сабміти', 'Команди подали матеріали для оцінювання і перевірки прогресу.'],
    ['evaluation.created', 'Журі виставило оцінки', 'Частина робіт уже перевірена, решта очікує рішення журі.'],
    ['notification.created', 'Надіслано сповіщення', 'Учасники отримали оновлення про активний раунд і дедлайни.'],
    ['leaderboard.updated', 'Оновлено лідерборд', 'Результати оцінювання відображаються у рейтингах турніру.'],
    ['round.started', 'Активний раунд стартував', `Раунд "${createdRounds[2].title}" відкрито для команд.`],
    ['submission.closed', 'Попередній раунд закрито', `Раунд "${createdRounds[1].title}" перейшов до перевірки.`],
    ['dashboard.updated', 'Оновлено дашборд', 'Дані для графіків активності сформовані за останні сім днів.'],
    ['tournament.updated', 'Підготовлено до показу', `${TOURNAMENT_TITLE} готовий для демонстрації журі.`],
  ];

  await prisma.auditLog.createMany({
    data: actions.map(([action, title, description], index) => ({
      actorId: organizer.id,
      actorRole: 'ORGANIZER',
      action,
      entityType: 'TOURNAMENT',
      entityId: tournament.id,
      entityLabel: TOURNAMENT_TITLE,
      tournamentId: tournament.id,
      title,
      description,
      metadata: {
        demo: true,
        tournamentTitle: TOURNAMENT_TITLE,
      },
      createdAt: daysAgo(index % 7, 9 + (index % 8)),
    })),
  });
}

async function createDataset() {
  const passwordHash = await bcrypt.hash(process.env.STAR_FOR_LIFE_PASSWORD, 10);
  const userMap = await createUsers(passwordHash);
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isBlocked: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const tournament = await createTournament(userMap, admin?.id);
  console.log(`Created ${TOURNAMENT_TITLE}: ${tournament.id}`);
  console.log(`Demo users password source: STAR_FOR_LIFE_PASSWORD`);
}

async function main() {
  requireApplyApproval();
  const existing = await collectExisting();
  printSummary(existing);

  if (mode === 'dry-run') {
    console.log('Dry-run complete. No database changes were made.');
    return;
  }

  await cleanup(existing);
  await createDataset();
  console.log('Star For Life demo dataset created.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
