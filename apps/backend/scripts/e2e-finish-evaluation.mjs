const baseUrl = process.env.BASE_URL ?? 'http://localhost:4000';
const timestamp = Date.now().toString();

const adminEmail = process.env.ADMIN_EMAIL ?? '';
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
const teamEmail = `team_e2e_${timestamp}@falconarena.live`;
const juryEmail = `jury_e2e_${timestamp}@falconarena.live`;
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

async function createCoreUsers() {
  if (!adminEmail || !adminPassword) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD for e2e script');
  }

  const adminLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: adminEmail, password: adminPassword },
  });

  const adminToken = adminLogin.payload.accessToken;
  assert(adminToken, 'Missing admin token');

  await request('POST', '/auth/admin/users', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      email: teamEmail,
      fullName: 'Team E2E',
      password: userPassword,
      role: 'TEAM',
    },
  });

  await request('POST', '/auth/admin/users', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      email: juryEmail,
      fullName: 'Jury E2E',
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

  const juryToken = juryLogin.payload.accessToken;
  const juryMe = await request('GET', '/auth/me', {
    token: juryToken,
    expectedStatus: [200, 201],
  });

  return {
    adminToken,
    teamToken: teamLogin.payload.accessToken,
    juryToken,
    juryUserId: juryMe.payload.id,
  };
}

async function createTournamentAndTeam(adminToken, teamToken, suffix) {
  const createdTournament = await request('POST', '/tournaments', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: `Finish Evaluation E2E ${suffix}`,
      description: `Status transitions ${suffix}`,
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
      name: `Team ${suffix}`,
      organization: 'Falcon School',
      contactHandle: '@falcon',
      members: [
        { fullName: `Member One ${suffix}`, email: `member1_${suffix}@falconarena.live` },
        { fullName: `Member Two ${suffix}`, email: `member2_${suffix}@falconarena.live` },
      ],
    },
  });

  return tournamentId;
}

async function createRound(adminToken, tournamentId, title) {
  const createdRound = await request('POST', `/tournaments/${tournamentId}/rounds`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title,
      description: `Description for ${title}`,
      mustHave: ['Auth', 'Submission'],
      startsAt: '2025-01-01T00:00:00.000Z',
      deadlineAt: '2030-01-01T00:00:00.000Z',
    },
  });

  const roundId = createdRound.payload.id;
  assert(roundId, 'Missing roundId');
  return roundId;
}

async function activateRound(adminToken, tournamentId, roundId) {
  await request('PATCH', `/tournaments/${tournamentId}/rounds/${roundId}/status`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { status: 'ACTIVE' },
  });
}

async function submitProject(teamToken, roundId, suffix) {
  await request('POST', `/rounds/${roundId}/submissions`, {
    token: teamToken,
    expectedStatus: [200, 201],
    body: {
      repoUrl: `https://github.com/FalconCodersUA/FalconArena-${suffix}`,
      demoUrl: 'https://youtu.be/dQw4w9WgXcQ',
      liveDemoUrl: 'https://falconarena.live',
      shortSummary: `Submission ${suffix}`,
    },
  });
}

async function distributeAssignments(adminToken, roundId, juryUserId) {
  await request('POST', `/rounds/${roundId}/assignments/distribute`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      minReviewersPerSubmission: 1,
      resetExisting: true,
      juryUserIds: [juryUserId],
    },
  });
}

async function submitJuryEvaluation(juryToken, roundId, scoreSeed) {
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
        technicalBackend: 80 + scoreSeed,
        technicalDatabase: 81 + scoreSeed,
        technicalFrontend: 82 + scoreSeed,
        mustHave: 83 + scoreSeed,
        stability: 84 + scoreSeed,
        usability: 85 + scoreSeed,
      },
      comment: `Evaluation ${scoreSeed}`,
    },
  });
}

async function run() {
  console.log(`Running finish-evaluation e2e against ${baseUrl}`);

  const { adminToken, teamToken, juryToken, juryUserId } = await createCoreUsers();
  assert(adminToken && teamToken && juryToken && juryUserId, 'Missing one of auth values');

  const tournamentA = await createTournamentAndTeam(adminToken, teamToken, `A_${timestamp}`);
  const roundA = await createRound(adminToken, tournamentA, 'Round A');

  await activateRound(adminToken, tournamentA, roundA);
  await submitProject(teamToken, roundA, `A_${timestamp}`);
  await distributeAssignments(adminToken, roundA, juryUserId);

  await request('POST', `/rounds/${roundA}/finish-evaluation`, {
    token: adminToken,
    expectedStatus: 400,
    body: { force: false },
  });

  const forcedFinish = await request('POST', `/rounds/${roundA}/finish-evaluation`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { force: true },
  });

  assert(forcedFinish.payload.roundStatus === 'EVALUATED', 'Round A should be EVALUATED after force finish');

  const submissionsA = await request('GET', `/rounds/${roundA}/submissions`, {
    token: adminToken,
    expectedStatus: [200, 201],
  });
  assert(submissionsA.payload.submissions?.[0]?.status === 'LOCKED', 'Round A submission should be LOCKED after force finish');

  const tournamentB = await createTournamentAndTeam(adminToken, teamToken, `B_${timestamp}`);
  const roundB1 = await createRound(adminToken, tournamentB, 'Round B1');
  const roundB2 = await createRound(adminToken, tournamentB, 'Round B2');

  await activateRound(adminToken, tournamentB, roundB1);
  await submitProject(teamToken, roundB1, `B1_${timestamp}`);
  await distributeAssignments(adminToken, roundB1, juryUserId);
  await submitJuryEvaluation(juryToken, roundB1, 1);

  await request('PATCH', `/tournaments/${tournamentB}/rounds/${roundB1}/status`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { status: 'SUBMISSION_CLOSED' },
  });

  await request('POST', `/rounds/${roundB1}/finish-evaluation`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { force: false },
  });

  const tournamentAfterFirstRound = await request('GET', `/tournaments/${tournamentB}`, {
    expectedStatus: [200, 201],
  });
  assert(tournamentAfterFirstRound.payload.status === 'RUNNING', 'Tournament B should stay RUNNING after first evaluated round');

  await activateRound(adminToken, tournamentB, roundB2);
  await submitProject(teamToken, roundB2, `B2_${timestamp}`);
  await distributeAssignments(adminToken, roundB2, juryUserId);
  await submitJuryEvaluation(juryToken, roundB2, 2);

  await request('PATCH', `/tournaments/${tournamentB}/rounds/${roundB2}/status`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { status: 'SUBMISSION_CLOSED' },
  });

  await request('POST', `/rounds/${roundB2}/finish-evaluation`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { force: false },
  });

  const tournamentAfterSecondRound = await request('GET', `/tournaments/${tournamentB}`, {
    expectedStatus: [200, 201],
  });
  assert(tournamentAfterSecondRound.payload.status === 'FINISHED', 'Tournament B should be FINISHED after all rounds are evaluated');

  console.log('Finish-evaluation e2e passed');
  console.log(
    JSON.stringify(
      {
        tournamentA,
        roundA,
        tournamentB,
        roundB1,
        roundB2,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('Finish-evaluation e2e failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
