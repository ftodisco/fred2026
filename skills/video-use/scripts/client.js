'use strict';

const BASE_URL = 'https://api.higgsfield.ai';

function getApiKey() {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) throw new Error('HIGGSFIELD_API_KEY environment variable is required');
  return key;
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Higgsfield API ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function generateVideo({ model, prompt, duration, aspectRatio, resolution, count = 1 }) {
  const payload = { model, count };
  if (prompt) payload.prompt = prompt;
  if (duration) payload.duration = duration;
  if (aspectRatio) payload.aspect_ratio = aspectRatio;
  if (resolution) payload.resolution = resolution;
  return request('POST', '/v1/generation/video', payload);
}

async function getJob(jobId) {
  return request('GET', `/v1/generation/video/${jobId}`);
}

async function listModels() {
  return request('GET', '/v1/models?type=video');
}

async function pollJob(jobId, { intervalMs = 5000, timeoutMs = 180000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await getJob(jobId);
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(`Job ${jobId} failed: ${job.error ?? 'unknown error'}`);
    process.stderr.write('.');
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for job ${jobId}`);
}

module.exports = { generateVideo, getJob, listModels, pollJob };
