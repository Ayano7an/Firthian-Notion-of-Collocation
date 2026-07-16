import { App, Plugin, Modal, TFile, setIcon, PluginSettingTab, Setting } from 'obsidian';

// ── i18n ───────────────────────────────────────────────────────────────────────

const STRINGS = {
    zh: {
        settingHeading: 'Firthian Collocation 设置',
        cmdRefresh: '刷新搭配数据',
        labelDuration: '分析时间范围',
        descDuration: '仅分析最近修改的笔记。',
        optAll: '所有时间',
        opt7: '最近 7 天',
        opt30: '最近 30 天',
        opt180: '最近半年',
        opt365: '最近一年',
        labelWindow: '共现窗口大小 (±N 词)',
        descWindow: '滑动窗口半径，默认 ±5。增大窗口捕获更远的搭配关系。',
        labelTopN: '显示条数',
        descTopN: '球面最多展示的词数量。',
        labelHeight: '侧边栏高度 (px)',
        labelRole: '搭配方向',
        descRole: '悬停某词时，展示它作为左词（→右搭配）、右词（←左搭配）还是双向的搭配词。',
        optBoth: '双向',
        optW1: '作为左词（查看右搭配）',
        optW2: '作为右词（查看左搭配）',
        labelZhSW: '启用中文停用词库',
        descZhSW: 'stopwords-iso/stopwords-zh，793 词，作者 Gene Diaz (MIT)',
        labelEnSW: '启用英文停用词库',
        descEnSW: 'stopwords-iso/stopwords-en，1297 词，作者 Gene Diaz (MIT)',
        labelCustomSW: '自定义屏蔽词',
        descCustomSW: '用空格或逗号分隔，修改后立即重新分析。',
        placeholderCustomSW: '输入要屏蔽的词汇…',
        kwicWithPartner: (pivot: string, partner: string, w: number, n: number) =>
            `「${pivot}」与「${partner}」在 ±${w} 词窗口内共现，见于以下 ${n} 篇笔记：`,
        kwicSingle: (pivot: string, n: number) =>
            `「${pivot}」出现于以下 ${n} 篇笔记：`,
    },
    en: {
        settingHeading: 'Firthian Collocation Settings',
        cmdRefresh: 'Refresh collocation data',
        labelDuration: 'Analysis time range',
        descDuration: 'Only analyse notes modified within the selected period.',
        optAll: 'All time',
        opt7: 'Last 7 days',
        opt30: 'Last 30 days',
        opt180: 'Last 6 months',
        opt365: 'Last year',
        labelWindow: 'Co-occurrence window (±N tokens)',
        descWindow: 'Sliding window radius. Default ±5. Larger values capture longer-range collocations.',
        labelTopN: 'Max words shown',
        descTopN: 'Maximum number of words to display in the sphere.',
        labelHeight: 'Sidebar height (px)',
        labelRole: 'Collocation direction',
        descRole: 'When hovering a word, show collocates where it appears as the left word (→ right collocates), right word (← left collocates), or both.',
        optBoth: 'Both directions',
        optW1: 'As left word (show right collocates)',
        optW2: 'As right word (show left collocates)',
        labelZhSW: 'Enable Chinese stopword list',
        descZhSW: 'stopwords-iso/stopwords-zh, 793 words, by Gene Diaz (MIT)',
        labelEnSW: 'Enable English stopword list',
        descEnSW: 'stopwords-iso/stopwords-en, 1297 words, by Gene Diaz (MIT)',
        labelCustomSW: 'Custom stopwords',
        descCustomSW: 'Separate with spaces or commas. Changes take effect immediately.',
        placeholderCustomSW: 'Enter words to suppress…',
        kwicWithPartner: (pivot: string, partner: string, w: number, n: number) =>
            `"${pivot}" and "${partner}" co-occur within a ±${w}-token window in ${n} note${n !== 1 ? 's' : ''}:`,
        kwicSingle: (pivot: string, n: number) =>
            `"${pivot}" appears in ${n} note${n !== 1 ? 's' : ''}:`,
    },
    de: {
        settingHeading: 'Firthian Collocation Einstellungen',
        cmdRefresh: 'Kollokationsdaten aktualisieren',
        labelDuration: 'Analysezeitraum',
        descDuration: 'Nur Notizen analysieren, die im gewählten Zeitraum geändert wurden.',
        optAll: 'Gesamter Zeitraum',
        opt7: 'Letzte 7 Tage',
        opt30: 'Letzte 30 Tage',
        opt180: 'Letzte 6 Monate',
        opt365: 'Letztes Jahr',
        labelWindow: 'Kookkurrenzfenster (±N Tokens)',
        descWindow: 'Radius des gleitenden Fensters. Standard ±5. Größere Werte erfassen weitreichendere Kollokationen.',
        labelTopN: 'Maximale Wortanzahl',
        descTopN: 'Maximale Anzahl der im Wortsphäre angezeigten Wörter.',
        labelHeight: 'Seitenleistenhöhe (px)',
        labelRole: 'Kollokationsrichtung',
        descRole: 'Bei Mouseover: Kollokate anzeigen, bei denen das Wort links steht (→ rechte Kollokate), rechts steht (← linke Kollokate) oder beides.',
        optBoth: 'Beide Richtungen',
        optW1: 'Als linkes Wort (rechte Kollokate anzeigen)',
        optW2: 'Als rechtes Wort (linke Kollokate anzeigen)',
        labelZhSW: 'Chinesische Stoppwortliste aktivieren',
        descZhSW: 'stopwords-iso/stopwords-zh, 793 Wörter, von Gene Diaz (MIT)',
        labelEnSW: 'Englische Stoppwortliste aktivieren',
        descEnSW: 'stopwords-iso/stopwords-en, 1297 Wörter, von Gene Diaz (MIT)',
        labelCustomSW: 'Eigene Stoppwörter',
        descCustomSW: 'Mit Leerzeichen oder Kommas trennen. Änderungen werden sofort übernommen.',
        placeholderCustomSW: 'Wörter zum Ausblenden eingeben…',
        kwicWithPartner: (pivot: string, partner: string, w: number, n: number) =>
            `„${pivot}" und „${partner}" kookkurrieren in einem ±${w}-Token-Fenster in ${n} Notiz${n !== 1 ? 'en' : ''}:`,
        kwicSingle: (pivot: string, n: number) =>
            `„${pivot}" erscheint in ${n} Notiz${n !== 1 ? 'en' : ''}:`,
    },
} as const;

