const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEMO_DOMAIN = 'demo.falconarena.local';
const DEFAULT_PASSWORD = 'DemoPass123!';
const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
const cleanupOnly = process.argv.includes('--cleanup-only');

const curatedTournamentTitles = [
  'Kyiv Web Challenge 2026',
  'Dnipro AI Cup 2026',
  'Lviv Product Hackathon 2026',
  'Odesa Code Finals 2026',
];

const oldTournamentTitlePatterns = [
  'FalconArena Smoke',
  'Finish Evaluation',
  'Smoke Tournament',
  'Smoke Test',
  'Demo Tournament',
  'Test Tournament',
  'E2E',
];

const oldNonAdminUserEmailPatterns = [
  'demo',
  'e2e',
  'smoke',
  'test',
];

const oldAdminUserEmailPatterns = [
  'admin_e2e',
];

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

function userEmail(key) {
  return `${key}@${DEMO_DOMAIN}`;
}

function userName(index, role) {
  const names = {
    organizer: ['Марія Демченко'],
    jury: ['Олена Коваль', 'Андрій Мельник', 'Ірина Савчук', 'Дмитро Романюк', 'Наталія Гнатюк'],
    captain: [
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
    ],
  };

  return names[role][index];
}

const demoUsers = [
  {
    key: 'organizer.demo',
    email: userEmail('organizer.demo'),
    fullName: userName(0, 'organizer'),
    role: 'ORGANIZER',
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    key: `jury.${index + 1}`,
    email: userEmail(`jury.${index + 1}`),
    fullName: userName(index, 'jury'),
    role: 'JURY',
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    key: `captain.${index + 1}`,
    email: userEmail(`captain.${index + 1}`),
    fullName: userName(index, 'captain'),
    role: 'TEAM',
  })),
];

function memberList(teamKey, count) {
  return Array.from({ length: count }, (_, index) => ({
    fullName: `Учасник ${index + 1} ${teamKey}`,
    email: userEmail(`${teamKey}.member.${index + 1}`),
  }));
}

function submissionPayload(teamName, roundTitle, index) {
  const slug = `${teamName}-${roundTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    repoUrl: `https://github.com/falconarena-demo/${slug}`,
    demoUrl: `https://youtu.be/demo-${index}`,
    liveDemoUrl: `https://demo.falconarena.local/${slug}`,
    shortSummary: `${teamName} demo submission for ${roundTitle}.`,
  };
}

function scorePayload(seed) {
  return {
    technicalBackend: 72 + (seed % 19),
    technicalDatabase: 70 + ((seed + 3) % 18),
    technicalFrontend: 74 + ((seed + 5) % 17),
    mustHave: 76 + ((seed + 7) % 16),
    stability: 71 + ((seed + 11) % 19),
    usability: 73 + ((seed + 13) % 18),
  };
}

