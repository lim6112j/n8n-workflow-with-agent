"use strict";

const els = {
  form: document.getElementById("filmForm"),
  title: document.getElementById("filmTitle"),
  story: document.getElementById("story"),
  counter: document.getElementById("storyCounter"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  thumbs: document.getElementById("thumbs"),
  submitBtn: document.getElementById("submitBtn"),
  errorPanel: document.getElementById("errorPanel"),
  errorText: document.getElementById("errorText"),
  resultPanel: document.getElementById("resultPanel"),
  resSlug: document.getElementById("resSlug"),
  resRefs: document.getElementById("resRefs"),
  resPath: document.getElementById("resPath"),
  resNext: document.getElementById("resNext"),
  pipelineCard: document.getElementById("pipelineCard"),
  pipelineSlug: document.getElementById("pipelineSlug"),
  pipelineSteps: document.getElementById("pipelineSteps"),
};

let images = []; // [{ id, file, url }]
let nextImageId = 1;
let pipeline = null; // { slug, manifest, stages: { [id]: { status, result, error } } }
let elapsedTimer = null; // { stageId, interval }

function getExtension(filename) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function addFiles(fileList) {
  const incoming = Array.from(fileList);
  const accepted = [];
  for (const file of incoming) {
    if (!CONFIG.ALLOWED_EXTENSIONS.includes(getExtension(file.name))) continue;
    if (images.length + accepted.length >= CONFIG.MAX_REFS) break;
    accepted.push({ id: nextImageId++, file, url: URL.createObjectURL(file) });
  }
  images = [...images, ...accepted];
  renderThumbs();
}

function removeImage(id) {
  const target = images.find((img) => img.id === id);
  if (target) URL.revokeObjectURL(target.url);
  images = images.filter((img) => img.id !== id);
  renderThumbs();
}

function moveImage(id, offset) {
  const index = images.findIndex((img) => img.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= images.length) return;
  const reordered = [...images];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);
  images = reordered;
  renderThumbs();
}

function renderThumbs() {
  els.thumbs.replaceChildren();
  images.forEach((img, index) => {
    const card = document.createElement("div");
    card.className = "thumb";

    const preview = document.createElement("img");
    preview.src = img.url;
    preview.alt = img.file.name;

    const badge = document.createElement("div");
    const isUsed = index < CONFIG.REFS_USED_IN_SHOTS;
    badge.className = "badge" + (isUsed ? "" : " unused");
    badge.textContent = isUsed
      ? "ref_" + String(index + 1).padStart(2, "0")
      : "unused in shots";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = img.file.name;
    name.title = img.file.name;

    const tools = document.createElement("div");
    tools.className = "tools";
    tools.append(
      makeToolButton("↑", "Move up", () => moveImage(img.id, -1)),
      makeToolButton("↓", "Move down", () => moveImage(img.id, 1)),
      makeToolButton("✕", "Remove", () => removeImage(img.id)),
    );

    card.append(preview, badge, tools, name);
    els.thumbs.append(card);
  });
}

function makeToolButton(label, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

function updateStoryCounter() {
  const length = els.story.value.trim().length;
  els.counter.textContent = length + " / " + CONFIG.MIN_STORY_CHARS + " min";
  els.counter.className = "counter " + (length >= CONFIG.MIN_STORY_CHARS ? "ok" : "short");
}

function validate() {
  const errors = [];
  if (!els.title.value.trim()) errors.push("Film title is required.");
  if (els.story.value.trim().length < CONFIG.MIN_STORY_CHARS) {
    errors.push("Story is required (at least " + CONFIG.MIN_STORY_CHARS + " characters).");
  }
  if (!images.length) errors.push("Please add at least 1 reference image.");
  if (images.length > CONFIG.MAX_REFS) errors.push("Please add at most " + CONFIG.MAX_REFS + " reference images.");
  return errors;
}

function buildFormData() {
  const data = new FormData();
  data.append("film_title", els.title.value.trim());
  data.append("story", els.story.value.trim());
  images.forEach((img, index) => data.append("image_" + (index + 1), img.file, img.file.name));
  return data;
}

function showError(message) {
  els.errorText.textContent = message;
  els.errorPanel.classList.remove("hidden");
  els.resultPanel.classList.add("hidden");
}

function showResult(data) {
  els.resSlug.textContent = data.slug ?? "—";
  els.resRefs.textContent = String(data.refCount ?? "—") + " reference image(s)";
  els.resPath.textContent = data.projectPath ?? "—";
  els.resNext.textContent = data.nextStep ?? "—";
  els.resultPanel.classList.remove("hidden");
  els.errorPanel.classList.add("hidden");
  if (data.slug) initPipeline(data.slug);
}

function extractErrorMessage(payload, fallback) {
  if (payload && typeof payload.message === "string" && payload.message) return payload.message;
  return fallback;
}

// ---------- Pipeline stages (film-02 … film-05) ----------

function buildInitialStages() {
  return Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage.id, { status: "pending", result: null, error: "" }]),
  );
}

function initPipeline(slug) {
  stopElapsedTimer();
  pipeline = { slug, stages: buildInitialStages(), manifest: null };
  els.pipelineCard.classList.remove("hidden");
  renderPipeline();
}

function isStageUnlocked(index) {
  return PIPELINE_STAGES.slice(0, index).every((stage) => pipeline.stages[stage.id].status === "done");
}

function updateStage(stageId, patch) {
  if (!pipeline) return;
  const current = pipeline.stages[stageId];
  pipeline = { ...pipeline, stages: { ...pipeline.stages, [stageId]: { ...current, ...patch } } };
  renderPipeline();
}