type Lang = keyof typeof STRINGS;

function detectLang(): Lang {
    const raw = (window as unknown as { localStorage: Storage }).localStorage
        ?.getItem('language') ?? '';
    if (raw.startsWith('de')) return 'de';
    if (raw.startsWith('zh') || raw === '') {
        // Obsidian stores 'zh' or 'zh-TW'; fall back to zh as default
        return raw.startsWith('zh') ? 'zh' : 'zh';
    }
    return 'en';
}

const t = STRINGS[detectLang()];

// Stopwords (zh & en) from stopwords-iso by Gene Diaz (https://github.com/genediazjr), MIT License
// https://github.com/stopwords-iso/stopwords-zh
// https://github.com/stopwords-iso/stopwords-en
const STOPWORDS_ZH = new Set(`、。〈〉《》一一个一些一何一切一则一方面一旦一来一样一种一般一转眼七万一三上上下下不仅不但不光不单不只不外乎不如不妨不尽不尽然不得不怕不惟不成不拘不料不是不比不然不特不独不管不至于不若不论不过不问与与其与其说与否与此同时且且不说且说两者个个别中临为为了为什么为何为止为此为着乃乃至乃至于么之之一之所以之类乌乎乎乘九也也好也罢了二二来于于是于是乎云云云尔五些亦人人们人家什什么什么样今介于仍仍旧从从此从而他他人他们他们们以以上以为以便以免以及以故以期以来以至以至于以致们任任何任凭会似的但但凡但是何何以何况何处何时余外作为你你们使使得例如依依据依照便于俺俺们倘倘使倘或倘然倘若借借傥然假使假如假若做像儿先不先光光是全体全部八六兮共关于关于具体地说其其一其中其二其他其余其它其次具体地说具体说来兼之内再再其次再则再有再者再者说再说冒冲况且几几时凡凡是凭凭借出于出来分分别则则甚别别人别处别是别的别管别说到前后前此前者加之加以区即即令即使即便即如即或即若却去又又及及及其及至反之反而反过来反过来说受到另另一方面另外另悉只只当只怕只是只有只消只要只限叫叮咚可可以可是可见各各个各位各种各自同同时后后者向向使向着吓吗否则吧吧哒含吱呀呃呕呗呜呜呼呢呵呵呵呸呼哧咋和咚咦咧咱咱们咳哇哈哈哈哉哎哎呀哎哟哗哟哦哩哪哪个哪些哪儿哪天哪年哪怕哪样哪边哪里哼哼唷唉唯有啊啐啥啦啪达啷当喂喏喔唷喽嗡嗡嗡嗬嗯嗳嘎嘎登嘘嘛嘻嘿嘿嘿四因因为因了因此因着因而固然在在下在于地基于处在多多么多少大大家她她们好如如上如上所述如下如何如其如同如是如果如此如若始而孰料孰知宁宁可宁愿宁肯它它们对对于对待对方对比将小尔尔后尔尔尚且就就是就是了就是说就算就要尽尽管尽管如此岂但己已已矣巴巴巴年并并且庶乎庶几开外开始归归齐当当地当然当着彼彼时彼此往待很得得了怎怎么怎么办怎么样怎奈怎样总之总的来看总的来说总的说来总而言之恰恰相反您惟其慢说我我们或或则或是或曰或者截至所所以所在所幸所有才才能打打从把抑或拿按按照换句话说换言之据据此接着故故此故而旁人无无宁无论既既往既是既然日时时候是是以是的更曾替替代最月有有些有关有及有时有的望朝朝着本本人本地本着本身来来着来自来说极了果然果真某某个某些某某根据欤正值正如正巧正是此此地此处此外此时此次此间毋宁每每当比比及比如比方没奈何沿沿着漫说点焉然则然后然而照照着犹且犹自甚且甚么甚或甚而甚至甚至于用用来由由于由是由此由此可见的的确的话直到相对而言省得看眨眼着着呢矣矣乎矣哉离秒称竟而第等等到等等简言之管类如紧接着纵纵令纵使纵然经经过结果给继之继后继而综上所述罢了者而而且而况而后而外而已而是而言能能否腾自自个儿自从自各儿自后自家自己自打自身至至于至今至若致般的若若夫若是若果若非莫不然莫如莫若虽虽则虽然虽说被要要不要不是要不然要么要是譬喻譬如让许多论设使设或设若诚如诚然该说说来请诸诸位诸如谁谁人谁料谁知贼死赖以赶起起见趁趁着越是距跟较较之边过还还是还有还要这这一来这个这么这么些这么样这么点儿这些这会儿这儿这就是说这时这样这次这般这边这里进而连连同逐步通过遵循遵照那那个那么那么些那么样那些那会儿那儿那时那样那般那边那里都鄙人鉴于针对阿除除了除外除开除此之外除非随随后随时随着难道说零非非但非徒非特非独靠顺顺着首先`.split(''));

