async function waitForScrape() {
    for (let i = 0; i < 10; i++) {
        const q = scrapeQuestionInternal();
        if (q && q.title && q.title !== "..." && !q.title.includes("Detecting")) return q;
        await new Promise(r => setTimeout(r, 200));
    }
    return scrapeQuestionInternal();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_QUESTION") {
        waitForScrape().then(sendResponse);
        return true; // Keep channel open for async response
    } else if (request.action === "QUICK_SAVE") {
        waitForScrape().then(q => {
            if (q) quickSave(request.status, q);
            else showNotif("Could not detect problem details.");
        });
        return true;
    }
    return true;
});

function scrapeQuestionInternal() {
    const url = window.location.href;
    let title = "", difficulty = "", topics = [];

    if (url.includes('leetcode.com')) {
        title = document.querySelector('span.text-title-large')?.innerText ||
            document.querySelector('[data-cy="question-title"]')?.innerText ||
            document.title.split(' - ')[0];
        difficulty = document.querySelector('div.text-difficulty-easy, div.text-difficulty-medium, div.text-difficulty-hard')?.innerText || "";
        topics = Array.from(document.querySelectorAll('a[href^="/tag/"]')).map(n => n.innerText).filter(t => t);
    } else if (url.includes('geeksforgeeks.org')) {
        title = document.querySelector('.problems_header_content__title h3')?.innerText || document.title.split(' | ')[0];
        difficulty = document.querySelector('.problems_header_description span')?.innerText || "";
        topics = Array.from(document.querySelectorAll('.problems_tag_container__link')).map(n => n.innerText).filter(t => t);
    } else if (url.includes('codeforces.com')) {
        title = document.querySelector('.problem-statement .title')?.innerText || document.title;
        topics = Array.from(document.querySelectorAll('.tag-box')).map(n => n.innerText.trim()).filter(t => t);
    }

    if (!title || title === "Loading..." || title.length < 2) title = document.querySelector('h1')?.innerText || document.title;

    title = title.replace(/^\d+\.\s*/, '').trim();

    const type = url.match(/problems|problemset|contest|challenges|tasks|task/) ? "Question" : "Blog";
    return title ? { title, difficulty, type, topics } : null;
}

function scrapeQuestion() { return scrapeQuestionInternal(); }

async function quickSave(subStatus, providedQ = null) {
    const qRaw = providedQ || await waitForScrape();
    if (!qRaw) return;

    const url = window.location.href;
    const { questions = [] } = await chrome.storage.local.get('questions');
    const idx = questions.findIndex(q => q.url === url);
    const now = Date.now();
    const entry = { timestamp: now, status: subStatus };

    if (idx !== -1) {
        if (!questions[idx].history) questions[idx].history = [];
        questions[idx].history.push(entry);
        questions[idx].attempts = questions[idx].history.length;
        questions[idx].timestamp = now;
        if (subStatus === 'AC' && !questions[idx].solvedAt) questions[idx].solvedAt = now;
        await chrome.storage.local.set({ questions });
        showNotif(`${subStatus} recorded!`);
    } else {
        const q = {
            ...qRaw,
            platform: getPlatform(url),
            url,
            history: [entry],
            attempts: 1,
            timestamp: now,
            solvedAt: subStatus === 'AC' ? now : null
        };
        questions.push(q);
        await chrome.storage.local.set({ questions });
        showNotif("Question tracked!");
    }
}

function getPlatform(url) {
    if (url.includes('leetcode.com')) return "LeetCode";
    if (url.includes('geeksforgeeks.org')) return "GFG";
    if (url.includes('codeforces.com')) return "Codeforces";
    if (url.includes('naukri.com')) return "CodeStudio";
    return "General";
}

function showNotif(msg) {
    const div = document.createElement('div');
    div.innerText = msg;
    div.style.cssText = `
        position:fixed; top:20px; right:20px; z-index:1000001; 
        background:rgba(15,23,42,0.95); color:white; padding:10px 20px; 
        border-radius:10px; font-size:13px; font-weight:600; 
        box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); pointer-events:none; 
        animation: fadeTrack 2.5s forwards; font-family: sans-serif;
    `;
    if (!document.getElementById('notif-style-minimal')) {
        const s = document.createElement('style');
        s.id = 'notif-style-minimal';
        s.innerHTML = `@keyframes fadeTrack { 0%{opacity:0; transform:translateY(-10px);} 10%,90%{opacity:1; transform:translateY(0);} 100%{opacity:0; transform:translateY(-10px);} }`;
        document.head.appendChild(s);
    }
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2500);
}
