const baseUrl = process.env.BASE_URL ?? 'http://localhost:4000';
const timestamp = Date.now().toString();

const adminEmail = process.env.ADMIN_EMAIL ?? '';
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
const teamEmail = `team_${timestamp}@falconarena.live`;
const juryEmail = `jury_${timestamp}@falconarena.live`;
const userPassword = process.env.TEST_USER_PASSWORD ?? 'StrongPass123!';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function statusOk(actual, expected) {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }

  return actual === expected;
}

function hasTitle(items, titlePart) {
  return Array.isArray(items) && items.some((item) => item.title?.includes(titlePart));
}

async function request(method, path, options = {}) {
  const headers = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const raw = await response.text();
  let payload = raw;
  if (raw.length > 0) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (options.expectedStatus !== undefined && !statusOk(response.status, options.expectedStatus)) {
    throw new Error(
      `${method} ${path} expected status ${JSON.stringify(options.expectedStatus)} but got ${response.status}. Payload: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
    );
  }

  if (options.expectedStatus === undefined && !response.ok) {
    throw new Error(
      `${method} ${path} failed with ${response.status}. Payload: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
    );
  }

  return { status: response.status, payload };
}

async function run() {
  console.log(`Running platform smoke against ${baseUrl}`);

  if (!adminEmail || !adminPassword) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD for smoke script');
  }

  const adminLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: adminEmail, password: adminPassword },
  });
  const adminToken = adminLogin.payload.accessToken;
  assert(adminToken, 'Missing admin token');

  const platformDefaults = await request('GET', '/platform/defaults', {
    expectedStatus: [200, 201],
  });
  assert(platformDefaults.payload?.teamMinMembers >= 2, 'Platform defaults must expose team limits');

  await request('POST', '/auth/admin/users', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      email: teamEmail,
      fullName: 'Team Captain',
      password: userPassword,
      role: 'TEAM',
    },
  });

  await request('POST', '/auth/admin/users', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      email: juryEmail,
      fullName: 'Jury User',
      password: userPassword,
      role: 'JURY',
    },
  });

  const teamLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: teamEmail, password: userPassword },
  });
  const juryLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: juryEmail, password: userPassword },
  });

  const teamToken = teamLogin.payload.accessToken;
  const juryToken = juryLogin.payload.accessToken;

  assert(teamToken, 'Missing team token');
  assert(juryToken, 'Missing jury token');

  const juryMe = await request('GET', '/auth/me', {
    token: juryToken,
    expectedStatus: [200, 201],
  });
  const juryUserId = juryMe.payload.id;
  assert(juryUserId, 'Missing jury user id');

  const createdTournament = await request('POST', '/tournaments', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: `FalconArena Smoke Tournament ${timestamp}`,
      description: 'End-to-end smoke run for demo readiness',
      startsAt: '2028-01-02T09:00:00.000Z',
      registrationOpenAt: '2028-01-01T09:00:00.000Z',
      registrationCloseAt: '2028-01-15T09:00:00.000Z',
      maxTeams: 100,
    },
  });

  const tournamentId = createdTournament.payload.id;
  assert(tournamentId, 'Missing tournamentId');

  const scheduleEvent = await request('POST', `/tournaments/${tournamentId}/schedule`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: 'Opening consultation',
      description: 'Kickoff Q&A for teams',
      type: 'CONSULTATION',
      startsAt: '2028-01-02T12:00:00.000Z',
      endsAt: '2028-01-02T13:00:00.000Z',
      location: 'Discord',
    },
  });
  assert(scheduleEvent.payload.id, 'Missing schedule event id');

  const schedule = await request('GET', `/tournaments/${tournamentId}/schedule`, {
    expectedStatus: [200, 201],
  });
  assert(schedule.payload.length === 1, 'Schedule must contain the created event');

  await request('PATCH', `/tournaments/${tournamentId}/status`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { status: 'REGISTRATION' },
  });

  const adminAnnouncement = await request('POST', '/announcements', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: `Smoke announcement ${timestamp}`,
      body: 'Read the rules before registration and submission.',
      audience: 'ALL',
      isPinned: true,
    },
  });
  assert(adminAnnouncement.payload.id, 'Missing announcement id');

  const teamNotificationsAfterRegistration = await request('GET', '/notifications', {
    token: teamToken,
    expectedStatus: [200, 201],
  });
  assert(
    hasTitle(teamNotificationsAfterRegistration.payload, 'Відкрита реєстрація'),
    'Team must receive registration started notification',
  );

  const teamAnnouncements = await request('GET', '/announcements', {
    token: teamToken,
    expectedStatus: [200, 201],
  });
  assert(
    hasTitle(teamAnnouncements.payload, `Smoke announcement ${timestamp}`),
    'Team must see the announcement',
  );
  const latestAnnouncement = teamAnnouncements.payload.find((item) =>
    item.title?.includes(`Smoke announcement ${timestamp}`),
  );
  assert(latestAnnouncement?.isUnread === true, 'New announcement must be unread');

  await request('PATCH', '/announcements/read-state', {
    token: teamToken,
    expectedStatus: [200, 201],
    body: { publishedAt: latestAnnouncement.publishedAt },
  });

  const teamAnnouncementsAfterRead = await request('GET', '/announcements', {
    token: teamToken,
    expectedStatus: [200, 201],
  });
  const sameAnnouncement = teamAnnouncementsAfterRead.payload.find((item) =>
    item.title?.includes(`Smoke announcement ${timestamp}`),
  );
  assert(sameAnnouncement?.isUnread === false, 'Announcement must become read after markRead');

  const registeredTeam = await request('POST', `/tournaments/${tournamentId}/teams/register`, {
    token: teamToken,
    expectedStatus: [200, 201],
    body: {
      name: `Falcon Team ${timestamp}`,
      organization: 'Falcon School',
      contactHandle: '@falcon_team',
      members: [
        { fullName: 'Member One', email: `member1_${timestamp}@falconarena.live` },
        { fullName: 'Member Two', email: `member2_${timestamp}@falconarena.live` },
      ],
    },
  });
  const teamId = registeredTeam.payload.id;
  assert(teamId, 'Missing teamId');

  const dialog = await request('POST', '/messages/dialogs', {
    token: teamToken,
    expectedStatus: [200, 201],
    body: { recipientEmail: juryEmail },
  });
  const dialogId = dialog.payload.id;
  assert(dialogId, 'Missing dialogId');

  await request('POST', `/messages/dialogs/${dialogId}`, {
    token: teamToken,
    expectedStatus: [200, 201],
    body: { body: 'Hello from smoke test team' },
  });

  const juryDialogsBeforeOpen = await request('GET', '/messages/dialogs', {
    token: juryToken,
    expectedStatus: [200, 201],
  });
  const juryDialogListItem = juryDialogsBeforeOpen.payload.find((item) => item.id === dialogId);
  assert(juryDialogListItem?.isUnread === true, 'Jury dialog must be unread before opening');

  const juryDialog = await request('GET', `/messages/dialogs/${dialogId}`, {
    token: juryToken,
    expectedStatus: [200, 201],
  });
  assert(
    juryDialog.payload.messages.some((message) => message.body === 'Hello from smoke test team'),
    'Dialog messages must include the sent message',
  );

  const juryDialogsAfterOpen = await request('GET', '/messages/dialogs', {
    token: juryToken,
    expectedStatus: [200, 201],
  });
  const juryDialogAfterOpen = juryDialogsAfterOpen.payload.find((item) => item.id === dialogId);
  assert(juryDialogAfterOpen?.isUnread === false, 'Opening a dialog must clear unread state');

  const createdRound = await request('POST', `/tournaments/${tournamentId}/rounds`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: 'Раунд 1',
      description: 'Зберіть і подайте MVP FalconArena.',
      mustHave: ['Auth', 'Team registration', 'Submission form'],
      technologyRequirements: ['React or compatible frontend', 'Backend API', 'Database storage'],
      additionalMaterials: ['https://falconarena.live/app/register'],
      startsAt: '2028-01-16T09:00:00.000Z',
      deadlineAt: '2028-01-17T08:00:00.000Z',
    },
  });

  const roundId = createdRound.payload.id;
  assert(roundId, 'Missing roundId');

  await request('PATCH', `/tournaments/${tournamentId}/rounds/${roundId}/status`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { status: 'ACTIVE' },
  });

  const tournamentAfterActivate = await request('GET', `/tournaments/${tournamentId}`, {
    expectedStatus: [200, 201],
  });
  assert(
    tournamentAfterActivate.payload.status === 'RUNNING',
    'Tournament must be RUNNING after round activation',
  );

  const notificationsAfterRoundStart = await request('GET', '/notifications', {
    token: teamToken,
    expectedStatus: [200, 201],
  });
  assert(
    hasTitle(notificationsAfterRoundStart.payload, 'Стартував раунд'),
    'Team must receive round started notification',
  );

  await request('POST', `/rounds/${roundId}/submissions`, {
    token: teamToken,
    expectedStatus: [200, 201],
    body: {
      repoUrl: 'https://github.com/FalconCodersUA/FalconArena',
      demoUrl: 'https://youtu.be/dQw4w9WgXcQ',
      liveDemoUrl: 'https://falconarena.live',
      shortSummary: 'Smoke test submission',
    },
  });

  const mySubmission = await request('GET', `/rounds/${roundId}/submissions/me`, {
    token: teamToken,
    expectedStatus: [200, 201],
  });
  assert(mySubmission.payload.isEditable === true, 'Submission should be editable during active round');

  const teamNotificationsAfterSubmission = await request('GET', '/notifications', {
    token: teamToken,
    expectedStatus: [200, 201],
  });
  const submissionNotification = teamNotificationsAfterSubmission.payload.find((item) =>
    item.title?.includes('Сабміт збережено'),
  );
  assert(submissionNotification, 'Team must receive submission notification');

  await request('PATCH', '/notifications/read-state', {
    token: teamToken,
    expectedStatus: [200, 201],
    body: { notificationIds: [submissionNotification.id] },
  });

  const teamNotificationsAfterRead = await request('GET', '/notifications', {
    token: teamToken,
    expectedStatus: [200, 201],
  });
  const readSubmissionNotification = teamNotificationsAfterRead.payload.find(
    (item) => item.id === submissionNotification.id,
  );
  assert(readSubmissionNotification?.isUnread === false, 'Notification must become read after markAsRead');

  await request('POST', `/rounds/${roundId}/assignments/distribute`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      minReviewersPerSubmission: 1,
      resetExisting: true,
      juryUserIds: [juryUserId],
    },
  });

  const assignments = await request('GET', `/rounds/${roundId}/assignments/me`, {
    token: juryToken,
    expectedStatus: [200, 201],
  });
  const assignmentId = assignments.payload[0]?.id;
  assert(assignmentId, 'Missing assignmentId');

  await request('POST', `/rounds/${roundId}/assignments/${assignmentId}/evaluation`, {
    token: juryToken,
    expectedStatus: [200, 201],
    body: {
      scores: {
        technicalBackend: 92,
        technicalDatabase: 86,
        technicalFrontend: 84,
        mustHave: 95,
        stability: 88,
        usability: 90,
      },
      comment: 'Solid platform smoke submission',
    },
  });

  await request('POST', `/rounds/${roundId}/finish-evaluation`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { force: true },
  });

  const rounds = await request('GET', `/tournaments/${tournamentId}/rounds`, {
    expectedStatus: [200, 201],
  });
  const currentRound = rounds.payload.find((entry) => entry.id === roundId);
  assert(currentRound?.status === 'EVALUATED', 'Round must be EVALUATED after finish-evaluation');

  const submissionsByRound = await request('GET', `/rounds/${roundId}/submissions`, {
    token: adminToken,
    expectedStatus: [200, 201],
  });
  const submissionStatus = submissionsByRound.payload.submissions?.[0]?.status;
  assert(submissionStatus === 'LOCKED', 'Submission must be LOCKED after finish-evaluation');

  const tournamentAfterFinish = await request('GET', `/tournaments/${tournamentId}`, {
    expectedStatus: [200, 201],
  });
  assert(
    tournamentAfterFinish.payload.status === 'FINISHED',
    'Tournament must be FINISHED when all rounds are evaluated',
  );

  const archive = await request('GET', `/tournaments/${tournamentId}/archive`, {
    expectedStatus: [200, 201],
  });
  assert(archive.payload.summary.teamsCount === 1, 'Archive must include the registered team');
  assert(archive.payload.summary.submissionsCount === 1, 'Archive must include the submission');
  assert(archive.payload.teams[0]?.rank === 1, 'Team must be first in archive leaderboard');

  const leaderboard = await request('GET', `/tournaments/${tournamentId}/leaderboard`, {
    expectedStatus: [200, 201],
  });
  assert(Array.isArray(leaderboard.payload.rows), 'Leaderboard rows must be an array');
  assert(leaderboard.payload.rows[0]?.rank === 1, 'Leaderboard must rank the team first');

  const certificateTemplate = await request('GET', `/tournaments/${tournamentId}/certificate-template`, {
    token: adminToken,
    expectedStatus: [200, 201],
  });
  assert(certificateTemplate.payload.title, 'Certificate template must be available');

  await request('PATCH', `/tournaments/${tournamentId}/certificate-template`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      name: 'Smoke Default Template',
      title: 'Smoke Certificate',
      subtitle: 'Demo ready',
      body: 'Awarded to {{teamName}} for the FalconArena smoke pass.',
      signerName: 'Falcon Admin',
      signerRole: 'Tournament Director',
      accentColor: '#5E17EB',
    },
  });

  const participationCertificate = await request(
    'GET',
    `/tournaments/${tournamentId}/certificates/teams/${teamId}?kind=participation`,
    {
      token: adminToken,
      expectedStatus: [200, 201],
    },
  );
  assert(
    participationCertificate.payload.certificate.kind === 'participation',
    'Participation certificate must be generated',
  );

  const winnerCertificate = await request(
    'GET',
    `/tournaments/${tournamentId}/certificates/teams/${teamId}?kind=winner`,
    {
      token: adminToken,
      expectedStatus: [200, 201],
    },
  );
  assert(
    winnerCertificate.payload.certificate.kind === 'winner',
    'Winner certificate must be generated for the first ranked team',
  );

  const notificationsAfterFinish = await request('GET', '/notifications', {
    token: adminToken,
    expectedStatus: [200, 201],
  });
  const finishNotification = notificationsAfterFinish.payload.find((item) =>
    item.title?.includes('Турнір завершено'),
  );
  assert(finishNotification?.linkUrl?.includes('/app/archive'), 'Finish notification must link to archive');

  console.log('Platform smoke passed');
  console.log(
    JSON.stringify(
      {
        tournamentId,
        roundId,
        teamId,
        dialogId,
        assignmentId,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('Platform smoke failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
