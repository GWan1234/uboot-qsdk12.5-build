const APP_STATE = {
    lang: "en",
    theme: "auto",
    page: "",
    settingsOpen: false
};

// ==============================
// 侧边导航栏
// ==============================

/**
 * 侧边栏管理器
 * 负责动态生成和更新侧边栏导航
 */
class SidebarManager {
    constructor() {
        this.sidebarElement = null;
        this.currentPath = this.getCurrentPath();
        this.currentPageId = this.getCurrentPageId();
        this.navigationSections = this.getNavigationConfig();
    }

    /**
     * 获取当前页面路径
     */
    getCurrentPath() {
        const pathname = location && location.pathname ? location.pathname : "";
        return pathname === "" ? "/" : pathname;
    }

    /**
     * 获取当前页面ID
     */
    getCurrentPageId() {
        const path = this.getCurrentPath();

        // 映射路径到页面ID
        const pathMap = {
            '/': 'firmware',
            '/cgi-bin/luci': 'firmware',
            '/cgi-bin/luci/': 'firmware',
            '/index.html': 'firmware',
            '/uboot.html': 'uboot',
            '/art.html': 'art',
            '/cdt.html': 'cdt',
            '/gpt.html': 'gpt',
            '/mibib.html': 'mibib',
            '/simg.html': 'simg',
            '/initramfs.html': 'initramfs',
            '/reboot.html': 'reboot',
            '/flashing.html': 'flashing',
            '/booting.html': 'booting',
        };

        return pathMap[path] || null;
    }

    /**
     * 导航配置
     */
    getNavigationConfig() {
        return {
            basic: {
                titleKey: "nav.basic",
                items: [
                    { path: "/", labelKey: "nav.firmware", id: "firmware" },
                    { path: "/uboot.html", labelKey: "nav.uboot", id: "uboot" }
                ]
            },
            advanced: {
                titleKey: "nav.advanced",
                items: [
                    { path: "/art.html", labelKey: "nav.art", id: "art" },
                    { path: "/cdt.html", labelKey: "nav.cdt", id: "cdt" },
                    { path: "/gpt.html", labelKey: "nav.gpt", id: "gpt" },
                    { path: "/mibib.html", labelKey: "nav.mibib", id: "mibib" },
                    { path: "/simg.html", labelKey: "nav.simg", id: "simg" },
                    { path: "/initramfs.html", labelKey: "nav.initramfs", id: "initramfs" }
                ]
            },
            system: {
                titleKey: "nav.system",
                items: [
                    {
                        path: "/reboot.html",
                        labelKey: "nav.reboot",
                        id: "reboot",
                        onClick: () => confirm(t("reboot.confirm"))
                    }
                ]
            }
        };
    }

    /**
     * 初始化侧边栏
     */
    init() {
        this.sidebarElement = document.getElementById("sidebar");
        if (!this.sidebarElement) {
            console.warn("Sidebar element not found");
            return;
        }

        // 检查是否已渲染
        if (this.sidebarElement.getAttribute("data-rendered") === "1") {
            // 如果已渲染，只更新状态而不重新渲染
            this.updateActiveStates();
            return;
        }

        this.render();
    }

    /**
     * 渲染整个侧边栏
     */
    render() {
        // 清空并标记为已渲染
        this.sidebarElement.innerHTML = "";
        this.sidebarElement.setAttribute("data-rendered", "1");

        // 构建侧边栏各组件
        this.renderBrandSection();
        this.renderNavigationSections();

        // 应用国际化
        applyI18n(this.sidebarElement);

        // 更新激活状态
        this.updateActiveStates();
    }

    /**
     * 创建品牌标题区
     */
    renderBrandSection() {
        const brandContainer = document.createElement("div");
        brandContainer.className = "sidebar-brand";

        const title = document.createElement("div");
        title.className = "title";
        title.setAttribute("data-i18n", "app.name");
        title.textContent = t("app.name");

        brandContainer.appendChild(title);
        this.sidebarElement.appendChild(brandContainer);
    }

    /**
     * 渲染所有导航部分
     */
    renderNavigationSections() {
        const navContainer = document.createElement("div");
        navContainer.className = "nav";

        // 按顺序渲染各导航部分
        Object.entries(this.navigationSections).forEach(([sectionKey, sectionConfig]) => {
            navContainer.appendChild(this.createNavigationSection(sectionKey, sectionConfig));
        });

        this.sidebarElement.appendChild(navContainer);

        // 初始化折叠状态 - 只展开当前页面所在section
        this.initCollapsibleSections();
    }

    /**
     * 创建单个导航部分
     */
    createNavigationSection(sectionKey, sectionConfig) {
        const sectionElement = document.createElement("div");
        sectionElement.className = "nav-section";
        sectionElement.dataset.section = sectionKey;

        // 添加标题 - 作为折叠按钮
        const titleElement = document.createElement("div");
        titleElement.className = "nav-section-title";
        titleElement.setAttribute("data-i18n", sectionConfig.titleKey);
        titleElement.textContent = t(sectionConfig.titleKey);
        sectionElement.appendChild(titleElement);

        // 创建导航项容器
        const itemsContainer = document.createElement("div");
        itemsContainer.className = "nav-items";

        // 添加导航项
        sectionConfig.items.forEach(item => {
            itemsContainer.appendChild(this.createNavLink(item));
        });

        sectionElement.appendChild(itemsContainer);

        return sectionElement;
    }

    /**
     * 创建单个导航链接
     */
    createNavLink(item) {
        const link = document.createElement("a");
        link.className = "nav-link";
        link.href = item.path;
        link.setAttribute("data-nav-id", item.id);

        // 设置点击事件（如果有）
        if (item.onClick) {
            link.onclick = (e) => {
                if (!item.onClick()) {
                    e.preventDefault();
                }
            };
        }

        // 文本标签
        const label = document.createElement("span");
        label.setAttribute("data-i18n", item.labelKey);
        label.textContent = t(item.labelKey);
        link.appendChild(label);

        return link;
    }

