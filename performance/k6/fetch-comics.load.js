import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { bootstrapBenchmarkUser, buildComicPayload, getJson, postJson, ROUTES } from "./common.js";

// Track read performance separately so you can compare list latency with write-heavy flows.
const fetchDuration = new Trend("fetch_comics_duration");

export const options = {
  scenarios: {
    fetch_list: {
      executor: "constant-vus",
      vus: 10,
      duration: "1m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<500"],
  },
};

export function setup() {
  const data = bootstrapBenchmarkUser(100);

  // Seed a few comics so the fetch test measures a realistic list response.
  const seedCount = Math.max(Number.parseInt(__ENV.K6_SEED_COUNT || "3", 10), 1);
  for (let index = 0; index < seedCount; index += 1) {
    const response = postJson(ROUTES.comics.create, buildComicPayload(`fetch-${index}`), data.token);
    if (response.status !== 201) {
      throw new Error(`Failed to seed comic ${index} for fetch tests: ${response.status}`);
    }
  }

  return data;
}

export default function (data) {
  const response = getJson(ROUTES.comics.list, data.token);

  const ok = check(response, {
    "fetch-comics returns 200": (r) => r.status === 200,
    "fetch-comics returns a list": (r) => r.status === 200 && Array.isArray(r.json("comics")),
  });

  fetchDuration.add(response.timings.duration);

  if (!ok) {
    sleep(1);
    return;
  }

  sleep(1);
}
