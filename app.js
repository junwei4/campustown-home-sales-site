"use strict";

const DATA_PATH = "data/college_town_home_sales.csv";
const MINIMUM_SALE_PRICE = 10000;
const MAXIMUM_SALE_PRICE = 5000000;
const SVG_NS = "http://www.w3.org/2000/svg";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});
const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    const next = text[i + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header, index) => index === 0 ? header.replace(/^\uFEFF/, "") : header);
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))
  );
}

function numberValue(row, key) {
  const value = row[key];
  if (value === undefined || value.trim() === "") return NaN;
  return Number(value);
}

function inputNumber(input) {
  return input.value.trim() === "" ? NaN : Number(input.value);
}

function median(values) {
  if (!values.length) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : NaN;
}

function formatCurrency(value) {
  return Number.isFinite(value) ? currencyFormatter.format(value) : "N/A";
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
    : "N/A";
}

function formatCount(value) {
  return integerFormatter.format(value);
}

function cityName(row) {
  return `${row.city}, ${row.state}`;
}

function validPrice(row) {
  const price = numberValue(row, "sale_price");
  return Number.isFinite(price) && price >= MINIMUM_SALE_PRICE && price <= MAXIMUM_SALE_PRICE;
}

function saleYear(row) {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(row.sale_date);
  return match ? Number(match[1]) : NaN;
}

function daysOnMarket(row) {
  if (!row.list_date || !row.contract_date) return NaN;
  const listed = Date.parse(`${row.list_date}T00:00:00Z`);
  const contracted = Date.parse(`${row.contract_date}T00:00:00Z`);
  if (!Number.isFinite(listed) || !Number.isFinite(contracted)) return NaN;
  return (contracted - listed) / 86400000;
}

function uniqueSorted(values, compare = (a, b) => a.localeCompare(b)) {
  return [...new Set(values)].sort(compare);
}

function groupBy(rows, keyFunction) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = keyFunction(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}

