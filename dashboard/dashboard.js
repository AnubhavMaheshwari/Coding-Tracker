document.addEventListener('DOMContentLoaded', async () => {
    const listEl = document.getElementById('list');
    const searchEl = document.getElementById('search');
    const groupByEl = document.getElementById('group-by');
    const themeBtn = document.getElementById('theme-btn');
    const exportBtn = document.getElementById('export-btn');
    const pFilters = document.getElementById('p-filters');
    const tFilters = document.getElementById('t-filters');
    const statsEl = document.getElementById('stats');
    const totalCountEl = document.getElementById('total-count');

    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    let allQuestions = [];
    let filter = { platform: 'all', topic: 'all', search: '' };

    // Sidebar Toggle
    const { sidebarCollapsed = false } = await chrome.storage.local.get('sidebarCollapsed');
    if (sidebarCollapsed) sidebar.classList.add('collapsed');

    sidebarToggle.onclick = async () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        await chrome.storage.local.set({ sidebarCollapsed: isCollapsed });
    };

    // Theme logic
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
            themeBtn.innerText = '☀️ Light';
        } else {
            document.body.classList.remove('light-mode');
            themeBtn.innerText = '🌙 Dark';
        }
    }

    // Utility: Title Case
    function toTitleCase(str) {
        if (!str) return '';
        // Handle camelCase or snake_case if existing
        const result = str.replace(/([A-Z])/g, " $1")
            .replace(/[_-]/g, " ")
            .trim();
        return result.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    async function load() {
        const { questions = [] } = await chrome.storage.local.get('questions');
        allQuestions = questions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        updateFilters();
        render();
    }

    function updateFilters() {
        const platforms = {};
        const topics = {};

        // Count platforms (always from all questions)
        allQuestions.forEach(q => {
            platforms[q.platform] = (platforms[q.platform] || 0) + 1;
        });

        // Filter topics based on selected platform
        const platformFiltered = filter.platform === 'all'
            ? allQuestions
            : allQuestions.filter(q => q.platform === filter.platform);

        platformFiltered.forEach(q => {
            (q.topics || []).forEach(t => {
                topics[t] = (topics[t] || 0) + 1;
            });
        });

        totalCountEl.innerText = allQuestions.length;

        // Platform UI
        pFilters.innerHTML = '';
        const allPlatformDiv = document.createElement('div');
        allPlatformDiv.className = `filter-item ${filter.platform === 'all' ? 'active' : ''}`;
        allPlatformDiv.dataset.type = 'platform';
        allPlatformDiv.innerHTML = `<span>All Problems</span> <span class="filter-count">${allQuestions.length}</span>`;
        allPlatformDiv.onclick = () => setFilter('platform', 'all');
        pFilters.appendChild(allPlatformDiv);

        Object.keys(platforms).sort().forEach(p => {
            const div = document.createElement('div');
            div.className = `filter-item ${filter.platform === p ? 'active' : ''}`;
            div.dataset.type = 'platform';
            div.onclick = () => setFilter('platform', p);
            div.innerHTML = `<span>${toTitleCase(p)}</span> <span class="filter-count">${platforms[p]}</span>`;
            pFilters.appendChild(div);
        });

        // Topic UI
        tFilters.innerHTML = '';
        const allTopicDiv = document.createElement('div');
        allTopicDiv.className = `filter-item ${filter.topic === 'all' ? 'active' : ''}`;
        allTopicDiv.dataset.type = 'topic';
        allTopicDiv.innerHTML = `<span>Any Topic</span>`;
        allTopicDiv.onclick = () => setFilter('topic', 'all');
        tFilters.appendChild(allTopicDiv);

        Object.keys(topics).sort((a, b) => topics[b] - topics[a]).slice(0, 15).forEach(t => {
            const div = document.createElement('div');
            div.className = `filter-item ${filter.topic === t ? 'active' : ''}`;
            div.dataset.type = 'topic';
            div.onclick = () => setFilter('topic', t);
            div.innerHTML = `<span>${toTitleCase(t)}</span> <span class="filter-count">${topics[t]}</span>`;
            tFilters.appendChild(div);
        });
    }

    function setFilter(type, val) {
        // Immediate UI feedback for highlighting
        document.querySelectorAll(`.filter-item[data-type="${type}"]`).forEach(el => el.classList.remove('active'));
        // Find the specific element clicked (if available) or update after re-render

        filter[type] = val;
        updateFilters();
        render();
    }

    function render() {
        listEl.innerHTML = '';
        const groupKey = groupByEl.value;

        const filtered = allQuestions.filter(q => {
            const pMatch = filter.platform === 'all' || q.platform === filter.platform;
            const tMatch = filter.topic === 'all' || (q.topics || []).includes(filter.topic);
            const sMatch = !filter.search || q.title.toLowerCase().includes(filter.search) ||
                q.platform.toLowerCase().includes(filter.search) ||
                (q.topics || []).some(t => t.toLowerCase().includes(filter.search));
            return pMatch && tMatch && sMatch;
        });

        const solvedCount = filtered.filter(q => q.solvedAt).length;
        const filterName = filter.platform !== 'all' ? toTitleCase(filter.platform) : (filter.topic !== 'all' ? toTitleCase(filter.topic) : 'All Problems');

        document.getElementById('main-title').innerText = filterName;
        statsEl.innerHTML = `<strong>${filtered.length}</strong> items • <strong>${solvedCount}</strong> solved`;

        if (groupKey === 'none') {
            filtered.forEach(q => listEl.appendChild(createCard(q)));
        } else {
            const groups = {};
            filtered.forEach(q => {
                const rawKeys = groupKey === 'platform' ? [q.platform] : (q.topics && q.topics.length ? q.topics : ['General']);
                rawKeys.forEach(k => {
                    const key = toTitleCase(k);
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(q);
                });
            });

            Object.keys(groups).sort().forEach(label => {
                const head = document.createElement('div');
                head.className = 'group-header';
                head.innerText = label;
                listEl.appendChild(head);
                groups[label].forEach(q => listEl.appendChild(createCard(q)));
            });
        }
    }

    function createCard(q) {
        const div = document.createElement('div');
        div.className = 'card';

        const history = q.history || [];
        const firstAC = history.findIndex(h => h.status === 'AC');
        let truth;
        if (firstAC !== -1) {
            const tries = firstAC + 1;
            truth = tries === 1 ? "Perfect! Solved at first try." : `Solved on try #${tries} (after ${firstAC} failures).`;
        } else {
            truth = `${history.length} failed attempts. Keep pushing!`;
        }

        const formatDate = (ts) => {
            return new Intl.DateTimeFormat('default', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }).format(new Date(ts));
        };

        const dots = history.map(h => `
            <span class="dot" 
                  style="background:${h.status === 'AC' ? 'var(--success)' : 'var(--error)'}; cursor:help;" 
                  title="${h.status} on ${formatDate(h.timestamp)}">
            </span>`).join('');
        const topicPills = (q.topics || []).slice(0, 4).map(t => `<span class="topic-pill">${toTitleCase(t)}</span>`).join('');

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="flex:1;">
                    <a href="${q.url}" target="_blank" class="q-title">${q.title}</a>
                    <div style="display:flex; gap:8px;">
                        <span class="badge badge-platform">${toTitleCase(q.platform)}</span>
                        <span class="badge badge-type">${toTitleCase(q.type || 'Question')}</span>
                        ${q.solvedAt ? '<span class="badge badge-solved">Solved</span>' : ''}
                    </div>
                </div>
                <button class="btn-icon delete-btn">🗑️</button>
            </div>
            
            <div class="meta-row">
                ${q.difficulty ? `<span>Difficulty: ${q.difficulty}</span>` : ''}
                <div style="display:flex; gap:6px;">${topicPills}</div>
            </div>

            <div class="truth-info">
                <div>
                    <div class="truth-text">${truth}</div>
                    <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 2px;">
                        Last track: ${formatDate(q.timestamp)}
                    </div>
                </div>
                <div class="history-dots">${dots}</div>
            </div>
        `;

        // Attach delete listener manually
        const delBtn = div.querySelector('.delete-btn');
        delBtn.onclick = () => delQuestion(q.url);

        return div;
    }

    async function delQuestion(url) {
        if (!confirm("Delete this record permanently?")) return;
        const { questions = [] } = await chrome.storage.local.get('questions');
        const updated = questions.filter(q => q.url !== url);
        await chrome.storage.local.set({ questions: updated });
        load();
    }

    exportBtn.onclick = () => {
        const data = JSON.stringify(allQuestions, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coding-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    searchEl.oninput = (e) => { filter.search = e.target.value.toLowerCase(); render(); };
    groupByEl.onchange = () => render();

    load();
});
