import { App, ItemView, Plugin, WorkspaceLeaf, Modal, Notice } from 'obsidian';
import WordCloud from 'wordcloud';

const VIEW_TYPE_STATS_HEATMAP = "desktop-stats-heatmap-view";

// --- 基础虚词过滤库 ---
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'https', 'com', 'org', 
    'www', 'are', 'can', 'not', 'you', 'your', 'have', 'was', 'but', 'all', 
    'what', 'http', 'html', 'file', 'png', 'jpg', 'out', 'has', 'will', 'use',
    'which', 'when', 'more', 'about', 'their', 'there', 'some'
]);

// --- 日期解析引擎 ---
function parseMessyDate(dateStr: string): string | null {
    const cleanStr = dateStr.replace(/[^\d./-]/g, '');
    let match = cleanStr.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
    if (match) return formatStandardDate(match[1], match[2], match[3]);
    match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) return formatStandardDate(match[1], match[2], match[3]);
    match = cleanStr.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (match) return formatStandardDate(`20${match[1]}`, match[2], match[3]);
    match = cleanStr.match(/^(\d{2})(\d{1})(\d{1})$/);
    if (match) return formatStandardDate(`20${match[1]}`, match[2], match[3]);
    match = cleanStr.match(/^(\d{2})(\d{1,2})(\d{1,2})$/);
    if (match && cleanStr.length === 5) {
        const monthDouble = parseInt(cleanStr.substring(2, 4));
        if (monthDouble >= 10 && monthDouble <= 12) {
            return formatStandardDate(`20${match[1]}`, cleanStr.substring(2, 4), cleanStr.substring(4, 5));
        }
        return formatStandardDate(`20${match[1]}`, cleanStr.substring(2, 3), cleanStr.substring(3, 5));
    }
    return null; 
}

