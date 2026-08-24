

(function () {

const WANTED = [
  "dpt_meta_facebook_dinov3-vits16-pretrain-lvd1689m_equalw_drop_shuf_dfcel_semantic7c_A",
  "dpt_meta_vit_small_patch14_dinov2_equalw_drop_shuf_dfcel_semantic7c_A",
  "unetpp_resnet34_imagenet_equalw_drop_shuf_dfcel_semantic7c_A",
  "ms_linear_vit_small_patch14_dinov2_equalw_drop_shuf_dfcel_semantic7c_A",
  "segdino_mlp_facebook_dinov3-vits16-pretrain-lvd1689m_equalw_drop_shuf_dfcel_semantic7c_A",
  "unetplusplus_resnet50_imagenet_equalw_drop_shuf_dfcel_semantic7c_A",
  "unetr_sam_vit_b_lm_lora_r4_equalw_drop_shuf_dfcel_semantic7c_A",
  "yolo26m_coco_noweight_drop_shuf_ultralytics_instance6c_A",
];

const MODEL_INFO = {
  "dpt_meta_facebook_dinov3-vits16-pretrain-lvd1689m_equalw_drop_shuf_dfcel_semantic7c_A":
    { csv: "DINOv3 + DPT-meta",      label: "RADIX (DINOv3+DPT)", color: "#4e79a7" },
  "dpt_meta_vit_small_patch14_dinov2_equalw_drop_shuf_dfcel_semantic7c_A":
    { csv: "DINOv2 + DPT-meta",      label: "DINOv2 + DPT",       color: "#f28e2b" },
  "unetpp_resnet34_imagenet_equalw_drop_shuf_dfcel_semantic7c_A":
    { csv: "ResNet34 + UNet++ (IN)", label: "ResNet34 + UNet++",  color: "#76b7b2" },
  "ms_linear_vit_small_patch14_dinov2_equalw_drop_shuf_dfcel_semantic7c_A":
    { csv: "DINOv2 + MS-Linear",     label: "DINOv2 + MS",        color: "#59a14f" },
  "segdino_mlp_facebook_dinov3-vits16-pretrain-lvd1689m_equalw_drop_shuf_dfcel_semantic7c_A":
    { csv: "DINOv3 + SegDINO-MLP",   label: "SegDINO",            color: "#b07aa1" },
  "unetplusplus_resnet50_imagenet_equalw_drop_shuf_dfcel_semantic7c_A":
    { csv: "ResNet50 + UNet++ (IN)", label: "ResNet50 + UNet++",  color: "#9c755f" },
  "unetr_sam_vit_b_lm_lora_r4_equalw_drop_shuf_dfcel_semantic7c_A":
    { csv: "MicroSAM + UNETR",       label: "MicroSAM + UNETR",   color: "#edc948" },
  "yolo26m_coco_noweight_drop_shuf_ultralytics_instance6c_A":
    { csv: "YOLO26m-seg (COCO)",     label: "YOLO26m",            color: "#ff9da7" },
};

function meanBySplit(rows) {
    const acc = new Map();
    for (const r of rows) {
        const v = +r.mean_IoU;
        if (!Number.isFinite(v)) continue;
        const k = r.model + "||" + r.split;
        const a = acc.get(k) || { sum: 0, n: 0 };
        a.sum += v; a.n += 1;
        acc.set(k, a);
    }
    return (model, split) => {
        const a = acc.get(model + "||" + split);
        return a && a.n > 0 ? a.sum / a.n : NaN;
    };
}

const DEFAULT_PANEL_W = 67, DEFAULT_PANEL_H = 57;

const M = { top: 3, right: 4, bottom: 13, left: 8 };

const LABEL_TITLE_GAP = 0.5;
const TITLE_FONT_MM = 2.47;
const X_TITLE_BASELINE_OFFSET = 9.47;

const Y_TITLE_CENTRE_OFFSET   = 9.0;

const _csvCache = new Map();
async function _loadCsv(path) {
    if (!_csvCache.has(path)) {
        _csvCache.set(path, d3.csv(path + "?t=" + Date.now()));
    }
    return _csvCache.get(path);
}

async function render(svgEl, opts) {
    const {
        xMin = 0.82, xMax = 0.88,
        yMin = 0.78, yMax = 0.88,
        labelMode = "off",
        csvPath = "per_sample_miou_all_models.csv",
        panelW = DEFAULT_PANEL_W,
        panelH = DEFAULT_PANEL_H,
        title = "",
    } = opts || {};
    const PANEL_W = panelW;
    const PANEL_H = panelH;
    const PLOT_W = PANEL_W - M.left - M.right;
    const PLOT_H = PANEL_H - M.top - M.bottom;

    const raw = await _loadCsv(csvPath);
    const lookup = meanBySplit(raw);
    const rows = WANTED.map((n, i) => {
        const info = MODEL_INFO[n];
        if (!info) return null;
        return {
            idx: i + 1, run: n, label: info.label, color: info.color,
            test:    lookup(info.csv, "test"),
            oneshot: lookup(info.csv, "zero-shot"),
        };
    }).filter(x => Number.isFinite(x.test) && Number.isFinite(x.oneshot));

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

    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, PLOT_W]);
    const y = d3.scaleLinear().domain([yMin, yMax]).range([PLOT_H, 0]);

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    const xTicks = x.ticks(5), yTicks = y.ticks(5);
    g.append("g").selectAll("line.vg").data(xTicks).enter().append("line")
        .attr("x1", d => x(d)).attr("x2", d => x(d))
        .attr("y1", 0).attr("y2", PLOT_H)
        .attr("stroke", "#e4e4e4").attr("stroke-width", 0.1);
    g.append("g").selectAll("line.hg").data(yTicks).enter().append("line")
        .attr("x1", 0).attr("x2", PLOT_W)
        .attr("y1", d => y(d)).attr("y2", d => y(d))
        .attr("stroke", "#e4e4e4").attr("stroke-width", 0.1);

    const lineLo = Math.max(xMin, yMin);
    const lineHi = Math.min(xMax, yMax);
    if (lineLo < lineHi) {
        g.append("line")
            .attr("x1", x(lineLo)).attr("y1", y(lineLo))
            .attr("x2", x(lineHi)).attr("y2", y(lineHi))
            .attr("stroke", "#aaa").attr("stroke-width", 0.2)
            .attr("stroke-dasharray", "0.8 0.6");

        const midVal = (lineLo + lineHi) / 2;
        const mx = x(midVal);
        const my = y(midVal);
        const angleDeg = Math.atan2(y(lineHi) - y(lineLo),
                                    x(lineHi) - x(lineLo)) * 180 / Math.PI;
        g.append("text")
            .attr("transform", `translate(${mx},${my}) rotate(${angleDeg})`)
            .attr("x", 0).attr("y", -0.875)
            .attr("text-anchor", "middle")
            .attr("font-size", 1.76)
            .attr("font-style", "italic")
            .attr("fill", "#888")
            .text("Out-of-distribution mIoU = Test mIoU");
    }

    g.append("line").attr("x1", 0).attr("x2", PLOT_W)
        .attr("y1", PLOT_H).attr("y2", PLOT_H)
        .attr("stroke", "black").attr("stroke-width", 0.2);
    g.append("line").attr("x1", 0).attr("x2", 0)
        .attr("y1", 0).attr("y2", PLOT_H)
        .attr("stroke", "black").attr("stroke-width", 0.2);

    g.selectAll(".xt").data(xTicks).enter().append("g").each(function (d) {
        const xx = x(d);
        d3.select(this).append("line")
            .attr("x1", xx).attr("x2", xx)
            .attr("y1", PLOT_H).attr("y2", PLOT_H + 0.8)
            .attr("stroke", "black").attr("stroke-width", 0.2);
        d3.select(this).append("text")
            .attr("x", xx).attr("y", PLOT_H + 3)
            .attr("text-anchor", "middle").attr("font-size", 2.12)
            .text(d3.format(".3f")(d));
    });
    g.selectAll(".yt").data(yTicks).enter().append("g").each(function (d) {
        const yy = y(d);
        d3.select(this).append("line")
            .attr("x1", -0.8).attr("x2", 0)
            .attr("y1", yy).attr("y2", yy)
            .attr("stroke", "black").attr("stroke-width", 0.2);
        d3.select(this).append("text")
            .attr("x", -1.2).attr("y", yy + 0.7)
            .attr("text-anchor", "end").attr("font-size", 2.12)
            .text(d3.format(".3f")(d));
    });

    svg.append("text")
        .attr("x", M.left + PLOT_W / 2)
        .attr("y", M.top + PLOT_H + X_TITLE_BASELINE_OFFSET)
        .attr("text-anchor", "middle").attr("font-size", TITLE_FONT_MM)
        .attr("font-weight", "bold")
        .text("In-distribution Test mIoU");

    const yTitle = svg.append("text")
        .attr("transform",
              `translate(${M.left - Y_TITLE_CENTRE_OFFSET},${M.top + PLOT_H / 2}) rotate(-90)`)
        .attr("text-anchor", "middle").attr("font-size", TITLE_FONT_MM)
        .attr("font-weight", "bold");
    yTitle.append("tspan").attr("x", 0).attr("dy", "-0.55em").text("Out-of-distribution");
    yTitle.append("tspan").attr("x", 0).attr("dy", "1.1em").text("Test mIoU");

    const pts = rows.map(d => ({ ...d, px: x(d.test), py: y(d.oneshot) }));

    const MARKER_R = 0.6;
    g.selectAll(".pt").data(pts).enter().append("circle")
        .attr("cx", d => d.px).attr("cy", d => d.py)
        .attr("r", MARKER_R)
        .attr("fill", d => d.color);

    const LABEL_FS = 2.47;
    const LABEL_GAP = 0.7;
    const BOLD_LABEL = "RADIX (DINOv3+DPT)";

    const measure = svg.append("g").attr("visibility", "hidden");
    const labelWidth = pts.map(p => {
        const t = measure.append("text")
            .attr("font-size", LABEL_FS).text(p.label);
        if (p.label === BOLD_LABEL) t.attr("font-weight", "bold");
        return t.node().getComputedTextLength();
    });
    measure.remove();

    pts.forEach((p, i) => {
        const w = labelWidth[i];
        const flipLeft = p.px + MARKER_R + LABEL_GAP + w > PLOT_W - 0.5;
        const xText = flipLeft
            ? p.px - MARKER_R - LABEL_GAP
            : p.px + MARKER_R + LABEL_GAP;
        const t = g.append("text")
            .attr("x", xText)
            .attr("y", p.py + LABEL_FS * 0.32)
            .attr("text-anchor", flipLeft ? "end" : "start")
            .attr("font-size", LABEL_FS)
            .attr("fill", p.color)
            .text(p.label);
        if (p.label === BOLD_LABEL) t.attr("font-weight", "bold");
    });

    return { rows, pts };
}

window.Fig2fScatter = { render, WANTED, MODEL_INFO,
                        PANEL_W: DEFAULT_PANEL_W, PANEL_H: DEFAULT_PANEL_H };

})();