    /**
     * 初始化可折叠菜单
     * 规则：只展开当前页面所在的section，其他全部折叠
     */
    initCollapsibleSections() {
        const sections = this.sidebarElement.querySelectorAll('.nav-section');

        // 先找出当前页面所在的section
        const activeSectionKey = this.findActiveSection();

        sections.forEach((section) => {
            const title = section.querySelector('.nav-section-title');
            const sectionKey = section.dataset.section;

            // 移除旧的点击事件监听器（避免重复绑定）
            const newTitle = title.cloneNode(true);
            title.parentNode.replaceChild(newTitle, title);

            // 绑定新的点击事件
            newTitle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSection(section, sectionKey);
            });

            // 根据当前页面所在section设置折叠状态
            if (activeSectionKey === sectionKey) {
                // 当前页面所在section展开
                section.classList.remove('collapsed');
                // 添加激活section类
                section.classList.add('active-section');
            } else {
                // 其他section全部折叠
                section.classList.add('collapsed');
                section.classList.remove('active-section');
            }
        });
    }

    /**
     * 查找当前页面所在的section
     */
    findActiveSection() {
        if (!this.currentPageId) return null;

        for (const [sectionKey, sectionConfig] of Object.entries(this.navigationSections)) {
            const found = sectionConfig.items.some(item => item.id === this.currentPageId);
            if (found) {
                return sectionKey;
            }
        }
        return null;
    }

    /**
     * 更新所有导航项的激活状态
     */
    updateActiveStates() {
        if (!this.sidebarElement) return;

        // 移除所有active类
        const allLinks = this.sidebarElement.querySelectorAll('.nav-link');
        allLinks.forEach(link => link.classList.remove('active'));

        // 为当前页面的链接添加active类
        allLinks.forEach(link => {
            const navId = link.getAttribute('data-nav-id');
            if (navId === this.currentPageId) {
                link.classList.add('active');
            }
        });

        // 更新当前页面所在section的激活状态
        this.updateActiveSection();
    }

    /**
     * 更新当前页面所在section的激活状态
     */
    updateActiveSection() {
        if (!this.sidebarElement) return;

        // 移除所有section的active-section类
        const allSections = this.sidebarElement.querySelectorAll('.nav-section');
        allSections.forEach(section => {
            section.classList.remove('active-section');
        });

        // 为当前页面所在的section添加active-section类
        const activeSectionKey = this.findActiveSection();
        if (activeSectionKey) {
            const activeSection = this.sidebarElement.querySelector(`.nav-section[data-section="${activeSectionKey}"]`);
            if (activeSection) {
                activeSection.classList.add('active-section');
            }
        }
    }

    /**
     * 切换部分折叠状态
     * 点击标题时切换当前section的折叠状态
     */
    toggleSection(section, sectionKey) {
        // 切换当前部分的折叠状态
        section.classList.toggle('collapsed');
    }

    /**
     * 更新导航项状态（语言切换后）
     */
    updateNavigationLabels() {
        if (!this.sidebarElement) return;

        // 更新所有导航标签的文本
        const navLabels = this.sidebarElement.querySelectorAll("[data-i18n]");
        navLabels.forEach(label => {
            const key = label.getAttribute("data-i18n");
            if (key) {
                label.textContent = t(key);
            }
        });

        // 刷新折叠状态 - 保持只展开当前页面所在section
        this.refreshCollapsibleState();
    }

    /**
     * 刷新折叠状态（不重建DOM）
     * 规则：只展开当前页面所在section，其他全部折叠
     */
    refreshCollapsibleState() {
        const sections = this.sidebarElement.querySelectorAll('.nav-section');
        const activeSectionKey = this.findActiveSection();

        sections.forEach((section) => {
            const sectionKey = section.dataset.section;

            // 根据当前页面所在section设置折叠状态
            if (activeSectionKey === sectionKey) {
                // 当前页面所在section展开
                section.classList.remove('collapsed');
                section.classList.add('active-section');
            } else {
                // 其他section全部折叠
                section.classList.add('collapsed');
                section.classList.remove('active-section');
            }
        });
    }
}

// ==============================
// 侧边栏收起/唤出功能
// ==============================

/**
 * 侧边栏管理器增强版
 * 添加收起/唤出功能
 */
class EnhancedSidebarManager extends SidebarManager {
    constructor() {
        super();
        this.isMobile = this.checkIsMobile();
        this.isCollapsed = false;
        this.toggleButton = null;
        this.overlay = null;
    }

    /**
     * 检查是否为移动设备
     */
    checkIsMobile() {
        return window.innerWidth <= 992; // 平板及以下视为移动设备
    }

    /**
     * 初始化增强功能
     */
    initEnhanced() {
        this.toggleButton = document.getElementById('sidebarToggle');
        this.overlay = document.getElementById('sidebarOverlay');

        if (!this.toggleButton || !this.sidebarElement) {
            return;
        }

        // 加载保存的状态
        this.loadSidebarState();

        // 绑定事件
        this.bindEvents();
        this.bindKeyboardEvents();

        // 初始状态设置
        this.updateSidebarState();

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * 加载侧边栏状态
     */
    loadSidebarState() {
        try {
            if (this.isMobile) {
                // 移动端默认收起
                this.isCollapsed = true;
            } else {
                // 桌面端尝试加载保存的状态
                const savedState = localStorage.getItem('sidebarCollapsed');
                if (savedState !== null) {
                    this.isCollapsed = savedState === 'true';
                }
            }
        } catch (error) {
            console.warn('Failed to load sidebar state:', error);
            this.isCollapsed = this.isMobile;
        }
    }

    /**
     * 保存侧边栏状态
     */
    saveSidebarState() {
        try {
            if (!this.isMobile) {
                localStorage.setItem('sidebarCollapsed', this.isCollapsed.toString());
            }
        } catch (error) {
            console.warn('Failed to save sidebar state:', error);
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 切换按钮点击事件
        this.toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSidebar();
        });

        // 遮罩层点击事件
        if (this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.collapseSidebar();
            });
        }

        // 点击侧边栏外部时收起（仅移动端）
        document.addEventListener('click', (e) => {
            if (this.isMobile && this.isExpanded() &&
                !this.sidebarElement.contains(e.target) &&
                e.target !== this.toggleButton) {
                this.collapseSidebar();
            }
        });

        // 阻止侧边栏内点击事件冒泡
        this.sidebarElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * 绑定键盘事件
     */
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Ctrl + B 或 Cmd + B 切换侧边栏
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                this.toggleSidebar();
                e.preventDefault();
            }
        });
    }

    /**
     * 切换侧边栏状态
     */
    toggleSidebar() {
        this.isCollapsed = !this.isCollapsed;
        this.updateSidebarState();
        this.saveSidebarState();
    }

    /**
     * 展开侧边栏
     */
    expandSidebar() {
        this.isCollapsed = false;
        this.updateSidebarState();
        this.saveSidebarState();
    }

    /**
     * 收起侧边栏
     */
    collapseSidebar() {
        this.isCollapsed = true;
        this.updateSidebarState();
        this.saveSidebarState();
    }

    /**
     * 检查侧边栏是否展开
     */
    isExpanded() {
        return !this.isCollapsed;
    }

    /**
     * 更新侧边栏状态
     */
    updateSidebarState() {
        const isExpanded = !this.isCollapsed;

        // 更新侧边栏类名
        this.sidebarElement.classList.toggle('collapsed', this.isCollapsed);
        this.sidebarElement.classList.toggle('expanded', isExpanded);

        // 更新切换按钮显示状态
        this.toggleButton.style.display = isExpanded ? "none" : "flex";

        // 更新遮罩层
        if (this.overlay) {
            this.overlay.classList.toggle('active', isExpanded && this.isMobile);
        }

        // 更新 body 类名（移动端防止滚动）
        document.body.classList.toggle('sidebar-expanded', isExpanded && this.isMobile);
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = this.checkIsMobile();

        // 如果移动状态发生变化
        if (wasMobile !== this.isMobile) {
            if (this.isMobile) {
                // 切换到移动端：默认收起
                this.isCollapsed = true;
            } else {
                // 切换到桌面端：恢复保存的状态或默认展开
                try {
                    const savedState = localStorage.getItem('sidebarCollapsed');
                    this.isCollapsed = savedState ? savedState === 'true' : false;
                } catch (error) {
                    this.isCollapsed = false;
                }
            }
            this.updateSidebarState();
        }
    }
}