function formatStandardDate(year: string, month: string, day: string): string {
    const y = year.length === 2 ? `20${year}` : year;
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// --- 数据分析引擎 ---
async function analyzeVaultData(app: App) {
    const files = app.vault.getMarkdownFiles();
    const wordCounts = new Map<string, number>();
    const dateTrend = new Map<string, number>(); 

    for (const file of files) {
        let noteDateStr = parseMessyDate(file.basename);
        if (!noteDateStr) {
            const createTime = new Date(file.stat.ctime);
            noteDateStr = createTime.toISOString().split('T')[0];
        }
        dateTrend.set(noteDateStr, (dateTrend.get(noteDateStr) || 0) + 1);

        const content = await app.vault.cachedRead(file);
        const cleanText = content
            .replace(/```[\s\S]*?```/g, '') 
            .replace(/---[\s\S]*?---/, '')  
            .replace(/[#*`>\[\]()]/g, '');  

        const words = cleanText.match(/[\u4e00-\u9fa5]{2,}|\b[a-zA-Z]{3,}\b/g) || [];
        for (const word of words) {
            const w = word.toLowerCase();
            if (!STOP_WORDS.has(w)) {
                wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
            }
        }
    }

    return {
        heatmapWords: Array.from(wordCounts.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 100)
                            .map(([word, value]) => ({ word, value })),
        dateTrend: dateTrend
    };
}

// --- 纯原生计算颜色引擎 ---
function getHeatmapColor(value: number, max: number): string {
    if (value === 0) return 'rgba(142, 142, 147, 0.08)'; // 空白状态，极淡的灰色
    const ratio = Math.min(value / max, 1);
    // 苹果系统蓝色 (0, 122, 255) 动态透明度
    const opacity = 0.25 + (ratio * 0.75); 
    return `rgba(0, 122, 255, ${opacity})`;
}

// --- 热力词 Modal 组件 ---
class WordHeatmapModal extends Modal {
    words: {word: string, value: number}[];
    
    constructor(app: App, words: {word: string, value: number}[]) {
        super(app);
        this.words = words;
    }

    onOpen() {
        let { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { 
            text: "核心概念热力矩阵", 
            attr: { style: "text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 600; margin-bottom: 24px;" } 
        });

        const wordsContainer = contentEl.createDiv({ 
            attr: { style: "display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; padding: 10px;" } 
        });
        
        const maxCount = this.words.length > 0 ? this.words[0].value : 1;

        this.words.forEach(({word, value}) => {
            const wordEl = wordsContainer.createDiv();
            wordEl.setText(word);
            
            const bgColor = getHeatmapColor(value, maxCount);
            const textColor = value > maxCount * 0.4 ? '#ffffff' : '#333333';
            
            wordEl.setAttr("style", `
                background-color: ${bgColor}; 
                color: ${textColor}; 
                padding: 6px 14px; 
                border-radius: 16px; 
                font-size: ${Math.max(12, Math.min(24, 12 + (value/maxCount)*12))}px;
                font-weight: 500;
                cursor: pointer;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                border: 1px solid rgba(0,0,0,0.05);
            `);
            
            wordEl.addEventListener('mouseenter', () => {
                wordEl.style.transform = 'translateY(-2px)';
                wordEl.style.boxShadow = '0 4px 12px rgba(0, 122, 255, 0.2)';
                new Notice(`【${word}】: 出现 ${value} 次`);
            });
            
            wordEl.addEventListener('mouseleave', () => {
                wordEl.style.transform = 'translateY(0)';
                wordEl.style.boxShadow = 'none';
            });
        });
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}

// --- 桌面端视图 ---
class DesktopStatsHeatmapView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_TYPE_STATS_HEATMAP; }
    getDisplayText() { return "知识热力看板"; }
    getIcon() { return "heatmap"; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stats-dashboard-container');

        const headerDiv = container.createDiv({ cls: 'stats-header-row' });
        headerDiv.createEl("h2", { text: "知识资产全景热力", cls: 'stats-title' });
        const refreshBtn = headerDiv.createEl("button", { text: "重新抓取数据", cls: 'stats-refresh-btn' });
        
        const contentWrapper = container.createDiv({ cls: 'stats-content-wrapper' });

        const heatmapDiv = contentWrapper.createDiv({ cls: 'panel-container', attr: { style: 'flex: 1;' } });
        heatmapDiv.createEl("h3", { text: "近一年产出活跃度", cls: 'stats-subtitle' });
        
        // 原生 DOM 热力图容器
        const heatmapWrapper = heatmapDiv.createDiv({ 
            attr: { style: 'display: flex; gap: 4px; overflow-x: auto; padding: 10px; width: 100%; height: 100%; align-items: center; justify-content: flex-end;' } 
        });

        const renderData = async () => {
            refreshBtn.innerText = "数据计算中...";
            refreshBtn.disabled = true;
            heatmapWrapper.empty();
            
            const { heatmapWords, dateTrend } = await analyzeVaultData(this.app);

            // 1. 纯原生绘制 Github 风格热力图
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(endDate.getFullYear() - 1); // 往前推 1 年
            startDate.setDate(startDate.getDate() - startDate.getDay()); // 对齐到周日

            const weeks: {date: string, count: number}[][] = [];
            let currentWeek: {date: string, count: number}[] = [];
            let currDate = new Date(startDate);
            let maxCount = 1;

            for (const [_, count] of dateTrend.entries()) {
                if (count > maxCount) maxCount = count;
            }

            while (currDate <= endDate) {
                const dateStr = currDate.toISOString().split('T')[0];
                const count = dateTrend.get(dateStr) || 0;
                currentWeek.push({ date: dateStr, count });

                if (currDate.getDay() === 6) { // 周六结束一周
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
                currDate.setDate(currDate.getDate() + 1);
            }
            if (currentWeek.length > 0) weeks.push(currentWeek);

            // 使用 Flex 渲染网格
            weeks.forEach(week => {
                const col = heatmapWrapper.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 4px;' } });
                week.forEach(day => {
                    const bgColor = getHeatmapColor(day.count, maxCount);
                    const cell = col.createDiv({
                        attr: {
                            style: `width: 14px; height: 14px; background-color: ${bgColor}; border-radius: 4px; cursor: pointer; transition: transform 0.1s;`
                        }
                    });
                    cell.setAttr('title', `${day.date}: 产出 ${day.count} 篇`);
                    
                    cell.addEventListener('mouseenter', () => cell.style.transform = 'scale(1.2)');
                    cell.addEventListener('mouseleave', () => cell.style.transform = 'scale(1)');
                });
            });

            refreshBtn.innerText = "重新抓取数据";
            refreshBtn.disabled = false;

            // 2. 弹出热力词
            new WordHeatmapModal(this.app, heatmapWords).open();
        };

        refreshBtn.addEventListener('click', renderData);
        setTimeout(renderData, 150); 
    }
}

// --- 插件主入口：极简稳健加载 ---
export default class DesktopStatsPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_STATS_HEATMAP, (leaf) => new DesktopStatsHeatmapView(leaf));
        
        this.addRibbonIcon('heatmap', '打开产出热力看板', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-heatmap-dashboard',
            name: '打开产出热力看板',
            callback: () => {
                this.activateView();
            }
        });
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_STATS_HEATMAP);
    }

    async activateView() {
        const { workspace } = this.app;
        
        let existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_STATS_HEATMAP);
        for (let i = 0; i < existingLeaves.length; i++) {
            existingLeaves[i].detach(); // 安全清理所有的旧视图
        }

        // 重新开启一个全新的安全视图
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: VIEW_TYPE_STATS_HEATMAP, active: true });
            workspace.revealLeaf(leaf);
        }
    }
}
