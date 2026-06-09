import { App, ItemView, Plugin, WorkspaceLeaf, Modal, Notice } from 'obsidian';
import * as d3 from 'd3'; // 请务必先运行 npm install d3 @types/d3

const VIEW_TYPE_STATS_HEATMAP = "desktop-stats-heatmap-view";

// --- 基础虚词过滤库 ---
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'https', 'com', 'org', 
    'www', 'are', 'can', 'not', 'you', 'your', 'have', 'was', 'but', 'all', 
    'what', 'http', 'html', 'file', 'png', 'jpg', 'out', 'has', 'will', 'use',
    'which', 'when', 'more', 'about', 'their', 'there', 'some'
]);

// --- 数据分析引擎 ---
async function analyzeVaultData(app: App) {
    const files = app.vault.getMarkdownFiles();
    const wordCounts = new Map<string, number>();
    const dateTrend = new Map<string, number>(); // YYYY-MM-DD

    for (const file of files) {
        // 词频分析
        const content = await app.vault.cachedRead(file);
        const cleanText = content
            .replace(/```[\s\S]*?```/g, '') // 移除代码块
            .replace(/---[\s\S]*?---/, '')  // 移除 YAML
            .replace(/[#*`>\[\]()]/g, '');  // 移除常见 Markdown 符号

        const words = cleanText.match(/[\u4e00-\u9fa5]{2,}|\b[a-zA-Z]{3,}\b/g) || [];
        for (const word of words) {
            const w = word.toLowerCase();
            if (!STOP_WORDS.has(w)) {
                wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
            }
        }

        // 笔记产出趋势数据
        const createTime = new Date(file.stat.ctime);
        const dateStr = createTime.toISOString().split('T')[0];
        dateTrend.set(dateStr, (dateTrend.get(dateStr) || 0) + 1);
    }

    // 处理热力图数据
    const heatmapData = Array.from(dateTrend.entries()).map(([date, count]) => {
        return { date: new Date(date), count: count };
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

// --- 热力词Modal ---
class WordHeatmapModal extends Modal {
    words: {word: string, value: string}[];
    constructor(app: App, words: {word: string, value: string}[]) {
        super(app);
        this.words = words;
    }

    onOpen() {
        let { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "热力词汇" });

        const wordsContainer = contentEl.createDiv({ cls: "word-heatmap-modal-container" });
        const maxCount = this.words.length > 0 ? this.words[0].value : 1;
        
        const colorScale = d3.scaleSequential()
                             .domain([0, maxCount])
                             .interpolator(d3.interpolateBlues); // 蓝热力色

        this.words.forEach(({word, value}) => {
            const wordEl = wordsContainer.createDiv({ cls: "heatmap-word-modal-item" });
            wordEl.setText(word);
            wordEl.setAttr("style", `background-color: ${colorScale(value)}; color: ${value > maxCount / 2 ? '#fff' : '#000'}`);
            
            // 添加 Notice 显示词频
            wordEl.addEventListener('mouseenter', () => {
                new Notice(`${word}: ${value} 次`);
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
    getDisplayText() { return "知识产出热力"; }
    getIcon() { return "heatmap"; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stats-heatmap-dashboard-container');

        const headerDiv = container.createDiv({ cls: 'stats-header-row' });
        headerDiv.createEl("h2", { text: "知识资产热力全景" });
        const refreshBtn = headerDiv.createEl("button", { text: "重新抓取数据" });
        
        const contentWrapper = container.createDiv({ cls: 'stats-content-wrapper' });

        // 笔记产出热力图
        const heatmapDiv = contentWrapper.createDiv({ cls: 'panel-container' });
        heatmapDiv.createEl("h3", { text: "笔记产出热力" });
        const heatmapWrapper = heatmapDiv.createDiv({ attr: { id: 'heatmap-container' } });

        const renderData = async () => {
            refreshBtn.innerText = "数据计算中...";
            refreshBtn.disabled = true;
            
            const { heatmapWords, heatmapData } = await analyzeVaultData(this.app);

            // 绘制热力图 (使用 D3.js)
            const width = heatmapWrapper.clientWidth;
            const height = heatmapWrapper.clientHeight;
            const cellSize = Math.min(width / 53, height / 7) - 2;

            d3.select('#heatmap-container').select('svg').remove(); // 清除旧图

            const svg = d3.select('#heatmap-container')
                          .append('svg')
                          .attr('width', width)
                          .attr('height', height)
                          .append('g')
                          .attr('transform', `translate(10, 10)`);

            const colorScale = d3.scaleSequential()
                                 .domain([0, d3.max(heatmapData, d => d.count)])
                                 .interpolator(d3.interpolateReds); // 红热力色

            svg.selectAll('rect')
               .data(heatmapData)
               .enter()
               .append('rect')
               .attr('x', d => d3.timeWeek.count(d3.timeYear(d.date), d.date) * (cellSize + 2))
               .attr('y', d => d.date.getDay() * (cellSize + 2))
               .attr('width', cellSize)
               .attr('height', cellSize)
               .attr('fill', d => colorScale(d.count))
               .attr('rx', 2)
               .attr('ry', 2)
               .append('title')
               .text(d => `${d.date.toISOString().split('T')[0]}: ${d.count} 篇`);

            refreshBtn.innerText = "重新抓取数据";
            refreshBtn.disabled = false;

            // 打开热力词 Modal
            new WordHeatmapModal(this.app, heatmapWords).open();
        };

        refreshBtn.addEventListener('click', renderData);
        setTimeout(renderData, 100); 
    }
}

export default class DesktopStatsPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_STATS_HEATMAP, (leaf) => new DesktopStatsHeatmapView(leaf));
        this.addRibbonIcon('heatmap', '打开产出热力看板', () => {
            this.activateView();
        });
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_STATS_HEATMAP)[0];
        if (!leaf) {
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({ type: VIEW_TYPE_STATS_HEATMAP, active: true });
        }
        workspace.revealLeaf(leaf);
    }
}
