import { App, ItemView, Plugin, WorkspaceLeaf, Modal, TFile, setIcon } from 'obsidian';

const VIEW_TYPE_STATS_HEATMAP = "desktop-stats-heatmap-view";

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'https', 'com', 'org', 
    'www', 'are', 'can', 'not', 'you', 'your', 'have', 'was', 'but', 'all', 
    'what', 'http', 'html', 'file', 'png', 'jpg', 'out', 'has', 'will', 'use',
    'which', 'when', 'more', 'about', 'their', 'there', 'some', '因此', '通过',
    '可以', '一个', '没有', '我们', '什么', '这个', '如果是', '怎么', '如果',
    '可以说', '这样', '很多', '非常', '进行', '然后', '可能', '因为', '所以',
    '各位', '谢谢', '由于', '其实', '只要', '目前', '开始'
]);

interface SphereNode {
    el: HTMLElement;
    x: number;
    y: number;
    z: number;
    theta: number;
    phi: number;
    baseFontSize: number;
    baseWeight: string;
    renderState: string;
    filePaths: Set<string>;
}

// --- 物理级 3D 星系引擎 (真实阻尼 + 拖拽交互) ---
class WordSphereEngine {
    container: HTMLElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    radius: number;
    width: number = 0;
    height: number = 0;
    tags: SphereNode[] = [];
    
    // 物理交互状态
    isDragging = false;
    isHoveringNode = false; 
    previousMouseX = 0; 
    previousMouseY = 0;
    
    // 速度与摩擦力系统
    velocityX = 0.002; 
    velocityY = 0.002;
    targetMinSpeed = 0.0015; // 最终的匀速漂移速度
    friction = 0.94; // 拖拽松开后的阻尼系数

    animationFrameId: number = 0;
    isActive = true;
    resizeObserver: ResizeObserver;

    // 绑定事件引用，以便安全卸载
    private onMouseMove: (e: MouseEvent) => void;
    private onMouseUp: () => void;