const STOPWORDS_EN = new Set(`'ll 'tis 'twas 've 10 39 a a's able ableabout about above abroad abst accordance according accordingly across act actually ad added adj adopted ae af affected affecting affects after afterwards ag again against ago ah ahead ai ain't aint al all allow allows almost alone along alongside already also although always am amid amidst among amongst amoungst amount an and announce another any anybody anyhow anymore anyone anything anyway anyways anywhere ao apart apparently appear appreciate appropriate approximately aq ar are area areas aren aren't arent arise around arpa as aside ask asked asking asks associated at au auth available aw away awfully az b ba back backed backing backs backward backwards bb bd be became because become becomes becoming been before beforehand began begin beginning beginnings begins behind being beings believe below beside besides best better between beyond bf bg bh bi big bill billion biol bj bm bn bo both bottom br brief briefly bs bt but buy bv bw by bz c c'mon c's ca call came can can't cannot cant caption case cases cause causes cc cd certain certainly cf cg ch changes ci ck cl clear clearly click cm cmon cn co co. com come comes computer con concerning consequently consider considering contain containing contains copy corresponding could could've couldn couldn't couldnt course cr cry cs cu currently cv cx cy cz d dare daren't darent date de dear definitely describe described despite detail did didn didn't didnt differ different differently directly dj dk dm do does doesn doesn't doesnt doing don don't done dont doubtful down downed downing downs downwards due during dz e each early ec ed edu ee effect eg eh eight eighty either eleven else elsewhere empty end ended ending ends enough entirely er es especially et et-al etc even evenly ever evermore every everybody everyone everything everywhere ex exactly example except f face faces fact facts fairly far farther felt few fewer ff fi fifteen fifth fifty fify fill find finds fire first five fix fj fk fm fo followed following follows for forever former formerly forth forty forward found four fr free from front full fully further furthered furthering furthermore furthers fx g ga gave gb gd ge general generally get gets getting gf gg gh gi give given gives giving gl gm gmt gn go goes going gone good goods got gotten gov gp gq gr great greater greatest greetings group grouped grouping groups gs gt gu gw gy h had hadn't hadnt half happens hardly has hasn hasn't hasnt have haven haven't havent having he he'd he'll he's hed hell hello help hence her here here's hereafter hereby herein heres hereupon hers herself herse" hes hi hid high higher highest him himself himse" his hither hk hm hn home homepage hopefully how how'd how'll how's howbeit however hr ht htm html http hu hundred i i'd i'll i'm i've i.e. id ie if ignored ii il ill im immediate immediately importance important in inasmuch inc inc. indeed index indicate indicated indicates information inner inside insofar instead int interest interested interesting interests into invention inward io iq ir is isn isn't isnt it it'd it'll it's itd itll its itself itse" ive j je jm jo join jp just k ke keep keeps kept keys kg kh ki kind km kn knew know known knows kp kr kw ky kz l la large largely last lately later latest latter latterly lb lc least length less lest let let's lets li like liked likely likewise line little lk ll long longer longest look looking looks low lower lr ls lt ltd lu lv ly m ma made mainly make makes making man many may maybe mayn't maynt mc md me mean means meantime meanwhile member members men merely mg mh microsoft might might've mightn't mightnt mil mill million mine minus miss mk ml mm mn mo more moreover most mostly move mp mq mr mrs ms msie mt mu much mug must must've mustn't mustnt mv mw mx my myself myse" mz n na name namely nay nc nd ne near nearly necessarily necessary need needed needing needn't neednt needs neither net netscape never neverf neverless nevertheless new newer newest next nf ng ni nine ninety nl no no-one nobody non none nonetheless noone nor normally nos not noted nothing notwithstanding novel now nowhere np nr nu null number numbers nz o obtain obtained obviously of off often oh ok okay old older oldest om omitted on once one one's ones only onto open opened opening opens opposite or ord order ordered ordering orders org other others otherwise ought oughtn't oughtnt our ours ourselves out outside over overall owing own p pa page pages part parted particular particularly parting parts past pe per perhaps pf pg ph pk pl place placed places please plus pm pmid pn point pointed pointing points poorly possible possibly potentially pp pr predominantly present presented presenting presents presumably previously primarily probably problem problems promptly proud provided provides pt put puts pw py q qa que quickly quite qv r ran rather rd re readily really reasonably recent recently ref refs regarding regardless regards related relatively research reserved respectively resulted resulting results right ring ro room rooms round ru run rw s sa said same saw say saying says sb sc sd se sec second secondly seconds section see seeing seem seemed seeming seems seen sees self selves sensible sent serious seriously seven seventy several sg sh shall shan't shant she she'd she'll she's shed shell shes should should've shouldn shouldn't shouldnt show showed showing shown showns shows si side sides significant significantly similar similarly since sincere site six sixty sj sk sl slightly sm small smaller smallest sn so some somebody someday somehow someone somethan something sometime sometimes somewhat somewhere soon sorry specifically specified specify specifying sr st state states still stop strongly su sub substantially successfully such sufficiently suggest sup sure sv sy system sz t t's take taken taking tc td tell ten tends test text tf tg th than thank thanks thanx that that'll that's that've thatll thats thatve the their theirs them themselves then thence there there'd there'll there're there's there've thereafter thereby thered therefore therein therell thereof therere theres thereto thereupon thereve these they they'd they'll they're they've theyd theyll theyre theyve thick thin thing things think thinks third thirty this thorough thoroughly those thou though thoughh thought thoughts thousand three throug through throughout thru thus til till tip tis tj tk tm tn to today together too took top toward towards tp tr tried tries trillion truly try trying ts tt turn turned turning turns tv tw twas twelve twenty twice two tz u ua ug uk um un under underneath undoing unfortunately unless unlike unlikely until unto up upon ups upwards us use used useful usefully usefulness uses using usually uucp uy uz v va value various vc ve versus very vg vi via viz vn vol vols vs vu w want wanted wanting wants was wasn wasn't wasnt way ways we we'd we'll we're we've web webpage website wed welcome well wells went were weren weren't werent weve wf what what'd what'll what's what've whatever whatll whats whatve when when'd when'll when's whence whenever where where'd where'll where's whereafter whereas whereby wherein wheres whereupon wherever whether which whichever while whilst whim whither who who'd who'll who's whod whoever whole wholl whom whomever whos whose why why'd why'll why's widely width will willing wish with within without won won't wonder wont words work worked working works world would would've wouldn wouldn't wouldnt ws www x y ye year years yes yet you you'd you'll you're you've youd youll young younger youngest your youre yours yourself yourselves youve yt yu z za zero zm zr`.split(' '));

// Original supplementary stopwords from the plugin author
const STOP_WORDS_EXTRA = new Set([
    'https', 'com', 'org', 'www', 'http', 'html', 'file', 'png', 'jpg',
    '因此', '通过', '可以', '一个', '没有', '我们', '什么', '这个', '如果是', '怎么', '如果',
    '可以说', '这样', '很多', '非常', '进行', '然后', '可能', '因为', '所以',
    '各位', '谢谢', '由于', '其实', '只要', '目前', '开始'
]);

function buildStopWordsSet(settings: ThoughtSynapseSettings): Set<string> {
    const combined = new Set<string>();
    if (settings.useZhStopwords) STOPWORDS_ZH.forEach(w => combined.add(w));
    if (settings.useEnStopwords) STOPWORDS_EN.forEach(w => combined.add(w));
    STOP_WORDS_EXTRA.forEach(w => combined.add(w));
    settings.customStopWords.split(/[,，\s]+/).filter(w => w.trim().length > 0).forEach(w => combined.add(w.toLowerCase().trim()));
    return combined;
}

interface SegmentData { segment: string; isWordLike: boolean; }
interface IntlSegmenter { segment(input: string): Iterable<SegmentData>; }
interface ResizeObserver { observe(target: Element): void; unobserve(target: Element): void; disconnect(): void; }

interface SphereNode {
    el: HTMLElement;
    lx: number; ly: number; lz: number;
    rx: number; ry: number; rz: number;
    vx: number; vy: number; vz: number;
    currentScale: number;
    zRatio: number;
    baseFontSize: number;
    baseWeight: string;
    renderState: string;
    filePaths: Set<string>;
}

