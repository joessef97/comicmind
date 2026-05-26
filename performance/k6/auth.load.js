import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { postJson, ROUTES, stableBenchmarkCredentials } from "./common.js";

// This counter helps count unexpected auth failures beyond the built-in K6 metrics.
const unexpectedAuthFailures = new Counter("unexpected_auth_failures");

const SEEDED_USERS = [
  {
    username: __ENV.K6_AUTH_USERNAME || "",
    password: __ENV.K6_AUTH_PASSWORD || "",
  },
  {
    username: "youssef",
    email: "youssef.hassan@gmail.com",
    password: "12345678",
  },
  {
    username: "sara",
    email: "sara.nabil@gmail.com",
    password: "12345678",
  },
  {
    username: "ahmed",
    email: "ahmed.farouk@gmail.com",
    password: "12345678",
  },
  {
    username: "mona",
    email: "mona.salem@gmail.com",
    password: "12345678",
  },
  {
    username: "alex_art",
    email: "alex@comicmind.dev",
    password: "Password1!",
  },
  {
    username: "samira_k",
    email: "samira@comicmind.dev",
    password: "Password2!",
  },
  {
    username: "jordan_draws",
    email: "jordan@comicmind.dev",
    password: "Password3!",
  },
  {
    username: "priya_m",
    email: "priya@comicmind.dev",
    password: "Password4!",
  },
];

export const options = {
  scenarios: {
    login_users: {
      executor: "constant-vus",
      vus: 5,
      duration: "1m",
      exec: "loginFlow",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800"],
  },
};

export function setup() {
  // Prefer a known seeded user from the repository data so login tests run against a real account.
  for (const candidate of SEEDED_USERS) {
    if (!candidate.username || !candidate.password) {
      continue;
    }

    const loginResponse = postJson(ROUTES.auth.login, {
      username: candidate.username,
      password: candidate.password,
    });

    if (loginResponse.status === 200 && loginResponse.json("token")) {
      return { loginUser: candidate };
    }
  }

  const benchmarkUser = stableBenchmarkCredentials();
  const registerResponse = postJson(ROUTES.auth.register, benchmarkUser);

  if (![201, 400, 409].includes(registerResponse.status)) {
    throw new Error(
      `Could not create benchmark auth user. Register returned ${registerResponse.status}. Start the backend with npm run dev:benchmark or seed the database first.`,
    );
  }

  const loginResponse = postJson(ROUTES.auth.login, {
    username: benchmarkUser.username,
    password: benchmarkUser.password,
  });

  if (loginResponse.status === 200 && loginResponse.json("token")) {
    return { loginUser: benchmarkUser };
  }

  throw new Error(
    `Unable to create or use a valid auth user for the benchmark. Login returned ${loginResponse.status}. Start the backend with npm run dev:benchmark or seed the database first.`,
  );
}

export function loginFlow(data) {
  const response = postJson(ROUTES.auth.login, {
    username: data.loginUser.username,
    password: data.loginUser.password,
  });

  const ok = check(response, {
    "login returns 200": (r) => r.status === 200,
    "login returns a token": (r) => r.status === 200 && Boolean(r.json("token")),
  });

  if (!ok) {
    unexpectedAuthFailures.add(1);
  }

  sleep(1);
}