    constructor(container: HTMLElement, radius: number) {
        this.container = container;
        this.radius = radius;
        
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none'; 
        this.canvas.style.zIndex = '0';
        this.container.appendChild(this.canvas);
        
        const context = this.canvas.getContext('2d');
        if (!context) throw new Error("Canvas 2D context not supported");
        this.ctx = context;

        this.handleResize();
        this.setupMouseListeners();

        // @ts-ignore
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);
    }

    private handleResize() {
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    addTag(tagEl: HTMLElement, baseFontSize: number, baseWeight: string, filePaths: Set<string>) {
        tagEl.style.position = 'absolute';
        tagEl.style.left = '50%';
        tagEl.style.top = '50%';
        tagEl.style.cursor = 'pointer';
        tagEl.style.willChange = 'transform, opacity, filter';
        tagEl.style.zIndex = '10'; 
        
        const count = this.tags.length;
        const offset = 2 / 50; 
        const increment = Math.PI * (3 - Math.sqrt(5));
        const y = ((count * offset) - 1) + (offset / 2);
        const r = Math.sqrt(1 - y * y);
        const phi = (count % 50) * increment;
        
        this.tags.push({
            el: tagEl,
            x: Math.cos(phi) * r * this.radius,
            y: y * this.radius,
            z: Math.sin(phi) * r * this.radius,
            theta: Math.atan2(Math.sin(phi) * r * this.radius, Math.cos(phi) * r * this.radius),
            phi: Math.acos(y),
            baseFontSize,
            baseWeight,
            renderState: 'normal',
            filePaths: filePaths
        });
        
        this.container.appendChild(tagEl);
    }

    private setupMouseListeners() {
        // 拖拽抓取
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.previousMouseX = e.clientX;
            this.previousMouseY = e.clientY;
            this.container.style.cursor = 'grabbing';
        });

        // 全局监听鼠标移动，防止拖拽过快脱离容器
        this.onMouseMove = (e: MouseEvent) => {
            if (!this.isDragging) return;
            const deltaX = e.clientX - this.previousMouseX;
            const deltaY = e.clientY - this.previousMouseY;
            this.previousMouseX = e.clientX;
            this.previousMouseY = e.clientY;
            
            // 将鼠标像素移动转化为三维旋转角速度 (真实拨动反馈)
            this.velocityY = deltaX * 0.006; 
            this.velocityX = -deltaY * 0.006; 
        };

        // 全局监听松开
        this.onMouseUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.container.style.cursor = 'default';
            }
        };

        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    startAnimation() {
        if (this.tags.length === 0) return;

        const getComputedColor = (cssVar: string, fallback: string) => {
            const val = getComputedStyle(document.body).getPropertyValue(cssVar).trim();
            return val || fallback;
        };

        const animate = () => {
            if (!this.isActive) return;

            // 物理反馈核心系统
            if (!this.isDragging) {
                if (this.isHoveringNode) {
                    // 悬浮在节点上时：平滑刹车，方便用户点击
                    this.velocityX *= 0.8;
                    this.velocityY *= 0.8;
                } else {
                    // 没有拖拽、没有悬停时：平滑降速至底线匀速自转
                    const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
                    if (speed > this.targetMinSpeed) {
                        this.velocityX *= this.friction; // 惯性衰减
                        this.velocityY *= this.friction;
                    } else if (speed > 0 && speed < this.targetMinSpeed) {
                        // 防止彻底停下，保持匀速漂移
                        const ratio = this.targetMinSpeed / speed;
                        this.velocityX *= ratio;
                        this.velocityY *= ratio;
                    } else if (speed === 0) {
                        // 初始保底动力
                        this.velocityX = this.targetMinSpeed;
                        this.velocityY = this.targetMinSpeed;
                    }
                }
            }

            this.ctx.clearRect(0, 0, this.width, this.height);
            const cx = this.width / 2;
            const cy = this.height / 2;

            const colorAccent = getComputedColor('--interactive-accent', '#007AFF');
            const colorNormal = getComputedColor('--text-normal', '#333333');
            const neutralLineColor = '128, 128, 128'; 

            // 应用计算出的当前速度，进行 3D 旋转变换
            const renderList = this.tags.map(tag => {
                const x1 = tag.x * Math.cos(this.velocityY) - tag.z * Math.sin(this.velocityY);
                const z1 = tag.z * Math.cos(this.velocityY) + tag.x * Math.sin(this.velocityY);
                const y1 = tag.y * Math.cos(this.velocityX) - z1 * Math.sin(this.velocityX);
                const z2 = z1 * Math.cos(this.velocityX) + tag.y * Math.sin(this.velocityX);
                
                tag.x = x1; tag.y = y1; tag.z = z2;
                return { ...tag, zRatio: tag.z / this.radius };
            }).sort((a, b) => a.z - b.z);

            // 绘制连线与中心奇点 (遵循景深)
            renderList.forEach(item => {
                if (item.z >= 0) return;
                this.drawConnectionLine(cx, cy, item, neutralLineColor, colorNormal, colorAccent);
            });

            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
            this.ctx.fillStyle = colorNormal;
            this.ctx.fill();

            renderList.forEach(item => {
                if (item.z < 0) return;
                this.drawConnectionLine(cx, cy, item, neutralLineColor, colorNormal, colorAccent);
            });

            // 更新 DOM 节点
            renderList.forEach(item => {
                const tag = item;
                const baseTransform = `translate(-50%, -50%) translate3d(${tag.x}px, ${tag.y}px, 0px)`;
                
                if (this.isHoveringNode) {
                    if (tag.renderState === 'focused') {
                        tag.el.style.opacity = '1';
                        tag.el.style.filter = 'blur(0px)';
                        tag.el.style.transform = `${baseTransform} scale(1.2)`;
                        tag.el.style.zIndex = '99999';
                        tag.el.style.color = 'var(--text-normal)';
                        tag.el.style.textShadow = '0 8px 24px rgba(0,0,0,0.1)';
                    } else if (tag.renderState === 'co-occurring') {
                        tag.el.style.opacity = '0.5';
                        tag.el.style.filter = 'blur(0px)';
                        tag.el.style.transform = `${baseTransform} scale(1)';
                        tag.el.style.zIndex = '50000';
                        tag.el.style.color = 'var(--text-muted)';
                        tag.el.style.textShadow = 'none';
                    } else {
                        tag.el.style.opacity = '0.04';
                        tag.el.style.filter = `blur(6px)`;
                        tag.el.style.transform = `${baseTransform} scale(0.9)`;
                        tag.el.style.zIndex = '10';
                        tag.el.style.color = 'var(--text-faint)';
                        tag.el.style.textShadow = 'none';
                    }
                } else {
                    let opacity = 0; let blur = 0;
                    if (item.zRatio > 0.4) {
                        opacity = 0.9; blur = 0;
                        tag.el.style.color = 'var(--text-normal)'; 
                    } else if (item.zRatio > 0) {
                        opacity = 0.4 + 0.5 * (item.zRatio / 0.4); blur = 0;
                        tag.el.style.color = 'var(--text-muted)'; 
                    } else {
                        opacity = 0.05 + 0.2 * ((item.zRatio + 1) / 1); 
                        blur = Math.min(3.5, Math.abs(item.zRatio) * 3.5); 
                        tag.el.style.color = 'var(--text-faint)';
                    }

                    const scale = (this.radius + tag.z) / (2 * this.radius); 
                    const finalScale = 0.6 + 0.55 * scale; 

                    tag.el.style.transform = `${baseTransform} scale(${finalScale})`;
                    tag.el.style.opacity = opacity.toString();
                    tag.el.style.filter = `blur(${blur}px)`;
                    tag.el.style.zIndex = Math.round(tag.z + this.radius).toString();
                }
            });

            this.animationFrameId = requestAnimationFrame(animate);
        };

        animate();
    }

    private drawConnectionLine(cx: number, cy: number, item: any, neutralRGB: string, normalColor: string, accentColor: string) {
        let lineOpacity = 0;
        let lineWidth = 0.5;
        let strokeStyle = `rgba(${neutralRGB}, `;

        if (this.isHoveringNode) {
            if (item.renderState === 'focused') {
                lineOpacity = 0.3; 
                lineWidth = 1.2;
                strokeStyle = normalColor; 
            } else if (item.renderState === 'co-occurring') {
                lineOpacity = 0.15; 
                lineWidth = 0.8;
                strokeStyle = `rgba(${neutralRGB}, `;
            } else {
                lineOpacity = 0; 
            }
        } else {
            if (item.zRatio > 0) {
                lineOpacity = 0.02 + 0.12 * item.zRatio; 
                lineWidth = 0.5 + 0.5 * item.zRatio;
            } else {
                lineOpacity = 0.02 * (1 - Math.abs(item.zRatio)); 
                lineWidth = 0.5;
            }
        }

        if (lineOpacity <= 0) return;

        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + item.x, cy + item.y);
        this.ctx.strokeStyle = strokeStyle.includes('rgba') ? `${strokeStyle}${lineOpacity})` : strokeStyle;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
    }

    destroy() {
        this.isActive = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }
}

async function analyzeVaultData(app: App) {
    const files = app.vault.getMarkdownFiles();
    const wordData = new Map<string, { count: number, files: Set<TFile> }>();

    for (const file of files) {
        const content = await app.vault.cachedRead(file);
        const cleanText = content
            .replace(/```[\s\S]*?```/g, ' ') 
            .replace(/---[\s\S]*?---/, ' ')  
            .replace(/<[^>]*>?/gm, ' ')      
            .replace(/https?:\/\/[^\s]+/g, ' ') 
            .replace(/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g, ' ') 
            .replace(/[0-9a-fA-F]{8,}/g, ' ') 
            .replace(/[^\u4e00-\u9fa5a-zA-Z]/g, ' '); 

        let segments: any[] = [];
        const IntlAny = Intl as any;
        if (IntlAny.Segmenter) {
            const segmenter = new IntlAny.Segmenter('zh-CN', { granularity: 'word' });
            const iterator = segmenter.segment(cleanText);
            segments = Array.from(iterator);
        } else {
            const fallbackWords = cleanText.match(/[\u4e00-\u9fa5]{2,}|\b[a-zA-Z]{3,}\b/g) || [];
            segments = fallbackWords.map((w: string) => ({ segment: w, isWordLike: true }));
        }

        for (const { segment, isWordLike } of segments) {
            if (!isWordLike) continue; 
            const w = segment.toLowerCase().trim();
            if (STOP_WORDS.has(w)) continue;

            const isChinese = /[\u4e00-\u9fa5]/.test(w);
            if ((isChinese && w.length >= 2) || (!isChinese && w.length >= 3 && w.length <= 20)) {
                if (!wordData.has(w)) {
                    wordData.set(w, { count: 0, files: new Set() });
                }
                const entry = wordData.get(w)!;
                entry.count++;
                entry.files.add(file);
            }
        }
    }

    return Array.from(wordData.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 45) 
                .map(([word, data]) => ({ word, value: data.count, files: Array.from(data.files) }));
}

class WordContextModal extends Modal {
    word: string; files: TFile[];
    constructor(app: App, word: string, files: TFile[]) { super(app); this.word = word; this.files = files; }

    async onOpen() {
        const { contentEl } = this; contentEl.empty();
        this.modalEl.style.cssText = 'max-width: 850px; width: 90vw; border-radius: 24px; padding: 40px; box-shadow: 0 24px 60px rgba(0,0,0,0.06);';

        contentEl.createEl('h2', { text: `「${this.word}」`, attr: { style: 'margin: 0 0 10px 0; font-size: 2em; font-weight: 850; color: var(--interactive-accent); font-family: "SF Pro Display", "PingFang SC", sans-serif; letter-spacing: -0.5px;' } });
        contentEl.createEl('p', { text: `在 ${this.files.length} 篇笔记的正文中被提及：`, attr: { style: 'margin: 0 0 28px 0; color: var(--text-muted); font-size: 1.1em;' } });

        const listContainer = contentEl.createDiv({ attr: { style: 'max-height: 62vh; overflow-y: auto; padding-right: 15px; display: flex; flex-direction: column; gap: 20px;' } });

        this.files.forEach(async (file) => {
            const content = await this.app.vault.cachedRead(file);
            const rawContent = content.replace(/\s+/g, ' '); 
            const safeWord = this.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
            const regex = new RegExp(`.{0,45}${safeWord}.{0,45}`, 'gi');
            const matches = rawContent.match(regex) || [];

            if (matches.length > 0) {
                const card = listContainer.createDiv({ attr: { style: 'background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 16px; padding: 20px; cursor: pointer; transition: all 0.2s ease;' } });
                card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--interactive-accent)'; card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.04)'; });
                card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--background-modifier-border)'; card.style.transform = 'translateY(0)'; card.style.boxShadow = 'none'; });
                card.addEventListener('click', async () => { const leaf = this.app.workspace.getLeaf(false); await leaf.openFile(file); this.close(); });

                const fileTitle = card.createEl('div', { attr: { style: 'font-weight: 800; font-size: 1.25em; margin-bottom: 16px; color: var(--text-normal); font-family: "SF Pro Text", "PingFang SC", sans-serif; display: flex; align-items: center;' } });
                const fileIconSpan = fileTitle.createEl('span', { attr: { style: 'margin-right: 8px; opacity: 0.7;' } });
                setIcon(fileIconSpan, 'document'); fileTitle.appendChild(document.createTextNode(file.basename));

                const displayMatches = matches.slice(0, 3);
                for (let match of displayMatches) {
                    const snippetDiv = card.createDiv({ attr: { style: 'font-size: 1em; color: var(--text-muted); line-height: 1.6; margin-bottom: 12px; background: var(--background-primary); padding: 10px 16px; border-radius: 10px;' } });
                    const parts = match.split(new RegExp(`(${safeWord})`, 'gi'));
                    snippetDiv.appendChild(document.createTextNode('"...'));
                    parts.forEach(part => {
                        if (part.toLowerCase() === this.word.toLowerCase()) {
                            snippetDiv.createEl('span', { text: part, attr: { style: 'color: #fff; background-color: var(--interactive-accent); padding: 2px 6px; border-radius: 6px; font-weight: bold; margin: 0 2px;' } });
                        } else { snippetDiv.appendChild(document.createTextNode(part)); }
                    });
                    snippetDiv.appendChild(document.createTextNode('..."'));
                }
            }
        });
    }
    onClose() { this.contentEl.empty(); }
}

class DesktopStatsHeatmapView extends ItemView {
    sphereEngine: WordSphereEngine | null = null;
    
    constructor(leaf: WorkspaceLeaf) { super(leaf); }
    getViewType() { return VIEW_TYPE_STATS_HEATMAP; }
    getDisplayText() { return "拓扑网络"; }
    getIcon() { return "network"; } 

    async onOpen() {
        const container = this.containerEl.children[1]; container.empty();
        container.addClass('stats-heatmap-dashboard-container');

        // 适配左侧边栏：减小内边距，使其不拥挤
        container.setAttr('style', `
            padding: 24px 16px; display: flex; flex-direction: column; height: 100%; overflow: hidden; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
            -webkit-font-smoothing: antialiased; background-color: var(--background-secondary);
        `);

        const headerDiv = container.createDiv({ 
            attr: { 
                style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0; cursor: pointer; opacity: 0.85; transition: opacity 0.2s ease;',
                title: '点击重新构建突触'
            } 
        });
        
        const titleDiv = headerDiv.createDiv({
            attr: { style: 'display: flex; align-items: center; white-space: nowrap;' }
        });
        const iconSpan = titleDiv.createEl('span', { attr: { style: 'width: 20px; height: 20px; color: var(--text-normal); margin-right: 10px; display: flex; align-items: center;' } });
        setIcon(iconSpan, 'network'); 
        
        // 适配左侧边栏：略微减小标题字号
        const titleText = titleDiv.createEl("h1", { 
            text: "拓扑网络", 
            attr: { 
                style: 'margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-normal); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;' 
            } 
        });
        
        const contentWrapper = container.createDiv({ attr: { style: 'display: flex; flex-direction: column; flex: 1; min-height: 0;' } });
        const heatmapDiv = contentWrapper.createDiv({ 
            attr: { style: 'flex: 1; display: flex; justify-content: center; align-items: center; background-color: var(--background-primary); border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.03); overflow: hidden; position: relative;' } 
        });

        const renderData = async () => {
            headerDiv.style.opacity = '0.3';
            titleText.innerText = "构建中...";
            headerDiv.style.pointerEvents = 'none';

            if (this.sphereEngine) this.sphereEngine.destroy();
            heatmapDiv.empty();
            
            const heatmapWords = await analyzeVaultData(this.app);
            const maxWordCount = heatmapWords.length > 0 ? heatmapWords[0].value : 1;

            // 适配左侧边栏：动态计算半径，确保不撑出边界，保底 90px
            const containerMinSide = Math.min(heatmapDiv.clientWidth || 250, heatmapDiv.clientHeight || 350);
            const baseRadius = Math.max((containerMinSide / 2) * 0.75, 90);

            this.sphereEngine = new WordSphereEngine(heatmapDiv, baseRadius);

            heatmapWords.forEach(({word, value, files}) => {
                const wordEl = document.createElement('div');
                wordEl.innerText = word;
                
                // 适配左侧面板：最大字号收缩，防止拥挤
                const fontSize = Math.max(12, Math.min(36, 12 + (value/maxWordCount)*24));
                const fontWeight = value > maxWordCount * 0.6 ? '800' : (value > maxWordCount * 0.3 ? '600' : '500');
                const filePaths = new Set(files.map(f => f.path));

                wordEl.setAttr("style", `
                    font-size: ${fontSize}px;
                    font-weight: ${fontWeight};
                    letter-spacing: -0.5px;
                    padding: 4px;
                    white-space: nowrap;
                    user-select: none;
                    transition: filter 0.2s, opacity 0.2s, color 0.2s; 
                    transform-origin: center center;
                `);
                
                wordEl.addEventListener('click', () => new WordContextModal(this.app, word, files).open());
                this.sphereEngine!.addTag(wordEl, fontSize, fontWeight, filePaths);
            });

            this.sphereEngine.tags.forEach(tag => {
                const node = tag;
                node.el.addEventListener('mouseenter', () => {
                    this.sphereEngine!.isHoveringNode = true;
                    this.sphereEngine!.tags.forEach(other => {
                        let isCoOccurring = false;
                        for (let p of other.filePaths) { if (node.filePaths.has(p)) { isCoOccurring = true; break; } }

                        if (other === node) other.renderState = 'focused';
                        else if (isCoOccurring) other.renderState = 'co-occurring';
                        else other.renderState = 'dimmed';
                    });
                });
                
                node.el.addEventListener('mouseleave', () => {
                    this.sphereEngine!.isHoveringNode = false;
                    this.sphereEngine!.tags.forEach(other => other.renderState = 'normal');
                });
            });

            this.sphereEngine.startAnimation();

            headerDiv.style.pointerEvents = 'auto';
            titleText.innerText = "拓扑网络";
            headerDiv.style.opacity = '0.85';
        };

        headerDiv.addEventListener('mouseenter', () => headerDiv.style.opacity = '1');
        headerDiv.addEventListener('mouseleave', () => headerDiv.style.opacity = '0.85');
        headerDiv.addEventListener('click', renderData);
        
        setTimeout(renderData, 200); 
    }

    async onClose() { if (this.sphereEngine) this.sphereEngine.destroy(); }
}

export default class DesktopStatsPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_STATS_HEATMAP, (leaf) => new DesktopStatsHeatmapView(leaf));
        this.addRibbonIcon('network', '打开拓扑网络', () => this.activateView());
        this.addCommand({ id: 'open-typographic-insights', name: '打开拓扑网络', callback: () => this.activateView() });
    }
    async onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE_STATS_HEATMAP); }
    
    async activateView() {
        const { workspace } = this.app;
        let existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_STATS_HEATMAP);
        for (let i = 0; i < existingLeaves.length; i++) existingLeaves[i].detach(); 
        
        // 核心修改：强制在左侧边栏 (LeftLeaf) 唤起界面
        const leaf = workspace.getLeftLeaf(false);
        if (leaf) { await leaf.setViewState({ type: VIEW_TYPE_STATS_HEATMAP, active: true }); workspace.revealLeaf(leaf); }
    }
}
