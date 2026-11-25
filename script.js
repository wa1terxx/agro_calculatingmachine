(() => {
  "use strict";

  let mode = "crop";

  const presets = {
    crop: {
      scaleLabel: "Площадь поля (га)",
      outputLabel: "Урожайность (т / га)",
      seedsLabel: "Семена на 1 га (₽)",
      fertLabel: "Удобрения и СЗР на 1 га (₽)",
      fuelLabel: "ГСМ и операции на 1 га (₽)",
      leaseLabel: "Аренда техники и базы (₽)",
      priceLabel: "Цена реализации за 1 т (₽)",
      unitName: "т",
      values: {
        scale: 150, outputPerUnit: 4.2, seedsFeed: 9500,
        fertilizer: 11000, fuel: 7500, lease: 1400000, price: 15000,
      },
    },
    farm: {
      scaleLabel: "Поголовье КРС (гол.)",
      outputLabel: "Надой в год (т / голову)",
      seedsLabel: "Корма на 1 голову в год (₽)",
      fertLabel: "Ветеринария и добавки / гол. (₽)",
      fuelLabel: "ГСМ и содержание на 1 гол. (₽)",
      leaseLabel: "Аренда фермы и оборудования (₽)",
      priceLabel: "Цена реализации 1 т молока (₽)",
      unitName: "т",
      values: {
        scale: 80, outputPerUnit: 7.5, seedsFeed: 95000,
        fertilizer: 18000, fuel: 22000, lease: 1800000, price: 38000,
      },
    },
  };

  const $ = (id) => document.getElementById(id);

  const fmtRub = (n) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";

  const fmtDelta = (n) => {
    const sign = n > 0 ? "+" : "";
    return `${sign}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n))} ₽`;
  };

  // Soft number change animation
  function setTextWithFlash(el, text, isNegative) {
    if (el.textContent !== text) {
      el.textContent = text;
      el.classList.remove("value-flash");
      void el.offsetWidth; // force reflow to restart animation
      el.classList.add("value-flash");
    }
    el.classList.toggle("is-negative", Boolean(isNegative));
  }

  function setMode(nextMode) {
    mode = nextMode;
    $("btn-crop").classList.toggle("active", mode === "crop");
    $("btn-farm").classList.toggle("active", mode === "farm");
    $("btn-crop").setAttribute("aria-selected", mode === "crop");
    $("btn-farm").setAttribute("aria-selected", mode === "farm");

    const p = presets[mode];
    $("lbl-scale").textContent = p.scaleLabel;
    $("lbl-output").textContent = p.outputLabel;
    $("lbl-seeds").textContent = p.seedsLabel;
    $("lbl-fert").textContent = p.fertLabel;
    $("lbl-fuel").textContent = p.fuelLabel;
    $("lbl-lease").textContent = p.leaseLabel;
    $("lbl-price").textContent = p.priceLabel;
    $("lbl-cost-unit").textContent = `Себестоимость 1 ${p.unitName}`;

    for (const [k, v] of Object.entries(p.values)) {
      $(k).value = v;
    }

    calculate();
  }

  function computeModel(scale, outputPerUnit, varPerScale, fixedCosts, price) {
    const totalOutput = Math.max(0.0001, scale * outputPerUnit);
    const totalCosts = fixedCosts + scale * varPerScale;
    const revenue = totalOutput * price;
    const profit = revenue - totalCosts;
    const costPerUnit = totalCosts / totalOutput;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    const breakevenUnits = price > 0 ? totalCosts / price : 0;
    return { totalOutput, totalCosts, revenue, profit, costPerUnit, marginPct, breakevenUnits };
  }

  function calculate() {
    const scale = Number($("scale").value) || 0;
    const outputPerUnit = Number($("outputPerUnit").value) || 0;
    const seedsFeed = Number($("seedsFeed").value) || 0;
    const fertilizer = Number($("fertilizer").value) || 0;
    const fuel = Number($("fuel").value) || 0;
    const lease = Number($("lease").value) || 0;
    const price = Number($("price").value) || 0;

    const weatherDelta = Number($("weatherDelta").value) || 0;
    const priceDelta = Number($("priceDelta").value) || 0;

    const weatherPill = $("weatherVal");
    const pricePill = $("priceVal");
    weatherPill.textContent = `${weatherDelta > 0 ? "+" : ""}${weatherDelta}%`;
    pricePill.textContent = `${priceDelta > 0 ? "+" : ""}${priceDelta}%`;
    weatherPill.classList.toggle("is-negative", weatherDelta < 0);
    pricePill.classList.toggle("is-negative", priceDelta < 0);

    const unit = presets[mode].unitName;
    const varPerScale = seedsFeed + fertilizer + fuel;
    const base = computeModel(scale, outputPerUnit, varPerScale, lease, price);

    setTextWithFlash($("costPerUnit"), fmtRub(base.costPerUnit), base.costPerUnit < 0);
    setTextWithFlash($("marginPct"), `${base.marginPct.toFixed(1)}%`, base.marginPct < 0);
    setTextWithFlash($("breakeven"), `${base.breakevenUnits.toFixed(1)} ${unit}`, false);
    setTextWithFlash($("profit"), fmtRub(base.profit), base.profit < 0);

    const badge = $("statusBadge");
    if (base.profit >= 0) {
      badge.textContent = "ПРИБЫЛЬ";
      badge.className = "badge ok";
    } else {
      badge.textContent = "УБЫТОК";
      badge.className = "badge bad";
    }

    const stress = computeModel(
      scale,
      outputPerUnit * (1 + weatherDelta / 100),
      varPerScale,
      lease,
      price * (1 + priceDelta / 100)
    );

    const diff = stress.profit - base.profit;
    $("scenarioBox").innerHTML = `
      <strong>Результат стресс-сценария:</strong>
      Валовый объём: <b>${stress.totalOutput.toFixed(1)} ${unit}</b> •
      Себестоимость 1 ${unit}: <b>${fmtRub(stress.costPerUnit)}</b> •
      Финансовый результат: <b>${fmtRub(stress.profit)}</b>
      (${diff >= 0 ? "+" : ""}${fmtDelta(diff)} к базе).
    `;
  }

  // Wire up events
  document.querySelectorAll("input").forEach((el) => {
    el.addEventListener("input", calculate);
    el.addEventListener("change", calculate);
  });

  $("btn-crop").addEventListener("click", () => setMode("crop"));
  $("btn-farm").addEventListener("click", () => setMode("farm"));

  // Initial render
  setMode("crop");
})();