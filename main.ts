import { App, ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { Chart } from 'chart.js/auto';
import WordCloud from 'wordcloud';

const VIEW_TYPE_STATS = "desktop-stats-view";

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
            if (!STOP_WORDS.has(w)) {
                wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
            }
        }
    }

    const sortedDates = Object.keys(trendData).sort();
    return {
        chartLabels: sortedDates,
        chartValues: sortedDates.map(date => trendData[date]),
        sortedWords: Array.from(wordCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 100) 
    };
}

// --- 桌面端视图 ---
class DesktopStatsView extends ItemView {
    chartInstance: any = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_TYPE_STATS; }
    getDisplayText() { return "数据看板"; }
    getIcon() { return "monitor"; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stats-dashboard-container');

        const headerDiv = container.createDiv({ cls: 'stats-header-row' });
        headerDiv.createEl("h2", { text: "知识资产全景透视", cls: 'stats-title' });
        const refreshBtn = headerDiv.createEl("button", { text: "重新抓取数据", cls: 'stats-refresh-btn' });
        
        const contentWrapper = container.createDiv({ cls: 'stats-content-wrapper' });

        const chartDiv = contentWrapper.createDiv({ cls: 'panel-container' });
        chartDiv.createEl("h3", { text: "产出趋势", cls: 'stats-subtitle' });
        const chartWrapper = chartDiv.createDiv({ cls: 'canvas-wrapper' });
        const chartCanvas = chartWrapper.createEl("canvas", { attr: { id: "trend-chart" } });
        
        const wordDiv = contentWrapper.createDiv({ cls: 'panel-container' });
        wordDiv.createEl("h3", { text: "核心概念网络", cls: 'stats-subtitle' });
        const wordWrapper = wordDiv.createDiv({ cls: 'canvas-wrapper' });
        const wordCloudCanvas = wordWrapper.createEl("canvas", { attr: { id: "word-cloud" } });

        const renderData = async () => {
            refreshBtn.innerText = "数据计算中...";
            refreshBtn.disabled = true;
            
            const { chartLabels, chartValues, sortedWords } = await analyzeVaultData(this.app);

            if (this.chartInstance) this.chartInstance.destroy();
            
            const ctx = (chartCanvas as HTMLCanvasElement).getContext('2d');
            
            // 1. 定义 Keynote 级别的高级渐变配色
            let lineGradient: string | CanvasGradient = '#5E5CE6';
            let fillGradient: string | CanvasGradient = 'rgba(94, 92, 230, 0.1)';

            if (ctx) {
                // 水平流光线条：青蓝 -> 靛紫 -> 玫瑰
                lineGradient = ctx.createLinearGradient(0, 0, chartWrapper.clientWidth, 0);
                lineGradient.addColorStop(0, '#32ADE6');   
                lineGradient.addColorStop(0.5, '#5E5CE6'); 
                lineGradient.addColorStop(1, '#FF2D55');   

                // 垂直冰霜填充：从深邃的靛紫淡化到完全透明
                fillGradient = ctx.createLinearGradient(0, 0, 0, chartWrapper.clientHeight);
                fillGradient.addColorStop(0, 'rgba(94, 92, 230, 0.25)'); // 降低不透明度，提升通透感
                fillGradient.addColorStop(1, 'rgba(94, 92, 230, 0.0)');
            }

            this.chartInstance = new Chart(chartCanvas as any, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: '新增笔记数',
                        data: chartValues,
                        borderColor: lineGradient, 
                        backgroundColor: fillGradient, 
                        borderWidth: 2.5, // 极度克制的细线，告别笨重
                        pointRadius: 0, 
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#FFFFFF',
                        pointBorderColor: '#5E5CE6',
                        pointBorderWidth: 2,
                        cubicInterpolationMode: 'monotone', // 防止突刺跌破底线
                        fill: true // 恢复优雅的底部填充
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 20, right: 10 } 
                    },
                    animation: {
                        duration: 1200, 
                        easing: 'easeOutQuart',
                        active: { duration: 400 }
                    },
                    interaction: { mode: 'index', intersect: false },
                    plugins: { 
                        legend: { display: false },
                        tooltip: { 
                            backgroundColor: 'rgba(28, 28, 30, 0.8)',
                            backdropFilter: 'blur(12px)',
                            padding: 12,
                            cornerRadius: 8, 
                            displayColors: false,
                            titleFont: { size: 13, weight: '600' as const, family: '-apple-system, BlinkMacSystemFont, sans-serif' },
                            bodyFont: { size: 12, family: '-apple-system, BlinkMacSystemFont, sans-serif' },
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.15)'
                        }
                    },
                    scales: { 
                        x: { 
                            display: true, 
                            border: { display: false }, 
                            grid: { display: false }, // 保持 X 轴极简无网格
                            ticks: { 
                                color: '#999999', 
                                maxRotation: 45,
                                font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 10 },
                                padding: 6
                            } 
                        },
                        y: { 
                            beginAtZero: true, 
                            border: { display: false }, 
                            grid: { 
                                color: 'rgba(142, 142, 147, 0.08)', // 几乎不可见的极淡辅助线
                                drawTicks: false, 
                                borderDash: [4, 4] 
                            }, 
                            ticks: { 
                                precision: 0, 
                                color: '#999999', 
                                padding: 12, 
                                font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 }
                            }
                        }
                    } 
                }
            });

            // 2. 词云逻辑保持不变
            const maxFreq = sortedWords.length > 0 ? sortedWords[0][1] : 1;
            wordCloudCanvas.width = wordWrapper.clientWidth;
            wordCloudCanvas.height = wordWrapper.clientHeight;
            
            const minSize = 16;
            const maxSize = 80;

            WordCloud(wordCloudCanvas, {
                list: sortedWords,
                gridSize: 10, 
                weightFactor: function (size) { 
                    const normalized = size / maxFreq;
                    return (normalized * (maxSize - minSize)) + minSize; 
                }, 
                fontFamily: 'Impact, "Arial Black", "Helvetica Neue", "PingFang SC", sans-serif',
                fontWeight: '900', 
                color: function(word: string, weight: number, fontSize: number) {
                    const opacity = 0.30 + 0.70 * ((fontSize - minSize) / (maxSize - minSize));
                    return `rgba(0, 122, 255, ${opacity})`;
                },
                rotateRatio: 0, 
                shrinkToFit: true, 
                drawOutOfBound: false, 
                backgroundColor: 'transparent'
            });

            refreshBtn.innerText = "重新抓取数据";
            refreshBtn.disabled = false;
        };

        refreshBtn.addEventListener('click', renderData);
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