interface CollocatePair {
    w1: string;
    w2: string;
    freq: number;
    pmi: number;
    logLikelihood: number;
    files: Set<TFile>;
}

interface ThoughtSynapseSettings {
    analyzeDuration: number;
    containerHeight: number;
    customStopWords: string;
    useZhStopwords: boolean;
    useEnStopwords: boolean;
    windowSize: number;
    topN: number;
    // 'w1': hovered word is left word → show right collocates
    // 'w2': hovered word is right word → show left collocates
    // 'both': show collocates from either direction
    collocateRole: 'w1' | 'w2' | 'both';
}

const DEFAULT_SETTINGS: ThoughtSynapseSettings = {
    analyzeDuration: 0,
    containerHeight: 400,
    customStopWords: '',
    useZhStopwords: false,
    useEnStopwords: false,
    windowSize: 5,
    topN: 50,
    collocateRole: 'both',
};

// ── Text segmentation ──────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
    const intlNs = (window as unknown as { Intl: { Segmenter: new (locale: string, opts: object) => IntlSegmenter } }).Intl;
    if (intlNs?.Segmenter) {
        const seg = new intlNs.Segmenter('zh-CN', { granularity: 'word' });
        return Array.from(seg.segment(text))
            .filter(s => s.isWordLike)
            .map(s => s.segment.toLowerCase().trim());
    }
    return (text.match(/[一-龥]{2,}|\b[a-zA-ZäöüÄÖÜß]{3,}\b/g) || []).map(w => w.toLowerCase());
}

function cleanText(content: string): string {
    return content
        .replace(/`{3}[\s\S]*?`{3}/g, ' ')
        .replace(/---[\s\S]*?---/, ' ')
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/https?:\/\/[^\s]+/g, ' ')
        .replace(/[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g, ' ')
        .replace(/[0-9a-fA-F]{8,}/g, ' ')
        .replace(/[^一-龥a-zA-ZäöüÄÖÜß]/g, ' ');
}

function isContentWord(w: string): boolean {
    const isChinese = /[一-龥]/.test(w);
    return isChinese ? w.length >= 2 : (w.length >= 3 && w.length <= 20);
}

// ── Collocation analysis ───────────────────────────────────────────────────────

function logLikelihood(o11: number, o12: number, o21: number, o22: number): number {
    const n = o11 + o12 + o21 + o22;
    const e11 = (o11 + o12) * (o11 + o21) / n;
    const e12 = (o11 + o12) * (o12 + o22) / n;
    const e21 = (o21 + o22) * (o11 + o21) / n;
    const e22 = (o21 + o22) * (o12 + o22) / n;
    const cell = (o: number, e: number) => e > 0 && o > 0 ? o * Math.log(o / e) : 0;
    return 2 * (cell(o11, e11) + cell(o12, e12) + cell(o21, e21) + cell(o22, e22));
}

async function analyzeVaultData(app: App, settings: ThoughtSynapseSettings): Promise<CollocatePair[]> {
    let files = app.vault.getMarkdownFiles();
    if (settings.analyzeDuration > 0) {
        const cutoff = Date.now() - settings.analyzeDuration * 86400000;
        files = files.filter(f => f.stat.mtime >= cutoff);
    }
    if (files.length === 0) return [];

    const stopWords = buildStopWordsSet(settings);
    const W = settings.windowSize;

    // word unigram counts and co-occurrence counts
    const unigramCount = new Map<string, number>();
    // key: `w1\tw2` (w1 < w2 lexicographically for undirected)
    const coocCount = new Map<string, number>();
    const coocFiles = new Map<string, Set<TFile>>();
    let totalTokens = 0;

    for (const file of files) {
        const content = await app.vault.cachedRead(file);
        const tokens = tokenize(cleanText(content))
            .filter(w => isContentWord(w) && !stopWords.has(w));

        tokens.forEach(w => {
            unigramCount.set(w, (unigramCount.get(w) ?? 0) + 1);
            totalTokens++;
        });

        // sliding window co-occurrence; stopwords already removed so
        // the token list is clean — window moves over content words only
        for (let i = 0; i < tokens.length; i++) {
            const w1 = tokens[i];
            for (let j = i + 1; j <= Math.min(i + W, tokens.length - 1); j++) {
                const w2 = tokens[j];
                if (w1 === w2) continue;
                const key = w1 < w2 ? `${w1}\t${w2}` : `${w2}\t${w1}`;
                coocCount.set(key, (coocCount.get(key) ?? 0) + 1);
                if (!coocFiles.has(key)) coocFiles.set(key, new Set());
                coocFiles.get(key)!.add(file);
            }
        }
    }

    const N = totalTokens;
    const results: CollocatePair[] = [];

    for (const [key, o11] of coocCount) {
        if (o11 < 2) continue; // minimum frequency filter
        const [w1, w2] = key.split('\t');
        const c1 = unigramCount.get(w1) ?? 0;
        const c2 = unigramCount.get(w2) ?? 0;

        const pmi = Math.log2((o11 / N) / ((c1 / N) * (c2 / N)));
        if (pmi < 1) continue; // filter noise: require positive association

        const o12 = c1 - o11;
        const o21 = c2 - o11;
        const o22 = N - c1 - c2 + o11;
        const ll = logLikelihood(o11, Math.max(0, o12), Math.max(0, o21), Math.max(0, o22));

        results.push({ w1, w2, freq: o11, pmi, logLikelihood: ll, files: coocFiles.get(key)! });
    }

    // sort by log-likelihood (more robust than PMI for rare pairs)
    results.sort((a, b) => b.logLikelihood - a.logLikelihood);
    return results.slice(0, settings.topN);
}

// ── KWIC Modal ─────────────────────────────────────────────────────────────────

class KWICModal extends Modal {
    pivot: string;
    partner: string | null;
    files: TFile[];
    windowSize: number;