function setAnswer(questionId, text, highlights = []) {
  const answer = document.querySelector(`#${questionId} .answer`);
  answer.replaceChildren();
  const matches = highlights.map((value) => ({ value, index: text.indexOf(value) }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index);
  let position = 0;
  matches.forEach((match) => {
    if (match.index < position) return;
    answer.append(document.createTextNode(text.slice(position, match.index)));
    const highlight = document.createElement("strong");
    highlight.className = "answer-highlight";
    highlight.textContent = match.value;
    answer.append(highlight);
    position = match.index + match.value.length;
  });
  answer.append(document.createTextNode(text.slice(position)));
}

function setExplanation(questionId, text) {
  document.querySelector(`#${questionId} .explanation`).textContent = text;
}

function renderDetail(questionId, headers, rows, emptyMessage = "No sales meet these conditions.") {
  const container = document.querySelector(`#${questionId} .detail`);
  container.replaceChildren();
  if (!rows.length) {
    const message = document.createElement("p");
    message.textContent = emptyMessage;
    container.append(message);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "table-wrap";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((header) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headerRow.append(cell);
  });
  thead.append(headerRow);
  const tbody = document.createElement("tbody");
  rows.forEach((values) => {
    const row = document.createElement("tr");
    values.forEach((value, index) => {
      const cell = index === 0 ? document.createElement("th") : document.createElement("td");
      if (index === 0) cell.scope = "row";
      else cell.dataset.label = headers[index];
      cell.textContent = value;
      row.append(cell);
    });
    tbody.append(row);
  });
  table.append(thead, tbody);
  wrapper.append(table);
  container.append(wrapper);
}

function makeSvg(container, width, height, label) {
  container.replaceChildren();
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.setAttribute("focusable", "true");
  if (window.matchMedia("(max-width: 60rem)").matches) svg.classList.add("compact-chart");
  container.append(svg);
  return svg;
}

function svgNode(svg, tag, attributes = {}, text = "") {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  if (text) element.textContent = text;
  svg.append(element);
  return element;
}

function addTooltip(element, text) {
  element.setAttribute("data-tooltip", text);
  element.setAttribute("aria-label", text);
}

function renderEmptyChart(container, message) {
  const svg = makeSvg(container, 900, 90, message);
  svgNode(svg, "text", { x: 16, y: 48, class: "axis-label" }, message);
}

function renderHorizontalChart(container, items, options) {
  const visible = items.filter((item) => Number.isFinite(item.value));
  if (!visible.length) {
    renderEmptyChart(container, "No values to chart for these conditions.");
    return;
  }

  const compact = window.matchMedia("(max-width: 60rem)").matches;
  const width = compact ? 420 : 1200;
  const marginLeft = compact ? 150 : 430;
  const rightMargin = compact ? 96 : 150;
  const plotWidth = width - marginLeft - rightMargin;
  const top = 18;
  const rowHeight = compact ? 39 : 29;
  const bottom = compact ? 62 : 54;
  const height = top + visible.length * rowHeight + bottom;
  const minValue = Math.min(0, ...visible.map((item) => item.value));
  const maxValue = Math.max(0, ...visible.map((item) => item.value));
  const span = maxValue - minValue || 1;
  const scale = (value) => marginLeft + ((value - minValue) / span) * plotWidth;
  const zeroX = scale(0);
  const svg = makeSvg(container, width, height, options.label);

  const tickCount = compact ? 2 : 4;
  for (let index = 0; index <= tickCount; index += 1) {
    const value = minValue + span * index / tickCount;
    const x = scale(value);
    svgNode(svg, "line", {
      x1: x, y1: top - 4, x2: x, y2: height - bottom + 1,
      class: value === 0 ? "axis" : "grid-line"
    });
    svgNode(svg, "text", {
      x, y: height - 27, "text-anchor": "middle", class: "axis-label"
    }, options.format(value));
  }
  svgNode(svg, "text", {
    x: marginLeft + plotWidth / 2, y: height - 6, "text-anchor": "middle", class: "axis-label"
  }, options.axisLabel || "Value");

  visible.forEach((item, index) => {
    const centerY = top + index * rowHeight + rowHeight / 2;
    const isHighlighted = (options.highlight || []).includes(item.label);
    const label = svgNode(svg, "text", {
      x: marginLeft - 12, y: centerY + 4, "text-anchor": "end",
      class: `data-label${isHighlighted ? " highlight-label" : ""}`
    });
    const words = compact ? item.label.split(/\s+/) : [item.label];
    const lines = [];
    words.forEach((word) => {
      const current = lines[lines.length - 1];
      if (compact && current && `${current} ${word}`.length > 18) lines.push(word);
      else if (current) lines[lines.length - 1] = `${current} ${word}`;
      else lines.push(word);
    });
    const firstLineY = centerY + 4 - (lines.length - 1) * 6;
    lines.forEach((line, lineIndex) => {
      const tspan = document.createElementNS(SVG_NS, "tspan");
      tspan.setAttribute("x", String(marginLeft - 12));
      tspan.setAttribute("y", String(firstLineY + lineIndex * 12));
      tspan.textContent = line;
      label.append(tspan);
    });
    const valueX = scale(item.value);
    const rect = svgNode(svg, "rect", {
      x: Math.min(zeroX, valueX),
      y: centerY - 7,
      width: Math.max(1, Math.abs(valueX - zeroX)),
      height: 14,
      rx: 2,
      class: `${item.value < 0 ? "bar negative" : "bar"}${options.highlight ? (isHighlighted ? " highlight" : " quiet") : ""}`
    });
    addTooltip(rect, `${item.label}: ${options.format(item.value)}${item.count === undefined ? "" : `; ${formatCount(item.count)} sales`}`);
    svgNode(svg, "text", {
      x: marginLeft + plotWidth + 8, y: centerY + 4,
      class: `data-label chart-value${isHighlighted ? " highlight-label" : ""}`
    }, options.format(item.value));
  });
}

function renderScatter(container, rows) {
  if (!rows.length) {
    renderEmptyChart(container, "No city values to chart.");
    return;
  }

  const compact = window.matchMedia("(max-width: 60rem)").matches;
  const width = compact ? 480 : 1000;
  const height = compact ? 420 : 560;
  const left = compact ? 86 : 95;
  const right = compact ? 18 : 28;
  const top = 25;
  const bottom = 72;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xValues = rows.map((row) => row.median);
  const yValues = rows.map((row) => row.mean);
  const xMin = Math.min(...xValues) * 0.92;
  const xMax = Math.max(...xValues) * 1.06;
  const yMin = Math.min(...yValues) * 0.92;
  const yMax = Math.max(...yValues) * 1.06;
  const xScale = (value) => left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const yScale = (value) => top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
  const svg = makeSvg(container, width, height, "Scatter plot of city sale-price medians and means using all rows.");

  const tickCount = compact ? 3 : 4;
  for (let index = 0; index <= tickCount; index += 1) {
    const fraction = index / tickCount;
    const x = left + fraction * plotWidth;
    const y = top + plotHeight - fraction * plotHeight;
    svgNode(svg, "line", { x1: x, y1: top, x2: x, y2: top + plotHeight, class: "grid-line" });
    svgNode(svg, "line", { x1: left, y1: y, x2: left + plotWidth, y2: y, class: "grid-line" });
    svgNode(svg, "text", { x, y: top + plotHeight + 23, "text-anchor": "middle", class: "axis-label" },
      formatCurrency(xMin + fraction * (xMax - xMin)));
    svgNode(svg, "text", { x: left - 10, y: y + 4, "text-anchor": "end", class: "axis-label" },
      formatCurrency(yMin + fraction * (yMax - yMin)));
  }
  svgNode(svg, "line", { x1: left, y1: top + plotHeight, x2: left + plotWidth, y2: top + plotHeight, class: "axis" });
  svgNode(svg, "line", { x1: left, y1: top, x2: left, y2: top + plotHeight, class: "axis" });
  svgNode(svg, "text", { x: left + plotWidth / 2, y: height - 13, "text-anchor": "middle", class: "axis-label" },
    "Median sale price");
  const yLabel = svgNode(svg, "text", {
    x: 18, y: top + plotHeight / 2, "text-anchor": "middle", class: "axis-label",
    transform: `rotate(-90 18 ${top + plotHeight / 2})`
  }, "Mean sale price");
  yLabel.setAttribute("aria-hidden", "true");

  rows.forEach((row) => {
    const point = svgNode(svg, "circle", {
      cx: xScale(row.median), cy: yScale(row.mean), r: 6, class: "point", tabindex: 0
    });
    addTooltip(point, `${row.city}: median ${formatCurrency(row.median)}, mean ${formatCurrency(row.mean)}, gap ${formatNumber(row.gap, 1)}%`);
  });
}

function renderSlopeChart(container, rows) {
  if (!rows.length) {
    renderEmptyChart(container, "No city ranks to chart.");
    return;
  }

  const compact = window.matchMedia("(max-width: 60rem)").matches;
  const width = compact ? 480 : 1000;
  const top = compact ? 42 : 52;
  const rowHeight = compact ? 24 : 27;
  const bottom = 30;
  const height = top + rows.length * rowHeight + bottom;
  const leftRankX = compact ? 190 : 270;
  const rightRankX = compact ? 330 : 770;
  const rankY = (rank) => top + (rank - 1) * rowHeight + rowHeight / 2;
  const svg = makeSvg(container, width, height, "Slope chart comparing each city's mean-price rank using all rows and valid-price rows.");
  svgNode(svg, "text", { x: leftRankX, y: 22, "text-anchor": "middle", class: "axis-label" }, "All rows");
  svgNode(svg, "text", { x: rightRankX, y: 22, "text-anchor": "middle", class: "axis-label" }, "Valid prices");

  rows.forEach((row) => {
    const changed = row.allRank !== row.validRank;
    svgNode(svg, "text", {
      x: 4, y: rankY(row.allRank) + 4, class: "data-label"
    }, compact ? row.city.split(",")[0] : row.city);
    const line = svgNode(svg, "line", {
      x1: leftRankX, y1: rankY(row.allRank), x2: rightRankX, y2: rankY(row.validRank),
      class: `slope-line${changed ? " changed" : ""}`, "stroke-width": 2, opacity: 0.8
    });
    addTooltip(line, `${row.city}: all rows rank ${row.allRank}; valid-price rank ${row.validRank}`);
    svgNode(svg, "text", {
      x: leftRankX - 12, y: rankY(row.allRank) + 4, "text-anchor": "end", class: "data-label"
    }, String(row.allRank));
    svgNode(svg, "text", {
      x: rightRankX + 12, y: rankY(row.validRank) + 4, class: "data-label"
    }, String(row.validRank));
  });
  svgNode(svg, "text", { x: width / 2, y: height - 5, "text-anchor": "middle", class: "axis-label" },
    "Rank (1 = highest mean)");
}

function renderMonthlyChart(container, counts) {
  const compact = window.matchMedia("(max-width: 60rem)").matches;
  const width = compact ? 480 : 1000;
  const height = compact ? 330 : 360;
  const left = compact ? 40 : 62;
  const right = compact ? 12 : 25;
  const top = compact ? 22 : 24;
  const bottom = compact ? 64 : 66;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxCount = Math.max(1, ...counts.map((item) => item.count));
  const svg = makeSvg(container, width, height, "Monthly sale counts for the selected city and year.");

  for (let index = 0; index <= 4; index += 1) {
    const value = Math.ceil(maxCount * index / 4);
    const y = top + plotHeight - (value / maxCount) * plotHeight;
    svgNode(svg, "line", { x1: left, y1: y, x2: left + plotWidth, y2: y, class: "grid-line" });
    svgNode(svg, "text", { x: left - 9, y: y + 4, "text-anchor": "end", class: "axis-label" }, formatCount(value));
  }
  const slot = plotWidth / counts.length;
  const barWidth = slot * 0.58;
  counts.forEach((item, index) => {
    const x = left + index * slot + (slot - barWidth) / 2;
    const barHeight = item.count / maxCount * plotHeight;
    const bar = svgNode(svg, "rect", {
      x, y: top + plotHeight - barHeight, width: barWidth, height: Math.max(1, barHeight), rx: 2, class: "bar"
    });
    addTooltip(bar, `${item.month}: ${formatCount(item.count)} sales`);
    svgNode(svg, "text", {
      x: x + barWidth / 2, y: top + plotHeight - barHeight - 7,
      "text-anchor": "middle", class: "data-label"
    }, formatCount(item.count));
    svgNode(svg, "text", {
      x: x + barWidth / 2, y: height - 30, "text-anchor": "middle", class: "axis-label"
    }, item.month.slice(0, 3));
  });
  svgNode(svg, "line", { x1: left, y1: top + plotHeight, x2: left + plotWidth, y2: top + plotHeight, class: "axis" });
  svgNode(svg, "text", { x: left + plotWidth / 2, y: height - 5, "text-anchor": "middle", class: "axis-label" }, "Month");
  svgNode(svg, "text", {
    x: 13, y: top + plotHeight / 2, "text-anchor": "middle", class: "axis-label",
    transform: `rotate(-90 13 ${top + plotHeight / 2})`
  }, "Sales");
}

function renderDistanceChart(container, medianDistance, maxDistance, campus, count) {
  if (!Number.isFinite(medianDistance)) {
    renderEmptyChart(container, "No qualifying sales for this selection.");
    return;
  }

  const compact = window.matchMedia("(max-width: 60rem)").matches;
  const width = compact ? 480 : 900;
  const height = 180;
  const left = compact ? 36 : 55;
  const right = compact ? 36 : 55;
  const axisY = 82;
  const axisWidth = width - left - right;
  const domainMax = maxDistance > 0 ? maxDistance : 1;
  const x = left + medianDistance / domainMax * axisWidth;
  const svg = makeSvg(container, width, height, `Median distance to campus is ${formatNumber(medianDistance, 1)} miles for ${formatCount(count)} sales.`);
  svgNode(svg, "line", { x1: left, y1: axisY, x2: width - right, y2: axisY, class: "axis" });
  [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => {
    const tickX = left + fraction * axisWidth;
    svgNode(svg, "line", { x1: tickX, y1: axisY - 7, x2: tickX, y2: axisY + 7, class: "axis" });
    svgNode(svg, "text", { x: tickX, y: axisY + 26, "text-anchor": "middle", class: "axis-label" },
      formatNumber(domainMax * fraction, 1));
  });
  const point = svgNode(svg, "circle", { cx: x, cy: axisY, r: 9, class: "point", tabindex: 0 });
  addTooltip(point, `${campus}: median ${formatNumber(medianDistance, 1)} miles; ${formatCount(count)} sales`);
  svgNode(svg, "text", {
    x, y: 42, "text-anchor": x > width - right - 90 ? "end" : "start", class: "data-label"
  }, `${formatNumber(medianDistance, 1)} miles`);
  svgNode(svg, "text", {
    x: width / 2, y: 18, "text-anchor": "middle", class: "axis-label"
  }, compact ? `${formatCount(count)} qualifying sales` : `${campus}; ${formatCount(count)} qualifying sales`);
  svgNode(svg, "text", {
    x: width / 2, y: height - 4, "text-anchor": "middle", class: "axis-label"
  }, "Distance to campus (miles)");
}

function createSelectControl(container, id, labelText, values, initialValue) {
  const label = document.createElement("label");
  label.className = "control";
  label.htmlFor = id;
  const title = document.createElement("span");
  title.textContent = labelText;
  const select = document.createElement("select");
  select.id = id;
  values.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  });
  if (initialValue !== undefined) select.value = String(initialValue);
  label.append(title, select);
  container.append(label);
  return select;
}