/**
 * 全局增强侧边栏实例
 */
let enhancedSidebarManager = null;

/**
 * 初始化侧边栏增强功能
 */
function initEnhancedSidebar() {
    if (!enhancedSidebarManager) {
        enhancedSidebarManager = new EnhancedSidebarManager();
    }

    // 先初始化基础侧边栏
    enhancedSidebarManager.init();

    // 再初始化增强功能
    enhancedSidebarManager.initEnhanced();
}

/**
 * 初始化侧边栏
 */
function ensureSidebar() {
    initEnhancedSidebar();
}

/**
 * 更新侧边栏国际化文本
 */
function updateSidebarI18n() {
    if (enhancedSidebarManager) {
        enhancedSidebarManager.updateNavigationLabels();
    }
}

// ==============================
// 设置面板管理
// ==============================

/**
 * 设置面板管理器
 * 负责右下角的设置按钮和弹出面板
 */
class SettingsManager {
    constructor() {
        this.isOpen = false;
        this.button = null;
        this.panel = null;
    }

    /**
     * 初始化设置面板
     */
    init() {
        this.createSettingsButton();
        this.createSettingsPanel();
        this.bindEvents();
    }

    /**
     * 创建设置按钮
     */
    createSettingsButton() {
        this.button = document.createElement('button');
        this.button.id = 'settingsButton';
        this.button.className = 'settings-button';
        this.button.innerHTML = '⚙️';
        this.button.setAttribute('title', t('control.settings'));
        document.body.appendChild(this.button);
    }

    /**
     * 创建设置面板
     */
    createSettingsPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'settingsPanel';
        this.panel.className = 'settings-panel';

        // 语言选择器
        const langRow = document.createElement('div');
        langRow.className = 'settings-row';

        const langLabel = document.createElement('span');
        langLabel.className = 'settings-label';
        langLabel.setAttribute('data-i18n', 'control.language');
        langLabel.textContent = t('control.language');
        langRow.appendChild(langLabel);

        const langSelect = document.createElement('select');
        langSelect.id = 'lang_select_settings';
        langSelect.innerHTML = `
            <option value="en">English</option>
            <option value="zh-cn">简体中文</option>
        `;
        langSelect.value = APP_STATE.lang;
        langSelect.onchange = () => setLang(langSelect.value);
        langRow.appendChild(langSelect);

        this.panel.appendChild(langRow);

        // 主题选择器
        const themeRow = document.createElement('div');
        themeRow.className = 'settings-row';

        const themeLabel = document.createElement('span');
        themeLabel.className = 'settings-label';
        themeLabel.setAttribute('data-i18n', 'control.theme');
        themeLabel.textContent = t('control.theme');
        themeRow.appendChild(themeLabel);

        const themeSelect = document.createElement('select');
        themeSelect.id = 'theme_select_settings';

        const options = [
            { value: "auto", key: "theme.auto" },
            { value: "light", key: "theme.light" },
            { value: "dark", key: "theme.dark" }
        ];

        options.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option.value;
            optElement.setAttribute('data-i18n', option.key);
            optElement.textContent = t(option.key);
            themeSelect.appendChild(optElement);
        });

        themeSelect.value = APP_STATE.theme;
        themeSelect.onchange = () => setTheme(themeSelect.value);
        themeRow.appendChild(themeSelect);

        this.panel.appendChild(themeRow);

        document.body.appendChild(this.panel);
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 点击按钮切换面板
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // 点击外部关闭面板
        document.addEventListener('click', (e) => {
            if (this.isOpen &&
                !this.panel.contains(e.target) &&
                e.target !== this.button) {
                this.close();
            }
        });

        // ESC 键关闭面板
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
                e.preventDefault();
            }
        });
    }

    /**
     * 切换面板状态
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * 打开面板
     */
    open() {
        this.isOpen = true;
        APP_STATE.settingsOpen = true;
        this.panel.classList.add('open');
        this.button.classList.add('active');
    }

    /**
     * 关闭面板
     */
    close() {
        this.isOpen = false;
        APP_STATE.settingsOpen = false;
        this.panel.classList.remove('open');
        this.button.classList.remove('active');
    }

    /**
     * 更新面板国际化
     */
    updateI18n() {
        // 更新按钮标题
        this.button.setAttribute('title', t('control.settings'));

        // 更新面板内的文本
        const labels = this.panel.querySelectorAll('[data-i18n]');
        labels.forEach(label => {
            const key = label.getAttribute('data-i18n');
            label.textContent = t(key);
        });

        // 更新选择器选项
        const themeSelect = document.getElementById('theme_select_settings');
        if (themeSelect) {
            const options = themeSelect.querySelectorAll('option[data-i18n]');
            options.forEach(opt => {
                const key = opt.getAttribute('data-i18n');
                opt.textContent = t(key);
            });
        }
    }
}

