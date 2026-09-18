"use strict";

const CONFIG = Object.freeze({
  WEBHOOK_URL: "http://localhost:5678/webhook/film-project-setup",
  DOWNLOAD_URL: "http://localhost:5678/webhook/film-download",
  REVIEW_URL: "http://localhost:5678/webhook/film-review",
  ASSET_URL: "http://localhost:5678/webhook/film-asset",
  MAX_REFS: 6,
  REFS_USED_IN_SHOTS: 3,
  MIN_STORY_CHARS: 20,
  ALLOWED_EXTENSIONS: ["jpg", "jpeg", "png", "webp"],
});

const PIPELINE_STAGES = Object.freeze([
  {
    id: "script",
    label: "Generate script",
    endpoint: "http://localhost:5678/webhook/film-run-script",
    detail: "The script agent writes the screenplay from your story (usually under a minute).",
    resultFields: Object.freeze([["shotCount", "Shots"], ["slug", "Slug"], ["scriptPath", "Path"]]),
  },
  {
    id: "shots",
    label: "Generate shot images",
    endpoint: "http://localhost:5678/webhook/film-gen-shots",
    detail: "One image per shot via OpenRouter — can take several minutes. Safe to re-run: existing shots are skipped.",
    resultFields: Object.freeze([["shotsPath", "Path"], ["nextStep", "Next"]]),
  },
  {
    id: "voice",
    label: "Generate voiceover",
    endpoint: "http://localhost:5678/webhook/film-gen-voice",
    detail: "Text-to-speech per line, mixed into per-shot audio tracks. Safe to re-run.",
    resultFields: Object.freeze([["audioPath", "Path"], ["nextStep", "Next"]]),
  },
  {
    id: "assemble",
    label: "Assemble final film",
    endpoint: "http://localhost:5678/webhook/film-assemble",
    detail: "FFmpeg renders each clip, mixes audio and subtitles, and concatenates the final film — can take several minutes.",
    resultFields: Object.freeze([["filmPath", "Film"], ["durationSeconds", "Duration (s)"], ["sizeMb", "Size (MB)"], ["nextStep", "Next"]]),
    download: true,
  },
]);
