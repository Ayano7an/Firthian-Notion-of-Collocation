import { App, ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { Chart } from 'chart.js/auto';
import WordCloud from 'wordcloud';

const VIEW_TYPE_STATS = "desktop-stats-view";

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
    const trendData: Record<string, number> = {};

    for (const file of files) {
        let noteDate = parseMessyDate(file.basename);
        if (!noteDate) {
            const createTime = new Date(file.stat.ctime);
            noteDate = createTime.toISOString().split('T')[0];
        }
        trendData[noteDate] = (trendData[noteDate] || 0) + 1;

        const content = await app.vault.cachedRead(file);
        const cleanText = content
            .replace(/```[\s\S]*?```/g, '')
            .replace(/---[\s\S]*?---/, '')
            .replace(/[#*`>\[\]()]/g, '');

        const words = cleanText.match(/[\u4e00-\u9fa5]{2,}|\b[a-zA-Z]{3,}\b/g) || [];
        for (const word of words) {
            const w = word.toLowerCase();
            wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
        }
    }

    const sortedDates = Object.keys(trendData).sort();
    return {
        chartLabels: sortedDates,
        chartValues: sortedDates.map(date => trendData[date]),
        sortedWords: Array.from(wordCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 100) // 取前100个词
    };
}

// --- 桌面端视图 ---
class DesktopStatsView extends ItemView {
    chartInstance: any = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_TYPE_STATS; }
    getDisplayText() { return "桌面端看板"; }
    getIcon() { return "monitor"; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stats-dashboard-container');

        const headerDiv = container.createDiv({ cls: 'stats-header-row' });
        headerDiv.createEl("h2", { text: "知识全景洞察", cls: 'stats-title' });
        const refreshBtn = headerDiv.createEl("button", { text: "重新抓取数据", cls: 'stats-refresh-btn' });
        
        const contentWrapper = container.createDiv({ cls: 'stats-content-wrapper' });

        // 左侧面板
        const chartDiv = contentWrapper.createDiv({ cls: 'panel-container' });
        chartDiv.createEl("h3", { text: "产出趋势 (按日)", cls: 'stats-subtitle' });
        const chartWrapper = chartDiv.createDiv({ cls: 'canvas-wrapper' });
        const chartCanvas = chartWrapper.createEl("canvas", { attr: { id: "trend-chart" } });
        
        // 右侧面板
        const wordDiv = contentWrapper.createDiv({ cls: 'panel-container' });
        wordDiv.createEl("h3", { text: "核心热词分布", cls: 'stats-subtitle' });
        const wordWrapper = wordDiv.createDiv({ cls: 'canvas-wrapper' });
        const wordCloudCanvas = wordWrapper.createEl("canvas", { attr: { id: "word-cloud" } });

        const renderData = async () => {
            refreshBtn.innerText = "数据计算中...";
            refreshBtn.disabled = true;
            
            const { chartLabels, chartValues, sortedWords } = await analyzeVaultData(this.app);

            // 1. 渲染趋势图
            if (this.chartInstance) this.chartInstance.destroy();
            this.chartInstance = new Chart(chartCanvas, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: '笔记新增量',
                        data: chartValues,
                        borderColor: '#4f46e5', 
                        backgroundColor: 'rgba(79, 70, 229, 0.15)',
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { 
                        x: { display: true },
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    } 
                }
            });

            // 2. 渲染词云（防爆改版）
            // 计算最高频词的次数，用于按比例缩放
            const maxFreq = sortedWords.length > 0 ? sortedWords[0][1] : 1;
            
            // 确保 Canvas 元素的内部渲染尺寸和外部容器一致
            wordCloudCanvas.width = wordWrapper.clientWidth;
            wordCloudCanvas.height = wordWrapper.clientHeight;

            WordCloud(wordCloudCanvas, {
                list: sortedWords,
                gridSize: 8, // 缩小网格让排版更紧密
                weightFactor: function (size) { 
                    // 动态比例尺：无论最高频次是 5 还是 5000，字号都被限制在 12px ~ 65px 之间
                    const normalized = size / maxFreq;
                    return (normalized * 50) + 12; 
                }, 
                fontFamily: 'Inter, "PingFang SC", sans-serif',
                color: 'random-dark',
                rotateRatio: 0,
                shrinkToFit: true, // 核心属性：如果字太大放不下，强制缩小
                drawOutOfBound: false, // 核心属性：绝对不允许画出框外
                backgroundColor: 'transparent'
            });

            refreshBtn.innerText = "重新抓取数据";
            refreshBtn.disabled = false;
        };

        refreshBtn.addEventListener('click', renderData);
        // 稍微延迟渲染，等待 CSS 布局完成获取真实宽高
        setTimeout(renderData, 100); 
    }
}

export default class DesktopStatsPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_STATS, (leaf) => new DesktopStatsView(leaf));
        this.addRibbonIcon('monitor', '打开桌面端看板', () => {
            this.activateView();
        });
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_STATS)[0];
        if (!leaf) {
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({ type: VIEW_TYPE_STATS, active: true });
        }
        workspace.revealLeaf(leaf);
    }
}