// 全局设置面板实例
let settingsManager = null;

/**
 * 初始化设置面板
 */
function initSettingsPanel() {
    if (!settingsManager) {
        settingsManager = new SettingsManager();
    }
    settingsManager.init();
}

/**
 * 更新设置面板国际化
 */
function updateSettingsI18n() {
    if (settingsManager) {
        settingsManager.updateI18n();
    }
}

// ==============================
// 工具函数
// ==============================

/**
 * 标准化语言代码
 */
function normalizeLang(lang) {
    if (!lang) return "en";
    const lowerLang = String(lang).toLowerCase();
    return lowerLang.indexOf("zh") === 0 ? "zh-cn" : "en";
}

/**
 * 检测用户语言偏好
 */
function detectLang() {
    // 尝试从 localStorage 读取
    try {
        const savedLang = localStorage.getItem("lang");
        if (savedLang) return normalizeLang(savedLang);
    } catch (error) {
        console.warn("Failed to read language from localStorage:", error);
    }

    // 从浏览器检测
    const browserLanguages = navigator.languages ||
                            (navigator.language ? [navigator.language] : []);
    return normalizeLang(browserLanguages[0]);
}

/**
 * 检测主题偏好
 */
function detectTheme() {
    try {
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme) return savedTheme;
    } catch (error) {
        console.warn("Failed to read theme from localStorage:", error);
    }
    return "auto";
}

/**
 * 翻译函数
 */
function t(key) {
    const lang = APP_STATE.lang || "en";

    // 尝试目标语言
    if (I18N[lang] && I18N[lang][key] !== undefined) {
        return I18N[lang][key];
    }

    // 回退到英语
    if (I18N.en && I18N.en[key] !== undefined) {
        return I18N.en[key];
    }

    // 返回键名作为最后的回退
    return key;
}

/**
 * 应用国际化到指定元素或整个文档
 */
function applyI18n(element) {
    const container = element || document;

    // 更新文本内容
    const textElements = container.querySelectorAll("[data-i18n]");
    textElements.forEach(el => {
        const key = el.getAttribute("data-i18n");
        el.textContent = t(key);
    });

    // 更新HTML内容
    const htmlElements = container.querySelectorAll("[data-i18n-html]");
    htmlElements.forEach(el => {
        const key = el.getAttribute("data-i18n-html");
        el.innerHTML = t(key);
    });

    // 更新属性
    const attrElements = container.querySelectorAll("[data-i18n-attr]");
    attrElements.forEach(el => {
        const attrSpec = el.getAttribute("data-i18n-attr");
        const [attrName, ...keyParts] = attrSpec.split(":");
        const key = keyParts.join(":");

        if (attrName && key) {
            el.setAttribute(attrName, t(key));
        }
    });
}

/**
 * 设置语言
 */
function setLang(lang) {
    APP_STATE.lang = normalizeLang(lang);

    try {
        localStorage.setItem("lang", APP_STATE.lang);
    } catch (error) {
        console.warn("Failed to save language to localStorage:", error);
    }

    applyI18n(document);

    // 更新特定组件
    if (typeof updateSidebarI18n === "function") {
        updateSidebarI18n();
    }

    // 更新设置面板国际化
    if (typeof updateSettingsI18n === "function") {
        updateSettingsI18n();
    }

    updateDocumentTitle();
}

/**
 * 设置主题
 */
function setTheme(theme) {
    APP_STATE.theme = theme || "auto";

    try {
        localStorage.setItem("theme", APP_STATE.theme);
    } catch (error) {
        console.warn("Failed to save theme to localStorage:", error);
    }

    const htmlElement = document.documentElement;

    if (APP_STATE.theme === "auto") {
        htmlElement.removeAttribute("data-theme");
    } else {
        htmlElement.setAttribute("data-theme", APP_STATE.theme);
    }

    // 更新设置面板中的选择器值
    const themeSelect = document.getElementById('theme_select_settings');
    if (themeSelect) {
        themeSelect.value = APP_STATE.theme;
    }
}

/**
 * 更新文档标题
 */
function updateDocumentTitle() {
    if (!APP_STATE.page) return;

    const key = APP_STATE.page + ".title";

    if (I18N[APP_STATE.lang] && I18N[APP_STATE.lang][key]) {
        document.title = t(key);
        return;
    }

    // 处理特殊页面
    if (APP_STATE.page === "flashing") {
        document.title = t("flashing.title.in_progress");
    } else if (APP_STATE.page === "booting") {
        document.title = t("booting.title.in_progress");
    } else if (APP_STATE.page === "reboot") {
        document.title = t("reboot.title.in_progress");
    }
}

// ==============================
// AJAX 相关
// ==============================

/**
 * 封装 AJAX 请求
 */
function ajax(options) {
    const xhr = window.XMLHttpRequest ?
                new XMLHttpRequest() :
                new ActiveXObject("Microsoft.XMLHTTP");

    // 上传进度事件
    if (options.progress && xhr.upload) {
        xhr.upload.addEventListener("progress", options.progress);
    }

    // 状态变化事件
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200 && options.done) {
            options.done(xhr.responseText);
        }
    };

    // 超时设置
    if (options.timeout) {
        xhr.timeout = options.timeout;
    }

    // 发送请求
    const method = options.data ? "POST" : "GET";
    xhr.open(method, options.url);
    xhr.send(options.data);
}

// ==============================
// 系统信息相关
// ==============================

/**
 * 将字节转换为可读格式
 */
function bytesToHuman(bytes) {
    if (bytes === null || bytes === undefined) return "";

    const numBytes = Number(bytes);
    if (!isFinite(numBytes) || numBytes < 0) return "";

    if (numBytes >= 1024 * 1024 * 1024) {
        return (numBytes / (1024 * 1024 * 1024)).toFixed(2) + " GiB";
    } else if (numBytes >= 1024 * 1024) {
        return (numBytes / (1024 * 1024)).toFixed(2) + " MiB";
    } else if (numBytes >= 1024) {
        return (numBytes / 1024).toFixed(2) + " KiB";
    } else {
        return String(Math.floor(numBytes)) + " B";
    }
}