function createNumberControl(container, id, labelText, initialValue, step = "any") {
  const label = document.createElement("label");
  label.className = "control";
  label.htmlFor = id;
  const title = document.createElement("span");
  title.textContent = labelText;
  const input = document.createElement("input");
  input.type = "number";
  input.id = id;
  input.min = "0";
  input.step = step;
  input.value = String(initialValue);
  label.append(title, input);
  container.append(label);
  return input;
}

function renderLegacyTable(rows) {
  const byCity = new Map();
  rows.forEach((row) => {
    const price = numberValue(row, "sale_price");
    if (row.city && Number.isFinite(price) && price >= MINIMUM_SALE_PRICE) {
      if (!byCity.has(row.city)) byCity.set(row.city, []);
      byCity.get(row.city).push(price);
    }
  });

  const body = document.querySelector("#results tbody");
  body.replaceChildren();
  [...byCity.entries()]
    .sort(([cityA], [cityB]) => cityA.localeCompare(cityB))
    .forEach(([city, prices]) => {
      const row = document.createElement("tr");
      const cityCell = document.createElement("th");
      cityCell.scope = "row";
      cityCell.textContent = city;
      const countCell = document.createElement("td");
      countCell.textContent = formatCount(prices.length);
      const sortedPrices = prices.slice().sort((a, b) => b - a);
      const summary = [
        sortedPrices[0],
        sortedPrices[1],
        sortedPrices[2],
        median(prices),
        mean(prices)
      ];
      countCell.dataset.label = "Qualifying sales";
      const priceCells = summary.map((value, index) => {
        const cell = document.createElement("td");
        cell.className = "price";
        cell.textContent = formatCurrency(value);
        cell.dataset.label = ["Highest sale", "2nd highest", "3rd highest", "Median", "Mean"][index];
        return cell;
      });
      row.append(cityCell, countCell, ...priceCells);
      body.append(row);
    });

  document.querySelector("#status").textContent =
    `${byCity.size} cities from ${formatCount(rows.length)} sales, summarized after the $10,000 cutoff.`;
  document.querySelector("#results").hidden = false;
}

