/* SPDX-License-Identifier: GPL-2.0 */
/*
 * Copyright (C) 2026 Yuzhii0718
 *
 * All rights reserved.
 *
 * This file is part of the project bl-mt798x-dhcpd
 * You may not use, copy, modify or distribute this file except in compliance with the license agreement.
 */

/*
 * Modified by: chenxin527
 */

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
            '/backup.html': 'backup',
            '/cdt.html': 'cdt',
            '/console.html': 'console',
            '/env.html': 'env',
            '/mibib.html': 'mibib',
            '/network.html': 'network',
            '/ptable.html': 'ptable',
            '/simg.html': 'simg',
            '/sysinfo.html': 'sysinfo',
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
                    { path: "/ptable.html", labelKey: "nav.ptable", id: "ptable" },
                    { path: "/simg.html", labelKey: "nav.simg", id: "simg" },
                    { path: "/initramfs.html", labelKey: "nav.initramfs", id: "initramfs" }
                ]
            },
            system: {
                titleKey: "nav.system",
                items: [
                    { path: "/sysinfo.html", labelKey: "nav.sysinfo", id: "sysinfo" },
                    { path: "/network.html", labelKey: "nav.network", id: "network" },
                    { path: "/backup.html", labelKey: "nav.backup", id: "backup" },
                    { path: "/console.html", labelKey: "nav.console", id: "console" },
                    { path: "/env.html", labelKey: "nav.env", id: "env" },
                    { path: "/mibib.html", labelKey: "nav.mibib", id: "mibib" },
                    { path: "/reboot.html", labelKey: "nav.reboot", id: "reboot", onClick: () => confirm(t("reboot.confirm")) }
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
    }

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
        case "flash_not_found":
            errorMessage = generateFlashNotFoundMessage(info);
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
function generateFlashNotFoundMessage(info) {
    const lang = APP_STATE.lang;

    if (lang === "zh-cn") {
        return `
            <div class="error-title">❌ 找不到闪存</div>
            <div class="error-detail">
                <p>文件类型: ${info.filetype || t("unknown")}</p>
                <p>闪存类型: ${info.flashtype || t("unknown")}</p>
                <p>找不到与所选文件类型对应的闪存设备。</p>
            </div>
        `;
    } else {
        return `
            <div class="error-title">❌ Flash not found</div>
            <div class="error-detail">
                <p>File type: ${info.filetype || t("unknown")}</p>
                <p>Flash type: ${info.flashtype || t("unknown")}</p>
                <p>No flash device can be found that corresponds to the selected file type.</p>
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

    // 根据页面初始化对应模块
    switch (pageName) {
        case "env":
            envManager.init();
            break;
        case "backup":
            if (typeof backupInit === "function") {
                backupInit();
            }
            break;
        case "network":
            networkManager.init();
            break;
        case "console":
            consoleManager.init();
            break;
        case "sysinfo":
            if (typeof sysinfoInit === "function") {
                sysinfoInit();
            }
            break;
        default:
            getAndStoreSysinfo();
            break;
    }

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
        case "flash_not_found":
            errorMessage = generateFlashNotFoundMessage(info);
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
// 备份功能模块
// ==============================

/**
 * 设置备份状态显示
 */
function setBackupStatus(text) {
    const el = document.getElementById("backup_status");
    if (el) {
        el.style.display = text ? "block" : "none";
        el.textContent = text || "";
    }
}

/**
 * 设置备份进度
 */
function setBackupProgress(percent) {
    const el = document.getElementById("backup_progress");
    if (el) {
        const p = Math.max(0, Math.min(100, parseInt(percent || 0)));
        el.style.display = "block";
        el.style.setProperty("--percent", p);
    }
}

/**
 * 解析用户输入的长度（支持十六进制和K/M后缀）
 */
function parseUserLen(str) {
    if (!str) return null;
    str = String(str).trim();
    if (str === "") return null;

    const match = /^\s*(0x[0-9a-fA-F]+|\d+)\s*([a-zA-Z]*)\s*$/.exec(str);
    if (!match) return null;

    let val = match[1].toLowerCase().indexOf("0x") === 0 ?
              parseInt(match[1], 16) : parseInt(match[1], 10);
    if (!isFinite(val) || val < 0) return null;

    const suffix = (match[2] || "").toLowerCase();
    if (suffix === "" || suffix === "b") return val;
    if (suffix === "k" || suffix === "kb" || suffix === "kib") return val * 1024;
    if (suffix === "m" || suffix === "mb" || suffix === "mib") return val * 1024 * 1024;

    return null;
}

/**
 * 更新范围提示
 */
function backupUpdateRangeHint() {
    const hint = document.getElementById("backup_range_hint");
    const startVal = parseUserLen(document.getElementById("backup_start").value);
    const endVal = parseUserLen(document.getElementById("backup_end").value);

    if (hint) {
        if (startVal === null || endVal === null) {
            hint.textContent = t("backup.range.hint");
        } else if (endVal > startVal) {
            const size = endVal - startVal;
            hint.textContent = "Start=" + startVal + " B (" + bytesToHuman(startVal) + ")" +
                              ", End=" + endVal + " B (" + bytesToHuman(endVal) + ")" +
                              ", Size=" + size + " B (" + bytesToHuman(size) + ")";
        } else {
            hint.textContent = t("backup.range.hint");
        }
    }
}

/**
 * 备份页面初始化
 */
function backupInit() {
    const modeSelect = document.getElementById("backup_mode");
    const targetSelect = document.getElementById("backup_target");
    const rangeDiv = document.getElementById("backup_range");
    const startInput = document.getElementById("backup_start");
    const endInput = document.getElementById("backup_end");

    function updateUI() {
        const isRange = modeSelect.value === "range";
        if (isRange) {
            rangeDiv.style.display = "block";
            backupUpdateRangeHint();
        } else {
            rangeDiv.style.display = "none";
        }
    }

    modeSelect.onchange = updateUI;
    if (startInput) startInput.oninput = backupUpdateRangeHint;
    if (endInput) endInput.oninput = backupUpdateRangeHint;

    updateUI();
    setBackupStatus("");

    // 获取存储设备信息
    ajax({
        url: "/sysinfo",
        done: function(text) {
            let info;
            try {
                info = JSON.parse(text);
            } catch (e) {
                setBackupStatus("Failed to parse backup info");
                return;
            }

            // 填充目标选择器
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="" data-i18n="backup.target.placeholder"></option>';

                // 添加RAW选项
                if (info.devices) {
                    if (info.devices.spi && info.devices.spi.present) {
                        const opt = document.createElement("option");
                        opt.value = "raw:spi";
                        opt.textContent = "[RAW] SPI: " +
                            (info.devices.spi.name ? info.devices.spi.name : "") +
                            (info.devices.spi.size ? " (" + bytesToHuman(info.devices.spi.size) + ")" : "");
                        targetSelect.appendChild(opt);
                    }

                    if (info.devices.mmc && info.devices.mmc.present) {
                        const opt = document.createElement("option");
                        opt.value = "raw:mmc";
                        opt.textContent = "[RAW] MMC: " +
                            (info.devices.mmc.product ? info.devices.mmc.product : "") +
                            (info.devices.mmc.size ? " (" + bytesToHuman(info.devices.mmc.size) + ")" : "");
                        targetSelect.appendChild(opt);
                    }

                    if (info.devices.nand && info.devices.nand.present) {
                        const opt = document.createElement("option");
                        opt.value = "raw:nand";
                        opt.textContent = "[RAW] NAND: " +
                            (info.devices.nand.name ? info.devices.nand.name : "") +
                            (info.devices.nand.size ? " (" + bytesToHuman(info.devices.nand.size) + ")" : "");
                        targetSelect.appendChild(opt);
                    }
                }

                // 添加分区选项
                if (info.partitions) {
                    // 添加SMEM分区选项
                    if (info.partitions.smem && info.partitions.smem.present && info.partitions.smem.parts && info.partitions.smem.parts.length) {
                        info.partitions.smem.parts.forEach(function(part) {
                            if (part && part.name) {
                                const opt = document.createElement("option");
                                opt.value = "smem:" + part.name;
                                opt.textContent = "[SMEM] " + part.name +
                                                 (part.size ? " (" + bytesToHuman(part.size) + ")" : "");
                                targetSelect.appendChild(opt);
                            }
                        });
                    }

                    // 添加MMC分区选项
                    if (info.partitions.mmc && info.partitions.mmc.present) {
                        if (info.partitions.mmc.parts && info.partitions.mmc.parts.length) {
                            info.partitions.mmc.parts.forEach(function(part) {
                                if (part && part.name) {
                                    const opt = document.createElement("option");
                                    opt.value = "mmc:" + part.name;
                                    opt.textContent = "[MMC] " + part.name +
                                                     (part.size ? " (" + bytesToHuman(part.size) + ")" : "");
                                    targetSelect.appendChild(opt);
                                }
                            });
                        }
                    }
                }

                // 选择第一个有效选项
                if (targetSelect.options.length > 1) {
                    targetSelect.selectedIndex = 1;
                }

                applyI18n(targetSelect);
            }
        }
    });
}

/**
 * 解析Content-Disposition中的文件名
 */
function parseFilenameFromDisposition(header) {
    if (!header) return "";
    const match = /filename\s*=\s*"([^"]+)"/i.exec(header);
    if (match && match[1]) return match[1];
    const match2 = /filename\s*=\s*([^;\s]+)/i.exec(header);
    if (match2 && match2[1]) return match2[1].replace(/^"|"$/g, "");
    return "";
}

/**
 * 开始备份
 */
async function startBackup() {
    const modeSelect = document.getElementById("backup_mode");
    const targetSelect = document.getElementById("backup_target");

    if (!modeSelect || !targetSelect) return;

    const mode = modeSelect.value;
    const target = targetSelect.value;

    if (!target) {
        alert(t("backup.error.no_target"));
        return;
    }

    const formData = new FormData();
    formData.append("mode", mode);
    formData.append("target", target);

    if (mode === "range") {
        const startInput = document.getElementById("backup_start");
        const endInput = document.getElementById("backup_end");

        if (!startInput || !endInput || !startInput.value || !endInput.value) {
            alert(t("backup.error.bad_range"));
            return;
        }

        formData.append("start", startInput.value);
        formData.append("end", endInput.value);
    }

    setBackupProgress(0);
    setBackupStatus(t("backup.status.starting"));

    try {
        const response = await fetch("/backup", { method: "POST", body: formData });

        if (!response.ok) {
            setBackupStatus(t("backup.error.http") + " " + response.status);
            return;
        }

        const contentLength = response.headers.get("Content-Length");
        const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
        let filename = parseFilenameFromDisposition(response.headers.get("Content-Disposition"));
        if (!filename) filename = "backup.bin";

        // 获取文件名中的备份信息
        if (typeof makeBackupDownloadName === "function") {
            filename = makeBackupDownloadName(filename);
        }

        let received = 0;
        const chunks = [];
        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            if (totalSize) {
                setBackupProgress((received / totalSize) * 100);
            }
            setBackupStatus(t("backup.status.downloading") + " " +
                           bytesToHuman(received) + (totalSize ? " / " + bytesToHuman(totalSize) : ""));
        }

        setBackupProgress(100);
        setBackupStatus(t("backup.status.preparing"));

        // 保存文件
        const blob = new Blob(chunks, { type: "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setBackupStatus(t("backup.status.done") + " " + filename);

    } catch (error) {
        setBackupStatus(t("backup.error.exception") + " " + (error.message || String(error)));
    }
}

// 导出备份初始化函数供appInit调用
window.backupInit = backupInit;

// ==============================
// 环境变量管理模块
// ==============================

/**
 * 环境变量管理器
 * 负责处理 U-Boot 环境变量的查看、添加、修改、删除等操作
 */
const envManager = (() => {
    // 私有变量
    let elements = null;
    let envData = []; // 存储解析后的环境变量数据
    let editMode = null; // 'add' | 'edit' | null
    let editingKey = null; // 正在编辑的变量名

    /**
     * 获取或缓存 DOM 元素
     */
    function getElements() {
        if (elements) return elements;

        elements = {
            tableBody: document.getElementById("env_table_body"),
            tableContainer: document.getElementById("env_table_container"),
            envTable: document.getElementById("env_table"),
            emptyHint: document.getElementById("env_empty"),
            status: document.getElementById("env_status"),
            count: document.getElementById("env_count"),
            editPanel: document.getElementById("env_edit_panel"),
            editTitle: document.getElementById("env_edit_title"),
            editName: document.getElementById("env_edit_name"),
            editValue: document.getElementById("env_edit_value"),
            restoreFile: document.getElementById("env_restore_file"),
        };

        return elements;
    }

    /**
     * 设置状态提示
     */
    function setStatus(text, isError) {
        const el = getElements().status;
        if (el) {
            el.textContent = text || "";
            el.style.color = isError ? "var(--danger)" : "";
        }
    }

    /**
     * 格式化错误信息
     */
    function formatError(error) {
        if (!error) return t("error.unknown");
        if (error.message) return error.message;
        return String(error);
    }

    /**
     * 渲染环境变量表格
     */
    function renderTable(data) {
        const els = getElements();

        if (!els.tableBody || !els.envTable || !els.emptyHint) return;

        // 清空表格
        els.tableBody.innerHTML = '';

        if (!data || data.length === 0) {
            els.emptyHint.style.display = 'flex';
            els.envTable.style.display = 'none';
            return;
        }

        // 显示表格，隐藏空提示
        els.emptyHint.style.display = 'none';
        els.envTable.style.display = 'table';

        // 渲染每一行
        data.forEach((item) => {
            const row = document.createElement('tr');
            row.className = 'env-row';
            row.dataset.key = item.key;

            // 名称列
            const tdName = document.createElement('td');
            tdName.className = 'env-col-name';
            tdName.textContent = item.key;
            tdName.title = item.key;

            // 值列
            const tdValue = document.createElement('td');
            tdValue.className = 'env-col-value';
            tdValue.textContent = item.value;
            tdValue.title = item.value;

            // 操作列
            const tdActions = document.createElement('td');
            tdActions.className = 'env-col-actions';

            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'button button-sm env-action-btn';
            editBtn.textContent = '✎';
            editBtn.title = t('env.action.edit') || 'Edit';
            editBtn.addEventListener('click', () => showEditPanel(item.key, item.value));

            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'button button-sm button-danger env-action-btn';
            deleteBtn.textContent = '✕';
            deleteBtn.title = t('env.action.delete') || 'Delete';
            deleteBtn.addEventListener('click', () => deleteSingle(item.key));

            tdActions.appendChild(editBtn);
            tdActions.appendChild(deleteBtn);

            row.appendChild(tdName);
            row.appendChild(tdValue);
            row.appendChild(tdActions);
            els.tableBody.appendChild(row);
        });
    }

    /**
     * 刷新环境变量列表
     */
    async function refresh() {
        const els = getElements();

        try {
            setStatus(t("env.status.loading"));

            const response = await fetch("/env/list", {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept": "text/plain"
                }
            });

            if (!response.ok) {
                throw new Error(`${t("env.status.http")} ${response.status}`);
            }

            const text = await response.text();

            // 解析纯文本：每行 key=value
            envData = [];
            const lines = text.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const equalPos = trimmed.indexOf('=');
                if (equalPos > 0) {
                    const key = trimmed.substring(0, equalPos).trim();
                    const value = trimmed.substring(equalPos + 1);
                    if (key) {
                        envData.push({ key, value });
                    }
                } else if (equalPos === -1 && trimmed) {
                    envData.push({ key: trimmed, value: '' });
                }
            }

            envData.sort((a, b) => a.key.localeCompare(b.key));
            renderTable(envData);

            if (els.count) {
                els.count.textContent = `${t("env.count")} ${envData.length}`;
            }

            setStatus(t("env.status.ready"));

        } catch (error) {
            console.error("[envManager] Error:", error);
            setStatus(formatError(error), true);
        }
    }

    /**
     * 显示编辑面板
     */
    function showEditPanel(key, value) {
        const els = getElements();

        editMode = 'edit';
        editingKey = key;

        if (els.editPanel) els.editPanel.style.display = 'block';
        if (els.editTitle) els.editTitle.textContent = t('env.edit.title') || 'Edit Variable';

        if (els.editName) {
            els.editName.value = key || '';
            els.editName.disabled = true; // 编辑模式下名称不可修改
        }

        if (els.editValue) {
            els.editValue.value = value || '';
            els.editValue.focus();
        }
    }

    /**
     * 显示添加面板
     */
    function showAddPanel() {
        const els = getElements();

        editMode = 'add';
        editingKey = null;

        if (els.editPanel) els.editPanel.style.display = 'block';
        if (els.editTitle) els.editTitle.textContent = t('env.add.title') || 'Add Variable';

        if (els.editName) {
            els.editName.value = '';
            els.editName.disabled = false;
            els.editName.focus();
        }

        if (els.editValue) els.editValue.value = '';
    }

    /**
     * 取消编辑
     */
    function cancelEdit() {
        const els = getElements();

        editMode = null;
        editingKey = null;

        if (els.editPanel) els.editPanel.style.display = 'none';
        if (els.editName) els.editName.value = '';
        if (els.editValue) els.editValue.value = '';
    }

    /**
     * 保存编辑（新增或修改）
     */
    async function saveEdit() {
        const els = getElements();
        const name = els.editName ? els.editName.value.trim() : '';
        const value = els.editValue ? els.editValue.value : '';

        if (!name) {
            alert(t("env.error.no_name"));
            els.editName?.focus();
            return;
        }

        try {
            setStatus(t("env.status.saving"));

            const formData = new FormData();
            formData.append("name", name);
            formData.append("value", value);

            const response = await fetch("/env/set", {
                method: "POST",
                body: formData
            });

            const result = await response.text();

            if (!response.ok) {
                throw new Error(`${t("env.status.http")} ${response.status}: ${result}`);
            }

            if (result !== "ok") {
                throw new Error(result || t("env.status.error"));
            }

            setStatus(t("env.status.saved"));
            cancelEdit();
            await refresh();
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 重置单个环境变量为默认值
     */
    async function resetSingle() {
        const els = getElements();
        const name = els.editName ? els.editName.value.trim() : '';

        if (!name) {
            alert(t("env.error.no_name"));
            return;
        }

        if (!confirm(`${name}: ${t("env.confirm.reset_single")}`)) return;

        try {
            setStatus(t("env.status.saving"));

            const formData = new FormData();
            formData.append("name", name);

            const response = await fetch("/env/reset/single", {
                method: "POST",
                body: formData
            });

            const result = await response.text();

            if (!response.ok) {
                throw new Error(`${t("env.status.http")} ${response.status}: ${result}`);
            }

            if (result !== "ok") {
                throw new Error(result || t("env.status.error"));
            }

            setStatus(t("env.status.reset_single"));
            cancelEdit();
            await refresh();
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 删除单个环境变量
     */
    async function deleteSingle(name) {
        const excludeList = ['baudrate', 'stderr', 'stdin', 'stdout'];
        if (excludeList.includes(name)) {
            alert(name + ": " + t("env.delete.forbid"));
            return;
        }

        if (!confirm(`${t("env.confirm.delete")} "${name}" ?`)) return;

        try {
            setStatus(t("env.status.saving"));

            const formData = new FormData();
            formData.append("name", name);

            const response = await fetch("/env/unset", {
                method: "POST",
                body: formData
            });

            const result = await response.text();

            if (!response.ok) {
                throw new Error(`${t("env.status.http")} ${response.status}: ${result}`);
            }

            if (result !== "ok") {
                throw new Error(result || t("env.status.error"));
            }

            setStatus(t("env.status.deleted"));
            await refresh();
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 重置所有环境变量为默认值
     */
    async function resetAll() {
        if (!confirm(t("env.confirm.reset"))) return;

        try {
            setStatus(t("env.status.saving"));
            const response = await fetch("/env/reset/all", { method: "POST" });
            const result = await response.text();

            if (!response.ok) {
                throw new Error(`${t("env.status.http")} ${response.status}: ${result}`);
            }

            if (result !== "ok") {
                throw new Error(result || t("env.status.error"));
            }

            setStatus(t("env.status.reset"));
            cancelEdit();
            await refresh();
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 从文件恢复环境变量
     * 点击恢复按钮后弹出文件选择框
     */
    function restore() {
        const els = getElements();

        if (!els.restoreFile) return;

        // 清除之前的选择，确保 change 事件能触发
        els.restoreFile.value = '';

        // 触发文件选择
        els.restoreFile.click();
    }

    /**
     * 处理恢复文件选择
     * @param {File} file - 用户选择的文件
     */
    async function handleRestoreFile(file) {
        if (!file) return;

        if (!confirm(t("env.confirm.restore"))) return;

        try {
            setStatus(t("env.status.saving"));

            const formData = new FormData();
            formData.append("envfile", file);

            const response = await fetch("/env/restore", {
                method: "POST",
                body: formData
            });

            const result = await response.text();

            if (!response.ok) {
                throw new Error(`${t("env.status.http")} ${response.status}: ${result}`);
            }

            if (result !== "ok") {
                throw new Error(result || t("env.status.error"));
            }

            setStatus(t("env.status.restored"));
            await refresh();
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 初始化环境变量管理器
     */
    function init() {
        const els = getElements();

        // 绑定恢复文件选择事件
        if (els.restoreFile) {
            els.restoreFile.addEventListener('change', function() {
                const file = this.files[0];
                if (file) handleRestoreFile(file);
            });
        }

        refresh();
    }

    // 导出公共 API
    return {
        init,
        refresh,
        showAddPanel,
        showEditPanel,
        cancelEdit,
        saveEdit,
        resetSingle,
        deleteSingle,
        resetAll,
        restore,
    };
})();

// ==============================
// 网络参数管理模块
// ==============================

/**
 * 网络参数管理器
 * 负责处理 U-Boot 网络参数（ipaddr、netmask、serverip）的查看、设置、重置操作
 */
const networkManager = (() => {
    // 私有变量
    let elements = null;
    let validationState = {
        ipaddr: true,
        netmask: true,
        serverip: true
    };

    /**
     * 获取或缓存 DOM 元素
     */
    function getElements() {
        if (elements) return elements;

        elements = {
            status: document.getElementById("network_status"),
            ipaddr: document.getElementById("network_ipaddr"),
            netmask: document.getElementById("network_netmask"),
            serverip: document.getElementById("network_serverip"),
            hintIpaddr: document.getElementById("hint_ipaddr"),
            hintNetmask: document.getElementById("hint_netmask"),
            hintServerip: document.getElementById("hint_serverip")
        };

        return elements;
    }

    /**
     * 设置状态提示
     */
    function setStatus(text, isError) {
        const el = getElements().status;
        if (el) {
            el.textContent = text || "";
            if (isError) {
                el.style.color = "var(--danger)";
            } else {
                el.style.color = "";
            }
        }
    }

    /**
     * 验证 IP 地址格式
     * @param {string} ip - 待验证的 IP 地址
     * @returns {boolean} 是否为有效 IP 地址
     */
    function isValidIP(ip) {
        if (!ip || typeof ip !== 'string') return false;

        // IP 地址正则表达式（IPv4）
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip.trim());
    }

    /**
     * 验证子网掩码格式
     * @param {string} mask - 待验证的子网掩码
     * @returns {boolean} 是否为有效子网掩码
     */
    function isValidNetmask(mask) {
        if (!mask || typeof mask !== 'string') return false;

        // 先检查是否为有效 IP 格式
        if (!isValidIP(mask)) return false;

        // 检查是否为有效的子网掩码（连续的1后跟连续的0）
        const parts = mask.trim().split('.').map(Number);
        const binary = parts.reduce((acc, part) => acc + part.toString(2).padStart(8, '0'), '');

        // 检查是否为连续的1后跟连续的0
        const firstZero = binary.indexOf('0');
        if (firstZero === -1) return true; // 全1 (255.255.255.255)
        const lastOne = binary.lastIndexOf('1');
        return lastOne < firstZero;
    }

    /**
     * 更新单个字段的验证提示
     * @param {string} field - 字段名
     * @param {string} value - 字段值
     */
    function updateFieldValidation(field, value) {
        const els = getElements();
        const inputEl = els[field];
        const hintEl = els[`hint${field.charAt(0).toUpperCase() + field.slice(1)}`];

        if (!hintEl || !inputEl) return;

        // 清除之前的样式
        inputEl.classList.remove('input-valid', 'input-invalid');

        if (!value || value.trim() === '') {
            hintEl.textContent = '';
            hintEl.className = 'field-hint';
            validationState[field] = true;
            return;
        }

        let isValid = false;
        if (field === 'netmask') {
            isValid = isValidNetmask(value);
        } else {
            isValid = isValidIP(value);
        }

        validationState[field] = isValid;

        if (isValid) {
            hintEl.textContent = '✓ ' + t('network.validation.valid');
            hintEl.className = 'field-hint field-hint-valid';
            inputEl.classList.add('input-valid');
        } else {
            if (field === 'netmask') {
                hintEl.textContent = '✗ ' + t('network.validation.invalid_netmask');
            } else {
                hintEl.textContent = '✗ ' + t('network.validation.invalid_ip');
            }
            hintEl.className = 'field-hint field-hint-invalid';
            inputEl.classList.add('input-invalid');
        }
    }

    /**
     * 表单验证（保存前检查）
     * @returns {boolean} 是否通过验证
     */
    function validateForm() {
        const els = getElements();
        const ipaddr = els.ipaddr?.value?.trim() || '';
        const netmask = els.netmask?.value?.trim() || '';
        const serverip = els.serverip?.value?.trim() || '';

        // 重新验证所有字段
        updateFieldValidation('ipaddr', ipaddr);
        updateFieldValidation('netmask', netmask);
        updateFieldValidation('serverip', serverip);

        const errors = [];

        // 获取字段标签文本
        const labelIpaddr = t('network.label.ipaddr').replace(':', '');
        const labelNetmask = t('network.label.netmask').replace(':', '');
        const labelServerip = t('network.label.serverip').replace(':', '');

        if (!ipaddr) {
            errors.push(labelIpaddr + ' ' + t('network.validation.cannot_be_empty'));
        } else if (!validationState.ipaddr) {
            errors.push(labelIpaddr + ' ' + t('network.validation.invalid_format'));
        }

        if (!netmask) {
            errors.push(labelNetmask + ' ' + t('network.validation.cannot_be_empty'));
        } else if (!validationState.netmask) {
            errors.push(labelNetmask + ' ' + t('network.validation.invalid_netmask_format'));
        }

        if (!serverip) {
            errors.push(labelServerip + ' ' + t('network.validation.cannot_be_empty'));
        } else if (!validationState.serverip) {
            errors.push(labelServerip + ' ' + t('network.validation.invalid_format'));
        }

        if (errors.length > 0) {
            setStatus(errors.join('; '), true);
            return false;
        }

        return true;
    }

    /**
     * 刷新网络参数信息
     */
    async function refresh() {
        try {
            setStatus(t('network.status.loading'));

            const response = await fetch("/network/info", {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`${t('network.status.http')} ${response.status}`);
            }

            const data = await response.json();

            // 更新输入框
            const els = getElements();
            if (els.ipaddr) {
                els.ipaddr.value = data.ipaddr || '';
                updateFieldValidation('ipaddr', els.ipaddr.value);
            }
            if (els.netmask) {
                els.netmask.value = data.netmask || '';
                updateFieldValidation('netmask', els.netmask.value);
            }
            if (els.serverip) {
                els.serverip.value = data.serverip || '';
                updateFieldValidation('serverip', els.serverip.value);
            }

            setStatus(t('network.status.ready'));

        } catch (error) {
            setStatus(formatError(error), true);
            console.error("Network Manager Error:", error);
        }
    }

    /**
     * 格式化错误信息
     */
    function formatError(error) {
        if (!error) return t("error.unknown");
        if (error.message) return error.message;
        return String(error);
    }

    /**
     * 保存网络参数
     */
    async function save() {
        // 先验证表单
        if (!validateForm()) {
            return;
        }

        const els = getElements();
        const ipaddr = els.ipaddr.value.trim();
        const netmask = els.netmask.value.trim();
        const serverip = els.serverip.value.trim();

        try {
            setStatus(t('network.status.saving'));

            const formData = new FormData();
            formData.append("ipaddr", ipaddr);
            formData.append("netmask", netmask);
            formData.append("serverip", serverip);

            const response = await fetch("/network/set", {
                method: "POST",
                body: formData
            });

            const result = await response.text();

            if (!response.ok) {
                throw new Error(`${t('network.status.http')} ${response.status}: ${result}`);
            }

            if (result !== "ok") {
                throw new Error(result || t('network.status.error'));
            }

            setStatus(t('network.status.saved'));

            // 刷新显示
            await refresh();

        } catch (error) {
            setStatus(formatError(error), true);
            console.error("Network Manager Error:", error);
        }
    }

    /**
     * 重置为默认网络参数
     */
    async function reset() {
        if (!confirm(t('network.confirm.reset'))) {
            return;
        }

        try {
            setStatus(t('network.status.saving'));

            const response = await fetch("/network/reset", {
                method: "POST"
            });

            const result = await response.text();

            if (!response.ok) {
                throw new Error(`${t('network.status.http')} ${response.status}: ${result}`);
            }

            if (result !== "ok") {
                throw new Error(result || t('network.status.error'));
            }

            setStatus(t('network.status.reset'));

            // 刷新显示
            await refresh();

        } catch (error) {
            setStatus(formatError(error), true);
            console.error("Network Manager Error:", error);
        }
    }

    /**
     * 绑定输入验证事件
     */
    function bindValidationEvents() {
        const els = getElements();

        // 为每个输入框绑定实时验证
        const fields = ['ipaddr', 'netmask', 'serverip'];

        fields.forEach(field => {
            const inputEl = els[field];
            if (!inputEl) return;

            // 输入事件（实时验证）
            inputEl.addEventListener('input', () => {
                updateFieldValidation(field, inputEl.value);
            });

            // 失焦事件（清理空格）
            inputEl.addEventListener('blur', () => {
                inputEl.value = inputEl.value.trim();
                updateFieldValidation(field, inputEl.value);
            });

            // 粘贴事件（立即验证）
            inputEl.addEventListener('paste', () => {
                setTimeout(() => {
                    updateFieldValidation(field, inputEl.value);
                }, 0);
            });
        });
    }

    /**
     * 初始化网络管理器
     */
    function init() {
        // 获取元素引用
        getElements();

        // 绑定验证事件
        bindValidationEvents();

        // 自动刷新一次
        refresh();
    }

    // 导出公共 API
    return {
        init,
        refresh,
        save,
        reset
    };
})();

// ==============================
// Web 控制台模块
// ==============================

/**
 * 控制台管理器
 * 负责处理 U-Boot 命令的发送、输出接收和管理，以及文件上传功能
 */
const consoleManager = (() => {
    // 私有变量
    let elements = null;
    let state = {
        running: false,
        pollTimer: null,
        history: [],
        histPos: -1,
        persistKey: "failsafe_console_output",
        persistMax: 200000
    };

    /**
     * 获取或缓存 DOM 元素
     */
    function getElements() {
        if (elements) return elements;

        elements = {
            output: document.getElementById("console_out"),
            cmd: document.getElementById("console_cmd"),
            status: document.getElementById("console_status"),
            fileInfo: document.getElementById("console_file_info"),
            fileProgress: document.getElementById("console_file_progress"),
            progressCircle: document.getElementById("bar-circle-mini")
        };

        return elements;
    }

    /**
     * 设置状态提示
     */
    function setStatus(text, isError) {
        const el = getElements().status;
        if (el) {
            el.textContent = text || "";
            if (isError) {
                el.style.color = "var(--danger)";
            } else {
                el.style.color = "";
            }
        }
    }

    /**
     * 显示文件信息
     */
    function showFileInfo(text, isSuccess) {
        const el = getElements().fileInfo;
        if (el) {
            el.textContent = text || "";
            el.style.display = text ? "block" : "none";
            if (isSuccess) {
                el.style.color = "var(--primary)";
            } else if (isSuccess === false) {
                el.style.color = "var(--danger)";
            } else {
                el.style.color = "";
            }
        }
    }

    /**
     * 显示/隐藏文件上传进度
     */
    function showFileProgress(show) {
        const el = getElements().fileProgress;
        if (el) {
            el.style.display = show ? "flex" : "none";
        }
    }

    /**
     * 设置文件上传进度
     */
    function setFileProgress(percent) {
        const el = getElements().progressCircle;
        if (el) {
            const p = Math.max(0, Math.min(100, parseInt(percent || 0)));
            el.style.setProperty("--percent", p);
        }
    }

    /**
     * 加载持久化的输出
     */
    function loadPersistedOutput() {
        const outputEl = getElements().output;
        if (!outputEl) return;

        try {
            const saved = sessionStorage.getItem(state.persistKey);
            if (saved) {
                outputEl.textContent = saved;
                // 滚动到底部
                outputEl.scrollTop = outputEl.scrollHeight;
            }
        } catch (e) {
            console.warn("Failed to load persisted output:", e);
        }
    }

    /**
     * 保存输出到 sessionStorage
     */
    function savePersistedOutput() {
        const outputEl = getElements().output;
        if (!outputEl) return;

        try {
            let content = outputEl.textContent || "";
            if (content.length > state.persistMax) {
                content = content.slice(content.length - state.persistMax);
            }
            sessionStorage.setItem(state.persistKey, content);
        } catch (e) {
            console.warn("Failed to persist output:", e);
        }
    }

    /**
     * 追加文本到输出区域
     */
    function appendText(text) {
        const outputEl = getElements().output;
        if (!outputEl || !text) return;

        outputEl.textContent += text;

        // 限制输出长度
        if (outputEl.textContent.length > state.persistMax) {
            outputEl.textContent = outputEl.textContent.slice(
                outputEl.textContent.length - state.persistMax
            );
        }

        savePersistedOutput();
        outputEl.scrollTop = outputEl.scrollHeight;
    }

    /**
     * 格式化错误信息
     */
    function formatError(error) {
        if (!error) return t("error.unknown");
        if (error.message) return error.message;
        return String(error);
    }

    /**
     * 轮询输出
     */
    async function pollOnce() {
        if (!state.running) return;

        try {
            const response = await fetch("/console/poll", {
                method: "GET",
            });

            if (!response.ok) {
                setStatus(`${t("console.status.http")} ${response.status}`, true);
                return;
            }

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                setStatus(t("console.status.parse"), true);
                return;
            }

            if (data && data.data) {
                appendText(data.data);
            }
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 启动轮询
     */
    function schedulePoll() {
        if (state.pollTimer) {
            clearTimeout(state.pollTimer);
        }

        state.pollTimer = setTimeout(async () => {
            await pollOnce();
            schedulePoll();
        }, 300);
    }

    /**
     * 停止轮询
     */
    function stopPoll() {
        if (state.pollTimer) {
            clearTimeout(state.pollTimer);
            state.pollTimer = null;
        }
        state.running = false;
    }

    /**
     * 发送命令
     */
    async function send() {
        const cmdEl = getElements().cmd;

        if (!cmdEl || !cmdEl.value.trim()) return;

        const line = cmdEl.value.trim();
        cmdEl.value = "";

        // 添加到历史记录
        state.history.unshift(line);
        if (state.history.length > 50) {
            state.history.length = 50;
        }
        state.histPos = -1;

        try {
            const formData = new FormData();
            formData.append("cmd", line);

            setStatus(t("console.status.running"));

            const response = await fetch("/console/exec", {
                method: "POST",
                body: formData
            });

            const result = await response.text();

            if (!response.ok) {
                setStatus(
                    `${t("console.status.http")} ${response.status}${result ? ": " + result : ""}`,
                    true
                );
                return;
            }

            try {
                const data = JSON.parse(result);
                setStatus(`${t("console.status.ret")} ${data && typeof data.ret !== "undefined" ? data.ret : "?"}`);
            } catch (e) {
                setStatus(t("console.status.done"));
            }
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 清空输出
     */
    async function clear() {
        try {
            const response = await fetch("/console/clear", {
                method: "GET",
            });

            if (response.ok) {
                const outputEl = getElements().output;
                if (outputEl) {
                    outputEl.textContent = "";
                }
                try {
                    sessionStorage.removeItem(state.persistKey);
                } catch (e) {
                    // 忽略清理错误
                }
                setStatus(t("console.status.cleared"));
            } else {
                setStatus(`${t("console.status.http")} ${response.status}`, true);
            }
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 文件上传功能
     */
    function uploadFile() {
        // 创建一个隐藏的文件选择器
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.style.display = "none";
        fileInput.accept = "*/*";

        fileInput.onchange = async function() {
            const file = fileInput.files[0];
            if (!file) return;

            // 显示文件名
            showFileInfo(`${t("console.uploading")} ${file.name}`);

            // 显示进度条
            showFileProgress(true);
            setFileProgress(0);

            // 准备表单数据
            const formData = new FormData();
            formData.append("file", file);

            try {
                // 使用 XMLHttpRequest 以支持上传进度
                const xhr = new XMLHttpRequest();

                // 上传进度
                xhr.upload.addEventListener("progress", function(event) {
                    if (event.lengthComputable && event.total > 0) {
                        const percent = parseInt((event.loaded / event.total) * 100);
                        setFileProgress(percent);
                    }
                });

                // 请求完成
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        // 隐藏进度条
                        showFileProgress(false);

                        if (xhr.status === 200) {
                            const responseText = xhr.responseText.trim();
                            if (responseText === "ok") {
                                // 上传成功
                                showFileInfo(`✓ ${t("console.upload.success")}`, true);
                                setStatus(t("console.upload.success"), false);
                            } else {
                                // 上传失败
                                showFileInfo(`✗ ${t("console.upload.failed")}: ${responseText}`, false);
                                setStatus(`${t("console.upload.failed")}: ${responseText}`, true);
                            }
                        } else {
                            // HTTP 错误
                            showFileInfo(`✗ ${t("console.status.http")} ${xhr.status}`, false);
                            setStatus(`${t("console.status.http")} ${xhr.status}`, true);
                        }

                        // 5秒后自动清除文件信息
                        setTimeout(() => {
                            showFileInfo("");
                        }, 5000);
                    }
                };

                xhr.open("POST", "/console/upload");
                xhr.send(formData);

            } catch (error) {
                // 隐藏进度条
                showFileProgress(false);
                showFileInfo(`✗ ${formatError(error)}`, false);
                setStatus(formatError(error), true);

                // 5秒后自动清除文件信息
                setTimeout(() => {
                    showFileInfo("");
                }, 5000);
            }
        };

        // 触发文件选择
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    /**
     * 绑定键盘事件
     */
    function bindKeyboardEvents() {
        const cmdEl = getElements().cmd;
        if (!cmdEl) return;

        cmdEl.addEventListener("keydown", (e) => {
            // Enter 发送命令
            if (e.key === "Enter") {
                e.preventDefault();
                send();
                return;
            }

            // 上箭头 - 历史记录向前
            if (e.key === "ArrowUp") {
                const history = state.history;
                if (!history || !history.length) return;

                state.histPos = Math.min(history.length - 1, state.histPos + 1);
                cmdEl.value = history[state.histPos] || "";
                e.preventDefault();
                return;
            }

            // 下箭头 - 历史记录向后
            if (e.key === "ArrowDown") {
                const history = state.history;
                if (!history || !history.length) return;

                state.histPos = Math.max(-1, state.histPos - 1);
                cmdEl.value = state.histPos >= 0 ? (history[state.histPos] || "") : "";
                e.preventDefault();
            }
        });

        // Ctrl+L 清空输出（类似终端行为）
        cmdEl.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "l") {
                e.preventDefault();
                clear();
            }
        });
    }

    /**
     * 初始化控制台管理器
     */
    function init() {
        // 获取元素引用
        getElements();

        // 绑定事件
        bindKeyboardEvents();

        // 加载持久化数据
        loadPersistedOutput();

        // 启动轮询
        state.running = true;
        setStatus(t("console.status.ready"));
        schedulePoll();

        // 页面卸载时停止轮询
        window.addEventListener("beforeunload", () => {
            stopPoll();
        });
    }

    /**
     * 清理资源
     */
    function destroy() {
        stopPoll();
        elements = null;
    }

    // 导出公共 API
    return {
        init,
        send,
        clear,
        uploadFile,
        destroy
    };
})();

// ==============================
// 系统信息模块
// ==============================

/**
 * 创建表格行
 * @param {string} labelKey - 标签的国际化 key
 * @param {string} value - 显示的值
 * @param {string} [valueClass] - 值的额外 CSS 类
 * @returns {HTMLTableRowElement}
 */
function createInfoRow(labelKey, value, valueClass) {
    const tr = document.createElement("tr");
    tr.className = "tr";

    const tdLabel = document.createElement("td");
    tdLabel.className = "td left";
    tdLabel.setAttribute("width", "33%");
    tdLabel.setAttribute("data-i18n", labelKey);
    tdLabel.textContent = t(labelKey);

    const tdValue = document.createElement("td");
    tdValue.className = "td left";
    if (valueClass) {
        tdValue.classList.add(valueClass);
    }
    tdValue.textContent = value !== undefined && value !== null ? String(value) : t("sysinfo.no_data");

    tr.appendChild(tdLabel);
    tr.appendChild(tdValue);
    return tr;
}

/**
 * 创建板块表格容器
 * @param {string} sectionId - 板块元素 ID
 * @param {string} titleKey - 标题的国际化 key
 * @returns {HTMLTableElement}
 */
function createSectionTable(sectionId, titleKey) {
    const section = document.getElementById(sectionId);
    if (!section) return null;

    // 清空并设置标题
    const inner = section.querySelector(".card-main-inner");
    if (!inner) return null;

    inner.innerHTML = "";

    const h2 = document.createElement("h2");
    h2.setAttribute("data-i18n", titleKey);
    h2.textContent = t(titleKey);
    inner.appendChild(h2);

    const table = document.createElement("table");
    table.className = "table";
    inner.appendChild(table);

    return table;
}

/**
 * 格式化字节数为可读字符串
 * @param {number} bytes
 * @returns {string}
 */
function formatHexBytes(bytes) {
    if (bytes === undefined || bytes === null) return t("sysinfo.no_data");
    const hex = "0x" + bytes.toString(16).toUpperCase();
    const human = bytesToHuman(bytes);
    return hex + " (" + human + ")";
}

/**
 * 处理设备信息
 * @param {object} device - 设备对象
 * @param {string} type - 设备类型 (spi/mmc/nand)
 * @param {HTMLTableElement} table - 目标表格
 */
function renderDeviceInfo(device, type, table) {
    if (!device || !device.present) return;

    // 添加设备类型标题行
    let deviceName;
    if (type === "mmc" && device.vendor && device.product) {
        deviceName = device.vendor + " / " + device.product;
    } else if (device.name) {
        deviceName = device.name;
    } else {
        deviceName = t("sysinfo.present");
    }

    const headerTr = document.createElement("tr");
    headerTr.className = "tr";

    const headerTd = document.createElement("td");
    headerTd.className = "td left";
    headerTd.setAttribute("colspan", "2");
    headerTd.style.fontWeight = "600";
    headerTd.style.color = "var(--primary)";
    headerTd.style.backgroundColor = "var(--panel-2)";
    headerTd.textContent = type.toUpperCase() + " (" + deviceName + ")";

    headerTr.appendChild(headerTd);
    table.appendChild(headerTr);

    // 大小
    if (device.size !== undefined) {
        table.appendChild(createInfoRow("sysinfo.size", formatHexBytes(device.size)));
    }

    // 根据设备类型显示不同属性
    const spiProps = {
        "page_size": "sysinfo.page_size",
        "block_size": "sysinfo.block_size",
        "sector_size": "sysinfo.sector_size",
        "erase_size": "sysinfo.erase_size",
    };

    const mmcProps = {
        "block_size": "sysinfo.block_size",
        "version": "sysinfo.version",
    };

    const nandProps = {
        "page_size": "sysinfo.page_size",
        "block_size": "sysinfo.block_size",
        "oob_size": "sysinfo.oob_size",
        "oob_avail": "sysinfo.oob_avail",
        "ecc_step_size": "sysinfo.ecc_step_size",
        "ecc_strength": "sysinfo.ecc_strength",
    };

    let propsToShow;
    if (type === "spi") {
        propsToShow = spiProps;
    } else if (type === "mmc") {
        propsToShow = mmcProps;
    } else if (type === "nand") {
        propsToShow = nandProps;
    }

    for (const [prop, labelKey] of Object.entries(propsToShow)) {
        if (device[prop] !== undefined) {
            let value = device[prop];
            // 大小相关的用十六进制显示
            if (prop.includes("size")) {
                value = formatHexBytes(value);
            }
            table.appendChild(createInfoRow(labelKey, value));
        }
    }
}

/**
 * 渲染分区信息
 * @param {object} partitionsInfo - 分区数据
 * @param {HTMLTableElement} table - 目标表格
 */
function renderPartitions(partitionsInfo, table) {
    if (!partitionsInfo) return;

    const partTypes = ["smem", "mmc"];

    partTypes.forEach(function(partType) {
        const partData = partitionsInfo[partType];
        if (!partData || !partData.present || !partData.parts || !partData.parts.length) {
            return;
        }

        // 添加分区类型标题行
        const headerTr = document.createElement("tr");
        headerTr.className = "tr";

        const headerTd = document.createElement("td");
        headerTd.className = "td left";
        headerTd.setAttribute("colspan", "5");
        headerTd.style.fontWeight = "600";
        headerTd.style.color = "var(--primary)";
        headerTd.style.backgroundColor = "var(--panel-2)";
        headerTd.textContent = partType.toUpperCase() + " " + t("sysinfo.title.partitions_info");

        headerTr.appendChild(headerTd);
        table.appendChild(headerTr);

        // 添加表头行
        const theadTr = document.createElement("tr");
        theadTr.className = "tr";

        // 列定义：序号、分区名、起始地址、结束地址、大小
        const columns = [
            { key: "sysinfo.part_index", text: t("sysinfo.part_index"), width: "8%" },
            { key: "sysinfo.name", text: t("sysinfo.name"), width: "20%" },
            { key: "sysinfo.part_start", text: t("sysinfo.part_start"), width: "24%" },
            { key: "sysinfo.part_end", text: t("sysinfo.part_end"), width: "24%" },
            { key: "sysinfo.size", text: t("sysinfo.size"), width: "24%" }
        ];

        columns.forEach(function(col) {
            const th = document.createElement("td");
            th.className = "td left";
            th.setAttribute("width", col.width);
            th.setAttribute("data-i18n", col.key);
            th.textContent = col.text;
            th.style.fontWeight = "500";
            th.style.fontSize = "0.85rem";
            th.style.color = "var(--muted)";
            theadTr.appendChild(th);
        });

        table.appendChild(theadTr);

        // 添加每个分区
        partData.parts.forEach(function(part, index) {
            const tr = document.createElement("tr");
            tr.className = "tr";

            // 序号（从 1 开始）
            const tdIndex = document.createElement("td");
            tdIndex.className = "td left";
            tdIndex.setAttribute("width", "8%");
            tdIndex.textContent = index + 1;
            tdIndex.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            tdIndex.style.fontSize = "0.85rem";

            // 分区名
            const tdName = document.createElement("td");
            tdName.className = "td left";
            tdName.setAttribute("width", "20%");
            tdName.textContent = part.name || "";
            tdName.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            tdName.style.fontSize = "0.85rem";

            // 起始地址
            const tdStart = document.createElement("td");
            tdStart.className = "td left";
            tdStart.setAttribute("width", "24%");
            const start = part.start || 0;
            tdStart.textContent = "0x" + start.toString(16).toUpperCase();
            tdStart.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            tdStart.style.fontSize = "0.85rem";

            // 结束地址 = 起始地址 + 大小 - 1
            const tdEnd = document.createElement("td");
            tdEnd.className = "td left";
            tdEnd.setAttribute("width", "24%");
            const size = part.size || 0;
            const end = start + size - 1;
            tdEnd.textContent = "0x" + end.toString(16).toUpperCase();
            tdEnd.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            tdEnd.style.fontSize = "0.85rem";

            // 大小
            const tdSize = document.createElement("td");
            tdSize.className = "td left";
            tdSize.setAttribute("width", "24%");
            tdSize.textContent = "0x" + size.toString(16).toUpperCase() + " (" + bytesToHuman(size) + ")";
            tdSize.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            tdSize.style.fontSize = "0.85rem";

            tr.appendChild(tdIndex);
            tr.appendChild(tdName);
            tr.appendChild(tdStart);
            tr.appendChild(tdEnd);
            tr.appendChild(tdSize);
            table.appendChild(tr);
        });
    });
}

/**
 * 渲染系统信息数据
 * @param {object} data - 解析后的系统信息数据
 */
function renderSysinfoData(sections, data) {
    // ========== 设备信息 ==========
    var boardTable = createSectionTable("board_info", "sysinfo.title.board_info");
    if (boardTable) {
        // 设备详细信息
        if (data.board) {
            var b = data.board;
            if (b.hostname) boardTable.appendChild(createInfoRow("sysinfo.hostname", b.hostname));
            if (b.model) boardTable.appendChild(createInfoRow("sysinfo.model", b.model));
            if (b.compatible) boardTable.appendChild(createInfoRow("sysinfo.compatible", b.compatible));
            if (b.machid) boardTable.appendChild(createInfoRow("sysinfo.machid", b.machid));
            if (b.ram_size !== undefined) {
                boardTable.appendChild(createInfoRow("sysinfo.ram_size", formatHexBytes(b.ram_size)));
            }
        }

        // 启动模式
        if (data.is_9008_mode !== undefined) {
            const bootMode = data.is_9008_mode ? "9008" : "Normal";
            boardTable.appendChild(createInfoRow("sysinfo.boot_mode", bootMode));
        }

        // U-Boot 版本
        if (data.uboot_version) {
            boardTable.appendChild(createInfoRow("sysinfo.uboot_version", data.uboot_version));
        }
    }

    // ========== 存储信息 ==========
    var flashTable = createSectionTable("flash_info", "sysinfo.title.flash_info");
    if (flashTable) {
        // SMEM 信息
        if (data.smeminfo) {

            // 添加 SMEM 信息标题行
            const headerTr = document.createElement("tr");
            headerTr.className = "tr";

            const headerTd = document.createElement("td");
            headerTd.className = "td left";
            headerTd.setAttribute("colspan", "2");
            headerTd.style.fontWeight = "600";
            headerTd.style.color = "var(--primary)";
            headerTd.style.backgroundColor = "var(--panel-2)";
            headerTd.setAttribute("data-i18n", "sysinfo.smeminfo");
            headerTd.textContent = t("sysinfo.smeminfo");

            headerTr.appendChild(headerTd);
            flashTable.appendChild(headerTr);

            var smem = data.smeminfo;
            if (smem.flash_type) flashTable.appendChild(createInfoRow("sysinfo.flash_type", smem.flash_type));
            if (smem.flash_block_size) flashTable.appendChild(createInfoRow("sysinfo.flash_block_size", formatHexBytes(smem.flash_block_size)));
            if (smem.flash_density) flashTable.appendChild(createInfoRow("sysinfo.flash_density", formatHexBytes(smem.flash_density)));
            if (smem.flash_secondary_type) flashTable.appendChild(createInfoRow("sysinfo.flash_secondary_type", smem.flash_secondary_type));
        }

        // 设备信息
        if (data.devices) {
            var devices = data.devices;

            // SPI
            if (devices.spi && devices.spi.present) {
                renderDeviceInfo(devices.spi, "spi", flashTable);
            }

            // MMC
            if (devices.mmc && devices.mmc.present) {
                renderDeviceInfo(devices.mmc, "mmc", flashTable);
            }

            // NAND
            if (devices.nand && devices.nand.present) {
                renderDeviceInfo(devices.nand, "nand", flashTable);
            }
        }

        // 如果没有任何设备，显示提示
        if (flashTable.querySelectorAll("tr").length === 0) {
            flashTable.appendChild(createInfoRow("sysinfo.no_data", t("sysinfo.no_data")));
        }
    }

    // ========== 分区信息 ==========
    var partitionTable = createSectionTable("partitions_info", "sysinfo.title.partitions_info");
    if (partitionTable) {
        if (data.partitions) {
            renderPartitions(data.partitions, partitionTable);
        }

        // 如果没有任何分区，显示提示
        if (partitionTable.querySelectorAll("tr").length === 0) {
            partitionTable.appendChild(createInfoRow("sysinfo.no_data", t("sysinfo.no_data")));
        }
    }

    // 应用国际化
    sections.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            applyI18n(el);
        }
    });
}

/**
 * 获取系统信息并将其存储在 APP_STATE 中
 */
function getAndStoreSysinfo() {
    ajax({
        url: "/sysinfo",
        timeout: 10000,
        done: function(responseText) {
            try {
                APP_STATE.sysinfo = JSON.parse(responseText);
            } catch (e) {
                return;
            }
        }
    });
}

/**
 * 系统信息页面初始化
 */
function sysinfoInit() {
    // 显示加载状态
    const sections = ["board_info", "flash_info", "partitions_info"];
    sections.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            var inner = el.querySelector(".card-main-inner");
            if (inner) {
                inner.innerHTML = '<span style="color: var(--muted);">' + t("sysinfo.loading") + '</span>';
            }
        }
    });

    // 请求系统信息
    ajax({
        url: "/sysinfo",
        timeout: 10000,
        done: function(responseText) {
            var data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                sections.forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el) {
                        var inner = el.querySelector(".card-main-inner");
                        if (inner) {
                            inner.innerHTML = '<span style="color: var(--danger);">' + t("sysinfo.error.parse") + '</span>';
                        }
                    }
                });
                return;
            }

            renderSysinfoData(sections, data);
        }
    });
}

// 导出初始化函数
window.sysinfoInit = sysinfoInit;

// ==============================
// MIBIB 重载模块
// ==============================

/**
 * 处理MIBIB重载成功
 */
function handleMibibReloadSuccess(elements) {
    const {
        successInfo,
        progressCircle
    } = elements;

    if (progressCircle) progressCircle.style.display = "none";
    if (successInfo) {
        successInfo.innerHTML = t("mibib.success");
        successInfo.style.display = "block";
    }
}

/**
 * 处理MIBIB重载失败
 */
function handleMibibReloadError(info, elements) {
    const {
        errorInfo,
        progressCircle
    } = elements;

    if (progressCircle) progressCircle.style.display = "none";

    // 根据错误类型生成错误信息
    let errorMessage = "";

    switch (info.type) {
        case "wrong_file_type":
            errorMessage = generateWrongFileTypeMessage(info);
            break;
        case "flash_not_found":
            errorMessage = generateFlashNotFoundMessage(info);
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
 * 处理无效的MIBIB重载响应信息
 */
function handleInvalidMibibReloadResponse(message, elements) {
    const {
        errorInfo,
        progressCircle
    } = elements;

    if (progressCircle) progressCircle.style.display = "none";

    if (errorInfo) {
        errorInfo.style.display = "block";
        errorInfo.innerHTML = `<div class="error-detail">${escapeHtml(message)}</div>`;
    }
}

/**
 * 处理MIBIB重载
 */
function mibibReload() {
    const sysinfo = APP_STATE.sysinfo;

    if (sysinfo && !sysinfo.is_9008_mode) {
        alert(t("mibib.not_9008"));
        return;
    }

    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];

    if (!file) {
        alert(t("file.select"));
        return;
    }

    // 获取页面相关元素
    const formElement = document.getElementById("form");
    const successInfo = document.getElementById("success-info");
    const errorInfo = document.getElementById("error-info");
    const progressCircle = document.getElementById("bar-circle");

    // 显示圆环进度条，隐藏无关元素
    if (formElement) formElement.style.display = "none";
    if (successInfo) successInfo.style.display = "none";
    if (errorInfo) errorInfo.style.display = "none";
    if (progressCircle) progressCircle.style.display = "block";

    // 准备表单数据
    const formData = new FormData();
    formData.append("mibib", file);

    // 发送上传请求
    ajax({
        url: "/mibib/reload",
        data: formData,
        done: function(responseText) {
            let response;

            // 尝试解析JSON响应
            try {
                response = JSON.parse(responseText);
            } catch (e) {
                // 无效的JSON，显示错误
                handleInvalidMibibReloadResponse(responseText || t("error.invalid_response"), {
                    errorInfo,
                    progressCircle
                });
                return;
            }

            switch (response.status) {
                case "success":
                    handleMibibReloadSuccess({
                        successInfo,
                        progressCircle
                    })
                    break;
                case "fail":
                    handleMibibReloadError(response.info, {
                        errorInfo,
                        progressCircle
                    });
                    break;
                default:
                    handleInvalidMibibReloadResponse(responseText || t("error.unknown_status"), {
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

// ==============================
// 国际化数据
// ==============================

const I18N = (() => {
    // 模板函数
    const t = {
        en: {
            updateHint: (type) => `You are going to update <strong>${type}</strong> on the device.<br>Please choose a file from your local hard drive and click <strong>Upload</strong> button.`,
            warnChoose: (type) => `You can upload whatever you want, so be sure you choose the proper ${type} for your device.`,
            warnDanger: (type) => `Updating ${type} is a very dangerous operation and may damage your device.`
        },
        "zh-cn": {
            updateHint: (type) => `你将要在此设备上更新 <strong>${type}</strong>。<br>请选择本地文件并点击 <strong>上传</strong> 按钮。`,
            warnChoose: (type) => `你可以上传任意文件，请确保选择了与你的设备匹配的 ${type} 文件。`,
            warnDanger: (type) => `更新 ${type} 是一个十分危险的操作，可能导致你的路由器无法启动。`
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
            "nav.ptable": "PTABLE Update",
            "nav.simg": "SIMG Update",
            "nav.initramfs": "Load Initramfs",
            "nav.system": "System",
            "nav.sysinfo": "System Info",
            "nav.network": "Network Settings",
            "nav.backup": "Flash Backup",
            "nav.console": "Web Console",
            "nav.env": "Environment Management",
            "nav.mibib": "MIBIB Reload",
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
            "ptable.title": "PTABLE UPDATE",
            "ptable.hint": t.en.updateHint("Partition Table (GPT or MIBIB)"),
            "ptable.warn.1": t.en.warnChoose("PTABLE"),
            "ptable.warn.2": t.en.warnDanger("PTABLE"),
            "simg.title": "SIMG UPDATE",
            "simg.hint": t.en.updateHint("Single Image (written starting from offset 0x0 of the flash memory device)"),
            "simg.warn.1": t.en.warnChoose("Single Image"),
            "simg.warn.2": t.en.warnDanger("Single Image"),
            "backup.title": "FLASH BACKUP",
            "backup.hint": "Download a backup from device storage as a <strong>binary file</strong>.<br>The backup data will be streamed to your browser and saved on your computer.",
            "backup.label.mode": "Mode:",
            "backup.label.target": "Target:",
            "backup.label.start": "Start:",
            "backup.label.end": "End (exclusive):",
            "backup.mode.part": "Partition backup",
            "backup.mode.range": "Custom range",
            "backup.action.download": "Download",
            "backup.status.starting": "Starting backup...",
            "backup.status.downloading": "Downloading data...",
            "backup.status.preparing": "Preparing file...",
            "backup.status.done": "Backup completed:",
            "backup.status.starting": "Starting backup...",
            "backup.error.no_target": "Please select a target",
            "backup.error.bad_range": "Invalid range",
            "backup.error.http": "HTTP error:",
            "backup.error.exception": "Error:",
            "backup.range.hint": "Start and end offsets (supports hex 0x... or decimal with K/KiB suffix)",
            "backup.target.placeholder": "-- Select target --",
            "backup.storage.not_present": "Not present",
            "backup.warn.1": "Do not power off the device during backup.",
            "backup.warn.2": "Custom range reads raw bytes; be careful with offsets.",
            "backup.warn.3": "Large backups may take a long time depending on storage speed.",
            "console.title": "WEB CONSOLE",
            "console.hint": "Run <strong>U-Boot commands</strong> directly in your browser.<br>Output is streamed by polling (no WebSocket). Treat this as <strong>root access</strong>.",
            "console.send": "Send",
            "console.clear": "Clear",
            "console.placeholder.cmd": "help; printenv",
            "console.status.ready": "Ready",
            "console.status.running": "Running...",
            "console.status.done": "Done",
            "console.status.cleared": "Cleared",
            "console.status.ret": "Return:",
            "console.status.http": "HTTP error:",
            "console.status.parse": "Parse error",
            "console.status.error": "Error:",
            "console.upload": "Upload",
            "console.uploading": "Uploading:",
            "console.upload.success": "Upload successful",
            "console.upload.failed": "Upload failed",
            "console.warn.1": "This console can execute arbitrary U-Boot commands.",
            "console.warn.2": "Do not expose this page on untrusted networks.",
            "env.title": "U-BOOT ENV",
            "env.hint": "Manage <strong>U-Boot environment variables</strong>. Changes will be saved to storage.",
            "env.count": "Variables:",
            "env.status.loading": "Loading...",
            "env.status.ready": "Ready",
            "env.status.saving": "Saving...",
            "env.status.saved": "✓ Saved",
            "env.status.deleted": "✓ Deleted",
            "env.status.reset": "✓ Reset to defaults",
            "env.status.reset_single": "✓ Variable reset to default",
            "env.status.restored": "✓ Restored",
            "env.status.http": "HTTP error:",
            "env.status.error": "Error",
            "env.thead.name": "Name",
            "env.thead.value": "Value",
            "env.thead.actions": "Actions",
            "env.label.name": "Name:",
            "env.label.value": "Value:",
            "env.action.unset": "Delete",
            "env.action.refresh": "Refresh",
            "env.action.reset": "Reset to defaults",
            "env.action.restore": "Restore",
            "env.action.add": "Add",
            "env.action.edit": "Edit",
            "env.action.save": "Save",
            "env.action.delete": "Delete",
            "env.action.cancel": "Cancel",
            "env.action.reset_single": "Reset to Default",
            "env.edit.title": "Edit Variable",
            "env.add.title": "Add Variable",
            "env.delete.forbid": "the variable cannot be deleted!",
            "env.confirm.reset_single": "reset this variable to default value?",
            "env.confirm.delete": "Delete variable",
            "env.confirm.reset": "Reset all environment variables to defaults?",
            "env.confirm.restore": "Restore environment from file? This will overwrite all current variables.",
            "env.error.no_name": "Please enter variable name",
            "env.error.no_file": "Please select a file",
            "env.placeholder": "No environment variables loaded",
            "env.warn.1": "Modifying environment variables may affect boot behavior.",
            "env.warn.2": "Do not power off during save or restore.",
            "env.warn.3": "The RESTORE function supports uploading a previously saved binary U-Boot environment image (CRC + data) to restore.",
            "mibib.title": "MIBIB RELOAD",
            "mibib.hint": "In <strong>9008</strong> mode, reloading <strong>MIBIB</strong> to initialize <strong>SMEM (Shared Memory) Partition Info</strong>. <br>Please choose a file from your local hard drive and click <strong>Reload</strong> button.",
            "mibib.reload": "Reload",
            "mibib.not_9008": "Not in 9008 mode, MIBIB reload is not allowed!",
            "mibib.success": "MIBIB reloaded successfully. Please open the \"System Info\" page to check if the SMEM information is correct.",
            "mibib.warn.1": "Use only in 9008 emergency download mode.",
            "mibib.warn.2": "After successful reload, please check if the SMEM information is correct.",
            "network.title": "NETWORK SETTINGS",
            "network.hint": "Configure <strong>U-Boot network parameters</strong> (ipaddr, netmask, serverip).<br>Changes will be saved to environment variables and will take effect after a restart.",
            "network.label.ipaddr": "IP Address:",
            "network.label.netmask": "Netmask:",
            "network.label.serverip": "Server IP:",
            "network.action.refresh": "Refresh",
            "network.action.save": "Save",
            "network.action.reset": "Reset to defaults",
            "network.status.loading": "Loading network settings...",
            "network.status.ready": "Ready",
            "network.status.saving": "Saving...",
            "network.status.saved": "✓ Network settings saved",
            "network.status.reset": "✓ Reset to defaults",
            "network.status.http": "HTTP error:",
            "network.status.error": "Error",
            "network.confirm.reset": "Reset all network settings to defaults?",
            "network.validation.valid": "Valid",
            "network.validation.invalid_ip": "Invalid IP address format",
            "network.validation.invalid_netmask": "Invalid netmask format",
            "network.validation.cannot_be_empty": "cannot be empty",
            "network.validation.invalid_format": "has invalid format",
            "network.validation.invalid_netmask_format": "has invalid netmask format",
            "network.warn.1": "Modifying network settings may affect network connectivity.",
            "network.warn.2": "Do not power off the device during save.",
            "network.warn.3": "Invalid network settings may prevent network access.",
            "sysinfo.title": "SYSTEM INFORMATION",
            "sysinfo.title.board_info": "Board Info",
            "sysinfo.title.flash_info": "Flash Info",
            "sysinfo.title.partitions_info": "Partitions",
            "sysinfo.loading": "Loading system information...",
            "sysinfo.error.load": "Failed to load system information",
            "sysinfo.error.parse": "Failed to parse system information",
            "sysinfo.uboot_version": "U-Boot Version",
            "sysinfo.hostname": "Hostname",
            "sysinfo.model": "Model",
            "sysinfo.compatible": "Compatible",
            "sysinfo.machid": "Machine ID",
            "sysinfo.ram_size": "RAM Size",
            "sysinfo.smeminfo": "SMEM INFO",
            "sysinfo.flash_type": "Flash Type",
            "sysinfo.flash_secondary_type": "2nd Flash Type",
            "sysinfo.flash_block_size": "Block Size",
            "sysinfo.flash_density": "Density",
            "sysinfo.present": "Present",
            "sysinfo.name": "Name",
            "sysinfo.size": "Size",
            "sysinfo.page_size": "Page Size",
            "sysinfo.sector_size": "Sector Size",
            "sysinfo.erase_size": "Erase Size",
            "sysinfo.block_size": "Block Size",
            "sysinfo.oob_size": "OOB Size",
            "sysinfo.oob_avail": "OOB Available",
            "sysinfo.ecc_step_size": "ECC Step Size",
            "sysinfo.ecc_strength": "ECC Strength",
            "sysinfo.vendor": "Vendor",
            "sysinfo.product": "Product",
            "sysinfo.version": "Version",
            "sysinfo.type": "Type",
            "sysinfo.part_index": "Index",
            "sysinfo.part_start": "Start Address",
            "sysinfo.part_end": "End Address",
            "sysinfo.no_data": "No data available",
            "sysinfo.boot_mode": "Boot Mode",
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
            "nav.ptable": "分区表更新",
            "nav.simg": "闪存镜像更新",
            "nav.initramfs": "启动内存固件",
            "nav.system": "系统",
            "nav.sysinfo": "系统信息",
            "nav.network": "网络设置",
            "nav.backup": "闪存备份",
            "nav.console": "网页终端",
            "nav.env": "环境变量管理",
            "nav.mibib": "MIBIB 重载",
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
            "common.warn.1": "刷写过程中请勿断电。",
            "common.warn.2": "如果更新成功，设备将自动重启。",
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
            "ptable.title": "分区表更新",
            "ptable.hint": t["zh-cn"].updateHint("分区表（GPT 或 MIBIB）"),
            "ptable.warn.1": t["zh-cn"].warnChoose("分区表"),
            "ptable.warn.2": t["zh-cn"].warnDanger("分区表"),
            "simg.title": "闪存镜像更新",
            "simg.hint": t["zh-cn"].updateHint("闪存镜像（从闪存设备的偏移量 0x0 处开始写入）"),
            "simg.warn.1": t["zh-cn"].warnChoose("闪存镜像"),
            "simg.warn.2": t["zh-cn"].warnDanger("闪存镜像"),
            "backup.title": "闪存备份",
            "backup.hint": "从设备存储下载备份为 <strong>二进制文件</strong>。<br>备份数据将流式传输到浏览器并保存到您的计算机。",
            "backup.label.mode": "模式:",
            "backup.label.target": "目标:",
            "backup.label.start": "起始偏移:",
            "backup.label.end": "结束偏移(不含):",
            "backup.mode.part": "分区备份",
            "backup.mode.range": "自定义范围",
            "backup.action.download": "下载",
            "backup.status.starting": "开始备份...",
            "backup.status.downloading": "正在下载数据...",
            "backup.status.preparing": "准备文件中...",
            "backup.status.done": "备份完成:",
            "backup.error.no_target": "请选择目标",
            "backup.error.bad_range": "无效的范围",
            "backup.error.http": "HTTP 错误:",
            "backup.error.exception": "错误:",
            "backup.range.hint": "起始和结束偏移量支持十进制、0x 十六进制及 KiB / MiB 后缀",
            "backup.target.placeholder": "-- 选择目标 --",
            "backup.storage.not_present": "不存在",
            "backup.warn.1": "备份过程中请勿断电。",
            "backup.warn.2": "自定义范围读取原始字节，请谨慎设置偏移量。",
            "backup.warn.3": "大容量备份可能需要较长时间，取决于存储速度。",
            "console.title": "网页终端",
            "console.hint": "在浏览器中直接执行 <strong>U-Boot 命令</strong>。<br>输出通过轮询方式获取（非 WebSocket），相当于 <strong>root 权限</strong>。",
            "console.send": "发送",
            "console.clear": "清空",
            "console.placeholder.cmd": "help; printenv",
            "console.status.ready": "就绪",
            "console.status.running": "执行中...",
            "console.status.done": "完成",
            "console.status.cleared": "已清空",
            "console.status.ret": "返回值：",
            "console.status.http": "HTTP 错误：",
            "console.status.parse": "解析失败",
            "console.status.error": "错误：",
            "console.upload": "上传",
            "console.uploading": "正在上传：",
            "console.upload.success": "上传成功",
            "console.upload.failed": "上传失败",
            "console.warn.1": "该终端可执行任意 U-Boot 命令。",
            "console.warn.2": "不要在不可信网络中暴露此页面。",
            "env.title": "U-Boot 环境变量",
            "env.hint": "管理 <strong>U-Boot 环境变量</strong>。更改将保存到存储设备。",
            "env.count": "变量数:",
            "env.status.loading": "加载中...",
            "env.status.ready": "就绪",
            "env.status.saving": "保存中...",
            "env.status.saved": "✓ 已保存",
            "env.status.deleted": "✓ 已删除",
            "env.status.reset": "✓ 已重置为默认值",
            "env.status.restored": "✓ 已恢复",
            "env.status.http": "HTTP 错误:",
            "env.status.error": "错误",
            "env.status.reset_single": "✓ 变量已重置为默认值",
            "env.thead.name": "名称",
            "env.thead.value": "值",
            "env.thead.actions": "操作",
            "env.label.name": "名称:",
            "env.label.value": "值:",
            "env.action.unset": "删除",
            "env.action.refresh": "刷新",
            "env.action.reset": "重置为默认值",
            "env.action.restore": "恢复",
            "env.action.add": "添加",
            "env.action.edit": "编辑",
            "env.action.save": "保存",
            "env.action.delete": "删除",
            "env.action.cancel": "取消",
            "env.action.reset_single": "重置为默认值",
            "env.edit.title": "编辑变量",
            "env.add.title": "添加变量",
            "env.delete.forbid": "该变量不能删除！",
            "env.confirm.reset_single": "确定将此变量重置为默认值？",
            "env.confirm.delete": "删除变量",
            "env.confirm.reset": "确定将所有环境变量重置为默认值？",
            "env.confirm.restore": "确定从文件恢复环境变量？这将覆盖所有当前变量。",
            "env.error.no_name": "请输入变量名称",
            "env.error.no_file": "请选择文件",
            "env.placeholder": "暂无环境变量",
            "env.warn.1": "修改环境变量可能影响系统启动行为。",
            "env.warn.2": "保存或恢复过程中请勿断电。",
            "env.warn.3": "恢复功能支持上传你之前保存的二进制环境变量镜像文件（含 CRC）进行恢复。",
            "mibib.title": "MIBIB 重载",
            "mibib.hint": "在 <strong>9008</strong> 模式下，通过重载 <strong>MIBIB</strong> 来初始化 <strong>SMEM (Shared Memory) 分区信息</strong>。<br>请选择本地文件并点击 <strong>重载</strong> 按钮。",
            "mibib.reload": "重载",
            "mibib.not_9008": "非 9008 启动模式，无法进行 MIBIB 重载！",
            "mibib.success": "MIBIB 重载成功，请打开 “系统信息” 页面查看 SMEM 相关信息是否正确。",
            "mibib.warn.1": "仅限于 9008 模式下使用。",
            "mibib.warn.2": "重载成功后，请检查 SMEM 相关信息是否正确。",
            "network.title": "网络设置",
            "network.hint": "配置 <strong>U-Boot 网络参数</strong>（ipaddr、netmask、serverip）。<br>更改将保存到环境变量，重启后生效。",
            "network.label.ipaddr": "IP 地址:",
            "network.label.netmask": "子网掩码:",
            "network.label.serverip": "服务器 IP:",
            "network.action.refresh": "刷新",
            "network.action.save": "保存",
            "network.action.reset": "重置为默认值",
            "network.status.loading": "正在加载网络设置...",
            "network.status.ready": "就绪",
            "network.status.saving": "保存中...",
            "network.status.saved": "✓ 网络设置已保存",
            "network.status.reset": "✓ 已重置为默认值",
            "network.status.http": "HTTP 错误:",
            "network.status.error": "错误",
            "network.confirm.reset": "确定将所有网络设置重置为默认值？",
            "network.validation.valid": "有效",
            "network.validation.invalid_ip": "无效的 IP 地址格式",
            "network.validation.invalid_netmask": "无效的子网掩码格式",
            "network.validation.cannot_be_empty": "不能为空",
            "network.validation.invalid_format": "格式无效",
            "network.validation.invalid_netmask_format": "子网掩码格式无效",
            "network.warn.1": "修改网络设置可能影响网络连接。",
            "network.warn.2": "保存过程中请勿断电。",
            "network.warn.3": "无效的网络设置可能导致无法通过网络访问 U-Boot。",
            "sysinfo.title": "系统信息",
            "sysinfo.title.board_info": "设备信息",
            "sysinfo.title.flash_info": "存储信息",
            "sysinfo.title.partitions_info": "分区信息",
            "sysinfo.loading": "正在加载系统信息...",
            "sysinfo.error.load": "加载系统信息失败",
            "sysinfo.error.parse": "解析系统信息失败",
            "sysinfo.uboot_version": "U-Boot 版本",
            "sysinfo.hostname": "主机名",
            "sysinfo.model": "型号",
            "sysinfo.compatible": "兼容平台",
            "sysinfo.machid": "机器 ID",
            "sysinfo.ram_size": "内存大小",
            "sysinfo.smeminfo": "SMEM 信息",
            "sysinfo.flash_type": "闪存类型",
            "sysinfo.flash_secondary_type": "次级闪存类型",
            "sysinfo.flash_block_size": "块大小",
            "sysinfo.flash_density": "容量密度",
            "sysinfo.present": "存在",
            "sysinfo.name": "名称",
            "sysinfo.size": "大小",
            "sysinfo.page_size": "页大小",
            "sysinfo.sector_size": "扇区大小",
            "sysinfo.erase_size": "擦除块大小",
            "sysinfo.block_size": "块大小",
            "sysinfo.oob_size": "OOB 大小",
            "sysinfo.oob_avail": "可用 OOB",
            "sysinfo.ecc_step_size": "ECC 步长",
            "sysinfo.ecc_strength": "ECC 强度",
            "sysinfo.vendor": "厂商",
            "sysinfo.product": "产品",
            "sysinfo.version": "版本",
            "sysinfo.type": "类型",
            "sysinfo.part_index": "序号",
            "sysinfo.part_start": "起始地址",
            "sysinfo.part_end": "结束地址",
            "sysinfo.no_data": "无数据",
            "sysinfo.boot_mode": "启动模式",
            "reboot.confirm": "确认立即重启设备？",
            "reboot.title.in_progress": "正在重启设备",
            "reboot.hint.in_progress": "已发送重启请求，请稍候…<br>该页面短时间可能显示无响应，这是正常现象。",
            "initramfs.title": "启动内存固件",
            "initramfs.hint": "你将要在此设备上启动 <strong>内存固件<\/strong>。<br>请选择本地文件并点击 <strong>上传<\/strong> 按钮。",
            "initramfs.boot_hint": "如果以上信息确认无误，请点击 “启动”。",
            "initramfs.warn.1": "如果一切顺利，设备将启动至内存固件。",
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
