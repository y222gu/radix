

(function () {

const CLASSES = [
    { name: "Vascular",   color: "#e76f61" },
    { name: "Exodermis",  color: "#f4a261" },
    { name: "Endodermis", color: "#f6e48e" },
    { name: "Cortex",     color: "#94d2bd" },
    { name: "Epidermis",  color: "#0a9396" },
    { name: "Aerenchyma", color: "#264653" },
];

function lighten(hex, amount) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);
    return `#${[lr,lg,lb].map(v => v.toString(16).padStart(2,"0")).join("")}`;
}

const DEFAULT_PANEL_W = 113, DEFAULT_PANEL_H = 57;

const M = { top: 6.5, right: 3, bottom: 11, left: 8 };
const TITLE_FONT_MM = 2.47;
const LABEL_TILT = -25;
const Y_TITLE_CENTRE_OFFSET = 5.94;

const X_TITLE_BASELINE_OFFSET = 10.47;

const _csvCache = new Map();
async function _loadCsv(path) {
    if (!_csvCache.has(path)) {
        _csvCache.set(path, d3.csv(path + "?t=" + Date.now()));
    }
    return _csvCache.get(path);
}

function boxStats(vals) {
    const s = vals.filter(v => v != null && !isNaN(v)).sort(d3.ascending);
    if (s.length === 0) return null;
    const q1 = d3.quantile(s, 0.25);
    const med = d3.quantile(s, 0.50);
    const q3 = d3.quantile(s, 0.75);
    const iqr = q3 - q1;
    const whiskerLo = Math.max(d3.min(s), q1 - 1.5 * iqr);
    const whiskerHi = Math.min(d3.max(s), q3 + 1.5 * iqr);
    return { q1, med, q3, whiskerLo, whiskerHi, n: s.length, vals: s };
}

function kde(values, grid, bandwidth) {
    const n = values.length;
    if (n === 0) return grid.map(() => 0);
    const norm = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
    return grid.map(x => {
        let s = 0;
        for (const v of values) {
            const u = (x - v) / bandwidth;
            s += Math.exp(-0.5 * u * u);
        }
        return norm * s;
    });
}

