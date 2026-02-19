chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save-ac",
        title: "Track: Mark as Accepted ✅",
        contexts: ["all"]
    });

    chrome.contextMenus.create({
        id: "save-try",
        title: "Track: Mark as Attempted ❌",
        contexts: ["all"]
    });

    chrome.contextMenus.create({
        id: "open-dashboard",
        title: "Open Coding Tracker Dashboard",
        contexts: ["all"]
    });

    chrome.contextMenus.create({
        id: "save-blog",
        title: "Save as Blog 📖",
        contexts: ["all"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open-dashboard") {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    } else if (info.menuItemId === "save-ac") {
        chrome.tabs.sendMessage(tab.id, { action: "QUICK_SAVE", status: "AC" });
    } else if (info.menuItemId === "save-try") {
        chrome.tabs.sendMessage(tab.id, { action: "QUICK_SAVE", status: "Attempt" });
    } else if (info.menuItemId === "save-blog") {
        chrome.tabs.sendMessage(tab.id, { action: "SAVE_BLOG" });
    }
});
