// Flaming Vulpine Whisperer — Content Script
// Keyboard hold-to-record, text insertion, and visual overlay

let isHolding = false;
let focusedElement = null;

// ── Keyboard: hold Alt+R to record ──────────────────────────────────────────

document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.altKey && e.code === 'KeyR') {
        e.preventDefault();
        e.stopPropagation();
        if (!isHolding) {
            isHolding = true;
            focusedElement = document.activeElement;
            browser.runtime.sendMessage({ action: 'start-recording' });
        }
    }
}, true);

document.addEventListener('keyup', (e) => {
    if (isHolding && e.code === 'KeyR') {
        e.preventDefault();
        e.stopPropagation();
        isHolding = false;
        browser.runtime.sendMessage({ action: 'stop-recording' });
    }
}, true);

// ── Messages from background ────────────────────────────────────────────────

browser.runtime.onMessage.addListener((msg) => {
    switch (msg.action) {
        case 'recording-started':
            showOverlay('recording');
            break;
        case 'processing':
            showOverlay('processing');
            break;
        case 'insert-text':
            hideOverlay();
            insertText(focusedElement, msg.text);
            break;
        case 'info':
            showOverlay('info', msg.message);
            setTimeout(hideOverlay, 2000);
            break;
        case 'error':
            showOverlay('error', msg.message);
            setTimeout(hideOverlay, 4000);
            break;
        case 'cancelled':
            hideOverlay();
            break;
    }
});

// ── Text insertion ──────────────────────────────────────────────────────────

function insertText(el, text) {
    if (!el) return;
    el.focus();

    // execCommand preserves undo and works broadly
    if (document.execCommand('insertText', false, text)) return;

    // Fallback: input / textarea
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        el.value = el.value.substring(0, start) + text + el.value.substring(end);
        el.selectionStart = el.selectionEnd = start + text.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }

    // Fallback: contentEditable
    if (el.isContentEditable) {
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

// ── Floating overlay indicator (Shadow DOM) ─────────────────────────────────

let overlayHost = null;
let overlayRoot = null;
let overlayEl = null;
let overlayIcon = null;
let overlayText = null;

function ensureOverlay() {
    if (overlayHost) return;

    overlayHost = document.createElement('div');
    overlayHost.id = 'fvw-overlay-host';
    overlayRoot = overlayHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            all: initial;
            position: fixed;
            z-index: 2147483647;
            bottom: 24px;
            right: 24px;
            pointer-events: none;
        }
        .fvw-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            font-weight: 500;
            color: white;
            pointer-events: auto;
            animation: fvw-fadein 0.15s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        @keyframes fvw-fadein {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .fvw-recording {
            background: #e94560;
        }
        .fvw-processing {
            background: #2d3a5c;
        }
        .fvw-info {
            background: #4ecca3;
            color: #1a1a2e;
        }
        .fvw-error {
            background: #c0392b;
        }
        .fvw-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: white;
            animation: fvw-pulse 0.8s ease-in-out infinite;
        }
        @keyframes fvw-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.7); }
        }
        .fvw-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: fvw-spin 0.6s linear infinite;
        }
        @keyframes fvw-spin {
            to { transform: rotate(360deg); }
        }
    `;
    overlayRoot.appendChild(style);

    overlayEl = document.createElement('div');
    overlayEl.className = 'fvw-pill';

    overlayIcon = document.createElement('div');
    overlayText = document.createElement('span');

    overlayEl.appendChild(overlayIcon);
    overlayEl.appendChild(overlayText);
    overlayRoot.appendChild(overlayEl);

    document.documentElement.appendChild(overlayHost);
}

function showOverlay(state, message) {
    ensureOverlay();
    overlayHost.style.display = '';

    // Reset icon
    overlayIcon.className = '';
    overlayIcon.style.display = '';

    switch (state) {
        case 'recording':
            overlayIcon.className = 'fvw-dot';
            overlayText.textContent = 'Recording...';
            overlayEl.className = 'fvw-pill fvw-recording';
            break;
        case 'processing':
            overlayIcon.className = 'fvw-spinner';
            overlayText.textContent = 'Transcribing...';
            overlayEl.className = 'fvw-pill fvw-processing';
            break;
        case 'info':
            overlayIcon.style.display = 'none';
            overlayText.textContent = message || 'Done';
            overlayEl.className = 'fvw-pill fvw-info';
            break;
        case 'error':
            overlayIcon.style.display = 'none';
            overlayText.textContent = message || 'Error';
            overlayEl.className = 'fvw-pill fvw-error';
            break;
    }
}

function hideOverlay() {
    if (overlayHost) overlayHost.style.display = 'none';
}
