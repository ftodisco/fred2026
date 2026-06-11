#!/usr/bin/env node
'use strict';

const { generateVideo, pollJob, listModels } = require('./client');
const fs = require('fs');

const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const prompt = positional.join(' ');

function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : def;
}

async function main() {
  if (args.includes('--list-models')) {
    const data = await listModels();
    const items = data.items ?? data;
    console.log('Available video models:\n');
    for (const m of items) {
      console.log(`  ${String(m.id).padEnd(22)} ${m.name} — ${m.description ?? ''}`);
    }
    return;
  }

  if (!prompt) {
    console.error('Usage: generate.js <prompt> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --model <id>          Model ID (default: seedance_2_0)');
    console.error('  --duration <secs>     Video duration in seconds');
    console.error('  --aspect-ratio <r>    e.g. 16:9, 9:16, 1:1 (default: 16:9)');
    console.error('  --resolution <r>      480p | 720p | 1080p (default: 720p)');
    console.error('  --output <path>       Save result JSON to file; print URL to stdout');
    console.error('  --list-models         List available video models and exit');
    process.exit(1);
  }

  const model = flag('model', 'seedance_2_0');
  const durationRaw = flag('duration', undefined);
  const duration = durationRaw !== undefined ? parseInt(durationRaw, 10) : undefined;
  const aspectRatio = flag('aspect-ratio', '16:9');
  const resolution = flag('resolution', '720p');
  const outputPath = flag('output', undefined);

  console.error(`Prompt  : ${prompt}`);
  console.error(`Model   : ${model}  Aspect: ${aspectRatio}  Resolution: ${resolution}${duration ? `  Duration: ${duration}s` : ''}`);

  const result = await generateVideo({ model, prompt, duration, aspectRatio, resolution });
  const jobId = result.job_id ?? result.id;
  if (!jobId) throw new Error(`Unexpected response — no job_id: ${JSON.stringify(result)}`);

  console.error(`Job     : ${jobId}`);
  process.stderr.write('Waiting ');

  const job = await pollJob(jobId);
  process.stderr.write('\n');

  const url = job.output_url ?? job.url ?? job.outputs?.[0]?.url ?? job.results?.[0]?.url;
  const output = { job_id: jobId, status: job.status, url, model, prompt };

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.error(`Saved   : ${outputPath}`);
    if (url) console.log(url);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

main().catch(err => {
  process.stderr.write('\n');
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
