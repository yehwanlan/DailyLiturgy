/**
 * 道教經文集 - 主要應用程式邏輯
 * 更新版：支援新的資料夾結構 (data/daily/, data/baogao/)
 */

// ==================== 
// 全域狀態管理
// ====================
const state = {
    fontSize: parseInt(localStorage.getItem('fontSize')) || 18,
    theme: localStorage.getItem('theme') || 'light',
    expandedSections: JSON.parse(localStorage.getItem('expandedSections')) || {
        daily: true,
        baogao: false,
        future: true
    },
    expandedBaogao: new Set(JSON.parse(localStorage.getItem('expandedBaogao') || '[]')),
    baogaoIndex: null
};

// ==================== 
// DOM 元素
// ====================
const elements = {
    fontDecrease: document.getElementById('font-decrease'),
    fontIncrease: document.getElementById('font-increase'),
    themeToggle: document.getElementById('theme-toggle'),
    navToggle: document.getElementById('nav-toggle'),
    sidebar: document.getElementById('sidebar'),
    sidebarClose: document.getElementById('sidebar-close'),
    backToTop: document.getElementById('back-to-top'),
    contentDaily: document.getElementById('content-daily'),
    contentBaogao: document.getElementById('content-baogao'),
    contentFuture: document.getElementById('content-future'),
    navDaily: document.getElementById('nav-daily'),
    navBaogao: document.getElementById('nav-baogao')
};

// ==================== 
// 初始化
// ====================
document.addEventListener('DOMContentLoaded', async () => {
    // 應用儲存的設定
    applyFontSize();
    applyTheme();

    // 載入經文資料（使用新的資料夾結構）
    await Promise.all([
        loadDailyPrayer(),
        loadBaogaoIndex()
    ]);

    // 設置事件監聽器
    setupEventListeners();

    // 應用儲存的區塊展開狀態
    applySectionStates();
});

// ==================== 
// 資料載入 - 日課
// ====================
async function loadDailyPrayer() {
    try {
        const response = await fetch('data/daily/morning-prayer.json');
        const data = await response.json();
        renderDailyPrayer(data);
        renderDailyNav(data);
    } catch (error) {
        console.error('載入日課資料失敗:', error);
        elements.contentDaily.innerHTML = '<div class="error">載入失敗，請重新整理頁面</div>';
    }
}

// ==================== 
// 資料載入 - 寶誥索引
// ====================
async function loadBaogaoIndex() {
    try {
        const response = await fetch('data/baogao/index.json');
        state.baogaoIndex = await response.json();
        renderBaogaoList(state.baogaoIndex);
        renderBaogaoNav(state.baogaoIndex);
    } catch (error) {
        console.error('載入寶誥索引失敗:', error);
        elements.contentBaogao.innerHTML = '<div class="error">載入失敗，請重新整理頁面</div>';
    }
}

// ==================== 
// 載入單篇寶誥
// ====================
async function loadSingleBaogao(id) {
    const filename = String(id).padStart(3, '0') + '.json';
    try {
        const response = await fetch(`data/baogao/${filename}`);
        return await response.json();
    } catch (error) {
        console.error(`載入寶誥 ${id} 失敗:`, error);
        return null;
    }
}

// ==================== 
// 日課渲染
// ====================
function renderDailyPrayer(data) {
    const html = data.sections.map(section => {
        if (section.subsections) {
            return renderSectionWithSubsections(section);
        } else {
            return renderSimpleSection(section);
        }
    }).join('');

    elements.contentDaily.innerHTML = `
        <div class="source-badge">
            <span>📖 來源：<a href="${data.sourceUrl}" target="_blank">${data.source}</a></span>
        </div>
        ${html}
    `;
}

function renderSimpleSection(section) {
    const content = Array.isArray(section.content)
        ? section.content.map(line => `<p>${line}</p>`).join('')
        : section.content.split('\n').map(line => `<p>${line}</p>`).join('');

    return `
        <div class="scripture-item" id="daily-${section.id}">
            <h3 class="scripture-title">${section.title}</h3>
            ${section.intro ? `<div class="scripture-intro">${section.intro}</div>` : ''}
            <div class="scripture-text">${content}</div>
        </div>
    `;
}