// ==============================
// 版本信息
// ==============================

/**
 * 获取版本信息
 */
function getVersion() {
    const versionContainer = document.getElementById("version");

    if (!versionContainer) return;

    versionContainer.innerHTML = '<span class="loading">Loading version info...</span>';

    // 发送请求获取版本信息
    ajax({
        url: "/version",
        timeout: 5000,
        done: function(responseText) {
            const versionText = responseText ? responseText : "U-Boot QSDK 12.5";
            const projectTitle = t("title.project");
            const authorTitle = t("title.author");

            versionContainer.innerHTML = `
                <a href="https://github.com/chenxin527/uboot-qsdk12.5-build"
                   target="_blank"
                   class="version-link"
                   title="${projectTitle}"
                   data-i18n-attr="title:title.project">
                    ${versionText}
                </a>
                <span class="separator">/</span>
                <a href="https://github.com/chenxin527"
                   target="_blank"
                   class="author-link"
                   title="${authorTitle}"
                   data-i18n-attr="title:title.author">
                    沉心
                </a>
            `;
        }
    });
}

// ==============================
// 文件上传相关
// ==============================

/**
 * 处理文件上传
 * 支持 JSON 响应和详细的错误提示
 */
function upload(formDataKey) {
    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];

    if (!file) {
        alert(t("file.select"));
        return;
    }

    // 获取页面相关元素
    const titleElement = document.getElementById("title");
    const hintElement = document.getElementById("hint");
    const formElement = document.getElementById("form");
    const progressCircle = document.getElementById("bar-circle");
    const successInfo = document.getElementById("success-info");
    const fileTypeElement = document.getElementById("file-type");
    const sizeElement = document.getElementById("size");
    const md5Element = document.getElementById("md5");
    const errorInfo = document.getElementById("error-info");
    const upgradeElement = document.getElementById("upgrade");

    // 显示圆环进度条，隐藏无关元素
    if (formElement) formElement.style.display = "none";
    if (successInfo) successInfo.style.display = "none";
    if (errorInfo) errorInfo.style.display = "none";
    if (upgradeElement) upgradeElement.style.display = "none";
    if (progressCircle) progressCircle.style.display = "block";

    // 准备表单数据
    const formData = new FormData();
    formData.append(formDataKey, file);

    // 发送上传请求
    ajax({
        url: "/upload",
        data: formData,
        done: function(responseText) {
            let response;

            // 尝试解析JSON响应
            try {
                response = JSON.parse(responseText);
            } catch (e) {
                // 无效的JSON，显示错误
                handleInvalidUploadResponse(responseText || t("error.invalid_response"), {
                    titleElement,
                    hintElement,
                    errorInfo,
                    progressCircle
                });
                return;
            }

            switch (response.status) {
                case "success":
                    handleUploadSuccess(response.info, {
                        successInfo,
                        fileTypeElement,
                        sizeElement,
                        md5Element,
                        upgradeElement,
                        progressCircle
                    });
                    break;
                case "fail":
                    handleUploadError(response.info, {
                        titleElement,
                        hintElement,
                        errorInfo,
                        progressCircle
                    });
                    break;
                default:
                    handleInvalidUploadResponse(responseText || t("error.unknown_status"), {
                        titleElement,
                        hintElement,
                        errorInfo,
                        progressCircle
                    });
            }
        },
        progress: function(event) {
            if (event.lengthComputable && event.total > 0) {
                const percent = parseInt((event.loaded / event.total) * 100);
                const progressCircle = document.getElementById("bar-circle");

                if (progressCircle) {
                    progressCircle.style.display = "block";
                    progressCircle.style.setProperty("--percent", percent);
                }
            }
        }
    });
}

/**
 * 处理上传成功
 */
function handleUploadSuccess(info, elements) {
    const {
        successInfo,
        fileTypeElement,
        sizeElement,
        md5Element,
        upgradeElement,
        progressCircle
    } = elements;

    // 隐藏进度条
    if (progressCircle) progressCircle.style.display = "none";

    // 显示文件类型信息（如果有）
    if (info.type && fileTypeElement) {
        fileTypeElement.style.display = "block";
        fileTypeElement.innerHTML = `<strong>${t("label.type")}</strong> ${info.type}`;
    }

    // 显示文件大小
    if (info.size && sizeElement) {
        sizeElement.style.display = "block";
        sizeElement.innerHTML = `<strong>${t("label.size")}</strong> ${bytesToHuman(info.size)} (${info.size} Bytes)`;
    }

    // 显示 MD5
    if (info.md5 && md5Element) {
        md5Element.style.display = "block";
        md5Element.innerHTML = `<strong>${t("label.md5")}</strong> ${info.md5}`;
    }

    // 显示成功信息区域和升级按钮
    if (successInfo) successInfo.style.display = "block";
    if (upgradeElement) upgradeElement.style.display = "block";
}

/**
 * 处理上传失败
 */
function handleUploadError(info, elements) {
    const {
        titleElement,
        hintElement,
        errorInfo,
        progressCircle
    } = elements;

    if (titleElement) titleElement.innerHTML = t('fail.title');
    if (hintElement) hintElement.innerHTML = t('fail.hint');
    if (progressCircle) progressCircle.style.display = "none";

    // 根据错误类型生成错误信息
    let errorMessage = "";

    switch (info.type) {
        case "file_too_big":
            errorMessage = generateFileTooBigMessage(info);
            break;
        case "part_not_found":
            errorMessage = generatePartNotFoundMessage(info);
            break;
        case "wrong_file_type":
            errorMessage = generateWrongFileTypeMessage(info);
            break;
        default:
            errorMessage = JSON.stringify(info) || t("error.unknown_type");
    }

    // 显示错误信息
    if (errorInfo) {
        errorInfo.style.display = "block";
        errorInfo.innerHTML = errorMessage;
    }
}

/**
 * 处理无效的上传响应信息
 */
function handleInvalidUploadResponse(message, elements) {
    const {
        titleElement,
        hintElement,
        errorInfo,
        progressCircle
    } = elements;

    if (titleElement) titleElement.innerHTML = t('fail.title');
    if (hintElement) hintElement.innerHTML = t('fail.hint');
    if (progressCircle) progressCircle.style.display = "none";

    if (errorInfo) {
        errorInfo.style.display = "block";
        errorInfo.innerHTML = `<div class="error-detail">${escapeHtml(message)}</div>`;
    }
}

