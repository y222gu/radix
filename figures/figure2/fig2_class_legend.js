

(function () {

const CLASSES = [
    { name: "Vascular",   color: "#e76f61" },
    { name: "Exodermis",  color: "#f4a261" },
    { name: "Endodermis", color: "#f6e48e" },
    { name: "Cortex",     color: "#94d2bd" },
    { name: "Epidermis",  color: "#0a9396" },
    { name: "Aerenchyma", color: "#264653" },
];

function render(svgEl, opts) {
    const {
        panelW, panelH,
        titleText = "Anatomical Class",

        contentBottom = null,

        contentTop = null,
    } = opts || {};
    const PANEL_W = panelW, PANEL_H = panelH;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("font-family", "Helvetica, Arial, sans-serif");

    const titleFS = 2.47;
    const rowFS   = 2.47;
    const swatchSide = 2.4;
    const rowPitch   = 3.3;
    const titleGap   = 1.5;
    const blockH = titleFS + titleGap + CLASSES.length * rowPitch;

    const y0 = (contentTop != null)
        ? contentTop + titleFS
        : (contentBottom != null)
            ? contentBottom - blockH + titleFS
            : (PANEL_H - blockH) / 2 + titleFS;

    const leftPad = 0;
    const swatchTextGap = 1.0;
    const swatchLeftX  = leftPad;
    const textLeftX    = swatchLeftX + swatchSide + swatchTextGap;

    svg.append("text")
        .attr("x", swatchLeftX).attr("y", y0)
        .attr("text-anchor", "start")
        .attr("font-size", titleFS).attr("font-weight", "bold")
        .text(titleText);

    let y = y0 + titleGap + rowFS;
    for (const cls of CLASSES) {
        svg.append("rect")
            .attr("x", swatchLeftX)
            .attr("y", y - swatchSide + 0.2)
            .attr("width", swatchSide).attr("height", swatchSide)
            .attr("fill", cls.color);
        svg.append("text")
            .attr("x", textLeftX).attr("y", y)
            .attr("text-anchor", "start")
            .attr("font-size", rowFS)
            .text(cls.name);
        y += rowPitch;
    }
}

window.Fig2ClassLegend = { render, CLASSES };

})();
