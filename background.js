// Flaming Vulpine Whisperer — Background Script
// Handles audio recording and Whisper API communication

let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingTabId = null;
let recordingStartTime = null;

// Settings (loaded from storage, updated via onChanged)
let settings = { endpoint: '', language: '' };

browser.storage.local.get(['endpoint', 'language']).then(s => {
    settings.endpoint = s.endpoint || '';
    settings.language = s.language || '';
});

browser.storage.onChanged.addListener((changes) => {
    if (changes.endpoint) settings.endpoint = changes.endpoint.newValue || '';
    if (changes.language) settings.language = changes.language.newValue || '';
});

// Toggle via commands API (Alt+R press-to-toggle fallback)
browser.commands.onCommand.addListener((command) => {
    if (command === 'toggle-recording') {
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
            if (tabs[0]) {
                if (isRecording) {
                    stopRecording();
                } else {
                    startRecording(tabs[0].id);
                }
            }
        });
    }
});

// Messages from content script (hold-to-record)
browser.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === 'start-recording' && sender.tab) {
        startRecording(sender.tab.id);
    } else if (msg.action === 'stop-recording') {
        stopRecording();
    }
});

// Browser action click: toggle recording or open options if no endpoint
browser.browserAction.onClicked.addListener((tab) => {
    if (!settings.endpoint) {
        browser.runtime.openOptionsPage();
        return;
    }
    if (isRecording) {
        stopRecording();
    } else {
        startRecording(tab.id);
    }
});

async function startRecording(tabId) {
    if (isRecording) return;

    if (!settings.endpoint) {
        sendToTab(tabId, {
            action: 'error',
            message: 'Set your Whisper API URL in extension options'
        });
        browser.runtime.openOptionsPage();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];
        recordingTabId = tabId;
        recordingStartTime = Date.now();

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            isRecording = false;

            // Discard recordings shorter than 300ms
            const duration = Date.now() - recordingStartTime;
            if (duration < 300) {
                sendToTab(recordingTabId, { action: 'cancelled' });
                return;
            }

            sendToTab(recordingTabId, { action: 'processing' });

            const blob = new Blob(audioChunks, { type: mimeType });
            await transcribe(blob);
        };

        mediaRecorder.start(100);
        isRecording = true;
        sendToTab(tabId, { action: 'recording-started' });

    } catch (err) {
        console.error('Mic error:', err);
        if (err.name === 'NotAllowedError') {
            // Open the mic permission prompt page
            sendToTab(tabId, {
                action: 'error',
                message: 'Microphone permission needed — opening prompt...'
            });
            browser.tabs.create({ url: browser.runtime.getURL('mic-prompt.html') });
        } else {
            sendToTab(tabId, {
                action: 'error',
                message: err.message || 'Failed to start recording'
            });
        }
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

async function transcribe(blob) {
    try {
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        formData.append('response_format', 'json');
        if (settings.language) {
            formData.append('language', settings.language);
        }

        // Normalize endpoint: strip trailing slash, append path
        const base = settings.endpoint.replace(/\/+$/, '');
        const url = base + '/v1/audio/transcriptions';

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Server ${response.status}: ${errText.substring(0, 100)}`);
        }

        const data = await response.json();
        const text = data.text?.trim() || '';

        if (text) {
            sendToTab(recordingTabId, { action: 'insert-text', text });
        } else {
            sendToTab(recordingTabId, { action: 'info', message: 'No speech detected' });
        }

    } catch (err) {
        console.error('Transcription error:', err);
        sendToTab(recordingTabId, {
            action: 'error',
            message: err.message || 'Transcription failed'
        });
    }
}

function sendToTab(tabId, msg) {
    if (!tabId) return;
    browser.tabs.sendMessage(tabId, msg).catch(() => {
        // Content script not available (restricted page, etc.)
    });
}