function renderQ1(rows, cities) {
  const grouped = groupBy(rows.filter(validPrice), cityName);
  const summaries = cities.map((city) => {
    const prices = (grouped.get(city) || []).map((row) => numberValue(row, "sale_price"));
    return { city, median: median(prices), count: prices.length };
  });
  const highest = Math.max(...summaries.map((item) => item.median));
  const leaders = summaries.filter((item) => item.median === highest);
  setAnswer("q1", `${leaders.map((item) => item.city).join(", ")} has the highest median sale price at ${formatCurrency(highest)}${leaders.length > 1 ? " (tie)" : ""}.`, leaders.map((item) => item.city));
  renderHorizontalChart(document.querySelector("#q1 .chart"), summaries.map((item) => ({
    label: item.city, value: item.median, count: item.count
  })).sort((a, b) => b.value - a.value), {
    label: "Median valid sale price for every city.",
    format: formatCurrency,
    highlight: leaders.map((item) => item.city),
    axisLabel: "Median sale price",
    value: "median"
  });
  renderDetail("q1", ["City", "Median sale price", "Sales"], summaries
    .slice().sort((a, b) => a.city.localeCompare(b.city))
    .map((item) => [item.city, formatCurrency(item.median), formatCount(item.count)]));
}

function renderQ2(rows, cities) {
  const grouped = groupBy(rows, cityName);
  const summaries = cities.map((city) => {
    const prices = (grouped.get(city) || []).map((row) => numberValue(row, "sale_price")).filter(Number.isFinite);
    const cityMedian = median(prices);
    const cityMean = mean(prices);
    return {
      city,
      median: cityMedian,
      mean: cityMean,
      gap: (cityMean - cityMedian) / cityMedian * 100,
      count: prices.length
    };
  });
  const largestGap = Math.max(...summaries.map((item) => item.gap));
  const leaders = summaries.filter((item) => item.gap === largestGap);
  setAnswer("q2", `${leaders.map((item) => item.city).join(", ")} has the largest mean-above-median gap: ${formatNumber(largestGap, 1)}% (mean ${formatCurrency(leaders[0].mean)}; median ${formatCurrency(leaders[0].median)}).`);
  const leadingPrices = (grouped.get(leaders[0].city) || [])
    .map((row) => numberValue(row, "sale_price")).filter(Number.isFinite);
  const aboveMillion = leadingPrices.filter((price) => price > 1000000).length;
  const aboveFiveMillion = leadingPrices.filter((price) => price > MAXIMUM_SALE_PRICE).length;
  const maximumPrice = Math.max(...leadingPrices);
  setExplanation("q2", `The gap is driven by the upper tail: ${formatCount(aboveMillion)} sales in ${leaders[0].city} exceed $1,000,000, including ${formatCount(aboveFiveMillion)} over the standard $5,000,000 scope limit; the largest is ${formatCurrency(maximumPrice)}. These high values pull the mean upward much more than the median.`);
  renderScatter(document.querySelector("#q2 .chart"), summaries);
  renderDetail("q2", ["City", "Mean sale price", "Median sale price", "Gap above median", "Sales"], summaries
    .slice().sort((a, b) => a.city.localeCompare(b.city))
    .map((item) => [item.city, formatCurrency(item.mean), formatCurrency(item.median), `${formatNumber(item.gap, 1)}%`, formatCount(item.count)]));
}