function averageScore(scores) {
  const values = Object.values(scores);
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function buildDemoSpec(now) {
  return [
    {
      title: 'Kyiv Web Challenge 2026',
      description: 'Демо-турнір у статусі чернетки для перевірки підготовки правил і раундів.',
      status: 'DRAFT',
      startsAt: addDays(now, 28),
      registrationOpenAt: addDays(now, 4),
      registrationCloseAt: addDays(now, 18),
      maxTeams: 8,
      juryKeys: ['jury.1', 'jury.2'],
      teams: [],
      rounds: [
        {
          title: 'Landing MVP',
          description: 'Підготуйте концепцію командного вебпродукту та план реалізації.',
          status: 'DRAFT',
          startsAt: addDays(now, 29),
          deadlineAt: addDays(now, 31),
        },
      ],
    },
    {
      title: 'Dnipro AI Cup 2026',
      description: 'Демо-турнір у реєстрації з відкритим набором команд.',
      status: 'REGISTRATION',
      startsAt: addDays(now, 12),
      registrationOpenAt: addDays(now, -2),
      registrationCloseAt: addDays(now, 8),
      maxTeams: 6,
      juryKeys: ['jury.1', 'jury.3'],
      teams: [
        { name: 'Vector Lab', captainKey: 'captain.1', organization: 'Dnipro Polytechnic', members: 3 },
        { name: 'Prompt Crew', captainKey: 'captain.2', organization: 'IT Step Dnipro', members: 4 },
        { name: 'Neural Sparks', captainKey: 'captain.3', organization: 'School 23', members: 3 },
      ],
      rounds: [
        {
          title: 'AI Assistant Prototype',
          description: 'Створіть прототип асистента для підтримки студентських команд.',
          status: 'DRAFT',
          startsAt: addDays(now, 13),
          deadlineAt: addDays(now, 15),
        },
      ],
    },
    {
      title: 'Lviv Product Hackathon 2026',
      description: 'Активний турнір з командами, сабмітами та призначеннями журі.',
      status: 'RUNNING',
      startsAt: addDays(now, -1),
      registrationOpenAt: addDays(now, -18),
      registrationCloseAt: addDays(now, -3),
      maxTeams: 10,
      juryKeys: ['jury.2', 'jury.4', 'jury.5'],
      teams: [
        { name: 'Product Owls', captainKey: 'captain.4', organization: 'Lviv IT Cluster', members: 4 },
        { name: 'Sprint Forge', captainKey: 'captain.5', organization: 'UCU', members: 5 },
        { name: 'Metric Minds', captainKey: 'captain.6', organization: 'LPNU', members: 4 },
        { name: 'Release Radar', captainKey: 'captain.7', organization: 'SoftServe Academy', members: 3 },
      ],
      rounds: [
        {
          title: 'Product Discovery',
          description: 'Опишіть проблему, користувачів, MVP і перші метрики успіху.',
          status: 'SUBMISSION_CLOSED',
          startsAt: addDays(now, -2),
          deadlineAt: addDays(now, -1),
          submissions: 'LOCKED',
          assignmentJuryKeys: ['jury.2', 'jury.4'],
          evaluatedTeamIndexes: [0, 1],
        },
        {
          title: 'Build Sprint',
          description: 'Реалізуйте працюючий прототип з демо та репозиторієм.',
          status: 'ACTIVE',
          startsAt: addHours(now, -12),
          deadlineAt: addDays(now, 2),
          submissions: 'SUBMITTED',
        },
      ],
    },
    {
      title: 'Odesa Code Finals 2026',
      description: 'Завершений демо-турнір з оцінками, лідербордом та архівом.',
      status: 'FINISHED',
      startsAt: addDays(now, -20),
      registrationOpenAt: addDays(now, -40),
      registrationCloseAt: addDays(now, -25),
      maxTeams: 12,
      juryKeys: ['jury.1', 'jury.2', 'jury.3', 'jury.5'],
      teams: [
        { name: 'Harbor Bytes', captainKey: 'captain.8', organization: 'Odesa Polytechnic', members: 4 },
        { name: 'Black Sea Devs', captainKey: 'captain.9', organization: 'ONMU', members: 5 },
        { name: 'Kernel Crew', captainKey: 'captain.10', organization: 'Hillel Odesa', members: 4 },
        { name: 'Data Pier', captainKey: 'captain.11', organization: 'Mate Academy', members: 3 },
        { name: 'Wave Coders', captainKey: 'captain.12', organization: 'School 7', members: 4 },
      ],
      rounds: [
        {
          title: 'Backend Reliability',
          description: 'Побудуйте API з логуванням, валідацією та стійкою обробкою помилок.',
          status: 'EVALUATED',
          startsAt: addDays(now, -19),
          deadlineAt: addDays(now, -17),
          submissions: 'LOCKED',
          assignmentJuryKeys: ['jury.1', 'jury.2'],
          evaluatedTeamIndexes: [0, 1, 2, 3, 4],
        },
        {
          title: 'Final Demo',
          description: 'Покажіть повний сценарій продукту та фінальну презентацію.',
          status: 'EVALUATED',
          startsAt: addDays(now, -16),
          deadlineAt: addDays(now, -14),
          submissions: 'LOCKED',
          assignmentJuryKeys: ['jury.3', 'jury.5'],
          evaluatedTeamIndexes: [0, 1, 2, 3, 4],
        },
      ],
    },
  ];
}

async function collectCleanupCandidates() {
  const curatedUsers = demoUsers.map((user) => user.email);
  const nonAdminUserFilters = [
    ...(!cleanupOnly
      ? [
          { email: { in: curatedUsers } },
          { email: { endsWith: `@${DEMO_DOMAIN}`, mode: 'insensitive' } },
        ]
      : []),
    ...oldNonAdminUserEmailPatterns
      .filter((pattern) => !cleanupOnly || pattern !== 'demo')
      .map((pattern) => ({
        email: { contains: pattern, mode: 'insensitive' },
      })),
  ];

  const oldTournaments = await prisma.tournament.findMany({
    where: {
      OR: oldTournamentTitlePatterns.map((pattern) => ({
        title: { contains: pattern, mode: 'insensitive' },
      })),
    },
    select: { id: true, title: true },
  });

  const curatedTournaments = cleanupOnly
    ? []
    : await prisma.tournament.findMany({
        where: { title: { in: curatedTournamentTitles } },
        select: { id: true, title: true },
      });

  const oldUsers = await prisma.user.findMany({
    where: {
      OR: [
        {
          role: { not: 'ADMIN' },
          OR: nonAdminUserFilters,
        },
        {
          role: 'ADMIN',
          OR: oldAdminUserEmailPatterns.map((pattern) => ({
            email: { contains: pattern, mode: 'insensitive' },
          })),
        },
      ],
    },
    select: { id: true, email: true, role: true },
  });

  const userIds = oldUsers.map((user) => user.id);
  const [captainTeams, createdTournaments] = userIds.length > 0
    ? await Promise.all([
        prisma.team.findMany({
          where: { captainId: { in: userIds } },
          select: {
            tournament: {
              select: { id: true, title: true },
            },
          },
        }),
        prisma.tournament.findMany({
          where: { createdById: { in: userIds } },
          select: { id: true, title: true },
        }),
      ])
    : [[], []];
  const captainTournaments = captainTeams.map((team) => team.tournament);
  const tournamentIds = [
    ...new Set(
      [
        ...oldTournaments,
        ...curatedTournaments,
        ...captainTournaments,
        ...createdTournaments,
      ].map((item) => item.id),
    ),
  ];

  const [
    teamsCount,
    roundsCount,
    submissionsCount,
    assignmentsCount,
    evaluationsCount,
    announcementsCount,
    scheduleCount,
    juryAssignmentsForUsers,
  ] = await Promise.all([
    prisma.team.count({ where: { tournamentId: { in: tournamentIds } } }),
    prisma.round.count({ where: { tournamentId: { in: tournamentIds } } }),
    prisma.submission.count({ where: { round: { tournamentId: { in: tournamentIds } } } }),
    prisma.evaluationAssignment.count({ where: { round: { tournamentId: { in: tournamentIds } } } }),
    prisma.evaluation.count({ where: { assignment: { round: { tournamentId: { in: tournamentIds } } } } }),
    prisma.announcement.count({ where: { tournamentId: { in: tournamentIds } } }),
    prisma.tournamentScheduleEvent.count({ where: { tournamentId: { in: tournamentIds } } }),
    prisma.evaluationAssignment.count({ where: { juryId: { in: userIds } } }),
  ]);

  return {
    oldTournaments,
    curatedTournaments,
    captainTournaments,
    createdTournaments,
    oldUsers,
    tournamentIds,
    userIds,
    counts: {
      tournaments: tournamentIds.length,
      users: oldUsers.length,
      teams: teamsCount,
      rounds: roundsCount,
      submissions: submissionsCount,
      assignments: assignmentsCount,
      evaluations: evaluationsCount,
      announcements: announcementsCount,
      scheduleEvents: scheduleCount,
      teamMembershipsForUsers: captainTeams.length,
      createdTournamentsForUsers: createdTournaments.length,
      juryAssignmentsForUsers,
    },
  };
}

function printSummary(candidates) {
  console.log(`Mode: ${mode}`);
  console.log(`Cleanup only: ${cleanupOnly ? 'yes' : 'no'}`);
  console.log('Cleanup candidates:');
  console.table(candidates.counts);

  if (
    candidates.oldTournaments.length > 0 ||
    candidates.curatedTournaments.length > 0 ||
    candidates.captainTournaments.length > 0
  ) {
    const tournamentCandidates = [
      ...new Map(
        [
          ...candidates.oldTournaments,
          ...candidates.curatedTournaments,
          ...candidates.captainTournaments,
          ...candidates.createdTournaments,
        ].map((item) => [item.id, item]),
      ).values(),
    ];
    console.log('Tournament candidates:');
    console.table(tournamentCandidates.map((item) => ({
      id: item.id,
      title: item.title,
    })));
  }

  if (candidates.oldUsers.length > 0) {
    console.log('User candidates:');
    console.table(candidates.oldUsers.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
    })));
  }

  if (!cleanupOnly) {
    console.log('Curated demo dataset to create:');
    console.table(curatedTournamentTitles.map((title) => ({ title })));
    console.log(`Demo user domain: ${DEMO_DOMAIN}`);
  }
}

