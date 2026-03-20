// Flaming Vulpine Whisperer — Options

const endpoint = document.getElementById('endpoint');
const language = document.getElementById('language');
const saved = document.getElementById('savedIndicator');

let saveTimeout = null;

// Load saved settings
browser.storage.local.get(['endpoint', 'language']).then(s => {
    endpoint.value = s.endpoint || '';
    language.value = s.language || '';
});

function save() {
    browser.storage.local.set({
        endpoint: endpoint.value.trim(),
        language: language.value
    });
    saved.classList.add('show');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saved.classList.remove('show'), 1500);
}

endpoint.addEventListener('input', save);
language.addEventListener('change', save);
