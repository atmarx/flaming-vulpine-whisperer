# Flaming Vulpine Whisperer

A Firefox extension for speech-to-text dictation into any text field, powered by your own self-hosted Whisper API.

Hold **Alt+R**, speak, release — your words appear at the cursor. Works with any OpenAI-compatible speech-to-text endpoint ([faster-whisper-server](https://github.com/fedirz/faster-whisper-server), [whisper.cpp](https://github.com/ggerganov/whisper.cpp), etc.).

No cloud. No subscription. Your server, your data.

## Features

- **Hold-to-record** — hold Alt+R to record, release to transcribe
- **Works everywhere** — inserts text into `<input>`, `<textarea>`, and `contentEditable` elements
- **Visual feedback** — floating pill indicator shows recording/transcribing state
- **Configurable** — set your API endpoint and preferred language
- **Minimal** — ~200 lines of code, no dependencies, no tracking
- **Shadow DOM overlay** — indicator styling never conflicts with page CSS

## Install

### From source (temporary)

1. Clone this repo
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from this directory
5. Click the extension icon or go to options to set your Whisper API endpoint

### From source (permanent)

1. Clone this repo
2. Zip the contents: `cd flaming-vulpine-whisperer && zip -r ../fvw.xpi *`
3. Open `about:addons`, click the gear icon, "Install Add-on From File", select the .xpi
4. (Requires `xpinstall.signatures.required = false` in `about:config` for unsigned extensions)

## Setup

1. Set your Whisper API endpoint in the extension options (e.g., `https://voice.example.com`)
   - The path `/v1/audio/transcriptions` is appended automatically
2. Optionally select a language (default: auto-detect)
3. Hold **Alt+R** in any text field to record

## Keyboard Shortcut

Default: **Alt+R** (hold to record, release to stop)

Rebind in: `about:addons` → gear icon → "Manage Extension Shortcuts"

## Compatible Servers

Any server that implements the OpenAI `/v1/audio/transcriptions` endpoint:

- [faster-whisper-server](https://github.com/fedirz/faster-whisper-server) — GPU-accelerated, CTranslate2
- [whisper.cpp server](https://github.com/ggerganov/whisper.cpp) — CPU-optimized C++ implementation
- [OpenAI API](https://platform.openai.com/docs/api-reference/audio) — the original cloud API
- Any proxy or wrapper that speaks the same protocol

## How It Works

1. Content script captures Alt+R keydown/keyup and remembers the focused element
2. Background script records audio via `getUserMedia` + `MediaRecorder`
3. On release, audio blob is POSTed to your endpoint as `multipart/form-data`
4. Response text is inserted at the cursor position in the original field
5. Shadow DOM overlay shows recording/transcribing/error state

## License

MIT
