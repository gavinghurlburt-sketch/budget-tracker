/* ---------- Glass bar and doughnut charts (iPhone build) ----------
   Every bar and doughnut chart gets the same coloured glass as the buttons: a see-through tint of its colour
   that's brighter at the top (bars) or the outer edge (doughnuts), a crisp lighter rim, rounded ends and a soft glow.
   It works on the colours each chart already uses, so the charts' own code stays as it is. */
if(typeof Chart !== 'undefined'){
  const rgbOf = c => { const h = String(c).trim();
    if(/^#[0-9a-f]{6}$/i.test(h)) return [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
    const m = h.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').slice(0, 3).map(x => x.trim()).join(',') : null; };
  const rim = rgb => `rgba(${rgb},.95)`;
  // bars: brighter near the top of the chart, fading toward the base, like light through tinted glass
  const barFill = rgb => ctx => { const a = ctx.chart.chartArea; if(!a) return `rgba(${rgb},.4)`;
    const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
    g.addColorStop(0, `rgba(${rgb},.62)`); g.addColorStop(1, `rgba(${rgb},.16)`); return g; };
  // doughnut slices: faint at the hole, richer at the outer edge
  const arcFill = rgb => ctx => { const ch = ctx.chart, a = ch.chartArea; if(!a) return `rgba(${rgb},.4)`;
    const cx = (a.left + a.right) / 2, cy = (a.top + a.bottom) / 2, r = Math.min(a.right - a.left, a.bottom - a.top) / 2;
    const g = ch.ctx.createRadialGradient(cx, cy, r * .45, cx, cy, r);
    g.addColorStop(0, `rgba(${rgb},.18)`); g.addColorStop(1, `rgba(${rgb},.62)`); return g; };

  Chart.register({
    id:'glassCharts',
    beforeInit(chart){
      const type = chart.config.type, isArc = type === 'doughnut' || type === 'pie';
      const sc = chart.config.options && chart.config.options.scales, stacked = type === 'bar' && !!(sc && sc.x && sc.x.stacked);
      if(type !== 'bar' && !isArc) return;
      chart.data.datasets.forEach(ds => {
        if(ds.glassDone) return;
        const list = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : [ds.backgroundColor];
        const rgbs = list.map(rgbOf); if(rgbs.some(x => !x)) return;
        // one colour per slice (doughnuts) or one per series (bars); a scriptable colour picks the right one
        const pick = f => Array.isArray(ds.backgroundColor) ? ctx => f(rgbs[ctx.dataIndex % rgbs.length])(ctx) : f(rgbs[0]);
        const pickRim = f => Array.isArray(ds.backgroundColor) ? rgbs.map(f) : f(rgbs[0]);
        ds.glassRgb = rgbs;
        ds.backgroundColor = pick(isArc ? arcFill : barFill);
        ds.hoverBackgroundColor = pick(isArc ? arcFill : barFill);
        ds.borderColor = pickRim(rim); ds.hoverBorderColor = pickRim(rgb => `rgba(${rgb},1)`);
        if(isArc){ ds.borderWidth = 1.5; ds.spacing = 3; ds.borderRadius = 8; ds.hoverOffset = 6; }
        else if(stacked){
          // stacked bars read as one glass column: only the top piece is rounded, and the pieces below it
          // drop their top edge so each join is a single thin line
          const isTop = ctx => !chart.data.datasets.some((d, j) => j > ctx.datasetIndex && !d.hidden && (+d.data[ctx.dataIndex] || 0) > 0);
          ds.borderWidth = 1.5; ds.maxBarThickness = 56; ds.categoryPercentage = .62; ds.barPercentage = 1;
          ds.borderRadius = ctx => isTop(ctx) ? { topLeft:12, topRight:12, bottomLeft:0, bottomRight:0 } : 0;
          ds.borderSkipped = ctx => isTop(ctx) ? 'start' : 'end';
        }
        else { ds.borderWidth = 1.5; ds.borderRadius = 10; ds.borderSkipped = false; ds.maxBarThickness = 46; }
        ds.glassDone = true;
      });
      // legend dots in the same tint, round to match the glass pills
      const lg = chart.options.plugins && chart.options.plugins.legend;
      if(lg){ lg.labels = Object.assign({}, lg.labels, { usePointStyle:true, pointStyle:'circle', boxWidth:9, boxHeight:9, padding:14 }); }
    },
    // a soft coloured glow around each bar series, so the glass catches the light like the buttons do
    beforeDatasetDraw(chart, args){ const ds = chart.data.datasets[args.index]; if(!ds.glassRgb) return;
      const c = chart.ctx; c.save(); c.shadowColor = `rgba(${ds.glassRgb[0]},.35)`; c.shadowBlur = chart.config.type === 'bar' ? 14 : 18; },
    afterDatasetDraw(chart, args){ if(chart.data.datasets[args.index].glassRgb) chart.ctx.restore(); },
    // each column's total sits just above it, so the size is readable without the axis
    afterDatasetsDraw(chart){
      if(!(chart.config.options && chart.config.options.glassTotals)) return;
      const c = chart.ctx, fmt = typeof money0 === 'function' ? money0 : v => '$' + Math.round(v).toLocaleString();
      chart.data.labels.forEach((l, i) => {
        let total = 0, topY = null, x = null;
        chart.data.datasets.forEach((d, j) => { const m = chart.getDatasetMeta(j); if(!chart.isDatasetVisible(j)) return;
          const v = +d.data[i] || 0; if(v <= 0 || !m.data[i]) return; total += v; x = m.data[i].x; topY = topY === null ? m.data[i].y : Math.min(topY, m.data[i].y); });
        if(!total) return;
        c.save(); c.font = `700 12px ${getComputedStyle(document.body).fontFamily}`; c.fillStyle = 'rgba(236,244,238,.9)';
        c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(fmt(total), x, topY - 6); c.restore();
      });
    }
  });
}