function startElapsed(stageId) {
  stopElapsedTimer();
  const startedAt = Date.now();
  const interval = setInterval(() => {
    const span = document.getElementById("elapsed-" + stageId);
    if (span) span.textContent = Math.round((Date.now() - startedAt) / 1000) + "s elapsed";
  }, 1000);
  elapsedTimer = { stageId, interval };
}

function stopElapsedTimer() {
  if (!elapsedTimer) return;
  clearInterval(elapsedTimer.interval);
  elapsedTimer = null;
}

async function runStage(stageId) {
  if (!pipeline) return;
  const stage = PIPELINE_STAGES.find((s) => s.id === stageId);
  if (!stage) return;

  updateStage(stageId, { status: "running", error: "" });
  startElapsed(stageId);

  try {
    const response = await fetch(stage.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_slug: pipeline.slug }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, "Request failed with HTTP " + response.status + "."));
    }
    updateStage(stageId, { status: "done", result: payload ?? {} });
    try {
      await refreshManifest(pipeline.slug); // pull the new stage output into the review sections
    } catch (manifestError) {
      console.warn("Manifest refresh failed:", manifestError);
    }
  } catch (error) {
    const hint = error instanceof TypeError
      ? "Could not reach " + stage.endpoint + " — is the workflow active and CORS-enabled? (" + error.message + ")"
      : error.message;
    updateStage(stageId, { status: "failed", error: hint });
  } finally {
    stopElapsedTimer();
  }
}

const STAGE_ICONS = Object.freeze({ pending: "○", done: "✓", failed: "✗" });

function renderPipeline() {
  if (!pipeline) return;
  els.pipelineSlug.textContent = pipeline.slug;
  els.pipelineSteps.replaceChildren();
  PIPELINE_STAGES.forEach((stage, index) => {
    els.pipelineSteps.append(makeStageRow(stage, index, pipeline.stages[stage.id]));
  });
}

function makeStageRow(stage, index, state) {
  const row = document.createElement("div");
  row.className = "stage";

  row.append(makeStageIcon(state), makeStageBody(stage, state));

  const button = makeStageButton(stage, index, state);
  if (button) row.append(button);
  return row;
}

function makeStageIcon(state) {
  const icon = document.createElement("div");
  icon.className = "icon " + state.status;
  if (state.status === "running") {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    icon.append(spinner);
  } else {
    icon.textContent = STAGE_ICONS[state.status] ?? "○";
  }
  return icon;
}

function makeStageBody(stage, state) {
  const body = document.createElement("div");
  body.className = "body";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = stage.label;
  body.append(label);

  if (state.status === "running") {
    const elapsed = document.createElement("span");
    elapsed.className = "elapsed";
    elapsed.id = "elapsed-" + stage.id;
    elapsed.textContent = "0s elapsed";
    label.append(" ", elapsed);
  }

  const detail = document.createElement("div");
  detail.className = "detail";
  detail.textContent = stage.detail;
  body.append(detail);

  if (state.status === "failed" && state.error) {
    const errorLine = document.createElement("div");
    errorLine.className = "stage-error";
    errorLine.textContent = state.error;
    body.append(errorLine);
  }
  if (state.status === "done" && state.result) {
    body.append(makeStageResult(state.result, stage));
    if (stage.download && pipeline) body.append(makeDownloadLink(pipeline.slug));
  }
  appendStageReview(body, stage);
  return body;
}

function makeDownloadLink(slug) {
  const link = document.createElement("a");
  link.className = "download-btn";
  link.href = CONFIG.DOWNLOAD_URL + "?slug=" + encodeURIComponent(slug);
  link.textContent = "⬇ Download film.mp4";
  return link;
}

function makeStageButton(stage, index, state) {
  if (state.status === "running") {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;
    button.textContent = "Running…";
    return button;
  }
  if (state.status === "done") return null;
  if (state.status === "pending" && !isStageUnlocked(index)) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = state.status === "failed" ? "Retry" : stage.label;
  button.addEventListener("click", () => runStage(stage.id));
  return button;
}

function makeStageResult(result, stage) {
  const dl = document.createElement("dl");
  dl.className = "kv";
  for (const [field, label] of stage.resultFields) {
    if (result[field] === undefined || result[field] === null) continue;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(result[field]);
    dl.append(dt, dd);
  }
  return dl;
}

async function submitForm(event) {
  event.preventDefault();

  const errors = validate();
  if (errors.length) {
    showError(errors.join(" "));
    return;
  }

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Creating project… (FFmpeg normalization takes a moment)";
  els.errorPanel.classList.add("hidden");

  try {
    const response = await fetch(CONFIG.WEBHOOK_URL, { method: "POST", body: buildFormData() });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, "Request failed with HTTP " + response.status + "."));
    }
    showResult(payload ?? {});
  } catch (error) {
    const hint = error instanceof TypeError
      ? "Could not reach the webhook — is n8n running, active, and CORS-enabled? (" + error.message + ")"
      : error.message;
    showError(hint);
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Create film project";
  }
}

function setupDropzone() {
  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", () => {
    addFiles(els.fileInput.files);
    els.fileInput.value = "";
  });
  for (const eventName of ["dragenter", "dragover"]) {
    els.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropzone.classList.add("dragover");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    els.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropzone.classList.remove("dragover");
    });
  }
  els.dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
}

setupDropzone();
els.story.addEventListener("input", updateStoryCounter);
els.form.addEventListener("submit", submitForm);
updateStoryCounter();