/**
 * 生成文件过大错误信息
 */
function generateFileTooBigMessage(info) {
    const lang = APP_STATE.lang;

    if (lang === "zh-cn") {
        return `
            <div class="error-title">❌ 文件过大</div>
            <div class="error-detail">
                <p>文件类型: ${info.filename || t("unknown")}</p>
                <p>文件大小: ${bytesToHuman(info.filesize)} (${info.filesize} 字节)</p>
                <p>分区名称: ${info.partname || t("unknown")}</p>
                <p>分区大小: ${bytesToHuman(info.partsize)} (${info.partsize} 字节)</p>
                <p>请选择小于分区大小的文件或扩容分区。</p>
            </div>
        `;
    } else {
        return `
            <div class="error-title">❌ File too large</div>
            <div class="error-detail">
                <p>File type: ${info.filename || t("unknown")}</p>
                <p>File size: ${bytesToHuman(info.filesize)} (${info.filesize} Bytes)</p>
                <p>Partition name: ${info.partname || t("unknown")}</p>
                <p>Partition size: ${bytesToHuman(info.partsize)} (${info.partsize} Bytes)</p>
                <p>Please choose a file smaller than the partition size or expand the partition.</p>
            </div>
        `;
    }
}

/**
 * 生成分区未找到错误信息
 */
function generatePartNotFoundMessage(info) {
    const lang = APP_STATE.lang;

    if (lang === "zh-cn") {
        return `
            <div class="error-title">❌ 找不到分区 </div>
            <div class="error-detail">
                <p>分区名：${info.partname || t("unknown")}</p>
                <p>目标分区不存在或不可用。</p>
                <p>请检查设备分区表或联系技术支持。</p>
            </div>
        `;
    } else {
        return `
            <div class="error-title">❌ Partition not found</div>
            <div class="error-detail">
                <p>Partition name: ${info.partname || t("unknown")}</p>
                <p>The target partition does not exist or is not available.</p>
                <p>Please check your device partition table or contact support.</p>
            </div>
        `;
    }
}

/**
 * 生成文件类型错误信息
 */
function generateWrongFileTypeMessage(info) {
    const lang = APP_STATE.lang;

    if (lang === "zh-cn") {
        return `
            <div class="error-title">❌ 文件类型错误</div>
            <div class="error-detail">
                <p>期望类型: ${info.expected || t("unknown")}</p>
                <p>实际类型: ${info.actual || t("unknown")}</p>
                <p>请选择正确的文件类型。</p>
            </div>
        `;
    } else {
        return `
            <div class="error-title">❌ Wrong file type</div>
            <div class="error-detail">
                <p>Expected: ${info.expected || t("unknown")}</p>
                <p>Actual: ${info.actual || t("unknown")}</p>
                <p>Please choose the correct file type.</p>
            </div>
        `;
    }
}

/**
 * 生成闪存类型错误信息
 */
function generateWrongFlashTypeMessage(info) {
    const lang = APP_STATE.lang;

    if (lang === "zh-cn") {
        return `
            <div class="error-title">❌ 不支持的闪存类型</div>
            <div class="error-detail">
                <p>文件类型: ${info.filetype || t("unknown")}</p>
                <p>闪存类型: ${info.flashtype || t("unknown")}</p>
                <p>当前设备不支持在此闪存类型上更新该类型的文件。</p>
            </div>
        `;
    } else {
        return `
            <div class="error-title">❌ Unsupported flash type</div>
            <div class="error-detail">
                <p>File type: ${info.filetype || t("unknown")}</p>
                <p>Flash type: ${info.flashtype || t("unknown")}</p>
                <p>Updating this file on the current flash type is not supported.</p>
            </div>
        `;
    }
}

/**
 * HTML转义（防止XSS）
 */
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==============================
// 应用初始化
// ==============================

/**
 * 应用初始化
 */
function appInit(pageName) {
    // 初始化应用状态
    APP_STATE.page = pageName || "";
    APP_STATE.lang = detectLang();
    APP_STATE.theme = detectTheme();

    // 应用主题和语言
    setTheme(APP_STATE.theme);
    setLang(APP_STATE.lang);

    // 初始化侧边栏（增强版）
    ensureSidebar();

    // 初始化设置面板
    initSettingsPanel();

    // 应用国际化
    applyI18n(document);

    // 更新文档标题
    updateDocumentTitle();

    // 添加准备完成的类
    setTimeout(function() {
        document.body.classList.add("ready");
    }, 0);

    // 获取版本信息
    getVersion();
}

// ==============================
// 结果处理相关
// ==============================

/**
 * 初始化 result 页面
 * 包括 flashing.html 和 booting.html
 */
function initResultPage(pageName, timeOut) {
    appInit(pageName);

    // 获取页面元素
    const titleElement = document.getElementById("title");
    const hintElement = document.getElementById("hint");
    const loadingElement = document.getElementById('l');
    const errorInfo = document.getElementById('error-info');

    ajax({
        url: '/result',
        done: function (responseText) {
            let response;

            // 尝试解析JSON响应
            try {
                response = JSON.parse(responseText);
            } catch (e) {
                // 无效的JSON，显示错误
                handleInvalidResultResponse(responseText || t("error.invalid_response"), {
                    titleElement,
                    hintElement,
                    loadingElement,
                    errorInfo
                });
                return;
            }

            switch (response.status) {
                case "success":
                    handleResultSuccess(pageName, {
                        titleElement,
                        hintElement,
                        errorInfo
                    });
                    break;
                case "fail":
                    handleResultError(response.info, {
                        titleElement,
                        hintElement,
                        loadingElement,
                        errorInfo
                    });
                    break;
                default:
                    handleInvalidResultResponse(responseText || t("error.unknown_status"), {
                        titleElement,
                        hintElement,
                        loadingElement,
                        errorInfo
                    });
            }
        },
        timeout: timeOut
    });
}

/**
 * 处理结果成功
 */
function handleResultSuccess(pageName, elements) {
    const {
        titleElement,
        hintElement,
        errorInfo
    } = elements;

    if (errorInfo) errorInfo.style.display = 'none';
    if (titleElement) titleElement.innerHTML = t(pageName + '.title.done');
    if (hintElement) hintElement.innerHTML = t(pageName + '.hint.done');
}