    constructor(app: App, pivot: string, partner: string | null, files: TFile[], windowSize = 5) {
        super(app);
        this.pivot = pivot;
        this.partner = partner;
        this.files = files;
        this.windowSize = windowSize;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.addClass('ts-modal');

        const title = this.partner
            ? `「${this.pivot}」 + 「${this.partner}」`
            : `「${this.pivot}」`;
        contentEl.createEl('h2', { text: title, cls: 'ts-modal-title' });

        const subtitle = this.partner
            ? t.kwicWithPartner(this.pivot, this.partner, this.windowSize, this.files.length)
            : t.kwicSingle(this.pivot, this.files.length);
        contentEl.createEl('p', { text: subtitle, cls: 'ts-modal-subtitle' });

        const listContainer = contentEl.createDiv({ cls: 'ts-list-container' });
        const safeP = this.pivot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const safeQ = this.partner?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        for (const file of this.files) {
            const content = await this.app.vault.cachedRead(file);

            const matchingLines: { left: string; pivot: string; right: string }[] = [];
            const reP = new RegExp(safeP, 'gi');
            let m: RegExpExecArray | null;
            while ((m = reP.exec(content)) !== null) {
                if (safeQ) {
                    // check if partner appears within ±300 chars of pivot in raw text
                    // (line breaks are irrelevant — tokenizer ignores them too)
                    const start = Math.max(0, m.index - 300);
                    const end = Math.min(content.length, m.index + m[0].length + 300);
                    if (!new RegExp(safeQ, 'i').test(content.slice(start, end))) continue;
                }
                // for display: extract the line containing this pivot occurrence
                const lineStart = content.lastIndexOf('\n', m.index - 1) + 1;
                const lineEnd = content.indexOf('\n', m.index + m[0].length);
                const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
                const posInLine = m.index - lineStart;
                const ctx = 60;
                const left = line.slice(Math.max(0, posInLine - ctx), posInLine);
                const right = line.slice(posInLine + m[0].length, posInLine + m[0].length + ctx);
                matchingLines.push({ left, pivot: m[0], right });
                if (matchingLines.length >= 5) break;
            }

            if (matchingLines.length === 0) continue;

            const card = listContainer.createDiv({ cls: 'ts-card' });
            card.addEventListener('click', () => {
                void (async () => {
                    const leaf = this.app.workspace.getLeaf('tab');
                    await leaf.openFile(file);
                    this.close();
                })();
            });

            const fileTitle = card.createEl('div', { cls: 'ts-card-title' });
            const icon = fileTitle.createEl('span', { cls: 'ts-card-icon' });
            setIcon(icon, 'document');
            fileTitle.appendChild(activeDocument.createTextNode(file.basename));

            for (const { left, pivot, right } of matchingLines) {
                const row = card.createDiv({ cls: 'ts-kwic-row' });

                // helper: render text with partner word highlighted in blue
                const renderWithPartner = (el: HTMLElement, text: string, prefix = '', suffix = '') => {
                    if (prefix) el.appendChild(activeDocument.createTextNode(prefix));
                    if (safeQ) {
                        const re2 = new RegExp(`(${safeQ})`, 'gi');
                        const parts = text.split(re2);
                        parts.forEach(part => {
                            if (new RegExp(`^${safeQ}$`, 'i').test(part))
                                el.createEl('span', { text: part, cls: 'ts-kwic-partner' });
                            else
                                el.appendChild(activeDocument.createTextNode(part));
                        });
                    } else {
                        el.appendChild(activeDocument.createTextNode(text));
                    }
                    if (suffix) el.appendChild(activeDocument.createTextNode(suffix));
                };

                // show the end of the left context (closest to pivot)
                const leftTrimmed = left.length > 60 ? left.slice(left.length - 60) : left;
                const leftEl = row.createEl('span', { cls: 'ts-kwic-left' });
                renderWithPartner(leftEl, leftTrimmed, '…');

                row.createEl('span', { text: pivot, cls: 'ts-kwic-pivot' });

                const rightEl = row.createEl('span', { cls: 'ts-kwic-right' });
                renderWithPartner(rightEl, right, '', '…');
            }
        }
    }

    onClose() { this.contentEl.empty(); }
}


// ── 3D Sphere Engine ───────────────────────────────────────────────────────────

class WordSphereEngine {
    container: HTMLElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    radius: number;
    initRadius: number;
    width = 0; height = 0;
    tags: SphereNode[] = [];

    isDragging = false;
    hoveredTag: SphereNode | null = null;
    previousMouseX = 0; previousMouseY = 0;
    canvasMouseX = 0; canvasMouseY = 0;

    velocityX = 0.002; velocityY = 0.002;
    targetMinSpeed = 0.0012; friction = 0.96;
    animationFrameId = 0;
    isActive = true;
    resizeObserver: ResizeObserver | null = null;

    private onMouseMove = (e: MouseEvent) => {
        const rect = this.container.getBoundingClientRect();
        this.canvasMouseX = e.clientX - rect.left - rect.width / 2;
        this.canvasMouseY = e.clientY - rect.top - rect.height / 2;
        if (!this.isDragging) return;
        const dx = e.clientX - this.previousMouseX;
        const dy = e.clientY - this.previousMouseY;
        this.previousMouseX = e.clientX; this.previousMouseY = e.clientY;
        this.velocityY = this.velocityY * 0.6 + dx * 0.008 * 0.4;
        this.velocityX = this.velocityX * 0.6 + (-dy * 0.008) * 0.4;
    };
    private onMouseUp = () => {
        if (this.isDragging) { this.isDragging = false; this.container.removeClass('ts-cursor-grabbing'); }
    };

