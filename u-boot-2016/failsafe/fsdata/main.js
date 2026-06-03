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
        this.rebootItem = this.getRebootConfig();
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
            '/': 'sysinfo',
            '/cgi-bin/luci': 'sysinfo',
            '/cgi-bin/luci/': 'sysinfo',
            '/index.html': 'sysinfo',
            '/syslog.html': 'syslog',
            '/firmware.html': 'firmware',
            '/art.html': 'art',
            '/cdt.html': 'cdt',
            '/ptable.html': 'ptable',
            '/simg.html': 'simg',
            '/uboot.html': 'uboot',
            '/initramfs.html': 'initramfs',
            '/mibib.html': 'mibib',
            '/backup.html': 'backup',
            '/env.html': 'env',
            '/console.html': 'console',
            '/mac.html': 'mac',
            '/network.html': 'network',
            '/settings.html': 'settings',
            '/flashing.html': 'flashing',
            '/booting.html': 'booting',
            '/reboot.html': 'reboot',
        };

        return pathMap[path] || null;
    }

    /**
     * 重启功能配置（独立一级菜单）
     */
    getRebootConfig() {
        return {
            titleKey: "nav.reboot",
            id: "reboot",
            path: "/reboot.html",
            // 点击时弹出确认框，确认后跳转到 reboot.html
            onClick: () => {
                return confirm(t("reboot.confirm"));
            }
        };
    }

    /**
     * 导航配置
     */
    getNavigationConfig() {
        return {
            overview: {
                titleKey: "nav.overview",
                items: [
                    { path: "/", labelKey: "nav.sysinfo", id: "sysinfo" },
                    { path: "/syslog.html", labelKey: "nav.syslog", id: "syslog" }
                ]
            },
            update: {
                titleKey: "nav.update",
                items: [
                    { path: "/firmware.html", labelKey: "nav.firmware", id: "firmware" },
                    { path: "/art.html", labelKey: "nav.art", id: "art" },
                    { path: "/cdt.html", labelKey: "nav.cdt", id: "cdt" },
                    { path: "/ptable.html", labelKey: "nav.ptable", id: "ptable" },
                    { path: "/simg.html", labelKey: "nav.simg", id: "simg" },
                    { path: "/uboot.html", labelKey: "nav.uboot", id: "uboot" }
                ]
            },
            debrick: {
                titleKey: "nav.debrick",
                items: [
                    { path: "/mibib.html", labelKey: "nav.mibib", id: "mibib" },
                    { path: "/initramfs.html", labelKey: "nav.initramfs", id: "initramfs" }
                ]
            },
            system: {
                titleKey: "nav.system",
                items: [
                    { path: "/settings.html", labelKey: "nav.settings", id: "settings" },
                    { path: "/network.html", labelKey: "nav.network", id: "network" },
                    { path: "/mac.html", labelKey: "nav.mac", id: "mac" },
                    { path: "/env.html", labelKey: "nav.env", id: "env" },
                    { path: "/backup.html", labelKey: "nav.backup", id: "backup" },
                    { path: "/console.html", labelKey: "nav.console", id: "console" }
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

        navContainer.appendChild(this.createRebootSection());

        this.sidebarElement.appendChild(navContainer);

        // 初始化折叠状态 - 只展开当前页面所在section
        this.initCollapsibleSections();
    }

    /**
     * 渲染重启区域（独立一级菜单，无子项）
     */
    createRebootSection() {
        // 创建重启按钮（作为一级菜单）
        const sectionElement = document.createElement("div");
        sectionElement.className = "nav-section reboot-section";
        sectionElement.dataset.section = "reboot";

        const rebootButton = document.createElement("div");
        rebootButton.className = "nav-section-title";
        rebootButton.setAttribute("data-i18n", this.rebootItem.titleKey);
        rebootButton.textContent = t(this.rebootItem.titleKey);

        // 添加点击事件 - 弹出确认框，确认后跳转到 reboot.html
        rebootButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 弹出确认框
            if (this.rebootItem.onClick && this.rebootItem.onClick()) {
                // 用户确认，跳转到 reboot.html
                window.location.href = this.rebootItem.path;
            }
            // 用户取消，什么都不做
        });

        sectionElement.appendChild(rebootButton);

        return sectionElement;
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
        const sections = this.sidebarElement.querySelectorAll('.nav-section:not(.reboot-section)');

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

        if (this.currentPageId === 'reboot') return 'reboot';

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
        const sections = this.sidebarElement.querySelectorAll('.nav-section:not(.reboot-section)');
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
    if (APP_STATE.page === "reboot") {
        document.title = t("reboot.title.in_progress");
    }
}

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

/**
 * HTML转义（防止XSS）
 */
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 检查是否处于 9008 模式
 * @returns {boolean}
 */
function is9008Mode() {
    const sysinfo = APP_STATE.sysinfo;
    return sysinfo && sysinfo.is_9008_mode;
}

// ==============================
// 版本信息模块
// ==============================

/**
 * 版本信息渲染器
 * 负责获取 U-Boot 版本信息并渲染到页脚
 */
const versionRenderer = (() => {
    /**
     * 渲染版本信息
     */
    function render(versionText) {
        const versionEl = document.getElementById("version");
        if (!versionEl) return;

        versionEl.innerHTML = `
            <a href="https://github.com/chenxin527/uboot-qsdk12.5-build"
               target="_blank"
               class="version-link"
               title="${t("title.project")}"
               data-i18n-attr="title:title.project">
                ${versionText || "U-Boot QSDK 12.5"}
            </a>
            <span class="separator">/</span>
            <a href="https://github.com/chenxin527"
               target="_blank"
               class="author-link"
               title="${t("title.author")}"
               data-i18n-attr="title:title.author">
                沉心
            </a>
        `;
    }

    /**
     * 加载并渲染版本信息
     */
    async function loadAndRender() {
        const versionEl = document.getElementById("version");
        if (!versionEl) return;

        try {
            const response = await fetch("/version", { method: "GET" });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const versionText = await response.text();
            render(versionText);

        } catch (error) {
            console.warn(error.message + ": Failed to fetch version");
            render();
        }
    }

    return {
        loadAndRender
    };
})();

// ==============================
// 应用初始化模块
// ==============================

/**
 * 页面配置映射
 */
const pageConfigs = {
    firmware: {
        needUpload: true,
        formDataKey: 'firmware',
        warningItems: {
            common: true,
            custom: 1
        }
    },
    uboot: {
        needUpload: true,
        formDataKey: 'uboot',
        warningItems: {
            common: true,
            custom: 2
        }
    },
    art: {
        needUpload: true,
        formDataKey: 'art',
        warningItems:  {
            common: true,
            custom: 2
        }
    },
    cdt: {
        needUpload: true,
        formDataKey: 'cdt',
        warningItems:  {
            common: true,
            custom: 2
        }
    },
    ptable: {
        needUpload: true,
        formDataKey: 'ptable',
        warningItems:  {
            common: true,
            custom: 2
        }
    },
    simg: {
        needUpload: true,
        formDataKey: 'simg',
        warningItems:  {
            common: true,
            custom: 2
        }
    },
    initramfs: {
        needUpload: true,
        formDataKey: 'initramfs',
        warningItems:  {
            common: false,
            custom: 2
        }
    },
    mibib: {
        needUpload: true,
        formDataKey: 'mibib',
        warningItems:  {
            common: false,
            custom: 2
        }
    },
    env: {
        needUpload: false,
        init: () => envManager.init()
    },
    backup: {
        needUpload: false,
        init: () => backupManager.init()
    },
    mac: {
        needUpload: false,
        init: () => macManager.init()
    },
    network: {
        needUpload: false,
        init: () => networkManager.init()
    },
    console: {
        needUpload: false,
        init: () => consoleManager.init()
    },
    settings: {
        needUpload: false,
        init: () => settingsPageManager.init()
    },
    sysinfo: {
        needUpload: false,
        init: () => sysinfoManager.init()
    },
    syslog: {
        needUpload: false,
        init: () => syslogManager.init()
    },
};

/**
 * 应用初始化
 */
function appInit(pageName) {
    // 初始化应用状态
    APP_STATE.page = pageName || "";
    APP_STATE.lang = detectLang();
    APP_STATE.theme = detectTheme();

    // 获取页面配置
    const config = pageConfigs[pageName] || { needUpload: false };

    // 初始化上传组件（如果需要）
    if (config.needUpload) {
        const uploadManager = getUnifiedUploadManager();
        uploadManager.initForPage(pageName, {
            formDataKey: config.formDataKey || pageName,
            warningItems : config.warningItems || null
        });
    }

    // 应用主题和语言
    setTheme(APP_STATE.theme);
    setLang(APP_STATE.lang);

    // 初始化侧边栏（增强版）
    ensureSidebar();

    // 应用国际化
    applyI18n(document);

    // 更新文档标题
    updateDocumentTitle();

    // 执行页面特定的初始化
    if (config.init && typeof config.init === 'function') {
        config.init();
    } else if (!APP_STATE.sysinfo) {
        sysinfoManager.fetchAndStore();
    }

    // 添加准备完成的类
    setTimeout(function() {
        document.body.classList.add("ready");
    }, 0);

    // 获取并渲染版本信息
    versionRenderer.loadAndRender();
}

// ==============================
// 信息生成工具模块
// ==============================

/**
 * 信息构建器
 * 提供成功信息与各种错误类型信息的结构化 HTML 生成函数
 */
const messageBuilder = (() => {
    /**
     * 生成标准错误表格
     * @param {string} title - 错误标题（国际化 key）
     * @param {Array<{label: string, value: any}>} rows - 标签和值的数组
     * @param {string} [suggestion] - 错误建议（国际化 key）
     * @returns {string} HTML字符串
     */
    function buildErrorTable(title, rows, suggestion) {
        const titleText = t(title) || title;
        const filteredRows = rows.filter(item => item.value != null && item.value !== undefined);

        let html = `
            <div class="error-title">❌ ${titleText}</div>
            <table class="info-table error-table">
                <tbody>
                    ${filteredRows.map(item => `
                    <tr>
                        <td class="info-label">${t(item.label)}</td>
                        <td class="info-value">${escapeHtml(String(item.value))}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;

        if (suggestion) {
            html += `
            <p class="error-suggestion">${t(suggestion)}</p>`;
        }

        return html;
    }

    /**
     * 生成文件过大错误信息
     * @param {object} info - 错误信息对象
     * @param {string} info.filename - 文件名
     * @param {number} info.filesize - 文件大小
     * @param {string} info.partname - 分区名称
     * @param {number} info.partsize - 分区大小
     * @returns {string} HTML字符串
     */
    function buildFileTooBigMessage(info) {
        return buildErrorTable(
            "error.file_too_big",
            [
                { label: "error.label.file_type", value: info.filename },
                { label: "error.label.file_size", value: bytesToHuman(info.filesize) + " (" + info.filesize + " " + t("error.unit.bytes") + ")" },
                { label: "error.label.part_name", value: info.partname },
                { label: "error.label.part_size", value: bytesToHuman(info.partsize) + " (" + info.partsize + " " + t("error.unit.bytes") + ")" }
            ],
            "error.suggestion.file_too_big"
        );
    }

    /**
     * 生成分区未找到错误信息
     * @param {object} info - 错误信息对象
     * @param {string} info.partname - 分区名称
     * @returns {string} HTML字符串
     */
    function buildPartNotFoundMessage(info) {
        return buildErrorTable(
            "error.part_not_found",
            [
                { label: "error.label.part_name", value: info.partname }
            ],
            "error.suggestion.part_not_found"
        );
    }

    /**
     * 生成文件类型错误信息
     * @param {object} info - 错误信息对象
     * @param {string} info.expected - 期望类型
     * @param {string} info.actual - 实际类型
     * @returns {string} HTML字符串
     */
    function buildWrongFileTypeMessage(info) {
        return buildErrorTable(
            "error.wrong_file_type",
            [
                { label: "error.label.expected_type", value: info.expected },
                { label: "error.label.actual_type", value: info.actual }
            ],
            "error.suggestion.wrong_file_type"
        );
    }

    /**
     * 生成闪存类型错误信息
     * @param {object} info - 错误信息对象
     * @param {string} info.filetype - 文件类型
     * @param {string} info.flashtype - 闪存类型
     * @returns {string} HTML字符串
     */
    function buildFlashNotFoundMessage(info) {
        return buildErrorTable(
            "error.flash_not_found",
            [
                { label: "error.label.file_type", value: info.filetype },
                { label: "error.label.flash_type", value: info.flashtype }
            ],
            "error.suggestion.flash_not_found"
        );
    }

    /**
     * 生成命令执行失败错误信息
     * @param {object} info - 错误信息对象
     * @param {string} info.cmd - 执行的命令
     * @param {string} info.output - 命令输出
     * @returns {string} HTML字符串
     */
    function buildRunCmdFailedMessage(info) {
        let html = `
            <div class="error-title">❌ ${t("error.run_cmd_failed")}</div>
            <div class="error-cmd-section">
                <div class="error-cmd-title">${t("error.label.cmd")}</div>
                <pre class="error-cmd-content">${escapeHtml(info.cmd || t("unknown"))}</pre>
            </div>
            <div class="error-output-section">
                <div class="error-output-title">${t("error.label.cmd_output")}</div>
                <pre class="error-output-content">${escapeHtml(info.output || t("error.no_output"))}</pre>
            </div>`;

        return html;
    }

    /**
     * 生成未知类型错误信息
     * @param {*} info - 错误信息（任意类型）
     * @returns {string} HTML字符串
     */
    function buildUnknownErrorMessage(info) {
        let message;
        try {
            message = JSON.stringify(info, null, 2);
        } catch (e) {
            message = String(info || t("error.unknown_type"));
        }

        return buildErrorTable(
            "fail.title",
            [
                { label: "error.title", value: message }
            ]
        );
    }

    /**
     * 生成无效响应错误信息
     * @param {string} rawResponse - 原始响应文本
     * @returns {string} HTML字符串
     */
    function buildInvalidResponseMessage(rawResponse) {
        return `
            <div class="error-title">❌ ${t("error.invalid_response")}</div>
            <table class="info-table error-table">
                <tbody>
                    <tr>
                        <td class="info-label">${t("error.title")}</td>
                        <td class="info-value">${escapeHtml(rawResponse || "")}</td>
                    </tr>
                </tbody>
            </table>`;
    }

    /**
     * 构建成功信息表格
     * @param {object} info - 成功信息对象
     * @param {string} info.type - 文件类型
     * @param {number} info.size - 文件大小
     * @param {string} info.md5 - MD5哈希值
     * @returns {string} HTML字符串
     */
    function buildSuccessTable(info) {
        let html = `
            <table class="info-table">
                <tbody>`;

        if (info.name) {
            html += `
                    <tr>
                        <td class="info-label" data-i18n="label.name">${t("label.name")}</td>
                        <td class="info-value">${escapeHtml(info.name)}</td>
                    </tr>`;
        }

        if (info.type) {
            html += `
                    <tr>
                        <td class="info-label" data-i18n="label.type">${t("label.type")}</td>
                        <td class="info-value">${escapeHtml(info.type)}</td>
                    </tr>`;
        }

        if (info.size) {
            html += `
                    <tr>
                        <td class="info-label" data-i18n="label.size">${t("label.size")}</td>
                        <td class="info-value">${bytesToHuman(info.size)} (${info.size} Bytes)</td>
                    </tr>`;
        }

        if (info.md5) {
            html += `
                    <tr>
                        <td class="info-label" data-i18n="label.md5">${t("label.md5")}</td>
                        <td class="info-value upload-md5-value">${info.md5}</td>
                    </tr>`;
        }

        html += `
                </tbody>
            </table>`;

        return html;
    }

    return {
        buildErrorTable,
        buildFileTooBigMessage,
        buildPartNotFoundMessage,
        buildWrongFileTypeMessage,
        buildFlashNotFoundMessage,
        buildRunCmdFailedMessage,
        buildUnknownErrorMessage,
        buildInvalidResponseMessage,
        buildSuccessTable,
    };
})();

// ==============================
// 统一的上传管理器
// ==============================

class UnifiedUploadManager {
    constructor() {
        this.instances = new Map();   // 存储每个页面的上传实例
        this.currentPage = null;
    }

    /**
     * 为指定页面初始化上传组件
     * @param {string} pageName - 页面名称
     * @param {object} options - 配置选项
     */
    initForPage(pageName, options = {}) {
        // 如果已经初始化过，先销毁
        if (this.instances.has(pageName)) {
            this.destroyPage(pageName);
        }

        // 获取容器
        const container = document.body;
        if (!container) {
            console.warn(`Body element not found for page: ${pageName}`);
            return null;
        }

        // 创建上传组件实例
        const instance = new FileUploadComponent(container, {
            formDataKey: options.formDataKey || pageName,
            warningItems: options.warningItems || null,
            pageName: pageName
        });

        // 存储实例
        this.instances.set(pageName, instance);

        // 渲染组件
        instance.render();

        return instance;
    }

    /**
     * 销毁指定页面的上传组件
     */
    destroyPage(pageName) {
        const instance = this.instances.get(pageName);
        if (instance) {
            instance.destroy();
            this.instances.delete(pageName);
        }
    }
}

// ==============================
// 文件上传组件类
// ==============================

class FileUploadComponent {
    constructor(container, options) {
        this.container = container;
        this.options = {
            formDataKey: 'file',
            warningItems: null,
            pageName: 'unknown',
            ...options
        };

        this.selectedFile = null;
        this.elements = {};
        this.isUploading = false;
    }

    /**
     * 渲染上传组件
     */
    render() {
        const pageName = this.options.pageName;
        const keys = this.getHintAndBtnKey();

        const html = `
            <div class="app">
                <aside id="sidebar" class="sidebar"></aside>
                <div class="sidebar-overlay" id="sidebarOverlay"></div>
                <button class="sidebar-toggle" id="sidebarToggle"></button>
                <div class="main">
                    <div id="m">
                        <div class="card-title-section">
                            <h1 id="title" data-i18n="${pageName}.title"></h1>
                        </div>

                        <div class="card-hint-section">
                            <p id="hint" data-i18n-html="${pageName}.hint"></p>
                        </div>

                        <div id="upload-container" class="upload-wrapper">
                            <div class="upload-card">
                                <div class="upload-area" id="uploadArea">
                                    <!-- 文件选择区域（正常状态） -->
                                    <div class="upload-selector" id="uploadSelector">
                                        <div class="drop-zone" id="dropZone">
                                            <div class="drop-zone-content">
                                                <svg class="drop-zone-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                    <polyline points="17 8 12 3 7 8"/>
                                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                                </svg>
                                                <p id="dropZoneText" class="drop-zone-text" data-i18n="file.dropzone.text"></p>
                                                <p class="drop-zone-hint" data-i18n="file.dropzone.hint"></p>
                                            </div>
                                        </div>

                                        <div class="upload-actions">
                                            <input type="file" id="fileInput" name="${this.options.formDataKey}" style="display: none;">
                                            <button type="button" id="uploadBtn" class="button" data-i18n="${keys.uploadBtn}"></button>
                                        </div>
                                    </div>

                                    <!-- 上传进度区域（上传时显示） -->
                                    <div class="upload-progress" id="uploadProgress" style="display: none;">
                                        <div class="progress-container">
                                            <div class="bar-circle" id="bar-circle" style="--percent: 0;"></div>
                                            <div class="progress-text">
                                                <p class="progress-filename" id="progressFilename"></p>
                                                <p class="progress-percent" id="progressPercent"></p>
                                            </div>
                                        </div>
                                        <p class="progress-status" id="progressStatus" data-i18n="file.uploading"></p>
                                    </div>

                                    <!-- 上传成功信息区域 -->
                                    <div class="upload-success" id="uploadSuccess" style="display: none;">
                                        <div id="upload-success-info"></div>
                                        <div class="continue-hint" data-i18n="${keys.continueHint}"></div>
                                        <div class="upload-success-actions">
                                            <button class="button" id="continueBtn" data-i18n="${keys.continueBtn}"></button>
                                            <button class="button" id="updateRebootBtn" data-i18n="common.update_reboot" style="display: none;"></button>
                                        </div>
                                    </div>

                                    <!-- 结果成功信息区域 -->
                                    <div class="result-success" id="resultSuccess" style="display: none;">
                                        <div id="result-success-info"></div>
                                    </div>

                                    <!-- 刷写/启动过程中的的加载动画 -->
                                    <div class="loading-spinner" id="loadingSpinner" style="display: none;"></div>

                                    <!-- 错误信息区域 -->
                                    <div class="error-area" id="errorArea" style="display: none;">
                                        <div id="error-info" class="error-message"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card-foot-section">
                            <div class="card-foot-inner">
                                <div class="i w">
                                    <strong data-i18n="common.warnings"></strong>
                                    <ul>${this.generateWarningList()}</ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="version"></div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.cacheElements();
        this.bindEvents();
        this.applyI18n();
    }

    /**
     * 生成页面底部的警告信息列表
     */
    generateWarningList() {
        const warningItems = this.options.warningItems;

        let warningList = '';

        if (warningItems) {
            if (warningItems.common) {
                for (let i = 1; i <= 2; i++) {
                    warningList += `<li data-i18n="common.warn.${i}"></li>`;
                }
            }
            if (warningItems.custom && warningItems.custom > 0) {
                for (let i = 1; i <= warningItems.custom; i++) {
                    warningList += `<li data-i18n="${this.options.pageName}.warn.${i}"></li>`;
                }
            }
        }

        return warningList;
    }

    /**
     * 获取上传按钮、继续按钮、继续提示的国际化 key
     */
    getHintAndBtnKey() {
        const keys = {};

        switch (this.options.pageName) {
            case 'initramfs' :
                keys.uploadBtn = 'common.upload';
                keys.continueHint = 'initramfs.boot_hint';
                keys.continueBtn = 'common.boot';
                break;
            case 'mibib' :
                keys.uploadBtn = 'mibib.reload';
                keys.continueHint = 'mibib.reload_success_hint';
                keys.continueBtn = 'mibib.reload_success';
                break;
            default:
                keys.uploadBtn = 'common.upload';
                keys.continueHint = 'common.upgrade_hint';
                keys.continueBtn = 'common.update';
                break;
        }

        return keys;
    }

    /**
     * 缓存 DOM 元素
     */
    cacheElements() {
        this.elements = {
            title: document.getElementById('title'),
            hint: document.getElementById('hint'),
            uploadArea: document.getElementById('uploadArea'),
            uploadSelector: document.getElementById('uploadSelector'),
            uploadProgress: document.getElementById('uploadProgress'),
            uploadSuccess: document.getElementById('uploadSuccess'),
            resultSuccess: document.getElementById('resultSuccess'),
            loadingSpinner: document.getElementById('loadingSpinner'),
            errorArea: document.getElementById('errorArea'),
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            uploadBtn: document.getElementById('uploadBtn'),
            progressCircle: document.getElementById('bar-circle'),
            progressPercent: document.getElementById('progressPercent'),
            progressFilename: document.getElementById('progressFilename'),
            progressStatus: document.getElementById('progressStatus'),
            uploadSuccessInfo: document.getElementById('upload-success-info'),
            resultSuccessInfo: document.getElementById('result-success-info'),
            errorInfo: document.getElementById('error-info'),
            continueBtn: document.getElementById('continueBtn'),
            updateRebootBtn: document.getElementById('updateRebootBtn')
        };
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 拖拽区域点击
        if (this.elements.dropZone) {
            this.elements.dropZone.addEventListener('click', () => this.openFileSelector());
            this.bindDragEvents();
        }

        // 文件输入变化
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files[0]);
            });
        }

        // 上传按钮
        if (this.elements.uploadBtn) {
            this.elements.uploadBtn.addEventListener('click', () => {
                this.upload();
            });
        }

        // 继续按钮
        if (this.elements.continueBtn) {
            this.elements.continueBtn.addEventListener('click', () => {
                this.continue(false);
            });
        }

        // 更新并重启按钮
        if (this.elements.updateRebootBtn) {
            this.elements.updateRebootBtn.addEventListener('click', () => {
                this.continue(true);
            });
        }
    }

    /**
     * 绑定拖拽事件
     */
    bindDragEvents() {
        const dropZone = this.elements.dropZone;
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dropZone.addEventListener('dragenter', () => {
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragover', () => {
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
    }

    /**
     * 打开文件选择器
     */
    openFileSelector() {
        if (this.elements.fileInput && !this.isUploading) {
            this.elements.fileInput.click();
        }
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(file) {
        if (!file) return;

        this.selectedFile = file;

        // 更新拖拽区域样式
        if (this.elements.dropZone) {
            this.elements.dropZone.classList.add('has-file');
        }

        // 更新显示文本
        this.updateDropZoneText(file.name);
    }

    /**
     * 更新拖拽区域文本
     */
    updateDropZoneText(filename) {
        const textElement = document.getElementById('dropZoneText');
        if (!textElement) return;

        if (filename) {
            const maxLength = 105;
            const displayName = filename.length > maxLength
                ? filename.substring(0, maxLength) + '...'
                : filename;
            textElement.innerHTML = `📄 ${escapeHtml(displayName)}`;
            textElement.style.fontWeight = '600';
            textElement.style.color = 'var(--primary)';
        } else {
            textElement.innerHTML = t('file.dropzone.text');
            textElement.style.fontWeight = '500';
            textElement.style.color = '';
        }
    }

    /**
     * 显示指定元素，隐藏其他无关元素
     */
    showElementAndHideOthers(id) {
        if (!id) return;

        const els = this.elements;
        const elements = [
            { id: 'uploadSelector', el: els.uploadSelector },
            { id: 'uploadProgress', el: els.uploadProgress },
            { id: 'uploadSuccess', el: els.uploadSuccess },
            { id: 'resultSuccess', el: els.resultSuccess },
            { id: 'loadingSpinner', el: els.loadingSpinner },
            { id: 'errorArea', el: els.errorArea }
        ];

        elements.forEach(element => {
            if (element.el) {
                element.el.style.display = element.id === id ? 'block' : 'none';
            }
        });
    }

    /**
     * 显示上传进度界面
     */
    showProgress() {
        this.showElementAndHideOthers('uploadProgress');

        // 更新文件名显示
        if (this.elements.progressFilename && this.selectedFile) {
            this.elements.progressFilename.textContent = this.selectedFile.name;
        }
    }

    /**
     * 更新进度百分比
     */
    updateProgress(percent) {
        const p = Math.max(0, Math.min(100, percent));

        if (this.elements.progressCircle) {
            this.elements.progressCircle.style.setProperty('--percent', p);
        }

        if (this.elements.progressPercent) {
            this.elements.progressPercent.textContent = `${p}%`;
        }

        if (this.elements.progressStatus) {
            if (p < 100) {
                this.elements.progressStatus.textContent = t('file.uploading');
            } else {
                this.elements.progressStatus.textContent = t('file.processing');
            }
        }
    }

    /**
     * 设置标题和提示文本
     * @param {string} titleKey - 标题国际化 key
     * @param {string} hintKey - 提示国际化 key
     */
    setTitleAndHint(titleKey, hintKey) {
        if (this.elements.title && titleKey) {
            this.elements.title.innerHTML = t(titleKey);
        }
        if (this.elements.hint && hintKey) {
            this.elements.hint.innerHTML = t(hintKey);
        }
    }

    /**
     * 显示成功界面
     */
    showSuccess(type, info) {
        const els = this.elements;
        const pageName = this.options.pageName;
        const isMibibPage = pageName === 'mibib';
        const isInitramfsPage = pageName === 'initramfs';

        this.isUploading = false;

        if (type === 'upload') {
            this.showElementAndHideOthers('uploadSuccess');
            if (els.uploadSuccessInfo && !isMibibPage) {
                els.uploadSuccessInfo.innerHTML = messageBuilder.buildSuccessTable(info);
            }
            if (els.updateRebootBtn) {
                els.updateRebootBtn.style.display = (isMibibPage || isInitramfsPage) ? 'none' : 'inline-block';
            }
        } else {
            if (info.reboot) {
                this.showElementAndHideOthers('loadingSpinner');
            } else {
                this.showElementAndHideOthers('resultSuccess');
                if (els.resultSuccessInfo) {
                    els.resultSuccessInfo.innerHTML = t('flashing.msg.continue');
                }
            }
        }
    }

    /**
     * 显示错误界面
     */
    showError(info) {
        this.isUploading = false;

        this.setTitleAndHint('fail.title', 'fail.hint');
        this.showElementAndHideOthers('errorArea');

        let errorMessage = "";

        switch (info?.type) {
            case "file_too_big":
                errorMessage = messageBuilder.buildFileTooBigMessage(info);
                break;
            case "part_not_found":
                errorMessage = messageBuilder.buildPartNotFoundMessage(info);
                break;
            case "wrong_file_type":
                errorMessage = messageBuilder.buildWrongFileTypeMessage(info);
                break;
            case "flash_not_found":
                errorMessage = messageBuilder.buildFlashNotFoundMessage(info);
                break;
            case "run_cmd_failed":
                errorMessage = messageBuilder.buildRunCmdFailedMessage(info);
                break;
            default:
                errorMessage = messageBuilder.buildUnknownErrorMessage(info);
        }

        if (this.elements.errorInfo) {
            this.elements.errorInfo.innerHTML = errorMessage;
        }
    }

    /**
     * 执行上传
     */
    upload() {
        if (this.options.pageName === 'mibib' && !is9008Mode()) {
            alert(t("mibib.not_9008"));
            return;
        }

        if (!this.selectedFile) {
            alert(t('file.select'));
            return;
        }

        if (this.isUploading) {
            alert(t('file.uploading'));
            return;
        }

        this.isUploading = true;
        this.showProgress();
        this.updateProgress(0);

        const formData = new FormData();
        formData.append(this.options.formDataKey, this.selectedFile);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && event.total > 0) {
                const percent = parseInt((event.loaded / event.total) * 100);
                this.updateProgress(percent);
            }
        });

        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    let response;
                    try {
                        response = JSON.parse(xhr.responseText);
                    } catch (e) {
                        this.showError({ type: 'invalid_response', message: xhr.responseText });
                        return;
                    }

                    switch (response.status) {
                        case 'success':
                            this.showSuccess('upload', response.info);
                            break;
                        case 'fail':
                            this.showError(response.info);
                            break;
                        default:
                            this.showError({ type: 'unknown_status', message: xhr.responseText });
                    }
                } else {
                    this.showError({ type: 'http_error', message: `HTTP ${xhr.status}` });
                }
            }
        };

        const url = this.options.pageName === 'mibib' ? '/mibib/reload' : '/upload';
        xhr.open('POST', url);
        xhr.send(formData);
    }

    /**
     * 执行后续操作
     * @param {boolean} autoRebootAfterSuccess - 操作成功后是否自动重启（仅对刷写更新类操作有效）
     */
    continue(autoRebootAfterSuccess) {
        const pageName = this.options.pageName;
        const isMibibPage = pageName === 'mibib';
        const isInitramfsPage = pageName === 'initramfs';

        if (isMibibPage) {
            window.location.href = '/';
            return;
        }

        const action = isInitramfsPage ? 'booting' : 'flashing';
        const titleStart = action + '.title.in_progress';
        const hintStart = action + '.hint.in_progress';
        const titleDone = action + '.title.done';
        const hintDone = action + '.hint.done';
        const hintContinue = 'flashing.hint.continue';

        this.setTitleAndHint(titleStart, hintStart);
        this.showElementAndHideOthers('loadingSpinner');

        const formData = new FormData();
        formData.append('auto_reboot', autoRebootAfterSuccess ? 'true' : 'false');

        const xhr = new XMLHttpRequest();

        xhr.timeout = 600000; // 10分钟

        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    let response;
                    try {
                        response = JSON.parse(xhr.responseText);
                    } catch (e) {
                        this.showError({ type: 'invalid_response', message: xhr.responseText });
                        return;
                    }

                    switch (response.status) {
                        case 'success':
                            this.setTitleAndHint(titleDone, response.info.reboot ? hintDone : hintContinue);
                            this.showSuccess('result', response.info);
                            break;
                        case 'fail':
                            this.showError(response.info);
                            break;
                        default:
                            this.showError({ type: 'unknown_status', message: xhr.responseText });
                    }
                } else {
                    this.showError({ type: 'http_error', message: `HTTP ${xhr.status}` });
                }
            }
        };

        xhr.open('POST', '/result');
        xhr.send(formData);
    }

    /**
     * 应用国际化
     */
    applyI18n() {
        if (typeof applyI18n === 'function') {
            applyI18n(this.container);
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.elements = {};
        this.selectedFile = null;
        this.isUploading = false;
    }
}

// 全局统一上传管理器实例
let unifiedUploadManager = null;

/**
 * 获取统一上传管理器实例
 */
function getUnifiedUploadManager() {
    if (!unifiedUploadManager) {
        unifiedUploadManager = new UnifiedUploadManager();
    }
    return unifiedUploadManager;
}

// ==============================
// 备份功能模块
// ==============================

/**
 * 备份管理器
 * 负责处理闪存备份的配置、执行和文件下载等功能
 */
const backupManager = (() => {
    let elements = null;
    let targetsLoaded = false;

    /**
     * 获取或缓存 DOM 元素
     */
    function getElements() {
        if (elements) return elements;

        elements = {
            mode: document.getElementById("backup_mode"),
            target: document.getElementById("backup_target"),
            range: document.getElementById("backup_range"),
            start: document.getElementById("backup_start"),
            end: document.getElementById("backup_end"),
            rangeHint: document.getElementById("backup_range_hint"),
            progress: document.getElementById("backup_progress"),
            status: document.getElementById("backup_status"),
        };

        return elements;
    }

    /**
     * 设置备份状态显示
     */
    function setStatus(text, isError) {
        const el = getElements().status;
        if (el) {
            el.style.display = text ? "block" : "none";
            el.textContent = text || "";
            if (isError) {
                el.style.color = "var(--danger)";
            } else {
                el.style.color = "";
            }
        }
    }

    /**
     * 设置备份进度
     */
    function setProgress(percent) {
        const el = getElements().progress;
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
    function updateRangeHint() {
        const hint = getElements().rangeHint;
        if (!hint) return;

        const startVal = parseUserLen(getElements().start?.value);
        const endVal = parseUserLen(getElements().end?.value);

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
     * 更新UI模式显示
     */
    function updateModeUI() {
        const els = getElements();
        const isRange = els.mode?.value === "range";

        if (els.range) {
            els.range.style.display = isRange ? "block" : "none";
        }

        if (isRange) {
            updateRangeHint();
        }
    }

    /**
     * 加载目标设备列表
     */
    function loadTargets() {
        const els = getElements();

        if (!els.target) return;

        ajax({
            url: "/sysinfo",
            timeout: 10000,
            done: function(text) {
                let info;
                try {
                    info = JSON.parse(text);
                } catch (e) {
                    setStatus(t("backup.error.exception") + " " + t("sysinfo.error.parse"), true);
                    return;
                }

                // 清空并添加占位符
                els.target.innerHTML = '<option value="" data-i18n="backup.target.placeholder"></option>';

                // 添加RAW选项
                if (info.devices) {
                    const rawDevices = [
                        { key: "spi", label: "SPI" },
                        { key: "mmc", label: "MMC" },
                        { key: "nand", label: "NAND" }
                    ];

                    rawDevices.forEach(function(dev) {
                        const device = info.devices[dev.key];
                        if (device && device.present) {
                            const opt = document.createElement("option");
                            opt.value = "raw:" + dev.key;
                            opt.textContent = "[RAW] " + dev.label + ": " +
                                (device.name || device.product || "") +
                                (device.size ? " (" + bytesToHuman(device.size) + ")" : "");
                            els.target.appendChild(opt);
                        }
                    });
                }

                // 添加分区选项
                if (info.partitions) {
                    addPartitionOptions(info.partitions.smem, "smem");
                    addPartitionOptions(info.partitions.mmc, "mmc");
                }

                // 选择第一个有效选项
                if (els.target.options.length > 1) {
                    els.target.selectedIndex = 1;
                }

                applyI18n(els.target);
                targetsLoaded = true;
            }
        });
    }

    /**
     * 添加分区选项
     */
    function addPartitionOptions(partData, type) {
        const els = getElements();

        if (!partData || !partData.present || !partData.parts || !partData.parts.length) {
            return;
        }

        partData.parts.forEach(function(part) {
            if (part && part.name) {
                const opt = document.createElement("option");
                opt.value = type + ":" + part.name;
                opt.textContent = "[" + type.toUpperCase() + "] " + part.name +
                                 (part.size ? " (" + bytesToHuman(part.size) + ")" : "");
                els.target.appendChild(opt);
            }
        });
    }

    /**
     * 开始备份
     */
    async function start() {
        const els = getElements();
        const mode = els.mode?.value;
        const target = els.target?.value;

        if (!target) {
            alert(t("backup.error.no_target"));
            return;
        }

        const formData = new FormData();
        formData.append("mode", mode);
        formData.append("target", target);

        if (mode === "range") {
            const startInput = els.start;
            const endInput = els.end;

            if (!startInput || !endInput || !startInput.value || !endInput.value) {
                alert(t("backup.error.bad_range"));
                return;
            }

            formData.append("start", startInput.value);
            formData.append("end", endInput.value);
        }

        setProgress(0);
        setStatus(t("backup.status.starting"));

        try {
            const response = await fetch("/backup", { method: "POST", body: formData });

            if (!response.ok) {
                setStatus(t("backup.error.http") + " " + response.status, true);
                return;
            }

            const contentLength = response.headers.get("Content-Length");
            const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
            let filename = parseFilenameFromDisposition(
                response.headers.get("Content-Disposition")
            );
            if (!filename) filename = "backup.bin";

            let received = 0;
            const chunks = [];
            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (totalSize) {
                    setProgress((received / totalSize) * 100);
                }
                setStatus(
                    t("backup.status.downloading") + " " +
                    bytesToHuman(received) +
                    (totalSize ? " / " + bytesToHuman(totalSize) : "")
                );
            }

            setProgress(100);
            setStatus(t("backup.status.preparing"));

            // 保存文件
            const blob = new Blob(chunks, { type: "application/octet-stream" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setStatus(t("backup.status.done") + " " + filename);

        } catch (error) {
            setStatus(
                t("backup.error.exception") + " " + (error.message || String(error)),
                true
            );
        }
    }

    /**
     * 初始化备份管理器
     */
    function init() {
        const els = getElements();

        // 绑定模式切换事件
        if (els.mode) {
            els.mode.addEventListener("change", updateModeUI);
        }

        // 绑定范围输入事件
        if (els.start) {
            els.start.addEventListener("input", updateRangeHint);
        }
        if (els.end) {
            els.end.addEventListener("input", updateRangeHint);
        }

        // 初始化UI状态
        updateModeUI();
        setStatus("");

        // 加载目标设备列表
        loadTargets();
    }

    return {
        init,
        start,
        loadTargets,
    };
})();

// ==============================
// 环境变量管理模块
// ==============================

/**
 * 环境变量管理器
 * 负责处理 U-Boot 环境变量的查看、添加、修改、删除等操作
 */
const envManager = (() => {
    let elements = null;
    let envData = []; // 存储解析后的环境变量数据
    let editMode = null; // 'add' | 'edit' | null
    let editingKey = null; // 正在编辑的变量名
    let refreshTimer = null; // 延迟刷新定时器

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

        els.tableBody.innerHTML = '';

        if (!data || data.length === 0) {
            els.emptyHint.style.display = 'flex';
            els.envTable.style.display = 'none';
            return;
        }

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
     * 刷新环境变量列表（立即执行）
     */
    async function refresh() {
        cancelDelayedRefresh();

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
     * 取消之前的延迟刷新定时器
     */
    function cancelDelayedRefresh() {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
    }

    /**
     * 延迟刷新环境变量列表
     * 先显示成功状态，延迟一段时间后再刷新
     * @param {number} delay - 延迟时间（毫秒），默认 1500ms
     */
    function delayedRefresh(delay) {
        cancelDelayedRefresh();

        delay = delay || 1500; // 默认 1.5 秒

        refreshTimer = setTimeout(async () => {
            refreshTimer = null;
            await refresh();
        }, delay);
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
            delayedRefresh();
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
            delayedRefresh();
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
            delayedRefresh();
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
            delayedRefresh();
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
            delayedRefresh();
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
    let elements = null;
    let validationState = {
        ipaddr: true,
        netmask: true,
        serverip: true
    };
    let refreshTimer = null; // 延迟刷新定时器

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
        cancelDelayedRefresh();

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
     * 取消之前的延迟刷新定时器
     */
    function cancelDelayedRefresh() {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
    }

    /**
     * 延迟刷新环境变量列表
     * 先显示成功状态，延迟一段时间后再刷新
     * @param {number} delay - 延迟时间（毫秒），默认 1500ms
     */
    function delayedRefresh(delay) {
        cancelDelayedRefresh();

        delay = delay || 1500; // 默认 1.5 秒

        refreshTimer = setTimeout(async () => {
            refreshTimer = null;
            await refresh();
        }, delay);
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
            delayedRefresh();
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

            delayedRefresh();

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
        getElements();

        bindValidationEvents();

        refresh();
    }

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
 * 负责处理 U-Boot 命令的发送、输出接收和管理，以及文件上传功能和命令自动补全提示
 */
const consoleManager = (() => {
    let elements = null;
    let state = {
        history: [],
        histPos: -1,
        persistKey: "failsafe_console_output",
        persistMax: 200000,
        commands: [],           // 存储所有命令对象 {name, usage}
        commandNames: new Map(), // 存储命令名称到完整对象的映射
        debounceTimer: null,
        currentMatch: null,
        isCommandLoaded: false,
        loadingCommands: false,
        fileInfoTimeout: null,
        forbiddenCommands: new Map([
            ['bootp', {
                reasonKey: 'console.cmd.forbid.reason.common'
            }],
            ['dhcp', {
                reasonKey: 'console.cmd.forbid.reason.common'
            }],
            ['ping', {
                reasonKey: 'console.cmd.forbid.reason.common'
            }],
            ['tftpboot', {
                reasonKey: 'console.cmd.forbid.reason.common',
                altKey: 'console.cmd.forbid.alt.tftpb'
            }],
            ['tftpput', {
                reasonKey: 'console.cmd.forbid.reason.common'
            }]
        ])
    };

    /**
     * 获取或缓存 DOM 元素
     */
    function getElements() {
        if (elements) return elements;

        elements = {
            output: document.getElementById("terminal_output"),
            status: document.getElementById("terminal_status"),
            cmd: document.getElementById("terminal_cmd"),
            fileInfo: document.getElementById("terminal_file_info"),
            fileMessage: document.getElementById("terminal_file_message"),
            fileProgress: document.getElementById("terminal_file_progress"),
            progressCircle: document.getElementById("bar-circle-mini"),
            suggestionsBox: document.getElementById("cmd_suggestions"),
            suggestionsList: document.getElementById("suggestions_list")
        };

        return elements;
    }

    /**
     * 设置状态栏文本
     */
    function setStatus(text, isError) {
        const el = getElements().status;
        if (el) {
            el.textContent = text || "Ready";
            if (isError) {
                el.classList.add('error');
                el.classList.remove('warning');
            } else {
                el.classList.remove('error', 'warning');
            }
        }
    }

    /**
     * 显示文件信息
     */
    function showFileInfo(text, isSuccess) {
        const els = getElements();

        // 清除之前的自动隐藏定时器
        if (state.fileInfoTimeout) {
            clearTimeout(state.fileInfoTimeout);
            state.fileInfoTimeout = null;
        }

        if (!text) {
            els.fileInfo.classList.remove('show');
            return;
        }

        // 显示文件信息区域
        els.fileInfo.classList.add('show');

        // 设置消息内容和样式
        if (els.fileMessage) {
            els.fileMessage.textContent = text;
            if (isSuccess === true) {
                els.fileMessage.classList.add('success');
                els.fileMessage.classList.remove('error');
            } else if (isSuccess === false) {
                els.fileMessage.classList.add('error');
                els.fileMessage.classList.remove('success');
            } else {
                els.fileMessage.classList.remove('success', 'error');
            }
        }

        // 2秒后自动隐藏
        state.fileInfoTimeout = setTimeout(() => {
            els.fileInfo.classList.remove('show');
            state.fileInfoTimeout = null;
        }, 2000);
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
     * 加载命令列表
     */
    async function loadCommands() {
        if (state.isCommandLoaded || state.loadingCommands) return;

        state.loadingCommands = true;

        try {
            const response = await fetch("/console/cmdlist", {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                console.warn(`HTTP ${response.status}: Failed to load commands`);
                return;
            }

            const data = await response.json();

            if (data && data.cmdlist && Array.isArray(data.cmdlist)) {
                state.commands = data.cmdlist.map(cmd => ({
                    name: cmd.name,
                    usage: cmd.usage || ""
                }));

                // 构建命令名称映射（用于快速精确匹配）
                state.commandNames.clear();
                state.commands.forEach(cmd => {
                    if (cmd.name) {
                        state.commandNames.set(cmd.name.toLowerCase(), cmd);
                    }
                });

                state.isCommandLoaded = true;

            } else {
                console.warn("Invalid commands data format: ", data);
            }

        } catch (error) {
            console.warn("Failed to load commands: ", error.message);
        } finally {
            state.loadingCommands = false;
        }
    }

    /**
     * 高亮匹配文本
     */
    function highlightMatch(text, query) {
        if (!query || query.length === 0) return text;

        const regex = new RegExp(`(${escapeRegex(query)})`);
        return text.replace(regex, match => `<span class="suggestion-highlight">${escapeHtml(match)}</span>`);
    }

    /**
     * 转义正则表达式特殊字符
     */
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 获取命令的简短描述（从 usage 中提取）
     */
    function getCommandDescription(cmd) {
        if (!cmd.usage) return "";

        // 取 usage 的第一行，去除开头的特殊字符
        let firstLine = cmd.usage.split('\n')[0].trim();

        // 如果第一行只是命令名，尝试取第二行
        if (firstLine === cmd.name || firstLine === cmd.name + " ") {
            const lines = cmd.usage.split('\n');
            if (lines.length > 1) {
                firstLine = lines[1].trim();
            }
        }

        // 限制描述长度
        if (firstLine.length > 40) {
            firstLine = firstLine.substring(0, 37) + "...";
        }

        return firstLine;
    }

    /**
     * 从输入中提取命令名（忽略前导空格，只取第一个单词）和参数
     * @param {string} rawInput - 原始用户输入
     * @returns {Object} 提取的命令名（小写）和参数
     */
    function extractCommandAndArgument(rawInput) {
        let rawCommand = "", rawArgument = "";

        // 去除前导空格
        const trimmedInput = rawInput ? rawInput.trimStart() : "";
        if (trimmedInput.length !== 0) {
            // 提取第一个单词（命令名），遇到空格或换行停止
            const match = trimmedInput.match(/^[^\s]+/);
            rawCommand = match ? match[0].toLowerCase() : "";
            rawArgument = trimmedInput.substring(rawCommand.length);
        }

        return {
            rawCommand: rawCommand,
            rawArgument: rawArgument
        };
    }

    /**
     * 过滤匹配的命令
     * @param {string} input - 用户输入（可能包含参数）
     * @returns {Object} 匹配的命令列表及精确匹配信息
     */
    function filterCommands(input) {
        // 提取命令名（忽略前导空格和参数）
        const { rawCommand } = extractCommandAndArgument(input);

        // 如果命令名为空（输入为空或只有空格），返回空数组
        if (!rawCommand || rawCommand.length === 0) {
            return { matches: [], exactMatch: null };
        }

        const matches = state.commands.filter(cmd => {
            const cmdName = cmd.name.toLowerCase();
            // 前缀匹配
            if (cmdName.startsWith(rawCommand)) {
                return true;
            }
            return false;
        }).sort((a, b) => a.name.localeCompare(b.name));

        // 限制最多显示10条建议
        const limitedMatches = matches.slice(0, 10);

        // 检查是否有精确匹配
        let exactMatch = null;
        if (state.commandNames.has(rawCommand)) {
            exactMatch = state.commandNames.get(rawCommand);
        }

        // 检查是否有非精确匹配
        const hasInexactMatches = limitedMatches.some(cmd => cmd.name.toLowerCase() !== rawCommand);

        return {
            matches: limitedMatches,
            exactMatch: exactMatch,
            hasInexactMatches: hasInexactMatches
        };
    }

    /**
     * 显示提示框
     */
    function showSuggestions(filterResult, input) {
        const els = getElements();
        const inputEl = els.cmd;

        if (!els.suggestionsBox || !els.suggestionsList) return;

        // 提取命令名用于显示（去除前导空格）
        const { rawCommand, rawArgument } = extractCommandAndArgument(input);

        // 清除输入框的错误样式
        inputEl.classList.remove('input-error');

        // 如果输入为空（去除前导空格后），隐藏提示框
        if (!rawCommand || rawCommand.length === 0) {
            hideSuggestions();
            return;
        }

        const { matches, exactMatch, hasInexactMatches } = filterResult;

        // 判断需要隐藏提示框的条件（同时满足）：
        // 1. 有精确匹配
        // 2. 无非精确匹配或命令后有其他内容（即参数，空格也算）
        if (exactMatch && (!hasInexactMatches || rawArgument)) {
            hideSuggestions();
            return;
        }

        // 无匹配命令，显示错误提示
        if (matches.length === 0 && !exactMatch) {
            els.suggestionsBox.className = "cmd-suggestions no-match";
            els.suggestionsList.innerHTML = `
                <div class="no-match-message">
                    ${escapeHtml(rawCommand) + ": " + t("console.cmd.nomatch")}
                </div>
            `;
            els.suggestionsBox.style.display = "block";

            // 输入框中的文字变红
            inputEl.classList.add('input-error');
            return;
        }

        // 有匹配命令（包括精确匹配但还有其他选项的情况）
        if (matches.length > 0) {
            els.suggestionsBox.className = "cmd-suggestions";

            let html = '';
            matches.forEach(match => {
                const isExact = exactMatch && match.name.toLowerCase() === rawCommand;
                const displayDesc = getCommandDescription(match);
                const highlightedName = highlightMatch(escapeHtml(match.name), rawCommand);

                let itemClass = 'suggestion-item';
                if (isExact) {
                    itemClass += ' suggestion-exact';
                }

                html += `
                    <div class="${itemClass}" data-cmd="${escapeHtml(match.name)}">
                        <span class="suggestion-cmd">
                            <span class="suggestion-cmd-name">${highlightedName}</span>
                            ${isExact ? '<span class="suggestion-exact-badge">✓</span>' : ''}
                        </span>
                        <span class="suggestion-desc">${escapeHtml(displayDesc)}</span>
                    </div>
                `;
            });
            els.suggestionsList.innerHTML = html;
            els.suggestionsBox.style.display = "block";

            // 绑定点击事件
            const items = els.suggestionsList.querySelectorAll('.suggestion-item');
            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();

                    const cmd = item.getAttribute('data-cmd');
                    if (cmd && inputEl) {
                        // 保留用户已输入的命令后的参数部分
                        const { rawArgument } = extractCommandAndArgument(inputEl.value);

                        // 替换命令名，保留参数
                        inputEl.value = cmd + rawArgument;
                        inputEl.focus();
                        hideSuggestions();
                        inputEl.classList.remove('input-error');
                    }
                });
            });
            return;
        }

        // 默认情况（不应该到达这里）
        hideSuggestions();
    }

    /**
     * 隐藏提示框
     */
    function hideSuggestions() {
        const els = getElements();
        const inputEl = els.cmd;

        if (els.suggestionsBox) {
            els.suggestionsBox.style.display = "none";
        }

        // 清除错误样式
        if (inputEl) {
            inputEl.classList.remove('input-error');
        }

        state.currentMatch = null;
    }

    /**
     * 处理输入变化（防抖）
     */
    function onInputChange() {
        // 清除之前的定时器
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }

        // 设置防抖
        state.debounceTimer = setTimeout(() => {
            const els = getElements();
            const rawInput = els.cmd ? els.cmd.value : "";

            // 如果命令列表还没加载，先加载
            if (!state.isCommandLoaded && !state.loadingCommands) {
                loadCommands().then(() => {
                    const filterResult = filterCommands(rawInput);
                    showSuggestions(filterResult, rawInput);
                });
            } else {
                const filterResult = filterCommands(rawInput);
                showSuggestions(filterResult, rawInput);
            }
        }, 200);
    }

    /**
     * 处理键盘事件（用于命令补全和发送）
     */
    function onKeyDown(e) {
        const els = getElements();
        const inputEl = els.cmd;
        if (!inputEl) return;

        // Enter 键发送命令
        if (e.key === 'Enter') {
            e.preventDefault();
            hideSuggestions();
            send();
            return;
        }

        // Tab 键自动补全
        if (e.key === 'Tab') {
            e.preventDefault();

            const rawInput = inputEl.value;
            const { rawCommand, rawArgument } = extractCommandAndArgument(rawInput);

            if (!rawCommand || rawCommand.length === 0) return;

            // 查找匹配的命令
            const filterResult = filterCommands(rawInput);
            const { matches } = filterResult;

            if (matches.length === 1) {
                // 只有一个匹配，自动补全
                hideSuggestions();
                inputEl.value = matches[0].name + rawArgument;
                inputEl.classList.remove('input-error');
            } else if (matches.length > 0) {
                // 多个匹配，显示提示框
                showSuggestions(filterResult, rawInput);
            }
            return;
        }

        // ESC 键隐藏提示框
        if (e.key === 'Escape') {
            hideSuggestions();
            return;
        }

        // 上下箭头历史记录（不处理 Tab 相关的）
        // 上箭头 - 历史记录向前
        if (e.key === "ArrowUp") {
            const history = state.history;
            if (!history || !history.length) return;

            state.histPos = Math.min(history.length - 1, state.histPos + 1);
            inputEl.value = history[state.histPos] || "";
            // 触发输入事件重新计算提示
            const newInput = inputEl.value;
            const filterResult = filterCommands(newInput);
            showSuggestions(filterResult, newInput);
            inputEl.classList.remove('input-error');
            e.preventDefault();
            return;
        }

        // 下箭头 - 历史记录向后
        if (e.key === "ArrowDown") {
            const history = state.history;
            if (!history || !history.length) return;

            state.histPos = Math.max(-1, state.histPos - 1);
            inputEl.value = state.histPos >= 0 ? (history[state.histPos] || "") : "";
            // 触发输入事件重新计算提示
            const newInput = inputEl.value;
            const filterResult = filterCommands(newInput);
            showSuggestions(filterResult, newInput);
            inputEl.classList.remove('input-error');
            e.preventDefault();
            return;
        }

        // Ctrl+L 清空终端输出
        if ((e.ctrlKey || e.metaKey) && e.key === "l") {
            e.preventDefault();
            clear();
        }
    }

    /**
     * 显示欢迎信息
     */
    function showWelcomeMessage() {
        addTerminalLine('system', 'Welcome to U-Boot Web Terminal');
        addTerminalLine('system', 'Type "help" to see available commands');
        addTerminalLine('separator', '');
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
                outputEl.innerHTML = saved;
                // 滚动到底部
                outputEl.scrollTop = outputEl.scrollHeight;
            } else {
                showWelcomeMessage();
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
            let content = outputEl.innerHTML;
            if (content.length > state.persistMax) {
                content = content.slice(content.length - state.persistMax);
            }
            sessionStorage.setItem(state.persistKey, content);
        } catch (e) {
            console.warn("Failed to persist output:", e);
        }
    }

    /**
     * 添加一行到终端输出
     * @param {string} type - 行类型: 'command', 'output', 'error', 'system'
     * @param {string} content - 内容
     * @param {string} commandPrompt - 命令行的提示符（仅当 type='command' 时使用）
     */
    function addTerminalLine(type, content, commandPrompt = '$') {
        const outputEl = getElements().output;
        if (!outputEl) return;

        const lineDiv = document.createElement('div');
        lineDiv.className = `terminal-line ${type}`;

        if (type === 'command') {
            const promptSpan = document.createElement('span');
            promptSpan.className = 'line-prompt';
            promptSpan.textContent = commandPrompt;
            const contentSpan = document.createElement('span');
            contentSpan.className = 'line-content';
            contentSpan.textContent = content;
            lineDiv.appendChild(promptSpan);
            lineDiv.appendChild(contentSpan);
        } else {
            const contentSpan = document.createElement('span');
            contentSpan.className = 'line-content';
            contentSpan.textContent = content;
            lineDiv.appendChild(contentSpan);
        }

        outputEl.appendChild(lineDiv);
        outputEl.scrollTop = outputEl.scrollHeight;
        savePersistedOutput();
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
     * 检查命令是否被禁止
     * @param {string} commandName - 命令名称
     * @returns {Object|null} 禁止信息，如果不被禁止则返回 null
     */
    function isForbiddenCommand(commandName) {
        if (!commandName) return null;
        const lowerName = commandName.toLowerCase();
        return state.forbiddenCommands.get(lowerName) || null;
    }

    /**
     * 检查并处理命令
     * @param {string} line - 输入的命令行
     * @returns {boolean} - 是否允许执行
     */
    function validateCommand(line) {
        const { rawCommand } = extractCommandAndArgument(line);
        const { matches, exactMatch } = filterCommands(line);
        let fullCommandName = "";

        if (exactMatch) {
            // 命令有精确匹配
            fullCommandName = rawCommand;
        } else if (matches.length === 1) {
            // 命令没有精确匹配，但有唯一前缀匹配
            fullCommandName = matches[0].name;
        } else {
            // 命令没有精确匹配，且无前缀匹配或有不止一个前缀匹配
            addTerminalLine('error', `${rawCommand}: ${t("console.cmd.unknown")}`);
            return false;
        }

        const forbiddenInfo = isForbiddenCommand(fullCommandName);
        if (forbiddenInfo) {
            addTerminalLine('error', `${fullCommandName}: ${t("console.cmd.forbid.hint")}`);
            if (forbiddenInfo.reasonKey) {
                addTerminalLine('error', t(forbiddenInfo.reasonKey));
            }
            if (forbiddenInfo.altKey) {
                addTerminalLine('system', t(forbiddenInfo.altKey));
            }
            return false;
        }

        return true;
    }

    /**
     * 发送命令并执行
     */
    async function send() {
        const cmdEl = getElements().cmd;

        if (!cmdEl || !cmdEl.value.trim()) {
            addTerminalLine('command', '');
            cmdEl.value = "";
            return;
        }

        const line = cmdEl.value.trim();

        // 回显命令到终端
        addTerminalLine('command', line);

        cmdEl.value = "";

        // 隐藏提示框
        hideSuggestions();

        // 添加到历史记录
        state.history.unshift(line);
        if (state.history.length > 50) {
            state.history.length = 50;
        }
        state.histPos = -1;

        // 验证命令
        if (!validateCommand(line)) {
            setStatus(t("console.status.ready"));
            return;
        }

        try {
            const formData = new FormData();
            formData.append("cmd", line);

            setStatus(t("console.status.running"));

            const response = await fetch("/console/exec", {
                method: "POST",
                body: formData
            });

            const text = await response.text();

            if (!response.ok) {
                const errorMsg = `${t("console.status.http")} ${response.status}${text ? ": " + text : ""}`;
                addTerminalLine('error', errorMsg);
                setStatus(errorMsg, true);
                return;
            }

            if (text && text.trim()) {
                // 移除末尾的换行符，但保留格式
                let outputText = text;
                if (outputText.endsWith('\n')) {
                    outputText = outputText.slice(0, -1);
                }
                // 分割多行输出
                const lines = outputText.split('\n');
                for (const lineText of lines) {
                    if (lineText.trim() !== "" || lines.length === 1) {
                        addTerminalLine('output', lineText);
                    } else if (lineText === "") {
                        addTerminalLine('output', "");
                    }
                }
            }

            setStatus(t("console.status.done"));

        } catch (error) {
            const errorMsg = formatError(error);
            addTerminalLine('error', errorMsg);
            setStatus(errorMsg, true);
        }
    }

    /**
     * 清空输出
     */
    async function clear() {
        const outputEl = getElements().output;
        if (outputEl) {
            outputEl.innerHTML = "";
            showWelcomeMessage();
            try {
                sessionStorage.removeItem(state.persistKey);
            } catch (e) {
                // 忽略清理错误
            }
            setStatus(t("console.status.cleared"));
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

            showFileInfo(`${t("console.uploading")} ${file.name}`);
            showFileProgress(true);
            setFileProgress(0);

            const formData = new FormData();
            formData.append("file", file);

            try {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener("progress", function(event) {
                    if (event.lengthComputable && event.total > 0) {
                        const percent = parseInt((event.loaded / event.total) * 100);
                        setFileProgress(percent);
                        showFileInfo(`${t("console.uploading")} ${file.name} (${percent}%)`);
                    }
                });

                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        showFileProgress(false);

                        if (xhr.status === 200) {
                            const text = xhr.responseText;
                            if (text) {
                                addTerminalLine('output', text);
                            }
                            showFileInfo(`✓ ${t("console.upload.success")}`, true);
                            setStatus(t("console.upload.success"));
                        } else {
                            showFileInfo(`✗ ${t("console.status.http")} ${xhr.status}`, false);
                            setStatus(`${t("console.status.http")} ${xhr.status}`, true);
                        }
                    }
                };

                xhr.open("POST", "/console/upload");
                xhr.send(formData);

            } catch (error) {
                showFileProgress(false);
                showFileInfo(`✗ ${formatError(error)}`, false);
                setStatus(formatError(error), true);
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

        // 输入事件（带防抖）
        cmdEl.addEventListener("input", onInputChange);

        // 键盘事件（统一处理所有按键）
        cmdEl.addEventListener("keydown", onKeyDown);

        // 失去焦点时隐藏提示框（延迟一下，让点击事件有机会执行）
        cmdEl.addEventListener("blur", () => {
            setTimeout(() => {
                hideSuggestions();
            }, 200);
        });

        // 获得焦点时的处理
        cmdEl.addEventListener("focus", () => {
            const rawInput = cmdEl.value;
            if (rawInput && rawInput.trimStart().length > 0) {
                if (!state.isCommandLoaded && !state.loadingCommands) {
                    loadCommands().then(() => {
                        const filterResult = filterCommands(rawInput);
                        showSuggestions(filterResult, rawInput);
                    });
                } else {
                    const filterResult = filterCommands(rawInput);
                    showSuggestions(filterResult, rawInput);
                }
            }
        });
    }

    /**
     * 初始化控制台管理器
     */
    function init() {
        getElements();

        bindKeyboardEvents();

        loadPersistedOutput();

        // 预加载命令列表（不阻塞UI）
        loadCommands();

        setStatus(t("console.status.ready"));
    }

    /**
     * 清理资源
     */
    function destroy() {
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }
        elements = null;
    }

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
 * 系统信息管理器
 * 负责加载和渲染设备的系统信息、存储信息和分区表
 */
const sysinfoManager = (() => {
    let elements = null;
    const sectionIds = ["board_info", "flash_info", "partitions_info"];

    /**
     * 获取或缓存 DOM 元素
     */
    function getElements() {
        if (elements) return elements;

        elements = {};
        sectionIds.forEach(function(id) {
            elements[id] = document.getElementById(id);
        });

        return elements;
    }

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
        tdValue.textContent = value !== undefined && value !== null
            ? String(value)
            : t("sysinfo.no_data");

        tr.appendChild(tdLabel);
        tr.appendChild(tdValue);
        return tr;
    }

    /**
     * 创建板块表格容器
     * @param {string} sectionId - 板块元素 ID
     * @param {string} titleKey - 标题的国际化 key
     * @returns {HTMLTableElement|null}
     */
    function createSectionTable(sectionId, titleKey) {
        const section = document.getElementById(sectionId);
        if (!section) return null;

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
        const propsMap = {
            spi: {
                "page_size": "sysinfo.page_size",
                "block_size": "sysinfo.block_size",
                "sector_size": "sysinfo.sector_size",
                "erase_size": "sysinfo.erase_size",
            },
            mmc: {
                "block_size": "sysinfo.block_size",
                "version": "sysinfo.version",
            },
            nand: {
                "page_size": "sysinfo.page_size",
                "block_size": "sysinfo.block_size",
                "oob_size": "sysinfo.oob_size",
                "oob_avail": "sysinfo.oob_avail",
                "ecc_step_size": "sysinfo.ecc_step_size",
                "ecc_strength": "sysinfo.ecc_strength",
            },
        };

        const propsToShow = propsMap[type] || {};

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

            const columns = [
                { key: "sysinfo.part_index", width: "8%" },
                { key: "sysinfo.name", width: "20%" },
                { key: "sysinfo.part_start", width: "24%" },
                { key: "sysinfo.part_end", width: "24%" },
                { key: "sysinfo.size", width: "24%" }
            ];

            columns.forEach(function(col) {
                const th = document.createElement("td");
                th.className = "td left";
                th.setAttribute("width", col.width);
                th.setAttribute("data-i18n", col.key);
                th.textContent = t(col.key);
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

                const cellStyle = "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85rem;";

                // 序号（从 1 开始）
                const tdIndex = document.createElement("td");
                tdIndex.className = "td left";
                tdIndex.setAttribute("width", "8%");
                tdIndex.textContent = index + 1;
                tdIndex.style.cssText = cellStyle;

                // 分区名
                const tdName = document.createElement("td");
                tdName.className = "td left";
                tdName.setAttribute("width", "20%");
                tdName.textContent = part.name || "";
                tdName.style.cssText = cellStyle;

                // 起始地址
                const tdStart = document.createElement("td");
                tdStart.className = "td left";
                tdStart.setAttribute("width", "24%");
                const start = part.start || 0;
                tdStart.textContent = "0x" + start.toString(16).toUpperCase();
                tdStart.style.cssText = cellStyle;

                // 结束地址 = 起始地址 + 大小 - 1
                const tdEnd = document.createElement("td");
                tdEnd.className = "td left";
                tdEnd.setAttribute("width", "24%");
                const size = part.size || 0;
                const end = start + size - 1;
                tdEnd.textContent = "0x" + end.toString(16).toUpperCase();
                tdEnd.style.cssText = cellStyle;

                // 大小
                const tdSize = document.createElement("td");
                tdSize.className = "td left";
                tdSize.setAttribute("width", "24%");
                tdSize.textContent = "0x" + size.toString(16).toUpperCase() + " (" + bytesToHuman(size) + ")";
                tdSize.style.cssText = cellStyle;

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
    function renderData(data) {
        // ========== 设备信息 ==========
        const boardTable = createSectionTable("board_info", "sysinfo.title.board_info");
        if (boardTable) {
            if (data.board) {
                const b = data.board;
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
        const flashTable = createSectionTable("flash_info", "sysinfo.title.flash_info");
        if (flashTable) {
            // SMEM 信息
            if (data.smeminfo) {
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

                const smem = data.smeminfo;
                if (smem.flash_type) flashTable.appendChild(createInfoRow("sysinfo.flash_type", smem.flash_type));
                if (smem.flash_block_size) flashTable.appendChild(createInfoRow("sysinfo.flash_block_size", formatHexBytes(smem.flash_block_size)));
                if (smem.flash_density) flashTable.appendChild(createInfoRow("sysinfo.flash_density", formatHexBytes(smem.flash_density)));
                if (smem.flash_secondary_type) flashTable.appendChild(createInfoRow("sysinfo.flash_secondary_type", smem.flash_secondary_type));
            }

            // 设备信息
            if (data.devices) {
                const devices = data.devices;

                if (devices.spi && devices.spi.present) {
                    renderDeviceInfo(devices.spi, "spi", flashTable);
                }

                if (devices.mmc && devices.mmc.present) {
                    renderDeviceInfo(devices.mmc, "mmc", flashTable);
                }

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
        const partitionTable = createSectionTable("partitions_info", "sysinfo.title.partitions_info");
        if (partitionTable) {
            if (data.partitions) {
                renderPartitions(data.partitions, partitionTable);
            }

            // 如果没有任何分区，显示提示
            if (partitionTable.querySelectorAll("tr").length === 0) {
                partitionTable.appendChild(createInfoRow("sysinfo.no_data", t("sysinfo.no_data")));
            }
        }

        // 应用国际化到所有板块
        sectionIds.forEach(function(id) {
            const el = document.getElementById(id);
            if (el) {
                applyI18n(el);
            }
        });
    }

    /**
     * 显示加载状态
     */
    function showLoading() {
        sectionIds.forEach(function(id) {
            const el = document.getElementById(id);
            if (el) {
                const inner = el.querySelector(".card-main-inner");
                if (inner) {
                    inner.innerHTML = '<span style="color: var(--muted);">' +
                        t("sysinfo.loading") + '</span>';
                }
            }
        });
    }

    /**
     * 显示错误状态
     * @param {string} errorKey - 错误信息的国际化 key
     */
    function showError(errorKey) {
        sectionIds.forEach(function(id) {
            const el = document.getElementById(id);
            if (el) {
                const inner = el.querySelector(".card-main-inner");
                if (inner) {
                    inner.innerHTML = '<span style="color: var(--danger);">' +
                        t(errorKey) + '</span>';
                }
            }
        });
    }

    /**
     * 加载系统信息
     */
    function load() {
        showLoading();

        ajax({
            url: "/sysinfo",
            timeout: 10000,
            done: function(responseText) {
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    showError("sysinfo.error.parse");
                    return;
                }

                renderData(data);
            }
        });
    }

    /**
     * 获取系统信息并存储在全局状态中
     * 供其他模块使用（如 MIBIB 重载模块需要检查 9008 模式）
     */
    function fetchAndStore() {
        ajax({
            url: "/sysinfo",
            timeout: 10000,
            done: function(responseText) {
                try {
                    APP_STATE.sysinfo = JSON.parse(responseText);
                } catch (e) {
                    // 静默失败，其他模块会检查 APP_STATE.sysinfo
                }
            }
        });
    }

    /**
     * 初始化系统信息管理器
     */
    function init() {
        load();
    }

    return {
        init,
        load,
        fetchAndStore,
    };
})();

// ==============================
// 系统日志模块
// ==============================

/**
 * 系统日志管理器
 * 负责通过轮询方式获取系统日志
 */
const syslogManager = (() => {
    let elements = null;
    let state = {
        running: false,
        pollTimer: null,
        autoScroll: true,
        persistKey: "failsafe_syslog_output",
        persistMax: 500000,  // 最大存储 500KB
        logBuffer: ""
    };

    /**
     * 获取或缓存 DOM 元素
     */
    function getElements() {
        if (elements) return elements;

        elements = {
            output: document.getElementById("syslog_out"),
            status: document.getElementById("syslog_status")
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

        // 如果是成功消息（非错误），3秒后自动清除
        if (!isError && text && text !== t("syslog.status.ready")) {
            setTimeout(() => {
                if (getElements().status && getElements().status.textContent === text) {
                    setStatus(t("syslog.status.ready"));
                }
            }, 3000);
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
                state.logBuffer = saved;
                // 滚动到底部
                if (state.autoScroll) {
                    outputEl.scrollTop = outputEl.scrollHeight;
                }
            }
        } catch (e) {
            console.warn("Failed to load persisted syslog:", e);
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
                // 保留最近的内容
                content = content.slice(content.length - state.persistMax);
            }
            sessionStorage.setItem(state.persistKey, content);
            state.logBuffer = content;
        } catch (e) {
            console.warn("Failed to persist syslog:", e);
        }
    }

    /**
     * 追加日志到输出区域
     */
    function appendLog(text) {
        const outputEl = getElements().output;
        if (!outputEl || !text) return;

        // 直接追加文本，不进行 HTML 转义（保持原始格式）
        if (outputEl.textContent === "") {
            outputEl.textContent = text;
        } else {
            outputEl.textContent += text;
        }

        // 限制输出长度
        if (outputEl.textContent.length > state.persistMax) {
            outputEl.textContent = outputEl.textContent.slice(
                outputEl.textContent.length - state.persistMax
            );
        }

        savePersistedOutput();

        // 自动滚动到底部
        if (state.autoScroll) {
            outputEl.scrollTop = outputEl.scrollHeight;
        }
    }

    /**
     * 复制日志到剪贴板
     */
    async function copy() {
        const outputEl = getElements().output;
        if (!outputEl || !outputEl.textContent) {
            setStatus(t("syslog.status.no_content"), true);
            return;
        }

        try {
            const logText = outputEl.textContent;

            // 使用现代 Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(logText);
                setStatus(t("syslog.status.copied"));
            }
            // 降级方案：使用传统的 execCommand
            else {
                // 创建临时 textarea 元素
                const textarea = document.createElement("textarea");
                textarea.value = logText;
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";
                textarea.style.top = "-9999px";
                document.body.appendChild(textarea);

                textarea.select();
                textarea.setSelectionRange(0, logText.length);

                const success = document.execCommand("copy");
                document.body.removeChild(textarea);

                if (success) {
                    setStatus(t("syslog.status.copied"));
                } else {
                    throw new Error("execCommand failed");
                }
            }
        } catch (error) {
            console.error("Copy failed:", error);
            setStatus(t("syslog.status.copy_failed"), true);
        }
    }

    /**
     * 清空日志输出
     */
    function clear() {
        if (!confirm(t("syslog.confirm.clear"))) return;

        const outputEl = getElements().output;
        if (outputEl) {
            outputEl.textContent = "";
            state.logBuffer = "";
            try {
                sessionStorage.removeItem(state.persistKey);
            } catch (e) {
                // 忽略清理错误
            }
            setStatus(t("syslog.status.cleared"));
        }
    }

    /**
     * 格式化日期时间：年-月-日_时-分-秒
     */
    function formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    }

    /**
     * 保存日志文件
     */
    function save() {
        const outputEl = getElements().output;
        if (!outputEl || !outputEl.textContent) {
            setStatus(t("syslog.status.no_content"), true);
            return;
        }

        try {
            // 获取原始文本
            let logText = outputEl.textContent || "";

            if (!logText) {
                setStatus(t("syslog.status.no_content"), true);
                return;
            }

            const now = new Date();
            const dateTimeStr = formatDateTime(now);
            const filename = `uboot_syslog_${dateTimeStr}.log`;

            const blob = new Blob([logText], { type: "text/plain;charset=utf-8" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            setStatus(t("syslog.status.saved"));
        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 切换自动滚动
     */
    function toggleAutoScroll() {
        state.autoScroll = !state.autoScroll;
        const btn = document.querySelector('.syslog-actions .button-sm:nth-child(4)');
        if (btn) {
            if (state.autoScroll) {
                btn.classList.remove('button-inactive');
                btn.style.opacity = "1";
            } else {
                btn.classList.add('button-inactive');
                btn.style.opacity = "0.6";
            }
        }
        setStatus(state.autoScroll ? t("syslog.status.auto_scroll_on") : t("syslog.status.auto_scroll_off"));

        // 如果自动滚动开启，立即滚动到底部
        if (state.autoScroll) {
            const outputEl = getElements().output;
            if (outputEl) {
                outputEl.scrollTop = outputEl.scrollHeight;
            }
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
     * 单次轮询获取日志
     */
    async function pollOnce() {
        if (!state.running) return;

        try {
            const url = '/syslog/poll';
            const response = await fetch(url, {
                method: "GET",
                cache: "no-store"
            });

            if (!response.ok) {
                if (response.status !== 404) {
                    setStatus(`${t("syslog.status.http")} ${response.status}`, true);
                }
                return;
            }

            const text = await response.text();
            if (text && text.trim()) {
                appendLog(text);
            }

        } catch (error) {
            console.warn("Syslog poll error:", error);
            setStatus(formatError(error), true);
        }
    }

    /**
     * 启动轮询调度
     */
    function schedulePoll() {
        if (state.pollTimer) {
            clearTimeout(state.pollTimer);
        }

        state.pollTimer = setTimeout(async () => {
            await pollOnce();
            schedulePoll();
        }, 500);  // 0.5 秒轮询间隔
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
     * 初始化系统日志管理器
     */
    function init() {
        getElements();

        loadPersistedOutput();

        // 启动轮询
        state.running = true;
        setStatus(t("syslog.status.ready"));
        schedulePoll();

        // 页面卸载时停止轮询
        window.addEventListener("beforeunload", () => {
            stopPoll();
        });
    }

    /**
     * 销毁管理器，清理资源
     */
    function destroy() {
        stopPoll();
        elements = null;
    }

    return {
        init,
        copy,
        clear,
        save,
        toggleAutoScroll,
        destroy
    };
})();

// ==============================
// 设置页面管理器
// ==============================

const settingsPageManager = (() => {
    let elements = null;

    function getElements() {
        if (elements) return elements;

        elements = {
            langSelect: document.getElementById("settings_lang"),
            themeSelect: document.getElementById("settings_theme")
        };

        return elements;
    }

    /**
     * 加载当前设置到表单
     */
    function loadSettingsToForm() {
        const els = getElements();

        if (els.langSelect) {
            els.langSelect.value = APP_STATE.lang || "en";
        }

        if (els.themeSelect) {
            els.themeSelect.value = APP_STATE.theme || "auto";
        }
    }

    /**
     * 绑定事件
     */
    function bindEvents() {
        const els = getElements();

        // 实时应用主题（选择即生效）
        if (els.themeSelect) {
            els.themeSelect.addEventListener("change", () => {
                setTheme(els.themeSelect.value);
            });
        }

        // 实时应用语言（选择即生效）
        if (els.langSelect) {
            els.langSelect.addEventListener("change", () => {
                setLang(els.langSelect.value);
                // 更新保存按钮文本（因为语言变了）
                if (els.saveBtn) {
                    els.saveBtn.textContent = t("settings.action.save");
                }
                if (els.resetBtn) {
                    els.resetBtn.textContent = t("settings.action.reset");
                }
            });
        }
    }

    /**
     * 初始化设置页面
     */
    function init() {
        getElements();
        loadSettingsToForm();
        bindEvents();
    }

    return {
        init,
    };
})();

// ==============================
// MAC 地址管理模块
// ==============================

/**
 * MAC 地址管理器
 * 负责处理设备 MAC 地址的查看、修改等操作
 */
const macManager = (() => {
    let elements = null;
    let macList = [];           // 存储 MAC 地址数组
    let partName = "";          // 存储分区名称
    let refreshTimer = null;    // 延迟刷新定时器

    /**
     * 获取或缓存 DOM 元素
     */
    function getElements() {
        if (elements) return elements;

        elements = {
            status: document.getElementById("mac_status"),
            partNameDisplay: document.getElementById("mac_part_name"),
            tableBody: document.getElementById("mac_table_body"),
            tableContainer: document.getElementById("mac_table_container"),
            modifyBtn: document.getElementById("mac_modify_btn"),
            saveBtn: document.getElementById("mac_save_btn"),
            cancelBtn: document.getElementById("mac_cancel_btn"),
            actionGroup: document.getElementById("mac_action_group"),
            saveCancelGroup: document.getElementById("mac_save_cancel_group")
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
     * 设置分区名称显示
     */
    function setPartName(name) {
        const el = getElements().partNameDisplay;
        if (el) {
            if (name) {
                el.textContent = name;
                el.style.display = "inline";
            } else {
                el.textContent = "";
                el.style.display = "none";
            }
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
     * 验证单个 MAC 字节是否为有效的十六进制数（00-FF）
     * @param {string} byte - 两位十六进制字符串
     * @returns {boolean}
     */
    function isValidHexByte(byte) {
        if (!byte || byte.length < 1 || byte.length > 2) return false;
        const hexPattern = /^[0-9A-Fa-f]{1,2}$/;
        return hexPattern.test(byte);
    }

    /**
     * 验证完整的 MAC 地址
     * @param {Array<string>} bytes - 6个字节的数组
     * @returns {boolean}
     */
    function isValidMac(bytes) {
        if (!bytes || bytes.length !== 6) return false;
        return bytes.every(byte => isValidHexByte(byte));
    }

    /**
     * 将 MAC 地址字符串转换为字节数组
     * @param {string} mac - MAC 地址字符串 (格式: XX:XX:XX:XX:XX:XX)
     * @returns {Array<string>}
     */
    function macToBytes(mac) {
        if (!mac) return Array(6).fill("00");
        const parts = mac.split(':');
        if (parts.length === 6) {
            return parts.map(p => p.toUpperCase().padStart(2, '0'));
        }
        return Array(6).fill("00");
    }

    /**
     * 将字节数组转换为 MAC 地址字符串
     * @param {Array<string>} bytes - 6个字节的数组
     * @returns {string}
     */
    function bytesToMac(bytes) {
        if (!bytes || bytes.length !== 6) return "";
        return bytes.map(b => b.toUpperCase().padStart(2, '0')).join(':');
    }

    /**
     * 创建 MAC 输入框组（6个小框）
     * @param {string} mac - MAC 地址字符串
     * @param {number} index - MAC 索引
     * @returns {HTMLElement}
     */
    function createMacInputGroup(mac, index) {
        const bytes = macToBytes(mac);
        const container = document.createElement("div");
        container.className = "mac-input-group";
        container.dataset.index = index;

        const inputs = [];

        for (let i = 0; i < 6; i++) {
            const input = document.createElement("input");
            input.type = "text";
            input.maxLength = 2;
            input.size = 2;
            input.className = "mac-byte-input";
            input.value = bytes[i];
            input.dataset.byteIndex = i;
            input.disabled = true;  // 初始状态为禁用（只读模式）
            input.readOnly = true;

            // 输入验证和格式化
            input.addEventListener("input", (e) => {
                handleByteInput(e, input, inputs, i);
            });

            input.addEventListener("keydown", (e) => {
                handleByteKeydown(e, input, inputs, i);
            });

            input.addEventListener("focus", (e) => {
                input.select();
            });

            container.appendChild(input);

            // 添加分隔符（除了最后一个）
            if (i < 5) {
                const separator = document.createElement("span");
                separator.className = "mac-separator";
                separator.textContent = "-";
                container.appendChild(separator);
            }

            inputs.push(input);
        }

        // 存储输入框引用
        container.inputs = inputs;

        // 为容器添加验证状态显示
        const validationStatus = document.createElement("span");
        validationStatus.className = "mac-validation-status";
        container.appendChild(validationStatus);
        container.validationStatus = validationStatus;

        return container;
    }

    /**
     * 处理字节输入事件
     */
    function handleByteInput(e, currentInput, allInputs, byteIndex) {
        let value = e.target.value.toUpperCase();

        // 只允许十六进制字符
        value = value.replace(/[^0-9A-F]/g, "");

        // 限制长度为2
        if (value.length > 2) {
            value = value.slice(0, 2);
        }

        currentInput.value = value;

        // 如果输入了2个字符且不是最后一个输入框，自动跳转到下一个
        if (value.length === 2 && byteIndex < 5) {
            const nextInput = allInputs[byteIndex + 1];
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            }
        }

        // 验证当前输入框的MAC组
        validateMacGroup(currentInput.closest(".mac-input-group"));
    }

    /**
     * 处理字节键盘事件
     */
    function handleByteKeydown(e, currentInput, allInputs, byteIndex) {
        // 处理删除键：如果当前输入框为空且按下了 Backspace，跳转到上一个输入框
        if (e.key === "Backspace" && currentInput.value === "" && byteIndex > 0) {
            const prevInput = allInputs[byteIndex - 1];
            if (prevInput) {
                prevInput.focus();
                prevInput.select();
            }
            e.preventDefault();
        }

        // 处理左箭头键
        if (e.key === "ArrowLeft" && byteIndex > 0) {
            const prevInput = allInputs[byteIndex - 1];
            if (prevInput) {
                prevInput.focus();
                prevInput.select();
            }
            e.preventDefault();
        }

        // 处理右箭头键
        if (e.key === "ArrowRight" && byteIndex < 5) {
            const nextInput = allInputs[byteIndex + 1];
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            }
            e.preventDefault();
        }
    }

    /**
     * 验证单个 MAC 输入组
     * @param {HTMLElement} group - MAC 输入组容器
     * @returns {boolean}
     */
    function validateMacGroup(group) {
        if (!group || !group.inputs) return false;

        const bytes = group.inputs.map(input => input.value.padStart(2, ''));
        const isValid = isValidMac(bytes);

        // 更新样式
        group.inputs.forEach(input => {
            const byteValue = input.value;
            const byteValid = isValidHexByte(byteValue);
            if (byteValid) {
                input.classList.remove("invalid");
                input.classList.add("valid");
            } else if (byteValue.length > 0) {
                input.classList.remove("valid");
                input.classList.add("invalid");
            } else {
                input.classList.remove("valid", "invalid");
            }
        });

        // 更新验证状态图标
        if (group.validationStatus) {
            if (isValid) {
                group.validationStatus.textContent = "✓";
                group.validationStatus.className = "mac-validation-status valid";
            } else {
                group.validationStatus.textContent = "✗";
                group.validationStatus.className = "mac-validation-status invalid";
            }
        }

        return isValid;
    }

    /**
     * 获取所有 MAC 地址
     * @returns {Array<string>}
     */
    function getAllMacs() {
        const groups = document.querySelectorAll(".mac-input-group");
        const macs = [];

        groups.forEach(group => {
            if (group.inputs) {
                const bytes = group.inputs.map(input => input.value.padStart(2, '0'));
                const mac = bytesToMac(bytes);
                macs.push(mac);
            }
        });

        return macs;
    }

    /**
     * 验证所有 MAC 地址
     * @returns {boolean}
     */
    function validateAllMacs() {
        const groups = document.querySelectorAll(".mac-input-group");
        let allValid = true;

        groups.forEach(group => {
            const isValid = validateMacGroup(group);
            if (!isValid) allValid = false;
        });

        return allValid;
    }

    /**
     * 渲染 MAC 地址表格
     * @param {Array<string>} macs - MAC 地址数组
     */
    function renderTable(macs) {
        const els = getElements();

        if (!els.tableBody) return;

        els.tableBody.innerHTML = "";

        if (!macs || macs.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 2;
            cell.className = "mac-empty-cell";
            cell.setAttribute("data-i18n", "mac.no_data");
            cell.textContent = t("mac.no_data");
            row.appendChild(cell);
            els.tableBody.appendChild(row);
            return;
        }

        macs.forEach((mac, index) => {
            const row = document.createElement("tr");
            row.className = "mac-row";

            // 名称列
            const nameCell = document.createElement("td");
            nameCell.className = "mac-name-cell";
            nameCell.textContent = `MAC${index + 1}`;
            row.appendChild(nameCell);

            // 输入框列
            const inputCell = document.createElement("td");
            inputCell.className = "mac-input-cell";
            const inputGroup = createMacInputGroup(mac, index);
            inputCell.appendChild(inputGroup);
            row.appendChild(inputCell);

            els.tableBody.appendChild(row);
        });

        // 应用国际化
        applyI18n(els.tableBody);
    }

    /**
     * 启用编辑模式
     */
    function enableEditMode() {
        const els = getElements();
        const inputs = document.querySelectorAll(".mac-byte-input");

        // 启用所有输入框
        inputs.forEach(input => {
            input.disabled = false;
            input.readOnly = false;
        });

        // 显示保存/取消按钮，隐藏修改按钮
        if (els.modifyBtn) els.modifyBtn.style.display = "none";
        if (els.saveCancelGroup) els.saveCancelGroup.style.display = "flex";

        setStatus(t("mac.status.edit_mode"));
    }

    /**
     * 禁用编辑模式（取消编辑）
     */
    function disableEditMode() {
        const els = getElements();

        // 重新加载原始数据
        loadMacInfo();

        // 显示修改按钮，隐藏保存/取消按钮
        if (els.modifyBtn) els.modifyBtn.style.display = "inline-block";
        if (els.saveCancelGroup) els.saveCancelGroup.style.display = "none";

        setStatus(t("mac.status.cancelled"));
    }

    /**
     * 保存 MAC 地址
     */
    async function saveMacs() {
        // 验证所有 MAC 地址
        if (!validateAllMacs()) {
            setStatus(t("mac.error.invalid_mac"), true);
            return;
        }

        const macs = getAllMacs();

        if (!macs || macs.length === 0) {
            setStatus(t("mac.error.no_mac"), true);
            return;
        }

        // 将 MAC 地址数组转换为分号分隔的字符串
        const macsString = macs.join(';');

        try {
            setStatus(t("mac.status.saving"));

            const formData = new FormData();
            formData.append("mac_data", macsString);

            const response = await fetch("/mac/set", {
                method: "POST",
                body: formData
            });

            const result = await response.text();

            if (!response.ok) {
                throw new Error(`${t("mac.status.http")} ${response.status}: ${result}`);
            }

            if (result === "ok") {
                setStatus(t("mac.status.saved"));
                disableEditMode();
                // delayedRefresh();
            } else {
                throw new Error(result || t("mac.status.error"));
            }

        } catch (error) {
            setStatus(formatError(error), true);
        }
    }

    /**
     * 取消之前的延迟刷新定时器
     */
    function cancelDelayedRefresh() {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
    }

    /**
     * 延迟刷新 MAC 列表
     * @param {number} delay - 延迟时间（毫秒），默认 1500ms
     */
    function delayedRefresh(delay) {
        cancelDelayedRefresh();

        delay = delay || 1500;

        refreshTimer = setTimeout(async () => {
            refreshTimer = null;
            await loadMacInfo();
        }, delay);
    }

    /**
     * 加载 MAC 地址信息
     */
    async function loadMacInfo() {
        try {
            setStatus(t("mac.status.loading"));

            const response = await fetch("/mac/info", {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`${t("mac.status.http")} ${response.status}`);
            }

            const data = await response.json();

            // 解析分区名称
            if (data && data.part_name) {
                partName = data.part_name;
                setPartName(partName);
            } else {
                partName = "";
                setPartName("");
            }

            // 解析 MAC 列表
            if (data && data.macs && Array.isArray(data.macs)) {
                macList = data.macs;
                renderTable(macList);
                setStatus(t("mac.status.ready"));
            } else {
                throw new Error(t("mac.error.invalid_response"));
            }

        } catch (error) {
            setStatus(formatError(error), true);
            setPartName("");
            renderTable([]);
        }
    }

    /**
     * 绑定事件
     */
    function bindEvents() {
        const els = getElements();

        if (els.modifyBtn) {
            els.modifyBtn.addEventListener("click", enableEditMode);
        }

        if (els.saveBtn) {
            els.saveBtn.addEventListener("click", saveMacs);
        }

        if (els.cancelBtn) {
            els.cancelBtn.addEventListener("click", disableEditMode);
        }
    }

    /**
     * 初始化 MAC 管理器
     */
    function init() {
        getElements();
        bindEvents();
        loadMacInfo();
    }

    return {
        init,
        refresh: loadMacInfo,
        save: saveMacs
    };
})();

// ==============================
// 国际化数据
// ==============================

const I18N = (() => {
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
            "nav.overview": "Overview",
            "nav.sysinfo": "System Info",
            "nav.syslog": "System Log",
            "nav.update": "Update",
            "nav.firmware": "Firmware Update",
            "nav.art": "ART Update",
            "nav.cdt": "CDT Update",
            "nav.ptable": "PTABLE Update",
            "nav.simg": "SIMG Update",
            "nav.uboot": "U-Boot Update",
            "nav.debrick": "Debrick",
            "nav.mibib": "MIBIB Reload",
            "nav.initramfs": "Load Initramfs",
            "nav.system": "System",
            "nav.settings": "Theme Settings",
            "nav.network": "Network Settings",
            "nav.backup": "Flash Backup",
            "nav.console": "Web Console",
            "nav.mac": "MAC Manage",
            "nav.env": "Env Manage",
            "nav.reboot": "Reboot",
            "title.author": "View Author Profile",
            "title.project": "View Project",
            "file.dropzone.text": "Drag & drop a file here or click to select a file",
            "file.dropzone.hint": "Maximum file size: depends on partition",
            "file.uploading": "Uploading",
            "file.processing": "Processing",
            "common.upload": "Upload",
            "common.update": "Update",
            "common.update_reboot": "Update & Reboot",
            "common.boot": "Boot",
            "common.upgrade_hint": 'If all information above is correct, click "Update" or "Update & Reboot".',
            "common.warnings": "WARNINGS",
            "common.warn.1": "Do not power off the device during update.",
            "common.warn.2": "If everything goes well, the device will restart.",
            "file.select": "Please select a file first!",
            "label.name": "File",
            "label.type": "Type",
            "label.size": "Size",
            "label.md5": "MD5",
            "firmware.title": "FIRMWARE UPDATE",
            "firmware.hint": t.en.updateHint("firmware"),
            "firmware.warn.1": t.en.warnChoose("firmware image"),
            "uboot.title": "U-BOOT UPDATE",
            "uboot.hint": t.en.updateHint("U-Boot (bootloader)"),
            "uboot.warn.1": t.en.warnChoose("U-Boot image"),
            "uboot.warn.2": t.en.warnDanger("U-Boot"),
            "art.title": "ART UPDATE",
            "art.hint": t.en.updateHint("ART (Atheros Radio Test)"),
            "art.warn.1": "ART has no fixed magic number, so its file type will be recognized as Unknown.",
            "art.warn.2": t.en.warnChoose("ART image"),
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
            "console.send": "Send",
            "console.clear": "Clear",
            "console.cmd.forbid.hint": "this command has been disabled!",
            "console.cmd.forbid.reason.common": "This command will cause the HTTPD service to exit abnormally. Do not use it in the web terminal!",
            "console.cmd.forbid.alt.tftpb": "Use the upload function provided on this page instead.",
            "console.cmd.nomatch": "no matching command",
            "console.cmd.placeholder": "help; printenv",
            "console.cmd.unknown": "unknown command!",
            "console.status.ready": "Ready",
            "console.status.running": "Running...",
            "console.status.done": "Done",
            "console.status.cleared": "Cleared",
            "console.status.http": "HTTP error:",
            "console.status.parse": "Parse error",
            "console.status.error": "Error:",
            "console.upload": "Upload",
            "console.uploading": "Uploading:",
            "console.upload.success": "Upload successful",
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
            "mac.title": "MAC ADDRESS MANAGEMENT",
            "mac.hint": "View and modify device <strong>MAC addresses</strong>.",
            "mac.no_data": "No MAC address data available",
            "mac.label.part_name": "MAC Address Partition:",
            "mac.status.loading": "Loading MAC addresses...",
            "mac.status.ready": "Ready",
            "mac.status.saving": "Saving...",
            "mac.status.saved": "✓ MAC addresses saved",
            "mac.status.edit_mode": "Edit mode - modify MAC addresses and click Save",
            "mac.status.cancelled": "Edit cancelled",
            "mac.status.http": "HTTP error:",
            "mac.status.error": "Error",
            "mac.error.invalid_mac": "Invalid MAC address format",
            "mac.error.no_mac": "No MAC address data to save",
            "mac.error.invalid_response": "Invalid server response",
            "mac.action.modify": "Modify",
            "mac.action.save": "Save",
            "mac.action.cancel": "Cancel",
            "mac.warn.1": "Backup MAC address partition before making any changes.",
            "mac.warn.2": "These are just the raw MAC data in the partition; whether and how they are used is determined by the firmware.",
            "mac.warn.3": "After modification, the firmware needs to be reset or reflashed for the modified MAC address to be recognized.",
            "mac.warn.4": "Invalid MAC addresses may cause network issues.",
            "mibib.title": "MIBIB RELOAD",
            "mibib.hint": "In <strong>9008</strong> mode, reloading <strong>MIBIB</strong> to initialize <strong>SMEM (Shared Memory) Partition Info</strong>. <br>Please choose a file from your local hard drive and click <strong>Reload</strong> button.",
            "mibib.reload": "Reload",
            "mibib.reload_success_hint": "MIBIB reloaded successfully. Please click the button below to go to the \"System Info\" page to check if the SMEM information is correct.",
            "mibib.reload_success": "View system info",
            "mibib.not_9008": "Not in 9008 mode, MIBIB reload is not allowed!",
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
            "settings.title": "SETTINGS",
            "settings.hint": "Configure <strong>application preferences</strong> including language and theme.",
            "settings.label.language": "Language",
            "settings.label.theme": "Theme",
            "settings.theme.auto": "Auto",
            "settings.theme.light": "Light",
            "settings.theme.dark": "Dark",
            "settings.warn.1": "Language and theme settings are saved in your browser's local storage.",
            "settings.warn.2": "Theme changes apply immediately. Auto mode follows your system preference.",
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
            "syslog.title": "SYSTEM LOG",
            "syslog.copy": "Copy",
            "syslog.clear": "Clear",
            "syslog.save": "Save",
            "syslog.auto_scroll": "Auto Scroll",
            "syslog.confirm.clear": "Clear all logs?",
            "syslog.status.copied": "Copied to clipboard",
            "syslog.status.copy_failed": "Failed to copy to clipboard",
            "syslog.status.ready": "Ready",
            "syslog.status.cleared": "Cleared",
            "syslog.status.saved": "Saved",
            "syslog.status.no_content": "No log content",
            "syslog.status.auto_scroll_on": "Auto-scroll enabled",
            "syslog.status.auto_scroll_off": "Auto-scroll disabled",
            "syslog.status.http": "HTTP error:",
            "syslog.warn.1": "Logs are fetched via polling and updated automatically.",
            "syslog.warn.2": "Logs are stored in browser session storage and will be cleared when the page is closed.",
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
            "flashing.hint.continue": "Your device was successfully updated!",
            "flashing.msg.continue": "You are currently still in U-Boot Web recovery mode. Please continue with other operations or manually restart your device.",
            "booting.title.in_progress": "BOOTING INITRAMFS",
            "booting.hint.in_progress": "Your file was successfully uploaded! Booting is in progress, please wait...<br>This page may be in not responding status for a short time.",
            "booting.title.done": "BOOT SUCCESS",
            "booting.hint.done": "Your device was successfully booted into initramfs!",
            "404.title": "PAGE NOT FOUND",
            "404.hint": "The page you were looking for doesn't exist!",
            "fail.title": "UPDATE FAILED",
            "fail.hint": "Something went wrong during update. Probably you have chosen wrong file.<p>Please, try again or contact with the author of this modification. You can also get more information during update in U-Boot console.",
            "error.title": "Error",
            "error.label.file_type": "File Type",
            "error.label.file_size": "File Size",
            "error.label.part_name": "Partition Name",
            "error.label.part_size": "Partition Size",
            "error.label.expected_type": "Expected Type",
            "error.label.actual_type": "Actual Type",
            "error.label.flash_type": "Flash Type",
            "error.label.filename": "Filename",
            "error.label.cmd": "Command",
            "error.label.cmd_output": "Command Output",
            "error.no_output": "No output",
            "error.unit.bytes": "Bytes",
            "error.file_too_big": "File Too Large",
            "error.part_not_found": "Partition Not Found",
            "error.wrong_file_type": "Wrong File Type",
            "error.flash_not_found": "Flash Not Found",
            "error.run_cmd_failed": "Command Execution Failed",
            "error.invalid_response": "Invalid Server Response",
            "error.suggestion.file_too_big": "Please choose a file smaller than the partition size or expand the partition.",
            "error.suggestion.part_not_found": "The target partition does not exist or is not available.<br>Please check your device partition table or contact support.",
            "error.suggestion.wrong_file_type": "Please choose the correct file type.",
            "error.suggestion.flash_not_found": "No flash device can be found that corresponds to the selected file type.",
            "unknown": "Unknown"
        },
        "zh-cn": {
            "app.name": "uBootKit",
            "nav.overview": "概览",
            "nav.sysinfo": "系统信息",
            "nav.syslog": "系统日志",
            "nav.update": "更新",
            "nav.firmware": "固件更新",
            "nav.art": "ART 更新",
            "nav.cdt": "CDT 更新",
            "nav.ptable": "分区表更新",
            "nav.simg": "闪存镜像更新",
            "nav.uboot": "U-Boot 更新",
            "nav.debrick": "救砖",
            "nav.mibib": "MIBIB 重载",
            "nav.initramfs": "Initramfs 启动",
            "nav.system": "系统",
            "nav.settings": "主题设置",
            "nav.network": "网络设置",
            "nav.backup": "闪存备份",
            "nav.console": "网页终端",
            "nav.mac": "MAC 管理",
            "nav.env": "环境变量",
            "nav.reboot": "重启",
            "title.author": "查看作者主页",
            "title.project": "查看项目",
            "file.dropzone.text": "将文件拖拽到此处，或点击以选择文件",
            "file.dropzone.hint": "最大文件大小：取决于分区大小",
            "file.uploading": "正在上传",
            "file.processing": "处理中",
            "common.upload": "上传",
            "common.update": "更新",
            "common.update_reboot": "更新并重启",
            "common.boot": "启动",
            "common.upgrade_hint": "如果以上信息确认无误，请点击 “更新” 或 “更新并重启”。",
            "common.warnings": "注意事项",
            "common.warn.1": "刷写过程中请勿断电。",
            "common.warn.2": "如果更新成功，设备将自动重启。",
            "file.select": "请选择文件！",
            "label.name": "文件",
            "label.type": "类型",
            "label.size": "大小",
            "label.md5": "MD5",
            "firmware.title": "固件更新",
            "firmware.hint": t["zh-cn"].updateHint("固件"),
            "firmware.warn.1": t["zh-cn"].warnChoose("固件"),
            "uboot.title": "U-BOOT 更新",
            "uboot.hint": t["zh-cn"].updateHint("U-Boot（引导程序）"),
            "uboot.warn.1": t["zh-cn"].warnChoose("U-Boot"),
            "uboot.warn.2": t["zh-cn"].warnDanger("U-Boot "),
            "art.title": "ART 更新",
            "art.hint": t["zh-cn"].updateHint("无线芯片频率校准数据 ART (Atheros Radio Test)"),
            "art.warn.1": "ART 无固定魔数，故其文件类型会被识别为 Unknown。",
            "art.warn.2": t["zh-cn"].warnChoose("ART"),
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
            "console.send": "发送",
            "console.clear": "清空",
            "console.cmd.forbid.hint": "此命令已被禁止执行！",
            "console.cmd.forbid.reason.common": "此命令会导致 HTTPD 服务异常退出，请勿在网页终端中使用！",
            "console.cmd.forbid.alt.tftpb": "请使用本页面提供的上传功能替代。",
            "console.cmd.nomatch": "没有匹配的命令",
            "console.cmd.placeholder": "help; printenv",
            "console.cmd.unknown": "未知命令！",
            "console.status.ready": "就绪",
            "console.status.running": "执行中...",
            "console.status.done": "完成",
            "console.status.cleared": "已清空",
            "console.status.http": "HTTP 错误：",
            "console.status.parse": "解析失败",
            "console.status.error": "错误：",
            "console.upload": "上传",
            "console.uploading": "正在上传：",
            "console.upload.success": "上传成功",
            "env.title": "U-BOOT 环境变量",
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
            "mac.title": "MAC 地址管理",
            "mac.hint": "查看和修改设备的 <strong>MAC 地址</strong>。",
            "mac.no_data": "暂无 MAC 地址数据",
            "mac.label.part_name": "MAC 地址所在分区：",
            "mac.status.loading": "正在加载 MAC 地址...",
            "mac.status.ready": "就绪",
            "mac.status.saving": "保存中...",
            "mac.status.saved": "✓ MAC 地址已保存",
            "mac.status.edit_mode": "编辑模式 - 修改 MAC 地址后点击保存",
            "mac.status.cancelled": "已取消编辑",
            "mac.status.http": "HTTP 错误:",
            "mac.status.error": "错误",
            "mac.error.invalid_mac": "无效的 MAC 地址格式",
            "mac.error.no_mac": "没有可保存的 MAC 地址数据",
            "mac.error.invalid_response": "无效的服务器响应",
            "mac.action.modify": "修改",
            "mac.action.save": "保存",
            "mac.action.cancel": "取消",
            "mac.warn.1": "修改前请先使用分区备份功能备份 MAC 地址所在分区。",
            "mac.warn.2": "这些只是分区中的原始 MAC 数据，是否使用及如何使用均由固件决定。",
            "mac.warn.3": "修改后需重置或重刷固件才能识别修改后的 MAC 地址。",
            "mac.warn.4": "无效的 MAC 地址可能导致网络问题。",
            "mibib.title": "MIBIB 重载",
            "mibib.hint": "在 <strong>9008</strong> 模式下，通过重载 <strong>MIBIB</strong> 来初始化 <strong>SMEM (Shared Memory) 分区信息</strong>。<br>请选择本地文件并点击 <strong>重载</strong> 按钮。",
            "mibib.reload": "重载",
            "mibib.reload_success_hint": "MIBIB 重载成功，请点击下方按钮跳转到 “系统信息” 页面查看 SMEM 相关信息是否正确。",
            "mibib.reload_success": "查看系统信息",
            "mibib.not_9008": "非 9008 启动模式，无法进行 MIBIB 重载！",
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
            "settings.title": "设置",
            "settings.hint": "配置 <strong>应用偏好</strong>，包括语言和主题。",
            "settings.label.language": "语言",
            "settings.label.theme": "主题",
            "settings.theme.auto": "自动",
            "settings.theme.light": "亮色",
            "settings.theme.dark": "暗色",
            "settings.warn.1": "语言和主题设置保存在浏览器的本地存储中。",
            "settings.warn.2": "主题更改立即生效，自动模式跟随系统偏好。",
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
            "syslog.title": "系统日志",
            "syslog.copy": "复制",
            "syslog.clear": "清空",
            "syslog.save": "保存",
            "syslog.auto_scroll": "自动滚动",
            "syslog.confirm.clear": "是否清空所有日志？",
            "syslog.status.copied": "已复制到剪贴板",
            "syslog.status.copy_failed": "复制到剪贴板失败",
            "syslog.status.ready": "就绪",
            "syslog.status.cleared": "已清空",
            "syslog.status.saved": "保存完成",
            "syslog.status.no_content": "无日志内容",
            "syslog.status.auto_scroll_on": "自动滚动已开启",
            "syslog.status.auto_scroll_off": "自动滚动已关闭",
            "syslog.status.http": "HTTP 错误：",
            "syslog.warn.1": "日志通过轮询方式获取并自动更新。",
            "syslog.warn.2": "日志保存在浏览器会话存储中，关闭页面后将清空。",
            "reboot.confirm": "确认立即重启设备？",
            "reboot.title.in_progress": "正在重启设备",
            "reboot.hint.in_progress": "已发送重启请求，请稍候…<br>该页面短时间可能显示无响应，这是正常现象。",
            "initramfs.title": "INITRAMFS 启动",
            "initramfs.hint": "你将要在此设备上启动 <strong>Initramfs（内存固件）<\/strong>。<br>请选择本地文件并点击 <strong>上传<\/strong> 按钮。",
            "initramfs.boot_hint": "如果以上信息确认无误，请点击 “启动”。",
            "initramfs.warn.1": "如果一切顺利，设备将启动至内存固件。",
            "initramfs.warn.2": t["zh-cn"].warnChoose("内存固件"),
            "flashing.title.in_progress": "正在刷写",
            "flashing.hint.in_progress": "文件上传成功！正在执行刷写，请等待设备自动重启。<br>刷写时间取决于镜像大小，可能需要几分钟。",
            "flashing.title.done": "刷写完成",
            "flashing.hint.done": "设备已成功更新！正在重启…",
            "flashing.hint.continue": "设备已成功更新！",
            "flashing.msg.continue": "当前仍处于 U-Boot Web 恢复模式，请继续执行其他操作或手动重启设备。",
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
            "error.title": "错误",
            "error.label.file_type": "文件类型",
            "error.label.file_size": "文件大小",
            "error.label.part_name": "分区名称",
            "error.label.part_size": "分区大小",
            "error.label.expected_type": "期望类型",
            "error.label.actual_type": "实际类型",
            "error.label.flash_type": "闪存类型",
            "error.label.filename": "文件名",
            "error.label.cmd": "命令",
            "error.label.cmd_output": "命令输出",
            "error.no_output": "无输出",
            "error.unit.bytes": "字节",
            "error.file_too_big": "文件过大",
            "error.part_not_found": "找不到分区",
            "error.wrong_file_type": "文件类型错误",
            "error.flash_not_found": "找不到闪存",
            "error.run_cmd_failed": "命令执行失败",
            "error.invalid_response": "无效的服务器响应",
            "error.suggestion.file_too_big": "请选择小于分区大小的文件或扩容分区。",
            "error.suggestion.part_not_found": "目标分区不存在或不可用。<br>请检查设备分区表或联系技术支持。",
            "error.suggestion.wrong_file_type": "请选择正确的文件类型。",
            "error.suggestion.flash_not_found": "找不到与所选文件类型对应的闪存设备。",
            "unknown": "未知"
        }
    };
})();
