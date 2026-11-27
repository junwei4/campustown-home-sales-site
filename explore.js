"use strict";

(() => {
  const MIN_PRICE = 10000;
  const MAX_PRICE = 5000000;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const FEATURE_OPTIONS = [
    { value: "any", label: "Any" },
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "unknown", label: "Unknown" }
  ];
  const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const currencyFormat = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  });

  let sales = [];
  let cities = [];
  let areas = [];
  let cityLocations = [];
  let livingExtent = [0, 0];
  let sort = { key: "median", direction: "desc" };
  let state;
  let controls = {};
  let compactLayout = false;

  function number(row, field) {
    if (row[field] === undefined || row[field].trim() === "") return NaN;
    return Number(row[field]);
  }

  function median(values) {
    if (!values.length) return NaN;
    const ordered = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  }

  function cityName(row) {
    return `${row.city}, ${row.state}`;
  }

  function saleYear(row) {
    const match = /^(\d{4})-\d{2}-\d{2}$/.exec(row.sale_date);
    return match ? Number(match[1]) : NaN;
  }

  function validPrice(row) {
    const price = number(row, "sale_price");
    return Number.isFinite(price) && price >= MIN_PRICE && price <= MAX_PRICE;
  }

  function urlParams() {
    return new URLSearchParams(window.location.search);
  }

  function queryStringValue(key, fallback) {
    return urlParams().get(key) ?? fallback;
  }

  function queryNumber(key, fallback) {
    const value = Number(queryStringValue(key, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  function saveUrl() {
    const params = urlParams();
    Object.entries(state).forEach(([key, value]) => {
      const parameter = ({ has_garage: "garage", has_basement: "basement", has_fireplace: "fireplace" })[key] || key;
      if (value === "any" || value === "") params.delete(parameter);
      else params.set(parameter, String(value));
    });
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }

  function createSelect(parent, id, labelText, options, value) {
    const label = document.createElement("label");
    label.className = "control";
    label.htmlFor = id;
    const caption = document.createElement("span");
    caption.textContent = labelText;
    const select = document.createElement("select");
    select.id = id;
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item.value);
      option.textContent = item.label;
      select.append(option);
    });
    if (value !== undefined) select.value = String(value);
    label.append(caption, select);
    parent.append(label);
    return select;
  }

  function createNumberInput(parent, id, labelText, value, min, max) {
    const label = document.createElement("label");
    label.className = "control";
    label.htmlFor = id;
    const caption = document.createElement("span");
    caption.textContent = labelText;
    const input = document.createElement("input");
    input.id = id;
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = "any";
    input.value = String(value);
    label.append(caption, input);
    parent.append(label);
    return input;
  }

  function addFilter(parent, key, label, options, value) {
    const select = createSelect(parent, `filter-${key}`, label, options, value);
    controls[key] = select;
    select.addEventListener("change", () => {
      state[key] = select.value;
      if (key === "city" && state.city !== "any") state.area = "any";
      if (key === "area" && state.area !== "any") state.city = "any";
      controls.city.value = state.city;
      controls.area.value = state.area;
      refresh();
    });
  }

  function setRangeValue(key, value, source) {
    if (String(value).trim() === "") return;
    const numeric = Math.max(livingExtent[0], Math.min(livingExtent[1], Number(value)));
    if (!Number.isFinite(numeric)) return;
    if (key === "livingMin" && numeric > state.livingMax) state.livingMax = numeric;
    if (key === "livingMax" && numeric < state.livingMin) state.livingMin = numeric;
    state[key] = numeric;
    if (source !== controls.livingMin) controls.livingMin.value = String(state.livingMin);
    if (source !== controls.livingMinSlider) controls.livingMinSlider.value = String(state.livingMin);
    if (source !== controls.livingMax) controls.livingMax.value = String(state.livingMax);
    if (source !== controls.livingMaxSlider) controls.livingMaxSlider.value = String(state.livingMax);
  }

  function createLivingRange() {
    const parent = document.querySelector("#living-range");
    const title = document.createElement("h3");
    title.textContent = "Living area range (sq ft)";
    parent.append(title);
    controls.livingMin = createNumberInput(parent, "living-min", "Minimum living area", state.livingMin, livingExtent[0], livingExtent[1]);
    controls.livingMinSlider = document.createElement("input");
    controls.livingMaxSlider = document.createElement("input");
    [
      [controls.livingMinSlider, "living-min-slider", "Minimum living area slider", state.livingMin],
      [controls.livingMaxSlider, "living-max-slider", "Maximum living area slider", state.livingMax]
    ].forEach(([slider, id, label, value]) => {
      slider.type = "range";
      slider.id = id;
      slider.min = String(livingExtent[0]);
      slider.max = String(livingExtent[1]);
      slider.step = "1";
      slider.value = String(value);
      slider.setAttribute("aria-label", label);
      parent.append(slider);
    });
    controls.livingMax = createNumberInput(parent, "living-max", "Maximum living area", state.livingMax, livingExtent[0], livingExtent[1]);
    [controls.livingMin, controls.livingMinSlider].forEach((input) => {
      input.addEventListener("input", () => {
        setRangeValue("livingMin", input.value, input);
        refresh();
      });
    });
    [controls.livingMax, controls.livingMaxSlider].forEach((input) => {
      input.addEventListener("input", () => {
        setRangeValue("livingMax", input.value, input);
        refresh();
      });
    });
  }

  function createControls() {
    const parent = document.querySelector("#explore-controls");
    const locations = [
      { value: "any", label: "All campus areas" },
      ...areas.map((area) => ({ value: area, label: area }))
    ];
    const cityOptions = [
      { value: "any", label: "All cities" },
      ...cities.map((city) => ({ value: city, label: city }))
    ];
    const years = [...new Set(sales.map(saleYear).filter(Number.isFinite))].sort((a, b) => a - b);
    const yearOptions = [
      { value: "any", label: "All years" },
      ...years.map((year) => ({ value: year, label: String(year) }))
    ];
    const bedrooms = [...new Set(sales.map((row) => number(row, "beds")).filter(Number.isFinite))].sort((a, b) => a - b);
    const bedroomOptions = [
      { value: "any", label: "Any bedrooms" },
      ...bedrooms.map((beds) => ({ value: beds, label: `${beds} bedroom${beds === 1 ? "" : "s"}` }))
    ];
    const featureOptions = ["has_garage", "has_basement", "has_fireplace"];
    const featureNames = { has_garage: "Garage", has_basement: "Basement", has_fireplace: "Fireplace" };

    addFilter(parent, "area", "Campus area", locations, state.area);
    addFilter(parent, "city", "City", cityOptions, state.city);
    addFilter(parent, "year", "Sale year", yearOptions, state.year);
    addFilter(parent, "beds", "Bedrooms", bedroomOptions, state.beds);
    controls.priceMin = createNumberInput(parent, "price-min", "Minimum price ($)", state.priceMin, MIN_PRICE, MAX_PRICE);
    controls.priceMax = createNumberInput(parent, "price-max", "Maximum price ($)", state.priceMax, MIN_PRICE, MAX_PRICE);
    [controls.priceMin, controls.priceMax].forEach((input, index) => {
      const key = index === 0 ? "priceMin" : "priceMax";
      input.addEventListener("input", () => {
        const value = input.value.trim() === "" ? NaN : Number(input.value);
        state[key] = Number.isFinite(value) ? value : "";
        refresh();
      });
    });
    featureOptions.forEach((feature) => {
      addFilter(parent, feature, featureNames[feature], FEATURE_OPTIONS, state[feature]);
    });
    createLivingRange();
    createComparisonControls();
  }

  function createComparisonControls() {
    const parent = document.querySelector("#compare-controls");
    const options = [
      ...cities.map((city) => ({ value: `city|${city}`, label: `City: ${city}` })),
      ...areas.map((area) => ({ value: `area|${area}`, label: `Campus: ${area}` }))
    ];
    const savedFirst = queryStringValue("compareA", options[0]?.value);
    const savedSecond = queryStringValue("compareB", options[1]?.value ?? options[0]?.value);
    const first = options.some((option) => option.value === savedFirst) ? savedFirst : options[0]?.value;
    const second = options.some((option) => option.value === savedSecond) ? savedSecond : options[1]?.value ?? options[0]?.value;
    state.compareA = first;
    state.compareB = second;
    controls.compareA = createSelect(parent, "compare-a", "Compare location A", options, first);
    controls.compareB = createSelect(parent, "compare-b", "Compare location B", options, second);
    [controls.compareA, controls.compareB].forEach((select, index) => {
      const key = index === 0 ? "compareA" : "compareB";
      select.addEventListener("change", () => {
        state[key] = select.value;
        refresh();
      });
    });
  }

  function readState() {
    const params = urlParams();
    const area = areas.includes(params.get("area")) ? params.get("area") : "any";
    const city = cities.includes(params.get("city")) ? params.get("city") : "any";
    const years = [...new Set(sales.map(saleYear).filter(Number.isFinite))];
    const yearParam = params.get("year");
    const year = years.includes(Number(yearParam)) ? yearParam : "any";
    const beds = params.get("beds");
    const bedroomValues = sales.map((row) => number(row, "beds"));
    const validBeds = bedroomValues.includes(Number(beds)) ? beds : "any";
    const minLiving = livingExtent[0];
    const maxLiving = livingExtent[1];
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const priceMin = clamp(queryNumber("priceMin", MIN_PRICE), MIN_PRICE, MAX_PRICE);
    const priceMax = clamp(queryNumber("priceMax", MAX_PRICE), MIN_PRICE, MAX_PRICE);
    let livingMin = clamp(queryNumber("livingMin", minLiving), minLiving, maxLiving);
    let livingMax = clamp(queryNumber("livingMax", maxLiving), minLiving, maxLiving);
    if (livingMin > livingMax) [livingMin, livingMax] = [livingMax, livingMin];
    const featureValue = (key) => FEATURE_OPTIONS.some((option) => option.value === params.get(key))
      ? params.get(key) : "any";
    return {
      area, city, year, beds: validBeds, priceMin, priceMax, livingMin, livingMax,
      has_garage: featureValue("garage"),
      has_basement: featureValue("basement"),
      has_fireplace: featureValue("fireplace"),
      compareA: queryStringValue("compareA", ""),
      compareB: queryStringValue("compareB", "")
    };
  }

  function filteredRows(options = {}) {
    const narrowedLiving = state.livingMin > livingExtent[0] || state.livingMax < livingExtent[1];
    return sales.filter((row) => {
      const price = number(row, "sale_price");
      if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) return false;
      if (state.priceMin === "" || state.priceMax === "" || price < state.priceMin || price > state.priceMax) return false;
      if (!options.ignoreLocation && state.area !== "any" && row.university !== state.area) return false;
      if (!options.ignoreLocation && state.city !== "any" && cityName(row) !== state.city) return false;
      if (state.year !== "any" && saleYear(row) !== Number(state.year)) return false;
      if (state.beds !== "any" && number(row, "beds") !== Number(state.beds)) return false;
      const areaValue = number(row, "living_area_sqft");
      if (narrowedLiving && (!Number.isFinite(areaValue) || areaValue < state.livingMin || areaValue > state.livingMax)) return false;
      for (const [field, key] of [["has_garage", "has_garage"], ["has_basement", "has_basement"], ["has_fireplace", "has_fireplace"]]) {
        const preference = state[key];
        if (preference === "any") continue;
        const value = row[field].trim();
        if (preference === "unknown" && value !== "") return false;
        if (preference === "yes" && value !== "1") return false;
        if (preference === "no" && value !== "0") return false;
      }
      return true;
    });
  }

  function groupRows(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const city = cityName(row);
      if (!groups.has(city)) groups.set(city, []);
      groups.get(city).push(row);
    });
    return [...groups.entries()].map(([city, rows]) => {
      const prices = rows.map((row) => number(row, "sale_price")).filter(Number.isFinite);
      return { city, count: rows.length, median: median(prices), mean: prices.reduce((sum, price) => sum + price, 0) / prices.length };
    });
  }

  function renderSummary(rows, grouped) {
    const container = document.querySelector("#explore-summary");
    container.replaceChildren();
    const priceMedian = median(rows.map((row) => number(row, "sale_price")).filter(Number.isFinite));
    const livingMedian = median(rows.map((row) => number(row, "living_area_sqft")).filter(Number.isFinite));
    const stats = [
      ["Matching sales", numberFormat.format(rows.length)],
      ["Median sale price", Number.isFinite(priceMedian) ? currencyFormat.format(priceMedian) : "—"],
      ["Cities represented", numberFormat.format(grouped.length)],
      ["Median living area", Number.isFinite(livingMedian) ? `${numberFormat.format(livingMedian)} sq ft` : "—"]
    ];
    stats.forEach(([label, value]) => {
      const card = document.createElement("article");
      card.className = "panel stat-card";
      const strong = document.createElement("strong");
      strong.textContent = value;
      const caption = document.createElement("span");
      caption.textContent = label;
      card.append(strong, caption);
      container.append(card);
    });
  }

  function makeSvgElement(parent, tag, attributes = {}, text = "") {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text) element.textContent = text;
    parent.append(element);
    return element;
  }

  function renderMap(rows) {
    const target = document.querySelector("#location-map");
    target.replaceChildren();
    const currentCities = new Set(rows.map(cityName));
    const compact = window.matchMedia("(max-width: 60rem)").matches;
    const width = compact ? 480 : 900;
    const height = compact ? 390 : 480;
    const padding = compact
      ? { top: 16, right: 14, bottom: 48, left: 72 }
      : { top: 24, right: 24, bottom: 52, left: 62 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const longitudes = cityLocations.map((item) => item.longitude);
    const latitudes = cityLocations.map((item) => item.latitude);
    const minLon = Math.min(...longitudes) - 0.6;
    const maxLon = Math.max(...longitudes) + 0.6;
    const minLat = Math.min(...latitudes) - 0.6;
    const maxLat = Math.max(...latitudes) + 0.6;
    const x = (longitude) => padding.left + (longitude - minLon) / (maxLon - minLon) * plotWidth;
    const y = (latitude) => padding.top + (maxLat - latitude) / (maxLat - minLat) * plotHeight;
    const svg = makeSvgElement(target, "svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "group",
      "aria-label": "Interactive map of city locations, positioned using median sale latitude and longitude."
    });
    if (compact) svg.classList.add("compact-map");

    for (let tick = 0; tick <= 4; tick += 1) {
      const fraction = tick / 4;
      const gridX = padding.left + fraction * plotWidth;
      const gridY = padding.top + fraction * plotHeight;
      makeSvgElement(svg, "line", {
        x1: gridX, y1: padding.top, x2: gridX, y2: padding.top + plotHeight, class: "map-grid"
      });
      makeSvgElement(svg, "line", {
        x1: padding.left, y1: gridY, x2: padding.left + plotWidth, y2: gridY, class: "map-grid"
      });
      makeSvgElement(svg, "text", {
        x: gridX, y: height - 23, "text-anchor": "middle", class: "map-axis-label"
      }, `${(minLon + fraction * (maxLon - minLon)).toFixed(1)}°`);
      makeSvgElement(svg, "text", {
        x: padding.left - 10, y: gridY + 4, "text-anchor": "end", class: "map-axis-label"
      }, `${(maxLat - fraction * (maxLat - minLat)).toFixed(1)}°`);
    }

    const placedLabels = [];
    cityLocations.forEach((location) => {
      const cx = x(location.longitude);
      const cy = y(location.latitude);
      const active = currentCities.has(location.city);
      const selected = state.city === location.city;
      const group = makeSvgElement(svg, "g", {
        role: "button",
        tabindex: active ? 0 : -1,
        "aria-label": `${location.city}${active ? ", select city" : ", no sales match current filters"}`,
        "aria-pressed": selected ? "true" : "false",
        "aria-disabled": active ? "false" : "true",
        class: "map-location"
      });
      group.setAttribute("data-tooltip", `${location.city}: ${location.latitude.toFixed(3)}°, ${location.longitude.toFixed(3)}°${active ? "" : "; no sales match current filters"}`);
      const point = makeSvgElement(group, "circle", {
        cx, cy, r: compact ? (selected ? 10 : 8) : (selected ? 8 : 6), class: "map-point"
      });
      point.setAttribute("aria-hidden", "true");
      const cityLabel = location.city.split(",")[0];
      const labelWidth = cityLabel.length * 7;
      const rightRoom = width - cx - 10;
      const leftRoom = cx - 10;
      const preferredRight = rightRoom >= labelWidth || (leftRoom < labelWidth && rightRoom >= leftRoom);
      const labelSides = preferredRight ? [true, false] : [false, true];
      const verticalOffsets = [0];
      for (let offset = 14; offset <= 140; offset += 14) verticalOffsets.push(-offset, offset);
      let placement;
      for (const offset of verticalOffsets) {
        const baseline = cy + 4 + offset;
        if (baseline - 9 < padding.top || baseline + 3 > height - padding.bottom) continue;
        for (const onRight of labelSides) {
          const labelX = cx + (onRight ? 9 : -9);
          const left = onRight ? labelX : labelX - labelWidth;
          const right = onRight ? labelX + labelWidth : labelX;
          const overlaps = placedLabels.some((label) =>
            left < label.right + 4 && right > label.left - 4 &&
            baseline - 9 < label.bottom + 2 && baseline + 3 > label.top - 2
          );
          if (left < 2 || right > width - 2 || overlaps) continue;
          placement = { x: labelX, y: baseline, onRight, left, right, top: baseline - 9, bottom: baseline + 3 };
          break;
        }
        if (placement) break;
      }
      if (!placement) {
        const onRight = preferredRight;
        const labelX = cx + (onRight ? 9 : -9);
        const baseline = Math.max(padding.top + 10, Math.min(height - padding.bottom - 3, cy + 4));
        placement = {
          x: labelX, y: baseline, onRight,
          left: onRight ? labelX : labelX - labelWidth,
          right: onRight ? labelX + labelWidth : labelX,
          top: baseline - 9, bottom: baseline + 3
        };
      }
      placedLabels.push(placement);
      if (Math.abs(placement.y - (cy + 4)) > 14) {
        makeSvgElement(group, "line", {
          x1: cx + (placement.onRight ? 6 : -6),
          y1: cy + 1,
          x2: placement.onRight ? placement.left - 3 : placement.right + 3,
          y2: placement.y - 3,
          class: "map-label-line"
        });
      }
      makeSvgElement(group, "text", {
        x: placement.x,
        y: placement.y,
        "text-anchor": placement.onRight ? "start" : "end",
        class: "map-label"
      }, cityLabel);
      const chooseCity = () => {
        if (!active) return;
        state.city = location.city;
        state.area = "any";
        controls.city.value = state.city;
        controls.area.value = "any";
        refresh();
      };
      group.addEventListener("click", chooseCity);
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseCity();
        }
      });
    });
    makeSvgElement(svg, "text", {
      x: width / 2, y: height - 4, "text-anchor": "middle", class: "map-axis-label"
    }, "Longitude");
    makeSvgElement(svg, "text", {
      x: 16, y: height / 2, "text-anchor": "middle", class: "map-axis-label",
      transform: `rotate(-90 16 ${height / 2})`
    }, "Latitude");
  }

  function renderComparison() {
    const target = document.querySelector("#comparison");
    target.replaceChildren();
    const rows = filteredRows({ ignoreLocation: true });
    [state.compareA, state.compareB].forEach((value, index) => {
      const [type, name] = (value || "").split("|");
      const subset = rows.filter((row) => type === "area" ? row.university === name : cityName(row) === name);
      const prices = subset.map((row) => number(row, "sale_price")).filter(Number.isFinite);
      const card = document.createElement("article");
      card.className = "compare-card";
      const title = document.createElement("h4");
      title.textContent = `${type === "area" ? "Campus" : "City"}: ${name || `Location ${index + 1}`}`;
      const list = document.createElement("dl");
      [["Median sale price", prices.length ? currencyFormat.format(median(prices)) : "No matching sales"],
        ["Sales", numberFormat.format(subset.length)]].forEach(([label, value]) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const detail = document.createElement("dd");
        detail.textContent = value;
        list.append(term, detail);
      });
      card.append(title, list);
      target.append(card);
    });
  }

  function renderPriceChart(grouped) {
    const target = document.querySelector("#explore-price-chart");
    target.replaceChildren();
    if (!grouped.length) {
      const message = document.createElement("p");
      message.textContent = "No city medians to chart for these filters.";
      target.append(message);
      return;
    }

    const compact = window.matchMedia("(max-width: 60rem)").matches;
    const width = compact ? 420 : 760;
    const left = compact ? 145 : 190;
    const right = compact ? 56 : 104;
    const plotWidth = width - left - right;
    const top = 18;
    const rowHeight = compact ? 38 : 32;
    const bottom = compact ? 60 : 54;
    const height = top + grouped.length * rowHeight + bottom;
    const maximum = Math.max(...grouped.map((item) => item.median));
    const x = (value) => left + value / maximum * plotWidth;
    const svg = makeSvgElement(target, "svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Median valid sale price by city for the current explore filters."
    });
    if (compact) svg.classList.add("compact-chart");
    const ticks = compact ? 2 : 4;
    for (let index = 0; index <= ticks; index += 1) {
      const value = maximum * index / ticks;
      const tickX = x(value);
      makeSvgElement(svg, "line", {
        x1: tickX, y1: top, x2: tickX, y2: height - bottom, class: "grid-line"
      });
      makeSvgElement(svg, "text", {
        x: tickX, y: height - 26, "text-anchor": "middle", class: "axis-label"
      }, currencyFormat.format(value));
    }
    makeSvgElement(svg, "text", {
      x: left + plotWidth / 2, y: height - 5, "text-anchor": "middle", class: "axis-label"
    }, "Median sale price");
    const winner = Math.max(...grouped.map((item) => item.median));
    grouped.forEach((item, index) => {
      const centerY = top + index * rowHeight + rowHeight / 2;
      makeSvgElement(svg, "text", {
        x: left - 8, y: centerY + 4, "text-anchor": "end",
        class: state.city === item.city ? "data-label highlight-label" : "data-label"
      }, compact ? item.city.split(",")[0] : item.city);
      const bar = makeSvgElement(svg, "rect", {
        x: left, y: centerY - 7, width: Math.max(1, x(item.median) - left), height: 14, rx: 2,
        class: item.city === state.city || (!state.city || state.city === "any") && item.median === winner
          ? "bar highlight" : "bar quiet"
      });
      const tooltip = `${item.city}: median ${currencyFormat.format(item.median)}; ${numberFormat.format(item.count)} sales`;
      bar.setAttribute("data-tooltip", tooltip);
      bar.setAttribute("aria-label", tooltip);
      const atRight = x(item.median) > width - right - 70;
      makeSvgElement(svg, "text", {
        x: atRight ? x(item.median) - 7 : x(item.median) + 7,
        y: centerY + 4, "text-anchor": atRight ? "end" : "start", class: "data-label"
      }, currencyFormat.format(item.median));
    });
  }

  function sortIcon(direction, active) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("class", "sort-icon");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", active
      ? (direction === "asc" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4")
      : "M4 6l4-4 4 4M4 10l4 4 4-4");
    svg.append(path);
    return svg;
  }

  function renderTable(grouped) {
    const table = document.querySelector("#explore-results");
    const head = table.querySelector("thead");
    const body = table.querySelector("tbody");
    head.replaceChildren();
    body.replaceChildren();
    const columns = [
      ["city", "City", (item) => item.city],
      ["count", "Sales", (item) => item.count],
      ["median", "Median sale price", (item) => item.median],
      ["mean", "Mean sale price", (item) => item.mean]
    ];
    const headerRow = document.createElement("tr");
    columns.forEach(([key, label]) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      if (sort.key === key) cell.setAttribute("aria-sort", sort.direction === "asc" ? "ascending" : "descending");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sort-button";
      button.setAttribute("aria-label", `Sort by ${label}${sort.key === key ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`);
      button.textContent = label;
      button.append(sortIcon(sort.direction, sort.key === key));
      button.addEventListener("click", () => {
        if (sort.key === key) sort.direction = sort.direction === "asc" ? "desc" : "asc";
        else {
          sort.key = key;
          sort.direction = key === "city" ? "asc" : "desc";
        }
        renderTable(grouped);
      });
      cell.append(button);
      headerRow.append(cell);
    });
    head.append(headerRow);
    const column = columns.find(([key]) => key === sort.key);
    const ordered = grouped.slice().sort((a, b) => {
      const left = column[2](a);
      const right = column[2](b);
      const result = typeof left === "string" ? left.localeCompare(right) : left - right;
      return result * (sort.direction === "asc" ? 1 : -1);
    });
    if (!ordered.length) {
      const row = document.createElement("tr");
      const message = document.createElement("td");
      message.colSpan = columns.length;
      message.textContent = "No city results match these filters.";
      row.append(message);
      body.append(row);
      return;
    }
    ordered.forEach((item) => {
      const row = document.createElement("tr");
      [item.city, numberFormat.format(item.count), currencyFormat.format(item.median), currencyFormat.format(item.mean)]
        .forEach((value, index) => {
          const cell = document.createElement(index ? "td" : "th");
          if (!index) cell.scope = "row";
          else cell.dataset.label = ["", "Sales", "Median sale price", "Mean sale price"][index];
          cell.textContent = value;
          if (index === 2) cell.className = "price";
          row.append(cell);
        });
      body.append(row);
    });
  }

  function refresh() {
    saveUrl();
    const rows = filteredRows();
    const mapRows = filteredRows({ ignoreLocation: true });
    const grouped = groupRows(rows);
    document.querySelector("#explore-empty").hidden = rows.length > 0;
    renderSummary(rows, grouped);
    renderMap(mapRows);
    renderComparison();
    renderPriceChart(grouped.slice().sort((a, b) => b.median - a.median));
    renderTable(grouped);
  }

  function initialize(rows) {
    sales = rows;
    cities = [...new Set(sales.map(cityName))].sort((a, b) => a.localeCompare(b));
    areas = [...new Set(sales.map((row) => row.university))].sort((a, b) => a.localeCompare(b));
    const livingValues = sales.map((row) => number(row, "living_area_sqft")).filter(Number.isFinite);
    livingExtent = [Math.min(...livingValues), Math.max(...livingValues)];
    cityLocations = cities.map((city) => {
      const locationRows = sales.filter((row) => cityName(row) === city);
      return {
        city,
        latitude: median(locationRows.map((row) => number(row, "latitude")).filter(Number.isFinite)),
        longitude: median(locationRows.map((row) => number(row, "longitude")).filter(Number.isFinite))
      };
    });
    state = readState();
    createControls();
    refresh();
    document.querySelector("#explore").hidden = false;
    compactLayout = window.matchMedia("(max-width: 60rem)").matches;
    let resizeTimer;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const nextLayout = window.matchMedia("(max-width: 60rem)").matches;
        if (nextLayout === compactLayout) return;
        compactLayout = nextLayout;
        refresh();
      }, 120);
    });
  }

  document.addEventListener("sales:loaded", (event) => initialize(event.detail.rows), { once: true });
})();
