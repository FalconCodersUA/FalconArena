const baseUrl = process.env.BASE_URL ?? 'http://localhost:4000';
const timestamp = Date.now().toString();

const adminEmail = process.env.ADMIN_EMAIL ?? '';
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
const teamEmail = `archive_team_${timestamp}@falconarena.live`;
const juryEmail = `archive_jury_${timestamp}@falconarena.live`;
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
  console.log(`Running archive-certificate-export e2e against ${baseUrl}`);

  const adminToken = await loginAsAdmin();
  await createManagedUser(adminToken, teamEmail, 'Archive Flow Team Captain', 'TEAM');
  await createManagedUser(adminToken, juryEmail, 'Archive Flow Jury User', 'JURY');

  const teamToken = await login(teamEmail);
  const juryToken = await login(juryEmail);

  const juryMe = await request('GET', '/auth/me', {
    token: juryToken,
    expectedStatus: [200, 201],
  });
  const juryUserId = juryMe.payload.id;
  assert(juryUserId, 'Missing jury user id');

  const tournament = await request('POST', '/tournaments', {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: `Archive Flow ${timestamp}`,
      description: 'End-to-end archive and certificate verification',
      startsAt: '2028-03-10T09:00:00.000Z',
      registrationOpenAt: '2028-03-01T09:00:00.000Z',
      registrationCloseAt: '2028-03-09T09:00:00.000Z',
      maxTeams: 25,
    },
  });
  const tournamentId = tournament.payload.id;
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
      name: `Archive Team ${timestamp}`,
      organization: 'Falcon Archive QA',
      contactHandle: '@archive-team',
      members: [
        { fullName: 'Archive Member One', email: `archive_member_1_${timestamp}@falconarena.live` },
        { fullName: 'Archive Member Two', email: `archive_member_2_${timestamp}@falconarena.live` },
      ],
    },
  });
  const teamId = registeredTeam.payload.id;
  assert(teamId, 'Missing team id');

  const round = await request('POST', `/tournaments/${tournamentId}/rounds`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      title: 'Archive Round',
      description: 'Final scenario for archive and certificates',
      mustHave: ['Archive', 'Certificates', 'Export'],
      technologyRequirements: ['Frontend UI', 'Backend API', 'Export integration'],
      additionalMaterials: ['https://falconarena.live/app/archive'],
      startsAt: '2028-03-10T10:00:00.000Z',
      deadlineAt: '2028-03-11T10:00:00.000Z',
    },
  });
  const roundId = round.payload.id;
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
      shortSummary: 'Archive flow submission',
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

  await request('POST', `/rounds/${roundId}/assignments/${assignmentId}/evaluation`, {
    token: juryToken,
    expectedStatus: [200, 201],
    body: {
      scores: {
        technicalBackend: 93,
        technicalDatabase: 89,
        technicalFrontend: 87,
        mustHave: 95,
        stability: 90,
        usability: 91,
      },
      comment: 'Archive flow evaluation',
    },
  });

  await request('POST', `/rounds/${roundId}/finish-evaluation`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: { force: false },
  });

  const archive = await request('GET', `/tournaments/${tournamentId}/archive`, {
    expectedStatus: [200, 201],
  });
  assert(archive.payload.summary?.teamsCount === 1, 'Archive must show one registered team');
  assert(
    archive.payload.summary?.submissionsCount === 1,
    'Archive must show one stored submission',
  );
  assert(archive.payload.teams?.[0]?.rank === 1, 'Archive leaderboard must rank the team first');
  assert(
    archive.payload.rounds?.[0]?.submissions?.[0]?.teamName === `Archive Team ${timestamp}`,
    'Archive round details must include the submitted team',
  );

  const templateBefore = await request('GET', `/tournaments/${tournamentId}/certificate-template`, {
    token: adminToken,
    expectedStatus: [200, 201],
  });
  assert(templateBefore.payload.title, 'Default certificate template must exist');

  const template = await request('PATCH', `/tournaments/${tournamentId}/certificate-template`, {
    token: adminToken,
    expectedStatus: [200, 201],
    body: {
      name: 'Archive Flow Template',
      title: 'FalconArena Archive Certificate',
      subtitle: 'Verified end-to-end archive flow',
      body: 'Awarded to {{teamName}} for successful completion of the archive verification scenario.',
      signerName: 'Falcon Admin',
      signerRole: 'Tournament Director',
      accentColor: '#145af2',
    },
  });
  assert(template.payload.name === 'Archive Flow Template', 'Certificate template must update');

  const participationCertificate = await request(
    'GET',
    `/tournaments/${tournamentId}/certificates/teams/${teamId}?kind=participation`,
    {
      token: adminToken,
      expectedStatus: [200, 201],
    },
  );
  assert(
    participationCertificate.payload.certificate?.kind === 'participation',
    'Participation certificate must be generated',
  );
  assert(
    participationCertificate.payload.certificate?.teamName === `Archive Team ${timestamp}`,
    'Participation certificate must contain the registered team',
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
    winnerCertificate.payload.certificate?.kind === 'winner',
    'Winner certificate must be generated for top-ranked team',
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
      csvExport.payload.includes(`Archive Team ${timestamp}`),
    'CSV export must contain the archived team row',
  );

  const googleSheetsSettings = await request('GET', '/admin/system-integrations/google-sheets', {
    token: adminToken,
    expectedStatus: [200, 201],
  });

  let googleSheetsExport = { skipped: true, reason: 'not-configured' };
  if (googleSheetsSettings.payload?.isConfigured) {
    const exportResponse = await request(
      'POST',
      `/tournaments/${tournamentId}/leaderboard/export.google-sheets`,
      {
        token: adminToken,
        expectedStatus: [200, 201],
        body: {
          sheetName: `Archive Flow ${timestamp}`,
        },
      },
    );

    assert(exportResponse.payload.ok === true, 'Google Sheets export must return ok=true');
    googleSheetsExport = {
      skipped: false,
      destination: exportResponse.payload.destination,
      rowsExported: exportResponse.payload.rowsExported,
    };
  }

  console.log('Archive-certificate-export e2e passed');
  console.log(
    JSON.stringify(
      {
        tournamentId,
        roundId,
        teamId,
        assignmentId,
        googleSheetsExport,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('Archive-certificate-export e2e failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
