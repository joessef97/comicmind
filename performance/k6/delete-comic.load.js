import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { bootstrapBenchmarkUser, buildComicPayload, deleteJson, postJson, ROUTES } from "./common.js";

// Count unexpected delete failures so you can separate auth issues from API behavior.
const unexpectedDeleteFailures = new Counter("unexpected_delete_failures");

export const options = {
  scenarios: {
    delete_comic: {
      executor: "per-vu-iterations",
      vus: 5,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<500"],
  },
};

export function setup() {
  const data = bootstrapBenchmarkUser(100);
  const comicCount = Math.max(Number.parseInt(__ENV.K6_SEED_COUNT || "5", 10), 1);
  const comicIds = [];

  // Seed one comic per VU so each virtual user can delete a real record exactly once.
  for (let index = 0; index < comicCount; index += 1) {
    const response = postJson(ROUTES.comics.create, buildComicPayload(`delete-${index}`), data.token);
    if (response.status !== 201) {
      throw new Error(`Failed to seed comic ${index} for delete tests: ${response.status}`);
    }

    const comic = response.json("comic");
    comicIds.push(comic.id);
  }

  return {
    token: data.token,
    comicIds,
  };
}

export default function (data) {
  const comicId = data.comicIds[__VU - 1];
  if (!comicId) {
    throw new Error(`No comic id assigned for VU ${__VU}`);
  }

  const response = deleteJson(ROUTES.comics.delete(comicId), data.token);

  const ok = check(response, {
    "delete-comic returns 200": (r) => r.status === 200,
    "delete-comic acknowledges deletion": (r) => r.status === 200 && r.json("message") === "Comic deleted successfully",
  });

  if (!ok) {
    unexpectedDeleteFailures.add(1);
  }

  sleep(1);
}