function rankCities(rows) {
  const grouped = groupBy(rows, cityName);
  const summaries = [...grouped.entries()].map(([city, cityRows]) => ({
    city,
    mean: mean(cityRows.map((row) => numberValue(row, "sale_price")).filter(Number.isFinite))
  })).sort((a, b) => b.mean - a.mean || a.city.localeCompare(b.city));
  let previousMean;
  let currentRank = 0;
  summaries.forEach((item, index) => {
    if (index === 0 || item.mean !== previousMean) currentRank = index + 1;
    item.rank = currentRank;
    previousMean = item.mean;
  });
  return summaries;
}

function renderQ3(rows) {
  const allRanks = rankCities(rows);
  const validRanks = rankCities(rows.filter(validPrice));
  const validByCity = new Map(validRanks.map((item) => [item.city, item]));
  const comparisons = allRanks.map((item) => ({
    city: item.city,
    allMean: item.mean,
    allRank: item.rank,
    validMean: validByCity.get(item.city)?.mean,
    validRank: validByCity.get(item.city)?.rank
  })).sort((a, b) => a.allRank - b.allRank || a.city.localeCompare(b.city));
  const changes = comparisons.filter((item) => item.allRank !== item.validRank);
  const changeText = changes.length
    ? changes.map((item) => {
      const positions = Math.abs(item.validRank - item.allRank);
      const direction = item.validRank < item.allRank ? "up" : "down";
      return `${item.city} ${direction} ${positions} ${positions === 1 ? "position" : "positions"} (${item.allRank} → ${item.validRank})`;
    }).join("; ")
    : "No cities change rank.";
  setAnswer("q3", `Cities that change rank: ${changeText}`);
  renderSlopeChart(document.querySelector("#q3 .chart"), comparisons);
  renderDetail("q3", ["City", "All-row mean", "All-row rank", "Valid-price mean", "Valid-price rank", "Rank change"], comparisons
    .slice().sort((a, b) => a.city.localeCompare(b.city))
    .map((item) => [
      item.city, formatCurrency(item.allMean), String(item.allRank), formatCurrency(item.validMean), String(item.validRank),
      item.validRank === item.allRank ? "No change" : `${item.validRank < item.allRank ? "Up" : "Down"} ${Math.abs(item.validRank - item.allRank)}`
    ]));
}

function renderQ4(rows, areas) {
  const eligible = rows.filter(validPrice);
  const grouped = groupBy(eligible, (row) => row.university);
  const summaries = areas.map((area) => {
    const areaRows = grouped.get(area) || [];
    const prices2024 = areaRows.filter((row) => saleYear(row) === 2024).map((row) => numberValue(row, "sale_price"));
    const prices2025 = areaRows.filter((row) => saleYear(row) === 2025).map((row) => numberValue(row, "sale_price"));
    const median2024 = median(prices2024);
    const median2025 = median(prices2025);
    return {
      area,
      median2024,
      median2025,
      change: Number.isFinite(median2024) && median2024 !== 0 && Number.isFinite(median2025)
        ? (median2025 - median2024) / median2024 * 100
        : NaN
    };
  });
  const increases = summaries.filter((item) => item.change > 0);
  const largestIncrease = increases.length ? Math.max(...increases.map((item) => item.change)) : NaN;
  const leaders = summaries.filter((item) => item.change === largestIncrease);
  const decreases = summaries.filter((item) => item.change < 0);
  const highestText = Number.isFinite(largestIncrease)
    ? `${leaders.map((item) => item.area).join(", ")} had the largest increase at ${formatNumber(largestIncrease, 1)}%.`
    : "No campus area had an increase.";
  const decreaseText = decreases.length
    ? ` Decreases: ${decreases.map((item) => `${item.area} (${formatNumber(item.change, 1)}%)`).join("; ")}.`
    : " No campus area had a decrease.";
  setAnswer("q4", highestText + decreaseText);
  renderHorizontalChart(document.querySelector("#q4 .chart"), summaries.map((item) => ({
    label: item.area, value: item.change
  })).sort((a, b) => (Number.isFinite(b.value) ? b.value : -Infinity) - (Number.isFinite(a.value) ? a.value : -Infinity)), {
    label: "Percent change in median valid sale price by campus area.",
    format: (value) => `${formatNumber(value, 1)}%`,
    axisLabel: "Change in median sale price (%)"
  });
  renderDetail("q4", ["Campus area", "2024 median", "2025 median", "Percent change"], summaries
    .slice().sort((a, b) => a.area.localeCompare(b.area))
    .map((item) => [item.area, formatCurrency(item.median2024), formatCurrency(item.median2025), `${formatNumber(item.change, 1)}%`]));
}

