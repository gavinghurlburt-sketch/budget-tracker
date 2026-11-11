/* ---------- Every income source, as a chart (iPhone build) ----------
   The stats page's income source table becomes one glass bar per source, showing what each brings in a month,
   tinted by who earns it and grouped by person. Sources with nothing coming in are left off the chart. */
function sourceBars(){
  return S.people.flatMap(p => S.sources.filter(s => s.personId === p.id && s.active !== false)
    .map(s => ({ s, p, v:Math.round(projectSource(s)) })).filter(r => r.v > 0).sort((a, b) => b.v - a.v));
}
const renderInsightsBeforeSources = renderInsights;
renderInsights = function(){
  renderInsightsBeforeSources();
  const h = [...document.querySelectorAll('#panel-insights .card h3')].find(x => x.textContent.trim() === 'Every income source');
  if(!h) return;
  const card = h.parentElement, rows = sourceBars();
  card.classList.add('src-card');
  card.innerHTML = `<h3>Every income source</h3><small>What each one brings in a month</small>
    ${rows.length ? `${solo() ? '' : `<div class="src-key">${S.people.map(p => `<span><i style="background:${personColor(p.id)}"></i>${esc(p.name)}</span>`).join('')}</div>`}
      <div class="src-box" style="height:${rows.length * 38 + 16}px"><canvas id="ch-src" aria-label="Bar chart of monthly income from each source"></canvas></div>`
      : '<div class="empty-note">Add income sources on the Income tab.</div>'}`;
};
const drawChartsBeforeSources = drawCharts;
drawCharts = function(){
  drawChartsBeforeSources();
  const c = $('#ch-src'); if(!c || typeof Chart === 'undefined') return;
  const rows = sourceBars();
  charts.push(new Chart(c, { type:'bar',
    data:{ labels:rows.map(r => r.s.name), datasets:[{ data:rows.map(r => r.v), backgroundColor:rows.map(r => personColor(r.p.id)) }] },
    options:{ indexAxis:'y', maintainAspectRatio:false, layout:{ padding:{ right:58 } },
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ title: it => `${rows[it[0].dataIndex].p.name}: ${rows[it[0].dataIndex].s.name}`, label: x => `${money0(x.parsed.x)} a month` } } },
      scales:{ x:{ display:false, beginAtZero:true }, y:{ grid:{ display:false }, border:{ display:false },
        ticks:{ color:'rgba(236,244,238,.85)', font:{ size:13, weight:'700' }, autoSkip:false } } } },
    // the amount sits just past the end of each bar
    plugins:[{ id:'srcValues', afterDatasetsDraw(ch){ const m = ch.getDatasetMeta(0), x = ch.ctx;
      x.save(); x.font = `700 12px ${getComputedStyle(document.body).fontFamily}`; x.fillStyle = 'rgba(236,244,238,.9)'; x.textBaseline = 'middle';
      m.data.forEach((bar, i) => x.fillText(money0(rows[i].v), bar.x + 8, bar.y)); x.restore(); } }]
  }));
};