    constructor(container: HTMLElement, radius: number) {
        this.container = container;
        this.radius = this.initRadius = radius;
        this.canvas = activeDocument.createElement('canvas');
        this.canvas.addClass('ts-canvas');
        this.canvas.setCssStyles({ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
        this.container.appendChild(this.canvas);
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context not supported');
        this.ctx = ctx;
        this.handleResize();
        this.setupMouseListeners();
        const RO = (window as unknown as { ResizeObserver: new (cb: () => void) => ResizeObserver }).ResizeObserver;
        if (RO) { this.resizeObserver = new RO(() => this.handleResize()); this.resizeObserver.observe(this.container); }
    }

    private handleResize() {
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        let newRadius = Math.max(40, Math.min(rect.width / 2 - 20, rect.height / 2 - 20));
        if (this.radius > 0 && this.tags.length > 0 && this.radius !== newRadius) {
            const s = newRadius / this.radius;
            this.tags.forEach(t => { t.lx *= s; t.ly *= s; t.lz *= s; t.rx *= s; t.ry *= s; t.rz *= s; });
        }
        this.radius = newRadius;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr; this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width; this.height = rect.height;
    }

    addTag(el: HTMLElement, baseFontSize: number, baseWeight: string, filePaths: Set<string>) {
        el.addClass('ts-node');
        el.setCssStyles({ position: 'absolute', left: '50%', top: '50%', willChange: 'transform, opacity, filter, color' });
        const count = this.tags.length;
        const offset = 2 / 50; const increment = Math.PI * (3 - Math.sqrt(5));
        const y = (count * offset - 1) + offset / 2; const r = Math.sqrt(1 - y * y);
        const phi = (count % 50) * increment;
        const x = Math.cos(phi) * r * this.radius; const cy = y * this.radius; const z = Math.sin(phi) * r * this.radius;
        this.tags.push({ el, lx: x, ly: cy, lz: z, rx: x, ry: cy, rz: z, vx: 0, vy: 0, vz: 0, currentScale: 1, zRatio: z / this.radius, baseFontSize, baseWeight, renderState: 'normal', filePaths });
        this.container.appendChild(el);
    }

    private setupMouseListeners() {
        this.container.addEventListener('mousedown', e => {
            this.isDragging = true; this.previousMouseX = e.clientX; this.previousMouseY = e.clientY;
            this.container.addClass('ts-cursor-grabbing');
        });
        activeDocument.addEventListener('mousemove', this.onMouseMove);
        activeDocument.addEventListener('mouseup', this.onMouseUp);
    }

    startAnimation() {
        if (this.tags.length === 0) return;
        const getColor = (v: string, fb: string) => getComputedStyle(activeDocument.body).getPropertyValue(v).trim() || fb;
        const animate = () => {
            if (!this.isActive) return;
            if (!this.isDragging) {
                const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
                if (speed > this.targetMinSpeed) { this.velocityX *= this.friction; this.velocityY *= this.friction; }
                else if (speed > 0) { const r = this.targetMinSpeed / speed; this.velocityX *= r; this.velocityY *= r; }
                else { this.velocityX = this.targetMinSpeed; this.velocityY = this.targetMinSpeed; }
            }
            this.ctx.clearRect(0, 0, this.width, this.height);
            const cx = this.width / 2; const cy = this.height / 2;
            const colorNormal = getColor('--text-normal', '#333');
            const colorAccent = getColor('--interactive-accent', '#007AFF');
            const neutralRGB = '128,128,128';
            const gScale = Math.max(0.4, Math.min(this.radius / this.initRadius, 1.1));

            this.tags.forEach(tag => {
                const x1 = tag.lx * Math.cos(this.velocityY) - tag.lz * Math.sin(this.velocityY);
                const z1 = tag.lz * Math.cos(this.velocityY) + tag.lx * Math.sin(this.velocityY);
                const y1 = tag.ly * Math.cos(this.velocityX) - z1 * Math.sin(this.velocityX);
                const z2 = z1 * Math.cos(this.velocityX) + tag.ly * Math.sin(this.velocityX);
                tag.lx = x1; tag.ly = y1; tag.lz = z2;
            });

            this.tags.forEach(tag => {
                let tx = tag.lx, ty = tag.ly, tz = tag.lz;
                if (this.hoveredTag === tag) { /* stay in place */ }
                else if (this.hoveredTag) {
                    const dx = tag.lx - this.hoveredTag.rx, dy = tag.ly - this.hoveredTag.ry;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const avoidR = Math.max(25, this.radius * 1.1);
                    if (dist > 0 && dist < avoidR) {
                        const force = Math.pow((avoidR - dist) / avoidR, 2);
                        tx += (dx / dist) * force * this.radius * 1.3;
                        ty += (dy / dist) * force * this.radius * 1.3;
                        tz -= force * this.radius * 0.6;
                    }
                }
                const stiff = 0.10, damp = 0.72;
                tag.vx += (tx - tag.rx) * stiff; tag.vy += (ty - tag.ry) * stiff; tag.vz += (tz - tag.rz) * stiff;
                tag.vx *= damp; tag.vy *= damp; tag.vz *= damp;
                tag.rx += tag.vx; tag.ry += tag.vy; tag.rz += tag.vz;
                tag.zRatio = tag.rz / this.radius;
                let ts = 1;
                if (this.hoveredTag) { if (tag.renderState === 'focused') ts = 1.25; else if (tag.renderState === 'co-occurring') ts = 1; else ts = 0.85; }
                tag.currentScale += (ts - tag.currentScale) * 0.15;
            });

            const sorted = [...this.tags].sort((a, b) => a.rz - b.rz);
            sorted.forEach(item => { if (item.rz >= 0) return; this.drawLine(cx, cy, item, neutralRGB, gScale, colorNormal, colorAccent); });
            this.ctx.beginPath(); this.ctx.arc(cx, cy, Math.max(1, 2.5 * gScale), 0, Math.PI * 2);
            this.ctx.fillStyle = colorNormal; this.ctx.fill();
            sorted.forEach(item => { if (item.rz < 0) return; this.drawLine(cx, cy, item, neutralRGB, gScale, colorNormal, colorAccent); });

            sorted.forEach(tag => {
                let opacity = 0, blur = 0, color = 'var(--text-faint)';
                if (tag.zRatio > 0.6) { opacity = 0.85 + 0.15 * ((tag.zRatio - 0.6) / 0.4); blur = 0; color = 'var(--text-normal)'; }
                else if (tag.zRatio > 0) { opacity = 0.25 + 0.6 * (tag.zRatio / 0.6); blur = 0.8 * (1 - tag.zRatio / 0.6); color = 'var(--text-muted)'; }
                else { opacity = 0.03 + 0.17 * ((tag.zRatio + 1)); blur = 1.0 + Math.min(3.5, Math.abs(tag.zRatio) * 3.5); color = 'var(--text-faint)'; }
                if (this.hoveredTag) {
                    if (tag.renderState === 'focused') { opacity = 1; blur = 0; color = 'var(--text-normal)'; }
                    else if (tag.renderState === 'co-occurring') { color = 'var(--interactive-accent)'; blur = 0; opacity = Math.max(opacity, 0.6); }
                    else { blur = 4; opacity = 0.04; }
                }
                const depthScale = 0.55 + 0.6 * ((this.radius + tag.rz) / (2 * this.radius));
                const finalScale = depthScale * tag.currentScale * gScale;
                tag.el.setCssStyles({
                    transform: `translate(-50%,-50%) translate3d(${tag.rx}px,${tag.ry}px,0) scale(${finalScale})`,
                    opacity: String(opacity), color, filter: `blur(${blur}px)`,
                    zIndex: String(Math.round(tag.rz + this.radius)),
                    fontSize: `${tag.baseFontSize}px`, fontWeight: tag.baseWeight, cursor: 'pointer'
                });
            });
            this.animationFrameId = window.requestAnimationFrame(animate);
        };
        animate();
    }

    private drawLine(cx: number, cy: number, item: SphereNode, neutralRGB: string, gScale: number, _normal: string, accent: string) {
        let opacity = 0, width = 0.3;
        if (item.zRatio > 0) { opacity = 0.02 + 0.1 * item.zRatio; width = 0.3 + 0.4 * item.zRatio; }
        else { opacity = 0.02 * (1 - Math.abs(item.zRatio)); }
        width *= gScale;
        if (opacity <= 0) return;
        this.ctx.save(); this.ctx.beginPath();
        this.ctx.moveTo(cx, cy); this.ctx.lineTo(cx + item.rx, cy + item.ry);
        this.ctx.lineWidth = Math.max(0.1, width);
        if (this.hoveredTag) {
            if (item.renderState === 'focused') { this.ctx.strokeStyle = `rgb(${neutralRGB})`; this.ctx.globalAlpha = opacity * 1.5; }
            else if (item.renderState === 'co-occurring') { this.ctx.strokeStyle = accent; this.ctx.globalAlpha = opacity * 1.5; }
            else { this.ctx.globalAlpha = 0; }
        } else { this.ctx.strokeStyle = `rgb(${neutralRGB})`; this.ctx.globalAlpha = opacity; }
        if (this.ctx.globalAlpha > 0) this.ctx.stroke();
        this.ctx.restore();
    }

    destroy() {
        this.isActive = false;
        if (this.animationFrameId) window.cancelAnimationFrame(this.animationFrameId);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        activeDocument.removeEventListener('mousemove', this.onMouseMove);
        activeDocument.removeEventListener('mouseup', this.onMouseUp);
    }
}

// ── Plugin ─────────────────────────────────────────────────────────────────────

export default class CollocationsPlugin extends Plugin {
    settings: ThoughtSynapseSettings;
    injectedContainer: HTMLElement | null = null;
    sphereEngine: WordSphereEngine | null = null;
    cachedPairs: CollocatePair[] | null = null;

    async onload() {
        await this.loadSettings();

        this.app.workspace.onLayoutReady(async () => {
            this.cachedPairs = await analyzeVaultData(this.app, this.settings);
            this.ensureInjection();
            this.registerInterval(window.setInterval(() => this.ensureInjection(), 1000));
        });

        this.registerEvent(this.app.workspace.on('layout-change', () => this.ensureInjection()));

        this.addCommand({
            id: 'refresh-collocations',
            name: t.cmdRefresh,
            callback: () => { void this.refresh(); }
        });

        this.addSettingTab(new CollocationsSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async refresh() {
        this.cachedPairs = await analyzeVaultData(this.app, this.settings);
        if (this.injectedContainer) {
            this.injectedContainer.remove();
            this.injectedContainer = null;
        }
        this.ensureInjection();
    }

    onunload() {
        if (this.sphereEngine) this.sphereEngine.destroy();
        if (this.injectedContainer) this.injectedContainer.remove();
        this.cachedPairs = null;
    }

    ensureInjection() {
        if (!this.cachedPairs || this.cachedPairs.length === 0) return;
        try {
            const leaves = this.app.workspace.getLeavesOfType('file-explorer');
            if (leaves.length === 0) return;
            const navContainer = leaves[0].view.containerEl.querySelector('.nav-files-container') as HTMLElement;
            if (!navContainer) return;
            if (!this.injectedContainer) this.buildContainer();
            if (this.injectedContainer && navContainer !== this.injectedContainer.parentElement) {
                navContainer.appendChild(this.injectedContainer);
            }
        } catch (e) {
            console.error('Collocation injection error:', e);
        }
    }

    buildContainer() {
        if (!this.cachedPairs || this.cachedPairs.length === 0) return;
        if (this.sphereEngine) { this.sphereEngine.destroy(); this.sphereEngine = null; }

        this.injectedContainer = activeDocument.createElement('div');
        this.injectedContainer.addClass('ts-desktop-parasitic-container');
        this.injectedContainer.style.height = `${this.settings.containerHeight}px`;

        const sphereDiv = this.injectedContainer.createDiv({ cls: 'ts-desktop-heatmap-div' });

        // ── Build word-level index from bigram pairs ──────────────────────────
        // wordTotalFreq: aggregate freq across all bigrams the word appears in
        // wordCollocates: word → list of bigram pairs (for collocate panel)
        const wordTotalFreq = new Map<string, number>();
        const wordCollocates = new Map<string, CollocatePair[]>();

        for (const pair of this.cachedPairs) {
            for (const w of [pair.w1, pair.w2]) {
                wordTotalFreq.set(w, (wordTotalFreq.get(w) ?? 0) + pair.freq);
                if (!wordCollocates.has(w)) wordCollocates.set(w, []);
                wordCollocates.get(w)!.push(pair);
            }
        }

        const sortedWords = [...wordTotalFreq.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 45);

        const baseRadius = 120;
        this.sphereEngine = new WordSphereEngine(sphereDiv, baseRadius);

        const maxTotalFreq = sortedWords[0][1];
        const minFont = Math.max(9, baseRadius * 0.12);
        const maxFont = Math.max(16, baseRadius * 0.24);

        // ── Collocate overlay panel ───────────────────────────────────────────
        const overlay = sphereDiv.createDiv({ cls: 'ts-coloc-overlay' });
        let hoverTimeout = 0;

        const hideOverlay = () => overlay.removeClass('ts-coloc-overlay--visible');

        const showCollocates = (pivotWord: string, anchorEl: HTMLElement) => {
            const pairs = wordCollocates.get(pivotWord) ?? [];
            const role = this.settings.collocateRole;
            let relevant: CollocatePair[];
            if (role === 'w1')      relevant = pairs.filter(p => p.w1 === pivotWord);
            else if (role === 'w2') relevant = pairs.filter(p => p.w2 === pivotWord);
            else                    relevant = pairs;
            relevant = relevant.sort((a, b) => b.freq - a.freq).slice(0, 7);
            if (relevant.length === 0) { hideOverlay(); return; }

            overlay.empty();
            overlay.createEl('div', { text: pivotWord, cls: 'ts-ov-pivot' });

            relevant.forEach((pair, i) => {
                const partner = pair.w1 === pivotWord ? pair.w2 : pair.w1;
                const chip = overlay.createDiv({ cls: 'ts-ov-chip' });
                chip.style.animationDelay = `${i * 35}ms`;
                chip.createEl('span', { text: partner, cls: 'ts-ov-word' });
                chip.createEl('span', { text: String(pair.freq), cls: 'ts-ov-freq' });
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    new KWICModal(this.app, pivotWord, partner, Array.from(pair.files), this.settings.windowSize).open();
                });
            });

            // position near anchor, keep inside container
            const cRect = sphereDiv.getBoundingClientRect();
            const aRect = anchorEl.getBoundingClientRect();
            const relX = aRect.left + aRect.width / 2 - cRect.left;
            const relY = aRect.top + aRect.height / 2 - cRect.top;
            const panelW = 160;
            let left = relX + 14;
            if (left + panelW > cRect.width - 4) left = relX - panelW - 14;
            overlay.style.left = `${Math.max(4, left)}px`;
            overlay.style.top = `${Math.max(4, relY - 20)}px`;
            overlay.addClass('ts-coloc-overlay--visible');
        };

        // ── Add word nodes to sphere (only words with ≥1 bigram) ─────────────
        sortedWords.forEach(([word, totalFreq]) => {
            // skip words with no qualifying bigram pairs after filtering
            if (!(wordCollocates.get(word)?.length)) return;

            const el = activeDocument.createElement('div');
            el.innerText = word;
            const t = totalFreq / maxTotalFreq;
            const fontSize = minFont + t * (maxFont - minFont);
            const weight = String(Math.round((300 + t * 600) / 100) * 100);

            el.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                this.sphereEngine!.hoveredTag = this.sphereEngine!.tags.find(n => n.el === el) ?? null;
                this.sphereEngine!.tags.forEach(o => o.renderState = o.el === el ? 'focused' : 'dimmed');
                showCollocates(word, el);
            });
            el.addEventListener('mouseleave', () => {
                hoverTimeout = window.setTimeout(() => {
                    if (!overlay.matches(':hover')) {
                        this.sphereEngine!.hoveredTag = null;
                        this.sphereEngine!.tags.forEach(o => o.renderState = 'normal');
                        hideOverlay();
                    }
                }, 300);
            });
            el.addEventListener('click', () => {
                const files = Array.from(new Set(
                    (wordCollocates.get(word) ?? []).flatMap(p => Array.from(p.files))
                ));
                new KWICModal(this.app, word, null, files, this.settings.windowSize).open();
            });

            this.sphereEngine!.addTag(el, fontSize, weight, new Set());
        });

        overlay.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
        overlay.addEventListener('mouseleave', () => {
            this.sphereEngine!.hoveredTag = null;
            this.sphereEngine!.tags.forEach(o => o.renderState = 'normal');
            hideOverlay();
        });

        this.sphereEngine.startAnimation();
    }
}

