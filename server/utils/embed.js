// server/utils/embed.js
// Embedding provider
// Priority:
// 1) Local semantic embeddings via @xenova/transformers (feature-extraction + mean pooling)
// 2) Optional OpenAI embeddings (if OPENAI_API_KEY exists)
// 3) Deterministic fallback vector (so demos never fail)

const crypto = require("crypto");

let _embedder = null;
let _embedderPromise = null;

// Lazily load transformers only if installed
async function getTransformersEmbedder() {
  if (_embedder) return _embedder;
  if (_embedderPromise) return _embedderPromise;

  _embedderPromise = (async () => {
    const mod = await import("@xenova/transformers");
    const { pipeline } = mod;

    // CPU-friendly 384-dim sentence embeddings
    const e = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    _embedder = e;
    return _embedder;
  })();

  return _embedderPromise;
}

// Deterministic pseudo-random generator (seeded)
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Always returns a vector of fixed dimension
function deterministicFallbackEmbedding(text, dim = 384) {
  const hash = crypto.createHash("sha256").update(String(text)).digest();
  const seed = (hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3];
  const rnd = mulberry32(seed >>> 0);

  const vec = new Array(dim);
  for (let i = 0; i < dim; i++) vec[i] = rnd() * 2 - 1;
  return vec;
}

// Optional warmup (call once if you want pre-download at startup)
async function warmupLocalEmbedder() {
  try {
    await getTransformersEmbedder();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get an embedding vector for a given text.
 * @param {string} text
 * @param {object} opts
 * @param {number} opts.dim Fallback dimension (default 384)
 * @returns {Promise<number[]>}
 */
async function getEmbeddingVector(text, opts = {}) {
  const dim = typeof opts.dim === "number" ? opts.dim : 384;
  const t = String(text || "").trim();

  if (!t) return deterministicFallbackEmbedding("", dim);

  // 1) Local transformer embeddings (best for your "no key required" use case)
  try {
    const embedder = await getTransformersEmbedder();
    const out = await embedder(t, { pooling: "mean", normalize: true });
    return Array.from(out.data);
  } catch {
    // ignore and try next
  }

  // 2) OpenAI fallback (only if key exists)
  try {
    if (process.env.OPENAI_API_KEY) {
      // require lazily so module doesn't crash if missing
      const OpenAI = require("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const resp = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: t,
      });

      return resp.data[0].embedding;
    }
  } catch {
    // ignore and fallback
  }

  // 3) Deterministic fallback (never fails)
  return deterministicFallbackEmbedding(t, dim);
}

module.exports = {
  getEmbeddingVector,
  warmupLocalEmbedder,
  deterministicFallbackEmbedding,
};