/**
 * 处理结果失败
 */
function handleResultError(info, elements) {
    const {
        titleElement,
        hintElement,
        loadingElement,
        errorInfo
    } = elements;

    if (titleElement) titleElement.innerHTML = t('fail.title');
    if (hintElement) hintElement.innerHTML = t('fail.hint');
    if (loadingElement) loadingElement.style.display = 'none';

    let errorMessage = "";

    switch (info.type) {
        case "wrong_file_type":
            errorMessage = generateWrongFileTypeMessage(info);
            break;
        case "wrong_flash_type":
            errorMessage = generateWrongFlashTypeMessage(info);
            break;
        default:
            errorMessage = JSON.stringify(info) || t("error.unknown_type");
    }

    if (errorInfo) {
        errorInfo.style.display = 'block';
        errorInfo.innerHTML = errorMessage;
    }
}

/**
 * 处理无效的结果响应信息
 */
function handleInvalidResultResponse(message, elements) {
    const {
        titleElement,
        hintElement,
        loadingElement,
        errorInfo
    } = elements;

    if (loadingElement) loadingElement.style.display = 'none';
    if (titleElement) titleElement.innerHTML = t('fail.title');
    if (hintElement) hintElement.innerHTML = t('fail.hint');

    if (errorInfo) {
        errorInfo.style.display = 'block';
        errorInfo.innerHTML = `<div class="error-detail">${escapeHtml(message)}</div>`;
    }
}

// ==============================
// 国际化数据
// ==============================

