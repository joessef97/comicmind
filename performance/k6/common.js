import http from "k6/http";

export const ROUTES = {
  auth: {
    register: "/api/auth/register",
    login: "/api/auth/login",
  },
  user: {
    activateSubscription: "/api/user/subscription/activate",
  },
  comics: {
    generateStory: "/api/comics/generate-story",
    create: "/api/comics",
    list: "/api/comics",
    delete: (comicId) => `/api/comics/${comicId}`,
  },
};

const DEFAULT_BASE_URL = "http://127.0.0.1:5000";
const DEFAULT_PASSWORD = "K6StrongPass123!";

export function getBaseUrl() {
  const baseUrl = __ENV.K6_BASE_URL || __ENV.BASE_URL || DEFAULT_BASE_URL;
  return baseUrl.replace(/\/$/, "");
}

export function apiUrl(path) {
  return `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return { headers };
}

export function uniqueSuffix() {
  return `${__VU}-${__ITER}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function benchmarkCredentials(prefix = "k6-user") {
  const suffix = uniqueSuffix();
  return {
    username: `${prefix}-${suffix}`.slice(0, 30),
    email: `${prefix}-${suffix}@example.com`,
    password: __ENV.K6_AUTH_PASSWORD || DEFAULT_PASSWORD,
  };
}

export function stableBenchmarkCredentials() {
  return {
    username: __ENV.K6_AUTH_USERNAME || "k6-benchmark-user",
    email: __ENV.K6_AUTH_EMAIL || "k6-benchmark-user@example.com",
    password: __ENV.K6_AUTH_PASSWORD || DEFAULT_PASSWORD,
  };
}

export function postJson(path, body, token) {
  return http.post(apiUrl(path), JSON.stringify(body), jsonHeaders(token));
}

export function getJson(path, token) {
  return http.get(apiUrl(path), jsonHeaders(token));
}

export function deleteJson(path, token) {
  return http.del(apiUrl(path), null, jsonHeaders(token));
}

export function bootstrapBenchmarkUser(plan = Number.parseInt(__ENV.K6_SUBSCRIPTION_PLAN || "100", 10)) {
  const resolvedPlan = Number.isFinite(plan) && plan > 0 ? plan : 100;
  const credentials = stableBenchmarkCredentials();

  const registerResponse = postJson(ROUTES.auth.register, credentials);
  if (![201, 400, 409].includes(registerResponse.status)) {
    throw new Error(`Benchmark user registration failed with ${registerResponse.status}`);
  }

  const loginResponse = postJson(ROUTES.auth.login, {
    username: credentials.username,
    password: credentials.password,
  });

  if (loginResponse.status !== 200) {
    throw new Error(`Benchmark user login failed with ${loginResponse.status}`);
  }

  const token = loginResponse.json("token");
  if (!token) {
    throw new Error("Benchmark user login did not return a token");
  }

  const activationResponse = postJson(
    ROUTES.user.activateSubscription,
    { plan: resolvedPlan },
    token,
  );

  if (activationResponse.status !== 200) {
    throw new Error(`Subscription activation failed with ${activationResponse.status}`);
  }

  return {
    token,
    credentials,
    plan: resolvedPlan,
  };
}

export function buildComicPayload(seed) {
  return {
    title: `K6 Load Comic ${seed}`,
    style: "noir",
    idea: `A benchmark team measures ComicMind under load in scenario ${seed}.`,
    panels: [
      {
        number: 1,
        description: "A calm control room before the test begins.",
        dialogue: "Lead: Ready to measure the system.",
        narration: "The benchmark begins in a quiet room.",
      },
      {
        number: 2,
        description: "The dashboard fills with traffic.",
        dialogue: "Analyst: The load is climbing.",
        narration: "Requests arrive from many virtual users.",
      },
    ],
  };
}