// ── Settings Tab ───────────────────────────────────────────────────────────────

class CollocationsSettingTab extends PluginSettingTab {
    plugin: CollocationsPlugin;
    constructor(app: App, plugin: CollocationsPlugin) { super(app, plugin); this.plugin = plugin; }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setName(t.settingHeading).setHeading();

        new Setting(containerEl)
            .setName(t.labelDuration)
            .setDesc(t.descDuration)
            .addDropdown(d => d
                .addOption('0',   t.optAll)
                .addOption('7',   t.opt7)
                .addOption('30',  t.opt30)
                .addOption('180', t.opt180)
                .addOption('365', t.opt365)
                .setValue(String(this.plugin.settings.analyzeDuration))
                .onChange(async v => {
                    this.plugin.settings.analyzeDuration = Number(v);
                    await this.plugin.saveSettings();
                    void this.plugin.refresh();
                }));

        new Setting(containerEl)
            .setName(t.labelWindow)
            .setDesc(t.descWindow)
            .addSlider(s => s
                .setLimits(1, 20, 1)
                .setValue(this.plugin.settings.windowSize)
                .setDynamicTooltip()
                .onChange(async v => {
                    this.plugin.settings.windowSize = v;
                    await this.plugin.saveSettings();
                    void this.plugin.refresh();
                }));

