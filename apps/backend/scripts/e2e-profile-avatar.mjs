const baseUrl = process.env.BASE_URL ?? 'http://localhost:4000';
const timestamp = Date.now().toString();

const adminEmail = process.env.ADMIN_EMAIL ?? '';
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
const userPassword = process.env.TEST_USER_PASSWORD ?? 'StrongPass123!';
const teamEmail = `avatar_e2e_${timestamp}@falconarena.live`;

const avatarDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8hM0UAAAAASUVORK5CYII=';

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
  console.log(`Running profile-avatar e2e against ${baseUrl}`);

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
      fullName: 'Avatar Smoke User',
      password: userPassword,
      role: 'TEAM',
    },
  });

  const firstLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: teamEmail, password: userPassword },
  });
  const firstToken = firstLogin.payload.accessToken;
  assert(firstToken, 'Missing token after first login');

  await request('PATCH', '/profile/settings', {
    token: firstToken,
    expectedStatus: [200, 201],
    body: {
      edit: {
        avatarUrl: avatarDataUrl,
      },
    },
  });

  const firstSettings = await request('GET', '/profile/settings', {
    token: firstToken,
    expectedStatus: [200, 201],
  });
  assert(
    firstSettings.payload?.edit?.avatarUrl === avatarDataUrl,
    'Avatar URL was not saved after PATCH /profile/settings',
  );

  const secondLogin = await request('POST', '/auth/login', {
    expectedStatus: [200, 201],
    body: { email: teamEmail, password: userPassword },
  });
  const secondToken = secondLogin.payload.accessToken;
  assert(secondToken, 'Missing token after second login');

  const secondMe = await request('GET', '/auth/me', {
    token: secondToken,
    expectedStatus: [200, 201],
  });
  assert(secondMe.payload?.email === teamEmail, 'Second login returned wrong user');

  const secondSettings = await request('GET', '/profile/settings', {
    token: secondToken,
    expectedStatus: [200, 201],
  });
  assert(
    secondSettings.payload?.edit?.avatarUrl === avatarDataUrl,
    'Avatar URL was not persisted after re-login',
  );

  console.log('Profile-avatar e2e passed');
  console.log(
    JSON.stringify(
      {
        userEmail: teamEmail,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('Profile-avatar e2e failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