function renderSectionWithSubsections(section) {
    const subsections = section.subsections.map(sub => {
        const content = Array.isArray(sub.content)
            ? sub.content.map(line => `<p>${line}</p>`).join('')
            : sub.content;

        return `
            <div class="subsection">
                <h4 class="subsection-title">${sub.title}</h4>
                ${sub.intro ? `<div class="scripture-intro">${sub.intro}</div>` : ''}
                <div class="scripture-text">${content}</div>
                ${sub.deity ? `<div class="scripture-deity">${sub.deity}</div>` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="scripture-item" id="daily-${section.id}">
            <h3 class="scripture-title">${section.title}</h3>
            ${subsections}
        </div>
    `;
}

function renderDailyNav(data) {
    const navItems = data.sections.map(section =>
        `<li class="nav-item" data-target="daily-${section.id}">${section.title}</li>`
    ).join('');
    elements.navDaily.innerHTML = navItems;
}

// ==================== 
// 寶誥清單渲染
// ====================
function renderBaogaoList(data) {
    const html = data.entries.map(entry => {
        const isExpanded = state.expandedBaogao.has(entry.id);
        return `
            <div class="baogao-item ${isExpanded ? 'expanded' : ''}" data-id="${entry.id}" data-file="${entry.file}" id="baogao-${entry.id}">
                <div class="baogao-header">
                    <span class="baogao-title">${entry.title}</span>
                    <span class="baogao-number">第 ${entry.id} 篇</span>
                </div>
                <div class="baogao-content" data-loaded="false">
                    <div class="loading">載入中...</div>
                </div>
            </div>
        `;
    }).join('');

    elements.contentBaogao.innerHTML = `
        <div class="baogao-info">
            <p>📜 共收錄 ${data.totalEntries} 篇寶誥經文</p>
            <p class="source-link">來源：<a href="${data.sourceUrl}" target="_blank">${data.source}</a></p>
        </div>
        <div class="baogao-grid">${html}</div>
    `;

    // 添加寶誥點擊事件
    document.querySelectorAll('.baogao-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = parseInt(item.dataset.id);
            const contentDiv = item.querySelector('.baogao-content');
            const isLoaded = contentDiv.dataset.loaded === 'true';

            item.classList.toggle('expanded');

            if (item.classList.contains('expanded')) {
                state.expandedBaogao.add(id);

                // 如果尚未載入，則載入內容
                if (!isLoaded) {
                    const baogaoData = await loadSingleBaogao(id);
                    if (baogaoData) {
                        contentDiv.innerHTML = `
                            <div class="scripture-intro">${baogaoData.intro || '志心皈命禮'}</div>
                            <div class="scripture-text">
                                <p>${baogaoData.content}</p>
                            </div>
                        `;
                        contentDiv.dataset.loaded = 'true';
                    } else {
                        contentDiv.innerHTML = '<div class="error">載入失敗</div>';
                    }
                }
            } else {
                state.expandedBaogao.delete(id);
            }

            localStorage.setItem('expandedBaogao', JSON.stringify([...state.expandedBaogao]));
        });
    });

    // 恢復之前展開的寶誥
    state.expandedBaogao.forEach(async id => {
        const item = document.querySelector(`.baogao-item[data-id="${id}"]`);
        if (item) {
            const contentDiv = item.querySelector('.baogao-content');
            const baogaoData = await loadSingleBaogao(id);
            if (baogaoData) {
                contentDiv.innerHTML = `
                    <div class="scripture-intro">${baogaoData.intro || '志心皈命禮'}</div>
                    <div class="scripture-text">
                        <p>${baogaoData.content}</p>
                    </div>
                `;
                contentDiv.dataset.loaded = 'true';
            }
        }
    });
}

function renderBaogaoNav(data) {
    // 只顯示前 20 個作為快速導航
    const entries = data.entries.slice(0, 20);

    const navItems = entries.map(entry =>
        `<li class="nav-item" data-target="baogao-${entry.id}">${entry.title}</li>`
    ).join('');

    elements.navBaogao.innerHTML = navItems +
        '<li class="nav-item placeholder">... 更多請展開區塊查看</li>';
}