const I18N = (() => {
    // 模板函数
    const t = {
        en: {
            updateHint: (type) => `You are going to update <strong>${type}</strong> on the device.<br>Please choose a file from your local hard drive and click <strong>Upload</strong> button.`,
            warnChoose: (type) => `You can upload whatever you want, so be sure you choose the proper ${type} for your device!`,
            warnDanger: (type) => `Updating ${type} is a very dangerous operation and may damage your device!`
        },
        "zh-cn": {
            updateHint: (type) => `你将要在此设备上更新 <strong>${type}</strong>。<br>请选择本地文件并点击 <strong>上传</strong> 按钮。`,
            warnChoose: (type) => `你可以上传任意文件，请确保选择了与你的设备匹配的 ${type} 文件！`,
            warnDanger: (type) => `更新 ${type} 是一个十分危险的操作，可能导致你的路由器无法启动！`
        }
    };

    return {
        en: {
            "app.name": "uBootKit",
            "nav.basic": "Basic",
            "nav.advanced": "Advanced",
            "nav.firmware": "Firmware Update",
            "nav.uboot": "U-Boot Update",
            "nav.art": "ART Update",
            "nav.cdt": "CDT Update",
            "nav.gpt": "GPT Update",
            "nav.simg": "SIMG Update",
            "nav.mibib": "MIBIB Update",
            "nav.initramfs": "Load Initramfs",
            "nav.system": "System",
            "nav.reboot": "Reboot",
            "control.language": "🌐 Language",
            "control.theme": "🌓 Theme",
            "control.settings": "Settings",
            "theme.auto": "Auto",
            "theme.light": "Light",
            "theme.dark": "Dark",
            "title.author": "View Author Profile",
            "title.project": "View Project",
            "common.upload": "Upload",
            "common.update": "Update",
            "common.boot": "Boot",
            "common.upgrade_hint": 'If all information above is correct, click "Update".',
            "common.warnings": "WARNINGS",
            "common.warn.1": "Do not power off the device during update.",
            "common.warn.2": "If everything goes well, the device will restart.",
            "file.select": "Please select a file first!",
            "label.type": "Type: ",
            "label.size": "Size: ",
            "label.md5": "MD5: ",
            "index.title": "FIRMWARE UPDATE",
            "index.hint": t.en.updateHint("firmware"),
            "index.warn.1": t.en.warnChoose("firmware image"),
            "uboot.title": "U-BOOT UPDATE",
            "uboot.hint": t.en.updateHint("U-Boot (bootloader)"),
            "uboot.warn.1": t.en.warnChoose("U-Boot image"),
            "uboot.warn.2": t.en.warnDanger("U-Boot"),
            "art.title": "ART UPDATE",
            "art.hint": t.en.updateHint("ART (Atheros Radio Test)"),
            "art.warn.1": t.en.warnChoose("ART image"),
            "cdt.title": "CDT UPDATE",
            "cdt.hint": t.en.updateHint("CDT (Configuration Data Table)"),
            "cdt.warn.1": t.en.warnChoose("CDT image"),
            "cdt.warn.2": t.en.warnDanger("CDT"),
            "gpt.title": "GPT UPDATE",
            "gpt.hint": t.en.updateHint("GPT (GUID Partition Table)"),
            "gpt.warn.1": t.en.warnChoose("GPT"),
            "gpt.warn.2": t.en.warnDanger("GPT"),
            "mibib.title": "MIBIB UPDATE",
            "mibib.hint": t.en.updateHint("MIBIB"),
            "mibib.warn.1": t.en.warnChoose("MIBIB"),
            "mibib.warn.2": t.en.warnDanger("MIBIB"),
            "simg.title": "SIMG UPDATE",
            "simg.hint": t.en.updateHint("Single Image (written starting from offset 0x0 of the flash memory device)"),
            "simg.warn.1": t.en.warnChoose("Single Image"),
            "simg.warn.2": t.en.warnDanger("Single Image"),
            "reboot.confirm": "Reboot device now?",
            "reboot.title.in_progress": "REBOOTING DEVICE",
            "reboot.hint.in_progress": "Reboot request has been sent. Please wait...<br>This page may be in not responding status for a short time.",
            "initramfs.title": "LOAD INITRAMFS",
            "initramfs.hint": "You are going to load <strong>Initramfs<\/strong> on the device.<br>Please choose a file from your local hard drive and click <strong>Upload<\/strong> button.",
            "initramfs.boot_hint": 'If all information above is correct, click "Boot".',
            "initramfs.warn.1": "If everything goes well, the device will boot into the Initramfs.",
            "initramfs.warn.2": t.en.warnChoose("Initramfs image"),
            "flashing.title.in_progress": "UPDATE IN PROGRESS",
            "flashing.hint.in_progress": "Your file was successfully uploaded! Update is in progress and you should wait for automatic reset of the device.<br>Update time depends on image size and may take up to a few minutes.",
            "flashing.title.done": "UPDATE COMPLETED",
            "flashing.hint.done": "Your device was successfully updated! Now rebooting...",
            "booting.title.in_progress": "BOOTING INITRAMFS",
            "booting.hint.in_progress": "Your file was successfully uploaded! Booting is in progress, please wait...<br>This page may be in not responding status for a short time.",
            "booting.title.done": "BOOT SUCCESS",
            "booting.hint.done": "Your device was successfully booted into initramfs!",
            "404.title": "PAGE NOT FOUND",
            "404.hint": "The page you were looking for doesn't exist!",
            "fail.title": "UPDATE FAILED",
            "fail.hint": "Something went wrong during update. Probably you have chosen wrong file.<p>Please, try again or contact with the author of this modification. You can also get more information during update in U-Boot console.",
            "error.invalid_response": "Invalid server response",
            "error.unknown_status": "Unknown response status",
            "error.unknown_type": "Unknown error type",
            "unknown": "Unknown"
        },
        "zh-cn": {
            "app.name": "uBootKit",
            "nav.basic": "基础",
            "nav.firmware": "固件更新",
            "nav.uboot": "U-Boot 更新",
            "nav.advanced": "高级",
            "nav.art": "ART 更新",
            "nav.cdt": "CDT 更新",
            "nav.gpt": "GPT 更新",
            "nav.mibib": "MIBIB 更新",
            "nav.simg": "闪存镜像更新",
            "nav.initramfs": "启动内存固件",
            "nav.system": "系统",
            "nav.reboot": "重启",
            "control.language": "🌐 语言",
            "control.theme": "🌓 主题",
            "control.settings": "设置",
            "theme.auto": "自动",
            "theme.light": "亮色",
            "theme.dark": "暗色",
            "title.author": "查看作者主页",
            "title.project": "查看项目",
            "common.upload": "上传",
            "common.update": "更新",
            "common.boot": "启动",
            "common.upgrade_hint": "如果以上信息确认无误，请点击 “更新”。",
            "common.warnings": "注意事项",
            "common.warn.1": "刷写过程中请勿断电！",
            "common.warn.2": "如果更新成功，设备将自动重启！",
            "file.select": "请选择文件！",
            "label.type": "类型: ",
            "label.size": "大小: ",
            "label.md5": "MD5: ",
            "index.title": "固件更新",
            "index.hint": t["zh-cn"].updateHint("固件"),
            "index.warn.1": t["zh-cn"].warnChoose("固件"),
            "uboot.title": "U-Boot 更新",
            "uboot.hint": t["zh-cn"].updateHint("U-Boot（引导程序）"),
            "uboot.warn.1": t["zh-cn"].warnChoose("U-Boot"),
            "uboot.warn.2": t["zh-cn"].warnDanger("U-Boot "),
            "art.title": "ART 更新",
            "art.hint": t["zh-cn"].updateHint("无线芯片频率校准数据 ART (Atheros Radio Test)"),
            "art.warn.1": t["zh-cn"].warnChoose("ART"),
            "cdt.title": "CDT 更新",
            "cdt.hint": t["zh-cn"].updateHint("CDT (Configuration Data Table)"),
            "cdt.warn.1": t["zh-cn"].warnChoose("CDT"),
            "cdt.warn.2": t["zh-cn"].warnDanger("CDT "),
            "gpt.title": "GPT 更新",
            "gpt.hint": t["zh-cn"].updateHint("GPT (GUID Partition Table)"),
            "gpt.warn.1": t["zh-cn"].warnChoose("GPT"),
            "gpt.warn.2": t["zh-cn"].warnDanger("GPT "),
            "mibib.title": "MIBIB 更新",
            "mibib.hint": t["zh-cn"].updateHint("MIBIB"),
            "mibib.warn.1": t["zh-cn"].warnChoose("MIBIB"),
            "mibib.warn.2": t["zh-cn"].warnDanger("MIBIB "),
            "simg.title": "闪存镜像更新",
            "simg.hint": t["zh-cn"].updateHint("闪存镜像（从闪存设备的偏移量 0x0 处开始写入）"),
            "simg.warn.1": t["zh-cn"].warnChoose("闪存镜像"),
            "simg.warn.2": t["zh-cn"].warnDanger("闪存镜像"),
            "reboot.confirm": "确认立即重启设备？",
            "reboot.title.in_progress": "正在重启设备",
            "reboot.hint.in_progress": "已发送重启请求，请稍候…<br>该页面短时间可能显示无响应，这是正常现象。",
            "initramfs.title": "启动内存固件",
            "initramfs.hint": "你将要在此设备上启动 <strong>内存固件<\/strong>。<br>请选择本地文件并点击 <strong>上传<\/strong> 按钮。",
            "initramfs.boot_hint": "如果以上信息确认无误，请点击 “启动”。",
            "initramfs.warn.1": "如果一切顺利，设备将启动至内存固件！",
            "initramfs.warn.2": t["zh-cn"].warnChoose("内存固件"),
            "flashing.title.in_progress": "正在刷写",
            "flashing.hint.in_progress": "文件上传成功！正在执行刷写，请等待设备自动重启。<br>刷写时间取决于镜像大小，可能需要几分钟。",
            "flashing.title.done": "刷写完成",
            "flashing.hint.done": "设备已成功更新！即将重启…",
            "booting.title.in_progress": "正在启动内存固件",
            "booting.hint.in_progress": "文件上传成功！正在启动，请稍候…<br>该页面短时间可能显示无响应，这是正常现象。",
            "booting.title.done": "启动成功",
            "booting.hint.done": "设备已成功进入内存固件！",
            "404.title": "页面不存在",
            "404.hint": "你访问的页面不存在！",
            "upload.title.in_progress": "正在上传",
            "upload.title.done": "上传完成",
            "fail.title": "更新失败",
            "fail.hint": "更新过程中出现错误。可能选择了错误的文件。<p>请重试或联系此修改的作者。你也可以在 U-Boot 控制台查看更多刷写过程信息。",
            "error.invalid_response": "无效的服务器响应",
            "error.unknown_status": "未知的响应状态",
            "error.unknown_type": "未知的错误类型",
            "unknown": "未知"
        }
    };
})();