function renderQ5(rows, areas) {
  const eligible = rows.filter((row) => validPrice(row) && Number.isFinite(daysOnMarket(row)));
  const grouped = groupBy(eligible, (row) => row.university);
  const summaries = areas.map((area) => {
    const areaRows = grouped.get(area) || [];
    return { area, median: median(areaRows.map(daysOnMarket)), count: areaRows.length };
  });
  const present = summaries.filter((item) => Number.isFinite(item.median));
  const fastest = present.length ? Math.min(...present.map((item) => item.median)) : NaN;
  const slowest = present.length ? Math.max(...present.map((item) => item.median)) : NaN;
  const fastestAreas = summaries.filter((item) => item.median === fastest).map((item) => item.area);
  const slowestAreas = summaries.filter((item) => item.median === slowest).map((item) => item.area);
  setAnswer("q5", `Slowest: ${slowestAreas.join(", ")} at ${formatNumber(slowest, 1)} days. Fastest: ${fastestAreas.join(", ")} at ${formatNumber(fastest, 1)} days.`);
  renderHorizontalChart(document.querySelector("#q5 .chart"), summaries.map((item) => ({
    label: item.area, value: item.median, count: item.count
  })).sort((a, b) => a.value - b.value), {
    label: "Median days on market by campus area.",
    format: (value) => `${formatNumber(value, 1)} days`,
    axisLabel: "Median days on market (days)"
  });
  renderDetail("q5", ["Campus area", "Median days on market", "Sales with both dates"], summaries
    .slice().sort((a, b) => a.area.localeCompare(b.area))
    .map((item) => [item.area, `${formatNumber(item.median, 1)} days`, formatCount(item.count)]));
}

function renderQ6(rows, areas) {
  const grouped = groupBy(rows.filter(validPrice).filter((row) => {
    const price = numberValue(row, "sale_price");
    const tax = numberValue(row, "tax_annual_amount");
    return Number.isFinite(tax) && tax > 0 && tax < price * 0.1;
  }), (row) => row.university);
  const summaries = areas.map((area) => {
    const areaRows = grouped.get(area) || [];
    const taxTotal = areaRows.reduce((total, row) => total + numberValue(row, "tax_annual_amount"), 0);
    const saleTotal = areaRows.reduce((total, row) => total + numberValue(row, "sale_price"), 0);
    return {
      area, taxTotal, saleTotal, count: areaRows.length,
      burden: saleTotal ? taxTotal / saleTotal * 100 : NaN
    };
  });
  const present = summaries.filter((item) => Number.isFinite(item.burden));
  const highest = present.length ? Math.max(...present.map((item) => item.burden)) : NaN;
  const lowest = present.length ? Math.min(...present.map((item) => item.burden)) : NaN;
  const highestAreas = summaries.filter((item) => item.burden === highest).map((item) => item.area);
  const lowestAreas = summaries.filter((item) => item.burden === lowest).map((item) => item.area);
  setAnswer("q6", `Highest burden: ${highestAreas.join(", ")} at ${formatNumber(highest, 1)}%. Lowest: ${lowestAreas.join(", ")} at ${formatNumber(lowest, 1)}%.`);
  renderHorizontalChart(document.querySelector("#q6 .chart"), summaries.map((item) => ({
    label: item.area, value: item.burden, count: item.count
  })).sort((a, b) => b.value - a.value), {
    label: "Annual tax burden by campus area.",
    format: (value) => `${formatNumber(value, 1)}%`,
    axisLabel: "Annual tax / sale price (%)"
  });
  renderDetail("q6", ["Campus area", "Total annual tax", "Total sale price", "Tax burden", "Sales"], summaries
    .slice().sort((a, b) => a.area.localeCompare(b.area))
    .map((item) => [item.area, formatCurrency(item.taxTotal), formatCurrency(item.saleTotal), `${formatNumber(item.burden, 1)}%`, formatCount(item.count)]));
}

function renderQ7(rows, cities, beds) {
  const grouped = groupBy(rows.filter((row) => validPrice(row) && numberValue(row, "beds") === beds), cityName);
  const summaries = cities.map((city) => {
    const cityRows = grouped.get(city) || [];
    const prices = cityRows.map((row) => numberValue(row, "sale_price"));
    return { city, median: median(prices), count: prices.length };
  });
  const available = summaries.filter((item) => Number.isFinite(item.median));
  let leaders = [];
  if (!available.length) {
    setAnswer("q7", `No valid-price sales were recorded with exactly ${beds} bedrooms.`);
  } else {
    const lowest = Math.min(...available.map((item) => item.median));
    leaders = available.filter((item) => item.median === lowest);
    setAnswer("q7", `${leaders.map((item) => item.city).join(", ")} has the lowest median at ${formatCurrency(lowest)} for exactly ${beds} bedrooms.`, leaders.map((item) => item.city));
  }
  renderHorizontalChart(document.querySelector("#q7 .chart"), summaries.map((item) => ({
    label: item.city, value: item.median, count: item.count
  })).filter((item) => Number.isFinite(item.value)).sort((a, b) => a.value - b.value), {
    label: `Median valid sale price by city for exactly ${beds} bedrooms.`,
    format: formatCurrency,
    highlight: leaders.map((item) => item.city),
    axisLabel: "Median sale price"
  });
  renderDetail("q7", ["City", "Median sale price", "Sales"], summaries
    .slice().sort((a, b) => a.city.localeCompare(b.city))
    .map((item) => [item.city, formatCurrency(item.median), formatCount(item.count)]));
}