async function render(svgEl, opts) {
    const {
        yMin = 0.0, yMax = 1.0,
        csvPath = "per_sample_iou.csv",
        humanCsvPath = "human_baseline_iou.csv",

        splitFilter = null,

        boxWidth = null,
        panelW = DEFAULT_PANEL_W,
        panelH = DEFAULT_PANEL_H,
        title = "",
    } = opts || {};
    const PANEL_W = panelW;
    const PANEL_H = panelH;
    const PLOT_W = PANEL_W - M.left - M.right;
    const PLOT_H = PANEL_H - M.top - M.bottom;

    const raw = await _loadCsv(csvPath);
    const filtered = splitFilter ? raw.filter(r => r.split === splitFilter) : raw;

    const byClass = {};
    for (const c of CLASSES) byClass[c.name] = [];
    for (const row of filtered) {
        for (const c of CLASSES) {
            const v = row[`${c.name}_IoU`];
            if (v === "" || v == null) continue;
            const f = parseFloat(v);
            if (!isNaN(f)) byClass[c.name].push(f);
        }
    }

    const byClassHuman = {};
    for (const c of CLASSES) byClassHuman[c.name] = [];
    if (humanCsvPath) {
        try {
            const hraw = await _loadCsv(humanCsvPath);
            for (const row of hraw) {
                for (const c of CLASSES) {
                    const v = row[`${c.name}_IoU`];
                    if (v === "" || v == null) continue;
                    const f = parseFloat(v);
                    if (!isNaN(f)) byClassHuman[c.name].push(f);
                }
            }
        } catch (e) {
            console.warn(`fig2d: no human baseline CSV at ${humanCsvPath} (${e.message})`);
        }
    }
    const hasHuman = Object.values(byClassHuman).some(v => v.length > 0);

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("font-family", "Helvetica, Arial, sans-serif");

    if (title) {
        svg.append("text")
            .attr("x", PANEL_W / 2).attr("y", 3.0)
            .attr("text-anchor", "middle")
            .attr("font-size", 2.12).attr("font-weight", "bold")
            .text(title);
    }

    const x = d3.scaleBand()
        .domain(CLASSES.map(c => c.name))
        .range([0, PLOT_W])
        .paddingInner(0.30);
    const y = d3.scaleLinear().domain([yMin, yMax]).range([PLOT_H, 0]);

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    const yTicks = y.ticks(5);
    g.selectAll("line.hg").data(yTicks).enter().append("line")
        .attr("x1", 0).attr("x2", PLOT_W)
        .attr("y1", d => y(d)).attr("y2", d => y(d))
        .attr("stroke", "#e4e4e4").attr("stroke-width", 0.1);

    g.append("line").attr("x1", 0).attr("x2", PLOT_W)
        .attr("y1", PLOT_H).attr("y2", PLOT_H)
        .attr("stroke", "black").attr("stroke-width", 0.2);
    g.append("line").attr("x1", 0).attr("x2", 0)
        .attr("y1", 0).attr("y2", PLOT_H)
        .attr("stroke", "black").attr("stroke-width", 0.2);

    g.selectAll(".yt").data(yTicks).enter().append("g").each(function (d) {
        const yy = y(d);
        d3.select(this).append("line")
            .attr("x1", -0.8).attr("x2", 0)
            .attr("y1", yy).attr("y2", yy)
            .attr("stroke", "black").attr("stroke-width", 0.2);
        d3.select(this).append("text")
            .attr("x", -1.2).attr("y", yy + 0.7)
            .attr("text-anchor", "end").attr("font-size", 2.12)
            .text(d3.format(".1f")(d));
    });

    svg.append("text")
        .attr("transform",
              `translate(${M.left - Y_TITLE_CENTRE_OFFSET},${M.top + PLOT_H / 2}) rotate(-90)`)
        .attr("text-anchor", "middle").attr("font-size", TITLE_FONT_MM)
        .attr("font-weight", "bold")
        .text("IoU");

    svg.append("text")
        .attr("x", M.left + PLOT_W / 2)
        .attr("y", M.top + PLOT_H + X_TITLE_BASELINE_OFFSET)
        .attr("text-anchor", "middle").attr("font-size", TITLE_FONT_MM)
        .attr("font-weight", "bold")
        .text("Anatomical Class");

    for (const c of CLASSES) {
        const cx = x(c.name) + x.bandwidth() / 2;
        g.append("line")
            .attr("x1", cx).attr("x2", cx)
            .attr("y1", PLOT_H).attr("y2", PLOT_H + 0.8)
            .attr("stroke", "black").attr("stroke-width", 0.2);

        g.append("text")
            .attr("transform", `translate(${cx},${PLOT_H + 2.5}) rotate(${LABEL_TILT})`)
            .attr("text-anchor", "end").attr("font-size", 2.12)
            .attr("font-weight", "bold")
            .attr("fill", c.color)
            .text(c.name);
    }

    const subGap   = 0.35;

    const fullBoxW = (boxWidth != null)
        ? (hasHuman ? 2 * boxWidth + subGap : boxWidth)
        : Math.max(1.2, x.bandwidth() * 0.75);
    const subBoxW  = hasHuman ? (fullBoxW - subGap) / 2 : fullBoxW;

    const HUMAN_LIGHTEN = 0.85;

    const HUMAN_POINT_LIGHTEN = 0.25;

    function drawBox(cx, stats, vals, color, classLen, style) {
        const fill = style === "model" ? color : lighten(color, HUMAN_LIGHTEN);
        const stroke = style === "model" ? color : lighten(color, HUMAN_LIGHTEN * 0.45);
        const pointFill = style === "model" ? color : lighten(color, HUMAN_POINT_LIGHTEN);

        g.append("line")
            .attr("x1", cx).attr("x2", cx)
            .attr("y1", y(stats.whiskerLo)).attr("y2", y(stats.whiskerHi))
            .attr("stroke", "black").attr("stroke-width", 0.15);
        [stats.whiskerLo, stats.whiskerHi].forEach(v => {
            g.append("line")
                .attr("x1", cx - subBoxW * 0.35).attr("x2", cx + subBoxW * 0.35)
                .attr("y1", y(v)).attr("y2", y(v))
                .attr("stroke", "black").attr("stroke-width", 0.15);
        });

        const rect = g.append("rect")
            .attr("x", cx - subBoxW / 2).attr("y", y(stats.q3))
            .attr("width", subBoxW).attr("height", y(stats.q1) - y(stats.q3))
            .attr("stroke", stroke).attr("stroke-width", 0.25);
        if (style === "model") {
            rect.attr("fill", fill).attr("fill-opacity", 0.55);
        } else {
            rect.attr("fill", "none");
        }

        const jitterW = subBoxW * 0.60;
        vals.forEach((v, i) => {
            const t = (Math.sin(i * 9301 + 49297 + classLen + (style === "human" ? 17 : 0)) + 1) / 2;
            const jx = cx + (t - 0.5) * jitterW;
            g.append("circle")
                .attr("cx", jx).attr("cy", y(v))
                .attr("r", 0.22)
                .attr("fill", pointFill).attr("fill-opacity", 0.55)
                .attr("stroke", "none");
        });

        g.append("line")
            .attr("x1", cx - subBoxW / 2).attr("x2", cx + subBoxW / 2)
            .attr("y1", y(stats.med)).attr("y2", y(stats.med))
            .attr("stroke", "black").attr("stroke-width", 0.25);
    }

    for (const c of CLASSES) {
        const vals = byClass[c.name];
        if (!vals.length) continue;
        const stats = boxStats(vals);
        if (!stats) continue;
        const cx = x(c.name) + x.bandwidth() / 2;

        if (hasHuman) {

            const cxModel = cx - (subBoxW + subGap) / 2;
            const cxHuman = cx + (subBoxW + subGap) / 2;
            drawBox(cxModel, stats, vals, c.color, c.name.length, "model");
            const hVals = byClassHuman[c.name] || [];
            const hStats = boxStats(hVals);
            if (hStats) drawBox(cxHuman, hStats, hVals, c.color, c.name.length, "human");
        } else {
            drawBox(cx, stats, vals, c.color, c.name.length, "model");
        }
    }

    const boxW = subBoxW;

    {
        const LG_FS = 2.12;
        const LG_BOX_W = 1.75, LG_BOX_H = 1.75;
        const LG_GAP = 0.6;
        const LG_ROW_PITCH = 3.2;
        const LG_PAD = 1.4;
        const LG_GREY = "#888";
        const labels = hasHuman
            ? ["Model Prediction vs Ground Truth", "Internal Annotator vs Ground Truth"]
            : ["Model Prediction vs Ground Truth"];

        const measureG = svg.append("g").attr("visibility", "hidden");
        const widths = labels.map(t => measureG.append("text")
            .attr("font-size", LG_FS).text(t).node().getComputedTextLength());
        measureG.remove();
        const widestLabel = Math.max(...widths);
        const innerW = LG_BOX_W + LG_GAP + widestLabel;
        const innerH = LG_ROW_PITCH * (labels.length - 1) + LG_BOX_H;
        const frameW = innerW + 2 * LG_PAD;
        const frameH = innerH + 2 * LG_PAD;

        const frameX = (PLOT_W - frameW) / 2;
        const frameY = PLOT_H - frameH - 0.5;

        g.append("rect")
            .attr("x", frameX).attr("y", frameY)
            .attr("width", frameW).attr("height", frameH)
            .attr("fill", "white").attr("fill-opacity", 0.95)
            .attr("stroke", "#888").attr("stroke-width", 0.2)
            .attr("rx", 0.4);
        const lgX = frameX + LG_PAD;
        const lgY = frameY + LG_PAD;
        const drawRow = (rowIdx, label, fillOpts, strokeColor) => {
            const yRow = lgY + rowIdx * LG_ROW_PITCH;
            const rect = g.append("rect")
                .attr("x", lgX).attr("y", yRow)
                .attr("width", LG_BOX_W).attr("height", LG_BOX_H)
                .attr("stroke", strokeColor).attr("stroke-width", 0.25);
            if (fillOpts) {
                rect.attr("fill", fillOpts.fill).attr("fill-opacity", fillOpts.opacity);
            } else {
                rect.attr("fill", "none");
            }
            g.append("text")
                .attr("x", lgX + LG_BOX_W + LG_GAP)
                .attr("y", yRow + LG_BOX_H)
                .attr("font-size", LG_FS).attr("fill", "#333")
                .text(label);
        };

        drawRow(0, labels[0], { fill: LG_GREY, opacity: 0.55 }, LG_GREY);

        if (hasHuman) drawRow(1, labels[1], null, LG_GREY);
    }

    const N_FS = 1.76;
    const N_KEY_BASELINE_Y = -1.7;
    const N_GAP = 0.85;
    g.append("text")
        .attr("x", -0.5).attr("y", N_KEY_BASELINE_Y)
        .attr("text-anchor", "end").attr("font-size", N_FS)
        .attr("fill", "#555")
        .text("n=");
    for (const c of CLASSES) {
        const cx = x(c.name) + x.bandwidth() / 2;
        const vals = byClass[c.name] || [];
        if (vals.length > 0) {
            const stats = boxStats(vals);
            const cxM = hasHuman ? cx - (subBoxW + subGap) / 2 : cx;
            g.append("text")
                .attr("x", cxM).attr("y", y(stats.whiskerHi) - N_GAP)
                .attr("text-anchor", "middle").attr("font-size", N_FS)
                .attr("fill", "#555")
                .text(`${vals.length}`);
        }
        if (hasHuman) {
            const hVals = byClassHuman[c.name] || [];
            if (hVals.length > 0) {
                const hStats = boxStats(hVals);
                const cxH = cx + (subBoxW + subGap) / 2;
                g.append("text")
                    .attr("x", cxH).attr("y", y(hStats.whiskerHi) - N_GAP)
                    .attr("text-anchor", "middle").attr("font-size", N_FS)
                    .attr("fill", "#555")
                    .text(`${hVals.length}`);
            }
        }
    }

    return byClass;
}

window.Fig2dBoxplot = { render, CLASSES,
                        PANEL_W: DEFAULT_PANEL_W, PANEL_H: DEFAULT_PANEL_H };

})();