// ==================== 
// 事件監聽器設置
// ====================
function setupEventListeners() {
    // 字體大小調整
    elements.fontDecrease.addEventListener('click', () => changeFontSize(-2));
    elements.fontIncrease.addEventListener('click', () => changeFontSize(2));

    // 主題切換
    elements.themeToggle.addEventListener('click', toggleTheme);

    // 側邊欄控制
    elements.navToggle.addEventListener('click', openSidebar);
    elements.sidebarClose.addEventListener('click', closeSidebar);

    // 點擊外部關閉側邊欄
    document.addEventListener('click', (e) => {
        if (elements.sidebar.classList.contains('open') &&
            !elements.sidebar.contains(e.target) &&
            e.target !== elements.navToggle) {
            closeSidebar();
        }
    });

    // 導航項目點擊
    document.querySelectorAll('.nav-list').forEach(list => {
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-item') && !e.target.classList.contains('placeholder')) {
                const targetId = e.target.dataset.target;
                scrollToElement(targetId);
                closeSidebar();
            }
        });
    });

    // 區塊標題點擊展開/收合
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            const sectionName = header.dataset.section;
            toggleSection(sectionName);
        });
    });

    // 滾動事件
    window.addEventListener('scroll', handleScroll);

    // 返回頂部
    elements.backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==================== 
// 字體大小控制
// ====================
function changeFontSize(delta) {
    state.fontSize = Math.max(14, Math.min(28, state.fontSize + delta));
    applyFontSize();
    localStorage.setItem('fontSize', state.fontSize);
}

function applyFontSize() {
    document.documentElement.style.setProperty('--font-size-base', `${state.fontSize}px`);
}

// ==================== 
// 主題控制
// ====================
function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    localStorage.setItem('theme', state.theme);
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    elements.themeToggle.textContent = state.theme === 'light' ? '🌙' : '☀️';
}

// ==================== 
// 側邊欄控制
// ====================
function openSidebar() {
    elements.sidebar.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    elements.sidebar.classList.remove('open');
    document.body.style.overflow = '';
}

// ==================== 
// 區塊展開/收合
// ====================
function toggleSection(sectionName) {
    const content = document.getElementById(`content-${sectionName}`);
    const header = document.querySelector(`.section-header[data-section="${sectionName}"]`);

    if (content && header) {
        const isCollapsed = content.classList.toggle('collapsed');
        header.classList.toggle('collapsed', isCollapsed);

        state.expandedSections[sectionName] = !isCollapsed;
        localStorage.setItem('expandedSections', JSON.stringify(state.expandedSections));
    }
}

function applySectionStates() {
    Object.entries(state.expandedSections).forEach(([section, isExpanded]) => {
        const content = document.getElementById(`content-${section}`);
        const header = document.querySelector(`.section-header[data-section="${section}"]`);

        if (content && header && !isExpanded) {
            content.classList.add('collapsed');
            header.classList.add('collapsed');
        }
    });
}

// ==================== 
// 滾動處理
// ====================
function handleScroll() {
    const scrollY = window.scrollY;

    // 顯示/隱藏返回頂部按鈕
    if (scrollY > 300) {
        elements.backToTop.classList.add('show');
    } else {
        elements.backToTop.classList.remove('show');
    }
}

// ==================== 
// 導航滾動
// ====================
function scrollToElement(targetId) {
    const element = document.getElementById(targetId);
    if (element) {
        // 確保父區塊是展開的
        const section = element.closest('.section-content');
        if (section && section.classList.contains('collapsed')) {
            const sectionName = section.id.replace('content-', '');
            toggleSection(sectionName);
        }

        // 延遲滾動以等待展開動畫
        setTimeout(() => {
            const headerHeight = 80;
            const elementTop = element.getBoundingClientRect().top + window.scrollY - headerHeight;
            window.scrollTo({ top: elementTop, behavior: 'smooth' });
        }, 100);
    }
}

// ==================== 
// 工具函數
// ====================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 使用 debounce 優化滾動處理
window.addEventListener('scroll', debounce(handleScroll, 50));