function renderQ8(rows, cities, minimum, maximum) {
  const isRangeValid = Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum;
  const effectiveMinimum = Math.max(MINIMUM_SALE_PRICE, minimum);
  const effectiveMaximum = Math.min(MAXIMUM_SALE_PRICE, maximum);
  const eligible = isRangeValid && effectiveMinimum <= effectiveMaximum
    ? rows.filter((row) => {
      const price = numberValue(row, "sale_price");
      return Number.isFinite(price) && price >= effectiveMinimum && price <= effectiveMaximum &&
        Number.isFinite(daysOnMarket(row));
    })
    : [];
  const grouped = groupBy(eligible, cityName);
  const summaries = cities.map((city) => {
    const cityRows = grouped.get(city) || [];
    return { city, median: median(cityRows.map(daysOnMarket)), count: cityRows.length };
  });
  const available = summaries.filter((item) => Number.isFinite(item.median));
  let leaders = [];
  if (!isRangeValid) {
    setAnswer("q8", "Enter a minimum price that is less than or equal to the maximum price.");
  } else if (effectiveMinimum > effectiveMaximum || !available.length) {
    setAnswer("q8", `No sales with both dates fall within the selected range and valid-price scope (${formatCurrency(effectiveMinimum)}–${formatCurrency(effectiveMaximum)}).`);
  } else {
    const shortest = Math.min(...available.map((item) => item.median));
    leaders = available.filter((item) => item.median === shortest);
    setAnswer("q8", `${leaders.map((item) => item.city).join(", ")} has the shortest median days on market at ${formatNumber(shortest, 1)} days, using ${formatCount(leaders.reduce((total, item) => total + item.count, 0))} sales${leaders.length > 1 ? " across the tied cities" : ""}.`, leaders.map((item) => item.city));
  }
  renderHorizontalChart(document.querySelector("#q8 .chart"), summaries.map((item) => ({
    label: item.city, value: item.median, count: item.count
  })).filter((item) => Number.isFinite(item.value)).sort((a, b) => a.value - b.value), {
    label: "Median days on market by city for the selected valid-price range.",
    format: (value) => `${formatNumber(value, 1)} days`,
    highlight: leaders.map((item) => item.city),
    axisLabel: "Median days on market (days)"
  });
  renderDetail("q8", ["City", "Median days on market", "Sales with both dates"], summaries
    .slice().sort((a, b) => a.city.localeCompare(b.city))
    .map((item) => [item.city, `${formatNumber(item.median, 1)} days`, formatCount(item.count)]),
  "No sales with both dates are in the selected valid-price range.");
}

function renderQ9(rows, city, year) {
  const counts = Array.from({ length: 12 }, (_, index) => ({ month: MONTHS[index], count: 0 }));
  rows.forEach((row) => {
    if (cityName(row) !== city || saleYear(row) !== year) return;
    const match = /^\d{4}-(\d{2})-\d{2}$/.exec(row.sale_date);
    if (!match) return;
    const monthIndex = Number(match[1]) - 1;
    if (monthIndex >= 0 && monthIndex < 12) counts[monthIndex].count += 1;
  });
  const largest = Math.max(...counts.map((item) => item.count));
  const leaders = counts.filter((item) => item.count === largest);
  setAnswer("q9", `${formatCount(counts.reduce((total, item) => total + item.count, 0))} sales in ${city} in ${year}. Most sales: ${leaders.map((item) => item.month).join(", ")} (${formatCount(largest)}${leaders.length > 1 ? " each, tied" : ""}).`);
  renderMonthlyChart(document.querySelector("#q9 .chart"), counts);
  renderDetail("q9", ["Month", "Sales"], counts.map((item) => [item.month, formatCount(item.count)]));
}

function renderQ10(rows, campus, budget, minBeds, maxDistance) {
  const validInputs = Number.isFinite(budget) && Number.isFinite(minBeds);
  const eligible = validInputs ? rows.filter((row) => {
    const price = numberValue(row, "sale_price");
    const beds = numberValue(row, "beds");
    return row.university === campus && Number.isFinite(price) &&
      price >= MINIMUM_SALE_PRICE && price <= MAXIMUM_SALE_PRICE &&
      price <= budget && Number.isFinite(beds) && beds >= minBeds &&
      Number.isFinite(numberValue(row, "miles_to_campus"));
  }) : [];
  const distance = median(eligible.map((row) => numberValue(row, "miles_to_campus")));
  if (!validInputs) {
    setAnswer("q10", "Enter a valid maximum budget and minimum bedroom count.");
  } else if (!eligible.length) {
    setAnswer("q10", `No sales meet the conditions for ${campus} (maximum budget ${formatCurrency(budget)}, at least ${formatCount(minBeds)} bedrooms).`);
  } else {
    setAnswer("q10", `Median distance: ${formatNumber(distance, 1)} miles to campus, from ${formatCount(eligible.length)} qualifying sales.`);
  }
  renderDistanceChart(document.querySelector("#q10 .chart"), distance, maxDistance, campus, eligible.length);
  renderDetail("q10", ["Campus area", "Maximum budget", "Minimum bedrooms", "Median distance", "Sales"], eligible.length
    ? [[campus, formatCurrency(budget), formatCount(minBeds), `${formatNumber(distance, 1)} miles`, formatCount(eligible.length)]]
    : [], "No sales meet the selected conditions.");
}