        new Setting(containerEl)
            .setName(t.labelTopN)
            .setDesc(t.descTopN)
            .addSlider(s => s
                .setLimits(10, 200, 10)
                .setValue(this.plugin.settings.topN)
                .setDynamicTooltip()
                .onChange(async v => {
                    this.plugin.settings.topN = v;
                    await this.plugin.saveSettings();
                    void this.plugin.refresh();
                }));

        new Setting(containerEl)
            .setName(t.labelHeight)
            .addSlider(s => s
                .setLimits(200, 800, 10)
                .setValue(this.plugin.settings.containerHeight)
                .setDynamicTooltip()
                .onChange(async v => {
                    this.plugin.settings.containerHeight = v;
                    await this.plugin.saveSettings();
                    if (this.plugin.injectedContainer)
                        this.plugin.injectedContainer.style.height = `${v}px`;
                }));

        new Setting(containerEl)
            .setName(t.labelRole)
            .setDesc(t.descRole)
            .addDropdown(d => d
                .addOption('both', t.optBoth)
                .addOption('w1',   t.optW1)
                .addOption('w2',   t.optW2)
                .setValue(this.plugin.settings.collocateRole)
                .onChange(async v => {
                    this.plugin.settings.collocateRole = v as 'w1' | 'w2' | 'both';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t.labelZhSW)
            .setDesc(t.descZhSW)
            .addToggle(tog => tog
                .setValue(this.plugin.settings.useZhStopwords)
                .onChange(async v => {
                    this.plugin.settings.useZhStopwords = v;
                    await this.plugin.saveSettings();
                    void this.plugin.refresh();
                }));

        new Setting(containerEl)
            .setName(t.labelEnSW)
            .setDesc(t.descEnSW)
            .addToggle(tog => tog
                .setValue(this.plugin.settings.useEnStopwords)
                .onChange(async v => {
                    this.plugin.settings.useEnStopwords = v;
                    await this.plugin.saveSettings();
                    void this.plugin.refresh();
                }));

        new Setting(containerEl)
            .setName(t.labelCustomSW)
            .setDesc(t.descCustomSW)
            .addTextArea(ta => {
                ta.inputEl.addClass('ts-desktop-custom-textarea');
                ta.setPlaceholder(t.placeholderCustomSW)
                    .setValue(this.plugin.settings.customStopWords)
                    .onChange(async v => {
                        this.plugin.settings.customStopWords = v;
                        await this.plugin.saveSettings();
                        void this.plugin.refresh();
                    });
            });
    }
}
