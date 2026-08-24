

(function (root) {
  function _segments(span) {
    const out = [];
    for (const node of span.childNodes) {
      const text = node.nodeType === Node.TEXT_NODE
        ? node.nodeValue
        : node.textContent;
      if (!text) continue;
      const italic = node.nodeType === 1 &&
                     (node.tagName === "I" || node.tagName === "EM");
      out.push({ text, italic });
    }
    if (out.length === 0 && span.textContent) {
      out.push({ text: span.textContent, italic: false });
    }
    return out;
  }

  function drawMixedItalic(ctx, span, fontPx, fontFamily, x, y, anchor) {
    const segs = _segments(span);
    let totalW = 0;
    for (const s of segs) {
      ctx.font = `${s.italic ? "italic " : ""}${fontPx}px ${fontFamily}`;
      totalW += ctx.measureText(s.text).width;
    }
    let cursorX = x;
    if (anchor === "center")     cursorX = x - totalW / 2;
    else if (anchor === "right") cursorX = x - totalW;
    ctx.textAlign = "left";
    for (const s of segs) {
      ctx.font = `${s.italic ? "italic " : ""}${fontPx}px ${fontFamily}`;
      ctx.fillText(s.text, cursorX, y);
      cursorX += ctx.measureText(s.text).width;
    }
  }

  function appendMixedItalicTspans(textEl, span) {
    const svgNS = "http://www.w3.org/2000/svg";
    for (const s of _segments(span)) {
      const ts = document.createElementNS(svgNS, "tspan");
      if (s.italic) ts.setAttribute("font-style", "italic");
      ts.textContent = s.text;
      textEl.appendChild(ts);
    }
  }

  root.drawMixedItalic = drawMixedItalic;
  root.appendMixedItalicTspans = appendMixedItalicTspans;
})(window);
