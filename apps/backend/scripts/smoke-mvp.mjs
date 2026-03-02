const baseUrl = process.env.BASE_URL ?? 'http://localhost:4000';
const timestamp = Date.now().toString();

const adminEmail = `admin_${timestamp}@falconarena.live`;
const teamEmail = `team_${timestamp}@falconarena.live`;
const juryEmail = `jury_${timestamp}@falconarena.live`;
const password = 'StrongPass123!';

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
  console.log(`Running MVP smoke against ${baseUrl}`);

  await request('POST', '/auth/register', {
    expectedStatus: [200, 201],
    body: {
      email: adminEmail,
      fullName: 'Admin User',
      password,
      role: 'ADMIN',
    },
  });

  await request('POST', '/auth/register', {
    expectedStatus: [200, 201],
    body: {
      email: teamEmail,
      fullName: 'Team Captain',
      password,
      role: 'TEAM',
    },
  });

  await request('POST', '/auth/register', {
    expectedStatus: [200, 201],
    body: {
      email: juryEmail,
      fullName: 'Jury User',
      password,
      role: 'JURY',
    },
  });

  const adminLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: adminEmail, password },
  });
  const teamLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: teamEmail, password },
  });
  const juryLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: juryEmail, password },
  });

  const adminToken = adminLogin.payload.accessToken;
  const teamToken = teamLogin.payload.accessToken;
  const juryToken = juryLogin.payload.accessToken;

  assert(adminToken, 'Missing admin token');
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
      description: 'MVP API smoke run',
      registrationOpenAt: '2025-01-01T00:00:00.000Z',
      registrationCloseAt: '2030-01-01T00:00:00.000Z',
      maxTeams: 100,
    },
  });

  const tournamentId = createdTournament.payload.id;
  assert(tournamentId, 'Missing tournamentId');

  await request('PATCH', `/tournaments/${tournamentId}/status`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { status: 'REGISTRATION' },
  });

  await request('POST', `/tournaments/${tournamentId}/teams/register`, {
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

  const createdRound = await request('POST', `/tournaments/${tournamentId}/rounds`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: 'Round 1',
      description: 'Build and submit MVP',
      mustHave: ['Auth', 'Team registration', 'Submission form'],
      startsAt: '2025-01-01T00:00:00.000Z',
      deadlineAt: '2030-01-01T00:00:00.000Z',
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
  assert(tournamentAfterActivate.payload.status === 'RUNNING', 'Tournament must be RUNNING after round activation');

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
      comment: 'Solid MVP submission',
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
  assert(tournamentAfterFinish.payload.status === 'FINISHED', 'Tournament must be FINISHED when all rounds are evaluated');

  const leaderboard = await request('GET', `/tournaments/${tournamentId}/leaderboard`, {
    expectedStatus: [200, 201],
  });
  assert(Array.isArray(leaderboard.payload.rows), 'Leaderboard rows must be an array');

  console.log('MVP smoke passed');
  console.log(
    JSON.stringify(
      {
        tournamentId,
        roundId,
        assignmentId,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('MVP smoke failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
