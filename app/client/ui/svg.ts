const svgNS = "http://www.w3.org/2000/svg";

export function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(svgNS, tag) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function makeSvgIcon(width: string, height: string, children: SVGElement[]): SVGElement {
  const svg = svgEl("svg", {
    width, height,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
  });
  for (const child of children) svg.appendChild(child);
  return svg;
}