async function cleanup(candidates) {
  if (candidates.tournamentIds.length > 0) {
    await prisma.tournament.deleteMany({
      where: { id: { in: candidates.tournamentIds } },
    });
  }

  if (candidates.userIds.length > 0) {
    const remainingCaptainTeams = await prisma.team.findMany({
      where: { captainId: { in: candidates.userIds } },
      select: { tournamentId: true },
    });
    const remainingTournamentIds = [...new Set(remainingCaptainTeams.map((team) => team.tournamentId))];

    if (remainingTournamentIds.length > 0) {
      await prisma.tournament.deleteMany({
        where: { id: { in: remainingTournamentIds } },
      });
    }

    await prisma.user.deleteMany({
      where: {
        id: { in: candidates.userIds },
      },
    });
  }
}

async function createDemoUsers(passwordHash) {
  const entries = new Map();

  for (const user of demoUsers) {
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

async function createTournament(spec, users, adminId) {
  const tournament = await prisma.tournament.create({
    data: {
      title: spec.title,
      description: spec.description,
      startsAt: spec.startsAt,
      registrationOpenAt: spec.registrationOpenAt,
      registrationCloseAt: spec.registrationCloseAt,
      maxTeams: spec.maxTeams,
      status: spec.status,
      createdById: adminId ?? users.get('organizer.demo').id,
    },
  });

  await prisma.tournamentJury.createMany({
    data: spec.juryKeys.map((key) => ({
      tournamentId: tournament.id,
      userId: users.get(key).id,
    })),
    skipDuplicates: true,
  });

  await prisma.announcement.create({
    data: {
      tournamentId: tournament.id,
      title: `${spec.title}: операційне оновлення`,
      body: 'Демо-оголошення показує, як організатор комунікує з учасниками турніру.',
      audience: 'ALL',
      visibility: spec.status === 'DRAFT' ? 'AUTHENTICATED' : 'PUBLIC',
      isPinned: spec.status === 'REGISTRATION' || spec.status === 'RUNNING',
      isActive: true,
      createdById: users.get('organizer.demo').id,
    },
  });

  await prisma.tournamentScheduleEvent.createMany({
    data: [
      {
        tournamentId: tournament.id,
        title: 'Відкриття турніру',
        description: 'Публічний старт та короткий брифінг для команд.',
        type: 'ANNOUNCEMENT',
        startsAt: spec.startsAt ?? spec.registrationOpenAt,
        endsAt: spec.startsAt ? addHours(spec.startsAt, 1) : null,
        location: 'Online',
      },
      {
        tournamentId: tournament.id,
        title: 'Фінальний дедлайн',
        description: 'Контрольна точка для здачі робіт або завершення оцінювання.',
        type: 'DEADLINE',
        startsAt: spec.rounds[spec.rounds.length - 1].deadlineAt,
        endsAt: null,
        location: null,
      },
    ],
  });

  const teams = [];
  for (const teamSpec of spec.teams) {
    const team = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        name: teamSpec.name,
        organization: teamSpec.organization,
        contactHandle: `@${teamSpec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        captainId: users.get(teamSpec.captainKey).id,
        members: {
          create: memberList(teamSpec.name.replace(/\s+/g, '').toLowerCase(), teamSpec.members),
        },
      },
    });
    teams.push({ ...team, spec: teamSpec });
  }

  for (const [roundIndex, roundSpec] of spec.rounds.entries()) {
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
        ],
        technologyRequirements: [
          'API or documented data layer',
          'Responsive frontend',
          'Error handling for core flows',
        ],
        additionalMaterials: [
          'README with launch steps',
          'Screenshots or live demo link',
        ],
        startsAt: roundSpec.startsAt,
        deadlineAt: roundSpec.deadlineAt,
        status: roundSpec.status,
      },
    });

    if (!roundSpec.submissions) {
      continue;
    }

    for (const [teamIndex, team] of teams.entries()) {
      const submission = await prisma.submission.create({
        data: {
          roundId: round.id,
          teamId: team.id,
          ...submissionPayload(team.name, round.title, teamIndex + 1),
          status: roundSpec.submissions,
          submittedAt: addHours(round.deadlineAt, -4 - teamIndex),
        },
      });

      const juryKeys = roundSpec.assignmentJuryKeys ?? spec.juryKeys.slice(0, 2);
      for (const [juryIndex, juryKey] of juryKeys.entries()) {
        const assignment = await prisma.evaluationAssignment.create({
          data: {
            roundId: round.id,
            submissionId: submission.id,
            juryId: users.get(juryKey).id,
          },
        });

        const shouldEvaluate =
          roundSpec.status === 'EVALUATED' ||
          (roundSpec.evaluatedTeamIndexes ?? []).includes(teamIndex);
        if (shouldEvaluate) {
          const scores = scorePayload((roundIndex + 1) * 10 + teamIndex * 3 + juryIndex);
          await prisma.evaluation.create({
            data: {
              assignmentId: assignment.id,
              juryId: users.get(juryKey).id,
              scores,
              totalScore: averageScore(scores),
              comment: 'Демо-оцінка для перевірки роботи журі та лідерборду.',
            },
          });
        }
      }
    }
  }

  return tournament;
}

async function createDemoDataset() {
  const now = new Date();
  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || DEFAULT_PASSWORD, 10);
  const users = await createDemoUsers(passwordHash);
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isBlocked: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const spec = buildDemoSpec(now);
  for (const tournamentSpec of spec) {
    await createTournament(tournamentSpec, users, admin?.id);
  }

  console.log(`Demo dataset created. Demo password: ${process.env.DEMO_PASSWORD || DEFAULT_PASSWORD}`);
}

async function main() {
  if (!process.argv.includes('--dry-run') && !process.argv.includes('--apply')) {
    throw new Error('Use --dry-run or --apply.');
  }

  const candidates = await collectCleanupCandidates();
  printSummary(candidates);

  if (mode === 'dry-run') {
    console.log('Dry-run complete. No database changes were made.');
    return;
  }

  await cleanup(candidates);

  if (cleanupOnly) {
    console.log('Cleanup complete. Curated demo dataset was left unchanged.');
    return;
  }

  await createDemoDataset();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
