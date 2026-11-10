  // gap chart (iPhone build): layered glowing waves.
  // Spliced in by scripts/patch.js in place of the web version's line chart.
  const gapCanvas = $('#ch-gap');
  if(gapCanvas){
    let months = []; for(let i = -11; i <= 3; i++) months.push(addMonths(CUR, i));
    const allDates = [...S.income, ...S.expenses].map(e => ymOf(e.date)).sort();
    const firstData = allDates[0];
    if(firstData){ const idx = months.findIndex(m => m >= firstData); if(idx > 0) months = months.slice(Math.min(idx, months.indexOf(CUR) - 1)); }
    const ci = months.indexOf(CUR);
    // past and this month are what really happened; later months are the forecast
    const pInc = projectedIncome(), pExp = projectedSpending();
    const asideAvg = (() => { const past = months.filter((m,i) => i < ci).slice(-3).map(monthSetAside); return past.length ? sum(past) / past.length : 0; })();
    // this month is only partway done, so its wave shows the expected total (or more, if it's already past that);
    // the tooltip still gives what has really come in and gone out so far
    const incA = months.map((m,i) => i <= ci ? monthIncome(m) : null), outA = months.map((m,i) => i <= ci ? monthExpenses(m) : null), asideA = months.map((m,i) => i <= ci ? monthSetAside(m) : null);
    const incW = months.map((m,i) => i < ci ? incA[i] : i === ci ? Math.max(incA[i], pInc) : pInc);
    const outW = months.map((m,i) => i < ci ? outA[i] : i === ci ? Math.max(outA[i], pExp) : pExp);
    const asideW = months.map((m,i) => i < ci ? asideA[i] : i === ci ? Math.max(asideA[i], asideAvg) : asideAvg);
    const labels = months.map(m => { const d = new Date(m + '-15T12:00:00'); return [d.toLocaleDateString('en-US',{month:'short'}).toUpperCase(), "'" + String(d.getFullYear()).slice(2)]; });
    const LAYERS = [
      { label:'Came in', data:incW, actual:incA, rgb:'116,209,126', line:'#8FE39A', a:.38 },
      { label:'Went out', data:outW, actual:outA, rgb:'242,154,142', line:'#F6B0A6', a:.46 },
      { label:'Set aside', data:asideW, actual:asideA, rgb:'140,194,242', line:'#A9D3F6', a:.6 }
    ];
    // a vertical glow: bright near the crest, fading to nothing at the floor
    const waveFill = (rgb, a) => ctx => {
      const area = ctx.chart.chartArea, y = ctx.chart.scales.y; if(!area || !y) return `rgba(${rgb},${a * .4})`;
      // the gradient starts at this wave's own crest, so every wave glows brightest at its peak
      const crest = Math.min(area.bottom - 1, y.getPixelForValue(Math.max(0, ...ctx.dataset.data.filter(v => v != null))));
      const g = ctx.chart.ctx.createLinearGradient(0, crest, 0, area.bottom);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(.45, `rgba(${rgb},${a * .3})`); g.addColorStop(.85, `rgba(${rgb},0)`);
      return g;
    };
    const datasets = [];
    LAYERS.forEach(L => {
      // two faint echoes under each wave give the layered, ribbon-like depth
      [[.84, .12], [.68, .09]].forEach(([k, a]) => datasets.push({ label:L.label, echo:true, data:L.data.map(v => v * k),
        borderColor:`rgba(${L.rgb},.22)`, borderWidth:1, backgroundColor:waveFill(L.rgb, a), fill:'origin', pointRadius:0, pointHoverRadius:0 }));
      datasets.push({ label:L.label, actual:L.actual, data:L.data, glow:`rgba(${L.rgb},.75)`, borderColor:L.line, borderWidth:2, backgroundColor:waveFill(L.rgb, L.a), fill:'origin',
        pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor:L.line, pointHoverBorderColor:'#0F1512', pointHoverBorderWidth:2,
        segment:{ borderDash: s => s.p0DataIndex >= ci ? [5,5] : undefined } });
    });
    const STARS = Array.from({length:34}, (_, i) => [((i * 73) % 97) / 97, ((i * 41 + 17) % 89) / 89, (i % 5 === 0) ? 1.3 : .8]);
    const waveLook = {
      id:'waveLook',
      beforeDatasetsDraw(chart){
        const {ctx, chartArea:a} = chart; ctx.save();
        STARS.forEach(([x, y, r]) => { ctx.fillStyle = 'rgba(234,242,236,.35)'; ctx.beginPath(); ctx.arc(a.left + x * (a.right - a.left), a.top + y * (a.bottom - a.top) * .7, r, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
      },
      // waves blend like light where they overlap (screen), so the colours glow instead of muddying
      beforeDatasetDraw(chart, args){ const ds = chart.data.datasets[args.index], c = chart.ctx; c.save(); c.globalCompositeOperation = 'screen'; if(ds.glow){ c.shadowColor = ds.glow; c.shadowBlur = 16; } },
      afterDatasetDraw(chart){ chart.ctx.restore(); },
      afterDatasetsDraw(chart){
        const {ctx, chartArea:a, scales:{x}} = chart; const nx = x.getPixelForValue(ci); ctx.save();
        // the forecast side sits a little dimmer than what really happened
        ctx.fillStyle = 'rgba(15,21,18,.38)'; ctx.fillRect(nx, a.top, a.right - nx, a.bottom - a.top);
        // the bright "this month" line, with a ringed dot at its top
        ctx.shadowColor = 'rgba(234,242,236,.8)'; ctx.shadowBlur = 8; ctx.strokeStyle = '#EAF2EC'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(nx, a.top + 2); ctx.lineTo(nx, a.bottom); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = '#8FE39A'; ctx.beginPath(); ctx.arc(nx, a.top + 6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#EAF2EC'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(nx, a.top + 6, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    };
    const mono = 'ui-monospace, "SF Mono", Menlo, monospace';
    charts.push(new Chart(gapCanvas, {
      type:'line', data:{ labels, datasets }, plugins:[waveLook],
      options:{ maintainAspectRatio:false, interaction:{mode:'index', intersect:false},
        elements:{ line:{ tension:.42, cubicInterpolationMode:'monotone' } },
        layout:{ padding:{ top:4, left:0, right:0, bottom:0 } },
        plugins:{ legend:{display:false},
          tooltip:{ backgroundColor:'rgba(26,36,31,.92)', borderColor:'rgba(255,255,255,.14)', borderWidth:1, padding:10, cornerRadius:12, titleColor:'#EAF2EC', bodyColor:'#EAF2EC', usePointStyle:true, boxPadding:4,
            filter: it => !it.dataset.echo,
            callbacks:{ title: items => { const i = items[0].dataIndex; return monthLabel(months[i]) + (i > ci ? ' (forecast)' : ''); },
              label: c => c.dataIndex === ci ? `${c.dataset.label}: ${money0(c.dataset.actual[ci])} so far` : `${c.dataset.label}: ${money0(c.parsed.y)}`,
              labelColor: c => ({ borderColor:c.dataset.borderColor, backgroundColor:c.dataset.borderColor }),
              footer: items => { const i = items.find(t => t.dataset.label === 'Came in'), o = items.find(t => t.dataset.label === 'Went out'); if(!i || !o) return '';
                const at = i.dataIndex, g = at === ci ? i.dataset.actual[ci] - o.dataset.actual[ci] : i.parsed.y - o.parsed.y;
                return at === ci ? `Expected: ${money0(pInc)} in, ${money0(pExp)} out` : (g >= 0 ? 'Left over: ' : 'Short by: ') + money0(Math.abs(g)); } } } },
        scales:{
          // headroom above the tallest crest, so the waves sit low with sky above them
          y:{ display:false, beginAtZero:true, max: Math.max(1, ...incW, ...outW, ...asideW) * 1.3 },
          x:{ position:'top', offset:false, border:{display:false},
            grid:{ color: c => c.index === ci ? 'rgba(0,0,0,0)' : 'rgba(234,242,236,.07)', drawTicks:false },
            ticks:{ padding:10, autoSkip:false, maxRotation:0, font: c => ({ family:mono, size:10, weight: c.index === ci ? '700' : '400' }),
              color: c => c.index === ci ? '#EAF2EC' : 'rgba(161,178,166,.75)' } } } }
    }));
  }

