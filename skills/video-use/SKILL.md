---
name: video-use
description: Generate AI videos using Higgsfield AI. Supports text-to-video with models from Bytedance (Seedance), Wan, Minimax Hailuo, and Kling. Requires HIGGSFIELD_API_KEY env var.
---

# Video Generation with Higgsfield AI

Generate AI videos from text prompts using Higgsfield AI's multi-model platform.

## Prerequisites

- `HIGGSFIELD_API_KEY` environment variable set (get from https://higgsfield.ai/settings/api)

## Quick Start

### Text-to-video (default model)
```bash
node /root/clawd/skills/video-use/scripts/generate.js "A serene mountain lake at sunrise, cinematic 4K"
```

### Specific model and settings
```bash
node /root/clawd/skills/video-use/scripts/generate.js "Product showcase on white background" \
  --model seedance_2_0 \
  --duration 8 \
  --aspect-ratio 9:16 \
  --resolution 1080p
```

### Save result to file
```bash
node /root/clawd/skills/video-use/scripts/generate.js "Ocean waves at golden hour" --output /tmp/result.json
# Prints the video URL to stdout; saves full JSON to /tmp/result.json
```

### List available models
```bash
node /root/clawd/skills/video-use/scripts/generate.js --list-models
```

## Available Models

| Model ID | Provider | Best For |
|----------|----------|----------|
| `seedance_2_0` | Bytedance | Reference-driven, consistent identity, products **(default)** |
| `seedance_1_5` | Bytedance | Reliable motion, versatile |
| `minimax_hailuo` | Hailuo | Natural physics, facial emotion, realistic |
| `wan2_6` | Wan | Stylized, experimental, artistic |
| `wan2_7` | Wan | Synchronized audio, character-consistent |
| `kling3_0` | Kling | Multi-shot, audio, motion transfer |

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--model <id>` | `seedance_2_0` | Model ID |
| `--duration <secs>` | model default | Video length in seconds |
| `--aspect-ratio <r>` | `16:9` | e.g. `16:9`, `9:16`, `1:1`, `4:3` |
| `--resolution <r>` | `720p` | `480p`, `720p`, or `1080p` |
| `--output <path>` | — | Save result JSON to file; prints URL to stdout |
| `--list-models` | — | Print available models and exit |

## Troubleshooting

- **401 Unauthorized** — Verify `HIGGSFIELD_API_KEY` is set: `echo $HIGGSFIELD_API_KEY`
- **Job stuck in polling** — Jobs take 30–120 seconds; the script polls every 5 s with a 3-minute timeout
- **Model not found** — Run `--list-models` to confirm the model ID
- **Empty URL in result** — The job completed but the output field name may differ; inspect the raw JSON in the result file
