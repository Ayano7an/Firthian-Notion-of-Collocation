import { App, ItemView, Plugin, WorkspaceLeaf, Modal, Notice } from 'obsidian';
import * as d3 from 'd3'; 

const VIEW_TYPE_STATS_HEATMAP = "desktop-stats-heatmap-view";

// --- 基础虚词过滤库 ---
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'https', 'com', 'org', 
    'www', 'are', 'can', 'not', 'you', 'your', 'have', 'was', 'but', 'all', 
    'what', 'http', 'html', 'file', 'png', 'jpg', 'out', 'has', 'will', 'use',
    'which', 'when', 'more', 'about', 'their', 'there', 'some'
]);

// --- 日期解析引擎 (恢复保留，确保你的历史文件名能被正确读取) ---
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
        // 解析日期
        let noteDateStr = parseMessyDate(file.basename);
        if (!noteDateStr) {
            const createTime = new Date(file.stat.ctime);
            noteDateStr = createTime.toISOString().split('T')[0];
        }
        dateTrend.set(noteDateStr, (dateTrend.get(noteDateStr) || 0) + 1);

        // 词频分析
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

    // 处理热力图数据
    const heatmapData = Array.from(dateTrend.entries()).map(([dateStr, count]) => {
        return { date: new Date(dateStr), count: count };
    });

    return {
        // 热力词汇数据：只取频率最高的 100 个
        heatmapWords: Array.from(wordCounts.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 100)
                            .map(([word, value]) => ({ word, value })),
        // 热力图数据
        heatmapData: heatmapData
    };
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
        
        // 模态框标题
        contentEl.createEl("h2", { 
            text: "核心概念热力矩阵", 
            attr: { style: "text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 600; margin-bottom: 24px;" } 
        });

        // 词汇容器
        const wordsContainer = contentEl.createDiv({ 
            attr: { style: "display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 10px;" } 
        });
        
        const maxCount = this.words.length > 0 ? this.words[0].value : 1;
        
        // 使用科技蓝色系插值算法
        const colorScale = d3.scaleSequential()
                             .domain([0, maxCount])
                             .interpolator(d3.interpolateBlues); 

        this.words.forEach(({word, value}) => {
            const wordEl = wordsContainer.createDiv();
            wordEl.setText(word);
            
            // 动态计算背景色与字体对比度，圆角胶囊样式
            const bgColor = colorScale(value);
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
    getIcon() { return "heatmap"; } // 匹配新图标

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stats-dashboard-container');

        const headerDiv = container.createDiv({ cls: 'stats-header-row' });
        headerDiv.createEl("h2", { text: "知识资产全景热力", cls: 'stats-title' });
        const refreshBtn = headerDiv.createEl("button", { text: "重新抓取数据", cls: 'stats-refresh-btn' });
        
        const contentWrapper = container.createDiv({ cls: 'stats-content-wrapper' });

        // 热力图容器 (独占空间)
        const heatmapDiv = contentWrapper.createDiv({ cls: 'panel-container', attr: { style: 'flex: 1;' } });
        heatmapDiv.createEl("h3", { text: "笔记产出活跃度", cls: 'stats-subtitle' });
        const heatmapWrapper = heatmapDiv.createDiv({ attr: { id: 'heatmap-container', style: 'width: 100%; height: 100%; min-height: 250px; display: flex; justify-content: center; align-items: center;' } });

        const renderData = async () => {
            refreshBtn.innerText = "数据计算中...";
            refreshBtn.disabled = true;
            
            const { heatmapWords, heatmapData } = await analyzeVaultData(this.app);

            // 绘制 D3 热力图
            const width = heatmapWrapper.clientWidth || 800;
            const height = heatmapWrapper.clientHeight || 250;
            
            // 算法：以年为单位的 53 周 x 7 天网格
            const cellSize = Math.min(width / 55, height / 9); 

            d3.select('#heatmap-container').select('svg').remove(); 

            const svg = d3.select('#heatmap-container')
                          .append('svg')
                          .attr('width', width)
                          .attr('height', height)
                          .append('g')
                          .attr('transform', `translate(20, 20)`);

            const maxCount = d3.max(heatmapData, d => d.count) || 1;
            const colorScale = d3.scaleSequential()
                                 .domain([0, maxCount])
                                 .interpolator(d3.interpolateBlues); // 苹果蓝热力色

            // 绘制方块
            svg.selectAll('rect')
               .data(heatmapData)
               .enter()
               .append('rect')
               .attr('x', d => d3.timeWeek.count(d3.timeYear(d.date), d.date) * (cellSize + 4))
               .attr('y', d => d.date.getDay() * (cellSize + 4))
               .attr('width', cellSize)
               .attr('height', cellSize)
               .attr('fill', d => colorScale(d.count))
               .attr('rx', 4) // 圆润的 R 角
               .attr('ry', 4)
               .style('stroke', 'rgba(0,0,0,0.05)') // 微妙的边框增加质感
               .style('stroke-width', '1px')
               .append('title')
               .text(d => `${d.date.toISOString().split('T')[0]}: 产出 ${d.count} 篇`);

            refreshBtn.innerText = "重新抓取数据";
            refreshBtn.disabled = false;

            // 渲染完毕后自动弹出热力词 Modal
            new WordHeatmapModal(this.app, heatmapWords).open();
        };

        refreshBtn.addEventListener('click', renderData);
        setTimeout(renderData, 150); 
    }
}

// --- 插件主入口：包含终极防崩溃生命周期管理 ---
export default class DesktopStatsPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_STATS_HEATMAP, (leaf) => new DesktopStatsHeatmapView(leaf));
        this.addRibbonIcon('heatmap', '打开产出热力看板', () => {
            this.activateView();
        });
    }

    // 关键修正：插件卸载/重载时强制清空旧视图，彻底消灭 "插件不再活动" 报错
    async onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_STATS_HEATMAP);
    }

    async activateView() {
        const { workspace } = this.app;
        
        // 强力清理：检索所有相关标签页并销毁，防止冲突
        let existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_STATS_HEATMAP);
        for (let i = 1; i < existingLeaves.length; i++) {
            existingLeaves[i].detach(); 
        }

        let leaf = existingLeaves.length > 0 ? existingLeaves[0] : null;

        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_STATS_HEATMAP, active: true });
        }
        
        workspace.revealLeaf(leaf);
    }
}
