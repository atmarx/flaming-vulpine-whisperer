// Flaming Vulpine Whisperer — Background Script
// Receives audio from content script, calls Whisper API, returns text.

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

// Browser action click: toggle or open options
browser.browserAction.onClicked.addListener((tab) => {
    if (!settings.endpoint) {
        browser.runtime.openOptionsPage();
        return;
    }
    browser.tabs.sendMessage(tab.id, { action: 'toggle-recording' }).catch(() => {});
});

// Messages from content script
browser.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === 'transcribe') {
        transcribe(msg.audio, msg.mimeType, sender.tab.id);
    } else if (msg.action === 'check-endpoint') {
        // Content script checks if endpoint is configured before recording
        return Promise.resolve({ configured: !!settings.endpoint });
    }
});

async function transcribe(base64Audio, mimeType, tabId) {
    if (!settings.endpoint) {
        sendToTab(tabId, {
            action: 'error',
            message: 'Set your Whisper API URL in extension options'
        });
        browser.runtime.openOptionsPage();
        return;
    }

    try {
        // Decode base64 back to blob
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });

        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        formData.append('response_format', 'json');
        if (settings.language) {
            formData.append('language', settings.language);
        }

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
            sendToTab(tabId, { action: 'insert-text', text });
        } else {
            sendToTab(tabId, { action: 'info', message: 'No speech detected' });
        }

    } catch (err) {
        console.error('Transcription error:', err);
        sendToTab(tabId, {
            action: 'error',
            message: err.message || 'Transcription failed'
        });
    }
}

function sendToTab(tabId, msg) {
    if (!tabId) return;
    browser.tabs.sendMessage(tabId, msg).catch(() => {});
}
