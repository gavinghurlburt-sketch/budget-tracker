/* Income vs. spending as layered glowing waves, with a 30 days / 3 months / 1 year switch (iPhone build).
   patch.js puts this in the main script; the Charts tab and the Home tab both draw with it.
   canvas: where to draw. sw: that chart's range switch. redraw: what to call when the range changes. */
function drawWave(gapCanvas, sw, redraw){
  if(gapCanvas && typeof Chart !== 'undefined'){
    // ---- range: remembered on this phone; 1 year is the default ----
    const RANGE_KEY = 'budgetrr-wave-range', RANGES = ['30d', '3m', '1y'];
    let range = '1y'; try{ const r = localStorage.getItem(RANGE_KEY); if(RANGES.includes(r)) range = r; }catch(e){}
    if(sw){
      sw.style.setProperty('--i', RANGES.indexOf(range));
      sw.querySelectorAll('button').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.range === range));
        b.onclick = () => { if(b.dataset.range === range) return; try{ localStorage.setItem(RANGE_KEY, b.dataset.range); }catch(e){} redraw(); };
      });
    }

    // ---- buckets: days, weeks (Sunday to Saturday) or months, each a [from, to] date range ----
    const DAY = 864e5, MO = 30.44;
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const at = s => new Date(s + 'T12:00:00');
    const shift = (d, n) => new Date(d.getTime() + n * DAY);
    const today = at(todayStr());
    let B = [], ci, per;   // per: how much of a month one bucket is, for the forecast
    if(range === '30d'){
      for(let i = -23; i <= 6; i++){ const d = shift(today, i); B.push({ from:iso(d), to:iso(d), d }); }
      ci = 23; per = 1 / MO;
    } else if(range === '3m'){
      const sun = shift(today, -today.getDay());
      for(let i = -10; i <= 2; i++){ const d = shift(sun, i * 7); B.push({ from:iso(d), to:iso(shift(d, 6)), d }); }
      ci = 10; per = 7 / MO;
    } else {
      let months = []; for(let i = -11; i <= 3; i++) months.push(addMonths(CUR, i));
      const firstData = [...S.income, ...S.expenses].map(e => ymOf(e.date)).sort()[0];
      if(firstData){ const idx = months.findIndex(m => m >= firstData); if(idx > 0) months = months.slice(Math.min(idx, months.indexOf(CUR) - 1)); }
      B = months.map(m => ({ from:m + '-01', to:m + '-31', d:at(m + '-15'), ym:m }));
      ci = months.indexOf(CUR); per = 1;
    }
    const inB = (list, b) => sum(list.filter(e => e.date >= b.from && e.date <= b.to).map(e => e.amount));
    const incOf = b => inB(S.income, b), outOf = b => inB(S.expenses, b);
    const asideOf = b => inB(S.income.filter(e => e.goalId), b) + inB(S.contributions, b);

    // what really happened up to now; past now is the forecast, scaled to the bucket size
    const pInc = projectedIncome() * per, pExp = projectedSpending() * per;
    const asideAvg = (() => { const past = [1,2,3].map(k => monthSetAside(addMonths(CUR, -k))); return sum(past) / 3 * per; })();
    const incA = B.map((b,i) => i <= ci ? incOf(b) : null), outA = B.map((b,i) => i <= ci ? outOf(b) : null), asideA = B.map((b,i) => i <= ci ? asideOf(b) : null);
    // a week or month that's only partway done shows the expected total (or more, if it's already past that);
    // a single day shows what really happened. The tooltip always gives the real so-far numbers.
    const wave = (A, exp) => B.map((b,i) => i < ci ? A[i] : i === ci ? (range === '30d' ? A[i] : Math.max(A[i], exp)) : exp);
    const incW = wave(incA, pInc), outW = wave(outA, pExp), asideW = wave(asideA, asideAvg);

    // labels along the top: every day/week/month gets a gridline, only some get a name so they never crowd
    const every = range === '30d' ? 3 : range === '3m' ? 2 : 1;
    const named = i => i === ci || ((i - ci) % every === 0);
    const labels = B.map((b,i) => {
      if(!named(i)) return '';
      if(range === '30d') return [b.d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase(), String(b.d.getDate())];
      if(range === '3m') return [b.d.toLocaleDateString('en-US',{month:'short'}).toUpperCase(), String(b.d.getDate())];
      return [b.d.toLocaleDateString('en-US',{month:'short'}).toUpperCase(), "'" + String(b.d.getFullYear()).slice(2)];
    });
    const bucketName = b => range === '30d' ? b.d.toLocaleDateString('en-US',{weekday:'long', month:'short', day:'numeric'})
      : range === '3m' ? 'Week of ' + b.d.toLocaleDateString('en-US',{month:'short', day:'numeric'}) : monthLabel(b.ym);
    const nowWord = range === '30d' ? 'today' : range === '3m' ? 'this week' : 'this month';
    const tension = range === '30d' ? .35 : .42;

    const LAYERS = [
      { label:'Came in', data:incW, actual:incA, rgb:'116,209,126', line:'#8FE39A', a:.38 },
      { label:'Went out', data:outW, actual:outA, rgb:'242,154,142', line:'#F6B0A6', a:.46 },
      { label:'Set aside', data:asideW, actual:asideA, rgb:'140,194,242', line:'#A9D3F6', a:.6 }
    ];
    // a vertical glow that starts at each wave's own crest, so every wave is brightest at its peak
    const waveFill = (rgb, a) => ctx => {
      const area = ctx.chart.chartArea, y = ctx.chart.scales.y; if(!area || !y) return `rgba(${rgb},${a * .4})`;
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
        // the bright "now" line, with a ringed dot at its top
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
        elements:{ line:{ tension, cubicInterpolationMode:'monotone' } },
        layout:{ padding:{ top:4, left:0, right:0, bottom:0 } },
        plugins:{ legend:{display:false},
          tooltip:{ backgroundColor:'rgba(26,36,31,.92)', borderColor:'rgba(255,255,255,.14)', borderWidth:1, padding:10, cornerRadius:12, titleColor:'#EAF2EC', bodyColor:'#EAF2EC', usePointStyle:true, boxPadding:4,
            filter: it => !it.dataset.echo,
            callbacks:{ title: items => { const i = items[0].dataIndex; return bucketName(B[i]) + (i > ci ? ' (forecast)' : ''); },
              label: c => c.dataIndex === ci ? `${c.dataset.label}: ${money0(c.dataset.actual[ci])} so far` : `${c.dataset.label}: ${money0(c.parsed.y)}`,
              labelColor: c => ({ borderColor:c.dataset.borderColor, backgroundColor:c.dataset.borderColor }),
              footer: items => { const i = items.find(t => t.dataset.label === 'Came in'), o = items.find(t => t.dataset.label === 'Went out'); if(!i || !o) return '';
                const k = i.dataIndex, g = k === ci ? i.dataset.actual[ci] - o.dataset.actual[ci] : i.parsed.y - o.parsed.y;
                if(k === ci && range !== '30d') return `Expected ${nowWord}: ${money0(pInc)} in, ${money0(pExp)} out`;
                if(k > ci && range === '30d') return 'An average day';
                return (g >= 0 ? 'Left over: ' : 'Short by: ') + money0(Math.abs(g)); } } } },
        scales:{
          // headroom above the tallest crest, so the waves sit low with sky above them
          y:{ display:false, beginAtZero:true, max: Math.max(1, ...incW, ...outW, ...asideW) * 1.3 },
          x:{ position:'top', offset:false, border:{display:false},
            grid:{ color: c => c.index === ci ? 'rgba(0,0,0,0)' : named(c.index) ? 'rgba(234,242,236,.08)' : 'rgba(234,242,236,.03)', drawTicks:false },
            ticks:{ padding:10, autoSkip:false, maxRotation:0, font: c => ({ family:mono, size:10, weight: c.index === ci ? '700' : '400' }),
              color: c => c.index === ci ? '#EAF2EC' : 'rgba(161,178,166,.75)' } } } }
    }));
  }
}
