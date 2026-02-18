document.addEventListener('DOMContentLoaded', async () => {
    const qTitle = document.getElementById('q-title');
    const qMeta = document.getElementById('q-meta');
    const status = document.getElementById('status');
    const acBtn = document.getElementById('ac-btn');
    const attemptBtn = document.getElementById('attempt-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const themeBtn = document.getElementById('theme-btn');
    const platformBadge = document.getElementById('platform-badge');

    let currentQuestion = null;

    // Load Theme
    const { theme = 'dark' } = await chrome.storage.local.get('theme');
    applyTheme(theme);

    themeBtn.onclick = async () => {
        const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
        await chrome.storage.local.set({ theme: nextTheme });
    };

    function applyTheme(t) {
        if (t === 'light') {
            document.body.classList.add('light-mode');
            themeBtn.innerText = '☀️';
        } else {
            document.body.classList.remove('light-mode');
            themeBtn.innerText = '🌙';
        }
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    // Detect platform
    const url = tab.url;
    let platform = 'General';
    if (url.includes('leetcode.com')) platform = 'LeetCode';
    else if (url.includes('geeksforgeeks.org')) platform = 'GFG';
    else if (url.includes('codeforces.com')) platform = 'Codeforces';
    else if (url.includes('naukri.com')) platform = 'CodeStudio';

    platformBadge.innerText = platform;

    // Initialize UI state
    acBtn.disabled = true;
    attemptBtn.disabled = true;
    acBtn.style.opacity = "0.5";
    attemptBtn.style.opacity = "0.5";

    async function updateQuestionInfo() {
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: "GET_QUESTION" });
            if (response && response.title) {
                currentQuestion = { ...response, platform, url };

                acBtn.disabled = false;
                attemptBtn.disabled = false;
                acBtn.style.opacity = "1";
                attemptBtn.style.opacity = "1";

                const { questions = [] } = await chrome.storage.local.get('questions');
                const existing = questions.find(q => q.url === url);

                if (existing) {
                    const history = existing.history || [];
                    const acTotal = history.filter(h => h.status === 'AC').length;
                    const subCount = history.length || existing.attempts || 1;
                    qMeta.innerText = `Submissions: ${subCount} (Accepted: ${acTotal})`;
                } else {
                    qMeta.innerText = response.type === "Blog" ? "Article" : (response.difficulty || "No difficulty detected");
                }
                qTitle.innerText = response.title;
            } else {
                qTitle.innerText = "No question detected";
                qMeta.innerText = "Make sure you're on a problem page.";
            }
        } catch (e) {
            qTitle.innerText = "Tracker not active";
            qMeta.innerText = "Please refresh the page to enable tracking.";
        }
    }

    async function record(subStatus) {
        if (!currentQuestion) return;

        const { questions = [] } = await chrome.storage.local.get('questions');
        const idx = questions.findIndex(q => q.url === currentQuestion.url);
        const now = Date.now();
        const entry = { timestamp: now, status: subStatus };

        if (idx !== -1) {
            if (!questions[idx].history) questions[idx].history = [];
            questions[idx].history.push(entry);
            questions[idx].attempts = questions[idx].history.length;
            questions[idx].timestamp = now;
            if (subStatus === 'AC' && !questions[idx].solvedAt) questions[idx].solvedAt = now;
            await chrome.storage.local.set({ questions });
            status.innerText = `Successfully recorded ${subStatus}!`;
        } else {
            const q = { ...currentQuestion, history: [entry], attempts: 1, timestamp: now };
            if (subStatus === 'AC') q.solvedAt = now;
            questions.push(q);
            await chrome.storage.local.set({ questions });
            status.innerText = `Question saved as ${subStatus}!`;
        }

        status.style.color = subStatus === 'AC' ? '#10b981' : '#f43f5e';
        setTimeout(() => { if (status) status.innerText = ''; }, 3000);

        // Refresh display
        updateQuestionInfo();
    }

    acBtn.onclick = () => record('AC');
    attemptBtn.onclick = () => record('Attempt');
    dashboardBtn.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });

    updateQuestionInfo();
});
