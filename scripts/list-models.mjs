/**
 * List the Gemini models this API key can reach, with the methods each supports.
 *
 *   node scripts/list-models.mjs
 *
 * Useful when a model id starts returning 404 — Google retires ids for new
 * projects without warning, and this shows what is actually available.
 */

import "dotenv/config";

const key =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;

if (!key) {
  console.error(
    "Set GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_API_KEY before running this."
  );
  process.exit(1);
}

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
);

if (!response.ok) {
  console.error(`Request failed (${response.status}):`, await response.text());
  process.exit(1);
}

const { models = [] } = await response.json();

for (const model of models) {
  console.log(
    model.name.padEnd(48),
    (model.supportedGenerationMethods ?? []).join(", ")
  );
}