function renderQuestions(rows) {
  const cities = uniqueSorted(rows.map(cityName));
  const areas = uniqueSorted(rows.map((row) => row.university));
  const bedroomValues = uniqueSorted(rows.map((row) => numberValue(row, "beds")).filter(Number.isFinite), (a, b) => a - b);
  const cityOptions = cities.map((city) => ({ value: city, label: city }));
  const areaOptions = areas.map((area) => ({ value: area, label: area }));
  const years = uniqueSorted(rows.map(saleYear).filter(Number.isFinite), (a, b) => a - b);
  const yearOptions = years.map((year) => ({ value: year, label: String(year) }));
  const search = new URLSearchParams(window.location.search);
  const savedBeds = bedroomValues.includes(Number(search.get("q7Beds"))) ? Number(search.get("q7Beds")) : 3;
  const savedCity = cities.includes(search.get("q9City")) ? search.get("q9City") : cities[0];
  const savedYear = years.includes(Number(search.get("q9Year"))) ? Number(search.get("q9Year")) : years[years.length - 1];
  const savedCampus = areas.includes(search.get("q10Area")) ? search.get("q10Area") : areas[0];
  const savedNumber = (key, fallback) => {
    const raw = search.get(key);
    if (raw === null || raw.trim() === "") return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };
  const q8Minimum = savedNumber("q8Min", MINIMUM_SALE_PRICE);
  const q8Maximum = savedNumber("q8Max", MAXIMUM_SALE_PRICE);
  const q10MaximumBudget = savedNumber("q10Budget", 400000);
  const q10MinimumBeds = savedNumber("q10Beds", 3);

  const q7Controls = document.querySelector("#q7 .controls");
  const q7Beds = createSelectControl(q7Controls, "q7-beds", "Exactly this many bedrooms", bedroomValues.map((beds) => ({
    value: beds, label: String(beds)
  })), bedroomValues.includes(savedBeds) ? savedBeds : bedroomValues[0]);
  const q8Controls = document.querySelector("#q8 .controls");
  const q8Min = createNumberControl(q8Controls, "q8-min-price", "Minimum price ($)", q8Minimum);
  const q8Max = createNumberControl(q8Controls, "q8-max-price", "Maximum price ($)", q8Maximum);
  const q9Controls = document.querySelector("#q9 .controls");
  const q9City = createSelectControl(q9Controls, "q9-city", "City", cityOptions, savedCity);
  const q9Year = createSelectControl(q9Controls, "q9-year", "Year", yearOptions, savedYear);
  const q10Controls = document.querySelector("#q10 .controls");
  const q10Campus = createSelectControl(q10Controls, "q10-campus", "Campus area", areaOptions, savedCampus);
  const q10Budget = createNumberControl(q10Controls, "q10-budget", "Maximum budget ($)", q10MaximumBudget);
  const q10Beds = createNumberControl(q10Controls, "q10-min-beds", "Minimum bedrooms", q10MinimumBeds, "1");
  const maxDistance = Math.max(...rows.map((row) => numberValue(row, "miles_to_campus")).filter(Number.isFinite));

  const updateQ7 = () => renderQ7(rows, cities, Number(q7Beds.value));
  const updateQ8 = () => renderQ8(rows, cities, inputNumber(q8Min), inputNumber(q8Max));
  const updateQ9 = () => renderQ9(rows, q9City.value, Number(q9Year.value));
  const updateQ10 = () => renderQ10(rows, q10Campus.value, inputNumber(q10Budget), inputNumber(q10Beds), maxDistance);
  const renderAllQuestions = () => {
    renderQ1(rows, cities);
    renderQ2(rows, cities);
    renderQ3(rows);
    renderQ4(rows, areas);
    renderQ5(rows, areas);
    renderQ6(rows, areas);
    updateQ7();
    updateQ8();
    updateQ9();
    updateQ10();
  };
  const syncQuestionParams = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("q7Beds", q7Beds.value);
    params.set("q8Min", q8Min.value);
    params.set("q8Max", q8Max.value);
    params.set("q9City", q9City.value);
    params.set("q9Year", q9Year.value);
    params.set("q10Area", q10Campus.value);
    params.set("q10Budget", q10Budget.value);
    params.set("q10Beds", q10Beds.value);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  };
  q7Beds.addEventListener("change", () => { updateQ7(); syncQuestionParams(); });
  q8Min.addEventListener("input", () => { updateQ8(); syncQuestionParams(); });
  q8Max.addEventListener("input", () => { updateQ8(); syncQuestionParams(); });
  q9City.addEventListener("change", () => { updateQ9(); syncQuestionParams(); });
  q9Year.addEventListener("change", () => { updateQ9(); syncQuestionParams(); });
  q10Campus.addEventListener("change", () => { updateQ10(); syncQuestionParams(); });
  q10Budget.addEventListener("input", () => { updateQ10(); syncQuestionParams(); });
  q10Beds.addEventListener("input", () => { updateQ10(); syncQuestionParams(); });
  renderAllQuestions();
  let compactCharts = window.matchMedia("(max-width: 60rem)").matches;
  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const nextLayout = window.matchMedia("(max-width: 60rem)").matches;
      if (nextLayout === compactCharts) return;
      compactCharts = nextLayout;
      renderAllQuestions();
    }, 120);
  });
  document.querySelector("#questions").hidden = false;
}

function initializePresentationControls() {
  const root = document.documentElement;
  const toggle = document.querySelector("#theme-toggle");
  toggle.addEventListener("click", () => {
    const dark = root.dataset.theme !== "dark";
    root.dataset.theme = dark ? "dark" : "light";
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.textContent = dark ? "Use light mode" : "Use dark mode";
  });

  const tooltip = document.querySelector("#chart-tooltip");
  const placeTooltip = (x, y) => {
    tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tooltip.offsetWidth - 8, x + 12))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - tooltip.offsetHeight - 8, y + 12))}px`;
  };
  const showTooltip = (target, x, y) => {
    const element = target.closest("[data-tooltip]");
    if (!element) return;
    tooltip.textContent = element.dataset.tooltip;
    tooltip.hidden = false;
    placeTooltip(x, y);
  };
  document.addEventListener("pointerover", (event) => showTooltip(event.target, event.clientX, event.clientY));
  document.addEventListener("pointermove", (event) => {
    if (!tooltip.hidden) placeTooltip(event.clientX, event.clientY);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.closest("[data-tooltip]") && !event.relatedTarget?.closest?.("[data-tooltip]")) tooltip.hidden = true;
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-tooltip]");
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    showTooltip(target, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest("[data-tooltip]")) tooltip.hidden = true;
  });
}

initializePresentationControls();

fetch(DATA_PATH)
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load sales data (${response.status}).`);
    return response.text();
  })
  .then((text) => {
    const rows = parseCsv(text);
    if (!rows.length) throw new Error("The sales data file is empty.");
    renderLegacyTable(rows);
    renderQuestions(rows);
    document.dispatchEvent(new CustomEvent("sales:loaded", { detail: { rows } }));
  })
  .catch((error) => {
    document.querySelector("#status").textContent = `Unable to load the sales data: ${error.message}`;
  });
