const baseUrl = process.env.BASE_URL ?? 'http://localhost:4000';
const timestamp = Date.now().toString();

const adminEmail = process.env.ADMIN_EMAIL ?? '';
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
const teamEmail = `team_flow_${timestamp}@falconarena.live`;
const juryEmail = `jury_flow_${timestamp}@falconarena.live`;
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
      `${method} ${path} expected status ${JSON.stringify(options.expectedStatus)} but got ${response.status}. Payload: ${
        typeof payload === 'string' ? payload : JSON.stringify(payload)
      }`,
    );
  }

  if (options.expectedStatus === undefined && !response.ok) {
    throw new Error(
      `${method} ${path} failed with ${response.status}. Payload: ${
        typeof payload === 'string' ? payload : JSON.stringify(payload)
      }`,
    );
  }

  return { status: response.status, payload, headers: response.headers };
}

async function loginAsAdmin() {
  if (!adminEmail || !adminPassword) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD for e2e script');
  }

  const login = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: adminEmail, password: adminPassword },
  });

  assert(login.payload.accessToken, 'Missing admin token');
  return login.payload.accessToken;
}

async function createManagedUser(adminToken, email, fullName, role) {
  await request('POST', '/auth/admin/users', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      email,
      fullName,
      password: userPassword,
      role,
    },
  });
}

async function login(email) {
  const response = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email, password: userPassword },
  });

  assert(response.payload.accessToken, `Missing access token for ${email}`);
  return response.payload.accessToken;
}

async function run() {
  console.log(`Running admin-team-jury-leaderboard e2e against ${baseUrl}`);

  const adminToken = await loginAsAdmin();
  await createManagedUser(adminToken, teamEmail, 'Leaderboard Team Captain', 'TEAM');
  await createManagedUser(adminToken, juryEmail, 'Leaderboard Jury User', 'JURY');

  const teamToken = await login(teamEmail);
  const juryToken = await login(juryEmail);

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
      title: `Leaderboard Flow ${timestamp}`,
      description: 'Focused end-to-end leaderboard verification flow',
      startsAt: '2028-02-10T09:00:00.000Z',
      registrationOpenAt: '2028-02-01T09:00:00.000Z',
      registrationCloseAt: '2028-02-09T09:00:00.000Z',
      maxTeams: 50,
    },
  });
  const tournamentId = createdTournament.payload.id;
  assert(tournamentId, 'Missing tournament id');

  await request('PATCH', `/tournaments/${tournamentId}/status`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { status: 'REGISTRATION' },
  });

  const registeredTeam = await request('POST', `/tournaments/${tournamentId}/teams/register`, {
    token: teamToken,
    expectedStatus: [200, 201],
    body: {
      name: `Flow Team ${timestamp}`,
      organization: 'Falcon QA',
      contactHandle: '@flow-team',
      members: [
        { fullName: 'Flow Member One', email: `flow_member_1_${timestamp}@falconarena.live` },
        { fullName: 'Flow Member Two', email: `flow_member_2_${timestamp}@falconarena.live` },
      ],
    },
  });
  const teamId = registeredTeam.payload.id;
  assert(teamId, 'Missing team id');

  const createdRound = await request('POST', `/tournaments/${tournamentId}/rounds`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: 'Leaderboard Round',
      description: 'Scenario for admin-team-jury leaderboard verification',
      mustHave: ['Authentication', 'Team registration', 'Leaderboard'],
      technologyRequirements: ['React frontend', 'Nest backend', 'PostgreSQL'],
      additionalMaterials: ['https://falconarena.live/app/leaderboard'],
      startsAt: '2028-02-10T10:00:00.000Z',
      deadlineAt: '2028-02-11T10:00:00.000Z',
    },
  });
  const roundId = createdRound.payload.id;
  assert(roundId, 'Missing round id');

  await request('PATCH', `/tournaments/${tournamentId}/rounds/${roundId}/status`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { status: 'ACTIVE' },
  });

  await request('POST', `/rounds/${roundId}/submissions`, {
    token: teamToken,
    expectedStatus: [200, 201],
    body: {
      repoUrl: 'https://github.com/FalconCodersUA/FalconArena',
      demoUrl: 'https://youtu.be/dQw4w9WgXcQ',
      liveDemoUrl: 'https://falconarena.live',
      shortSummary: 'Leaderboard flow submission',
    },
  });

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
  assert(assignmentId, 'Missing assignment id');

  const evaluationScores = {
    technicalBackend: 91,
    technicalDatabase: 86,
    technicalFrontend: 88,
    mustHave: 94,
    stability: 89,
    usability: 92,
  };
  const expectedAverageScore = Number(
    (
      Object.values(evaluationScores).reduce((total, current) => total + current, 0) /
      Object.values(evaluationScores).length
    ).toFixed(2),
  );

  await request('POST', `/rounds/${roundId}/assignments/${assignmentId}/evaluation`, {
    token: juryToken,
    expectedStatus: [200, 201],
    body: {
      scores: evaluationScores,
      comment: 'Leaderboard flow evaluation',
    },
  });

  await request('POST', `/rounds/${roundId}/finish-evaluation`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { force: false },
  });

  const leaderboard = await request('GET', `/tournaments/${tournamentId}/leaderboard`, {
    expectedStatus: [200, 201],
  });
  const topRow = leaderboard.payload.rows?.[0];
  assert(topRow, 'Leaderboard must contain at least one row');
  assert(topRow.teamId === teamId, 'Registered team must appear as first row');
  assert(topRow.rank === 1, 'Registered team must have rank 1');
  assert(
    topRow.averageScore === expectedAverageScore,
    `Average score mismatch. Expected ${expectedAverageScore}, got ${topRow.averageScore}`,
  );
  assert(
    topRow.totalScore === expectedAverageScore,
    `Total score mismatch. Expected ${expectedAverageScore}, got ${topRow.totalScore}`,
  );
  assert(
    topRow.rounds?.[0]?.averageScore === expectedAverageScore,
    'Round average score must match the submitted jury evaluation',
  );

  const csvExport = await request(
    'GET',
    `/tournaments/${tournamentId}/leaderboard/export.csv`,
    { expectedStatus: [200, 201] },
  );
  assert(
    csvExport.headers.get('content-type')?.includes('text/csv'),
    'CSV export must return text/csv content type',
  );
  assert(
    typeof csvExport.payload === 'string' &&
      csvExport.payload.includes('rank,teamName,organization,totalScore'),
    'CSV export must contain leaderboard header row',
  );
  assert(
    typeof csvExport.payload === 'string' && csvExport.payload.includes(`Flow Team ${timestamp}`),
    'CSV export must contain the registered team row',
  );

  const teamNotifications = await request('GET', '/notifications', {
    token: teamToken,
    expectedStatus: [200, 201],
  });
  assert(
    teamNotifications.payload.some((entry) => entry.title?.includes('Сабміт збережено')),
    'Team must receive submission notification during the e2e flow',
  );

  console.log('Admin-team-jury-leaderboard e2e passed');
  console.log(
    JSON.stringify(
      {
        tournamentId,
        roundId,
        teamId,
        assignmentId,
        expectedAverageScore,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('Admin-team-jury-leaderboard e2e failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
