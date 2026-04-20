/**
 * File persistence for the StockPulse engine state.
 * The whole state is written as JSON (atomic temp-file + rename, debounced) and reloaded on start,
 * so real business data survives restarts. wsSubscribers (live sockets) are never persisted.
 */
import fs from "node:fs";
import path from "node:path";

const EPHEMERAL = new Set(["wsSubscribers"]);

function serialize(state) {
  const out = {};
  for (const [key, value] of Object.entries(state)) {
    if (EPHEMERAL.has(key)) continue;
    if (value instanceof Map) out[key] = { __map: Array.from(value.entries()) };
    else out[key] = value;
  }
  return JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: out });
}

export function loadStateFromFile(state, file) {
  if (!fs.existsSync(file)) return false;
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.trim()) return false;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const backup = `${file}.corrupt-${Date.now()}`;
    fs.copyFileSync(file, backup);
    throw new Error(`Data file ${file} is not valid JSON (copy kept at ${backup}): ${err.message}`);
  }
  const saved = parsed.state || {};
  for (const [key, value] of Object.entries(saved)) {
    if (!(key in state) || EPHEMERAL.has(key)) continue;
    if (state[key] instanceof Map && value && value.__map) {
      state[key].clear();
      for (const [k, v] of value.__map) state[key].set(k, v);
    } else if (Array.isArray(state[key]) && Array.isArray(value)) {
      state[key].length = 0;
      for (const item of value) state[key].push(item);
    }
  }
  return true;
}

export function createPersistence(state, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let timer = null;
  let writing = false;
  let dirty = false;

  function writeNow() {
    if (writing) { dirty = true; return; }
    writing = true;
    try {
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, serialize(state));
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error("[StockPulse] Failed to save data:", err.message);
    } finally {
      writing = false;
      if (dirty) { dirty = false; writeNow(); }
    }
  }

  return {
    file,
    schedule() {
      if (timer) return;
      timer = setTimeout(() => { timer = null; writeNow(); }, 250);
    },
    flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      writeNow();
    }
  };
}
