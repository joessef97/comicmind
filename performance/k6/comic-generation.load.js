import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { bootstrapBenchmarkUser, buildComicPayload, postJson, ROUTES } from "./common.js";

// Custom trend for the dissertation report in addition to K6's built-in metrics.
const generationDuration = new Trend("comic_generation_duration");

export const options = {
  scenarios: {
    generate_story: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 1 },
        { duration: "1m", target: 3 },
        { duration: "30s", target: 5 },
        { duration: "30s", target: 2 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

export function setup() {
  return bootstrapBenchmarkUser(100);
}

export default function (data) {
  const payload = buildComicPayload(`${__VU}-${__ITER}`);
  const response = postJson(ROUTES.comics.generateStory, payload, data.token);

  const ok = check(response, {
    "generate-story returns 200": (r) => r.status === 200,
    "generate-story returns panels": (r) => r.status === 200 && Array.isArray(r.json("panels")),
  });

  generationDuration.add(response.timings.duration);

  if (!ok) {
    sleep(1);
    return;
  }

  sleep(1);
}
