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

    const card = gapCanvas.closest('.gap-card'), vEl = card && card.querySelector('.wave-verdict');
    if(vEl){ const v = waveVerdict(view.month); vEl.className = 'wave-verdict ' + (v ? v.tone : ''); vEl.innerHTML = v ? `<b>${v.head}</b><span>${v.sub}</span>` : ''; vEl.hidden = !v; }

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
    const incA = B.map((b,i) => i <= ci ? incOf(b) : null), outA = B.map((b,i) => i <= ci ? outOf(b) : null), asideA = B.map((b,i) => i <= ci ? asideOf(b) : null);

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

    // ---- one running-total wave: everything that came in minus everything that went out, from the first thing
    //      logged up to each point. Like a bank balance it carries over from month to month and never resets on
    //      the 1st; paydays step it up and bills and spending step it down. Past the bright line it keeps going
    //      at the usual pace. Above the zero line (green) more came in than went out; below it (coral) less. ----
    const tIso = todayStr(), dayNet = (projectedIncome() - projectedSpending()) / MO;
    const bal = d => sum(S.income.filter(e => e.date <= d).map(e => e.amount)) - sum(S.expenses.filter(e => e.date <= d).map(e => e.amount));
    const now = bal(tIso);
    const ahead = d => now + Math.round((at(d) - at(tIso)) / DAY) * dayNet;   // a future point: today's total plus usual days
    const run = B.map((b,i) => {
      // a whole month: where the total stood at the month's end; this month is where it's headed
      if(range === '1y') return i < ci ? bal(b.ym + '-31') : ahead(b.ym + '-' + pad(daysIn(b.ym)));
      const d = i <= ci ? (b.to < tIso ? b.to : tIso) : b.to;
      return i <= ci ? bal(d) : ahead(d);
    });
    const GREEN = '116,209,126', CORAL = '242,154,142';
    const zeroFrac = chart => { const a = chart.chartArea, y = chart.scales.y; if(!a || !y) return null;
      return Math.min(1, Math.max(0, (y.getPixelForValue(0) - a.top) / (a.bottom - a.top))); };
    // green above zero and coral below, with a hard switch right at the zero line
    const signLine = ctx => { const ch = ctx.chart, a = ch.chartArea, f = zeroFrac(ch); if(f == null) return '#8FE39A';
      const g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom);
      g.addColorStop(0, '#8FE39A'); g.addColorStop(f, '#8FE39A'); g.addColorStop(f, '#F6B0A6'); g.addColorStop(1, '#F6B0A6'); return g; };
    const signFill = (k = 1) => ctx => { const ch = ctx.chart, a = ch.chartArea, f = zeroFrac(ch); if(f == null) return `rgba(${GREEN},${.2 * k})`;
      const g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom);
      g.addColorStop(0, `rgba(${GREEN},${.5 * k})`); g.addColorStop(f, `rgba(${GREEN},${.04 * k})`);
      g.addColorStop(f, `rgba(${CORAL},${.04 * k})`); g.addColorStop(1, `rgba(${CORAL},${.55 * k})`); return g; };
    // the scale hugs the line, like a bank app, so a payday or a big bill shows as a real step even on a large total;
    // the $0 line only shows when the total comes near it
    const hi = Math.max(...run), lo = Math.min(...run), span = (hi - lo) || Math.max(100, Math.abs(hi) * .1);
    let yMax = hi + span * .28, yMin = lo - span * .14;
    if(lo >= 0 && lo < span * .6) yMin = Math.min(yMin, 0);
    if(hi <= 0 && -hi < span * .6) yMax = Math.max(yMax, 0);
    const floor = yMin > 0 ? yMin : yMax < 0 ? yMax : 0;   // where the fill and the echoes rest
    // two faint echoes under the wave give it the layered, ribbon-like depth
    const datasets = [[.8, .3], [.6, .22]].map(([k, a]) => ({ label:'echo', echo:true, data:run.map(v => floor + (v - floor) * k), borderWidth:1, borderColor:'rgba(234,242,236,.10)',
      backgroundColor:signFill(a), fill:{ value:floor }, pointRadius:0, pointHoverRadius:0 }));
    datasets.push({ label:'Running total', data:run, borderColor:signLine, borderWidth:2.5, backgroundColor:signFill(.75), fill:{ value:floor },
      glow: run[ci] >= 0 ? `rgba(${GREEN},.7)` : `rgba(${CORAL},.7)`,
      pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor: c => c.raw >= 0 ? '#8FE39A' : '#F6B0A6', pointHoverBorderColor:'#0F1512', pointHoverBorderWidth:2,
      segment:{ borderDash: s => s.p0DataIndex >= ci ? [5,5] : undefined } });
    const mono = 'ui-monospace, "SF Mono", Menlo, monospace';
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
        // the zero line: above it you kept money, below it more went out than came in
        const zy = chart.scales.y.getPixelForValue(0);
        if(zy >= a.top && zy <= a.bottom){
          ctx.setLineDash([3,4]); ctx.strokeStyle = 'rgba(234,242,236,.4)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.left, zy); ctx.lineTo(a.right, zy); ctx.stroke(); ctx.setLineDash([]);
          ctx.font = '10px ' + mono; ctx.fillStyle = 'rgba(234,242,236,.55)'; ctx.textAlign = 'right'; ctx.fillText('$0', a.right - 4, zy - 5);
        }
        // the bright "now" line, with a ringed dot at its top
        ctx.shadowColor = 'rgba(234,242,236,.8)'; ctx.shadowBlur = 8; ctx.strokeStyle = '#EAF2EC'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(nx, a.top + 2); ctx.lineTo(nx, a.bottom); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = run[ci] >= 0 ? '#8FE39A' : '#F6B0A6'; ctx.beginPath(); ctx.arc(nx, a.top + 6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#EAF2EC'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(nx, a.top + 6, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    };
    charts.push(new Chart(gapCanvas, {
      type:'line', data:{ labels, datasets }, plugins:[waveLook],
      options:{ maintainAspectRatio:false, interaction:{mode:'index', intersect:false},
        elements:{ line:{ tension, cubicInterpolationMode:'monotone' } },
        layout:{ padding:{ top:4, left:0, right:0, bottom:0 } },
        plugins:{ legend:{display:false},
          tooltip:{ filter: it => !it.dataset.echo, backgroundColor:'rgba(26,36,31,.92)', borderColor:'rgba(255,255,255,.14)', borderWidth:1, padding:10, cornerRadius:12, titleColor:'#EAF2EC', bodyColor:'#EAF2EC', displayColors:false,
            callbacks:{ title: items => { const i = items[0].dataIndex; return bucketName(B[i]) + (i > ci ? ' (forecast)' : ''); },
              label: c => { const i = c.dataIndex, k = run[i], money = v => (v < 0 ? '-' : '') + money0(Math.abs(v));
                if(range === '1y' && i === ci)
                  return [`Running total now: ${money(now)}`, `Headed for about ${money(k)} by month's end`, `${money0(incA[i])} came in, ${money0(outA[i])} went out this month`];
                const when = i > ci ? ', expected' : range === '1y' ? ' at month\'s end' : '';
                const kept = `Running total${when}: ${money(k)}`;
                if(i > ci) return [kept];
                const span = range === '1y' ? 'That month: ' : range === '3m' ? 'That week: ' : 'That day: ';
                const lines = [kept, `${span}${money0(incA[i])} came in, ${money0(outA[i])} went out`];
                if(asideA[i] > 0) lines.push(`Set aside ${money0(asideA[i])}`); return lines; } } } },
        scales:{
                y:{ display:false, max:yMax, min:yMin },
          x:{ position:'top', offset:false, border:{display:false},
            grid:{ color: c => c.index === ci ? 'rgba(0,0,0,0)' : named(c.index) ? 'rgba(234,242,236,.08)' : 'rgba(234,242,236,.03)', drawTicks:false },
            ticks:{ padding:10, autoSkip:false, maxRotation:0, font: c => ({ family:mono, size:10, weight: c.index === ci ? '700' : '400' }),
              color: c => c.index === ci ? '#EAF2EC' : 'rgba(161,178,166,.75)' } } } }
    }));
  }
}

// ---- the verdict above the chart: is this month going well? ----
// It compares money left over so far this month with where you usually are by this day of the month
// (from the last three months, so a rent day or a payday early in the month doesn't throw it off).
function waveVerdict(ym){
  const left = monthIncome(ym) - monthExpenses(ym), mName = monthName(ym);
  if(ym > CUR) return null;
  if(ym < CUR){
    if(!monthIncome(ym) && !monthExpenses(ym)) return null;
    return left >= 0 ? { tone:'good', head:`${mName} ended ahead`, sub:`You kept ${money0(left)} that month.` }
                     : { tone:'bad', head:`${mName} ended short`, sub:`${money0(-left)} more went out than came in.` };
  }
  const day = new Date().getDate(), dayName = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric' });
  if(!monthIncome(ym) && !monthExpenses(ym)) return { tone:'', head:'Nothing logged yet this month', sub:'Log what comes in and goes out and this shows how it\'s going.' };
  const past = [1,2,3].map(k => addMonths(ym, -k)).filter(m => monthIncome(m) || monthExpenses(m));
  let usual;
  if(past.length){
    usual = sum(past.map(m => { const cut = `${m}-${pad(Math.min(day, daysIn(m)))}`;
      return sum(S.income.filter(e => ymOf(e.date) === m && e.date <= cut).map(e => e.amount)) - sum(S.expenses.filter(e => ymOf(e.date) === m && e.date <= cut).map(e => e.amount)); })) / past.length;
  } else usual = (projectedIncome() - projectedSpending()) * day / daysIn(ym);
  const diff = left - usual, slack = Math.max(50, Math.abs(projectedIncome() - projectedSpending()) * .1);
  const usualTxt = `By ${dayName} you're usually ${usual >= 0 ? 'about ' + money0(usual) + ' ahead' : 'out about ' + money0(-usual)}.`;
  if(diff >= -slack){
    const where = diff > slack ? `${money0(diff)} better than usual by ${dayName}.` : `about where you usually are by ${dayName}.`;
    return { tone:'good', head:'On track', sub: left >= 0 ? `${money0(left)} left over so far, ${where}` : `Out ${money0(-left)} so far, ${where}` };
  }
  if(left < 0) return { tone:'bad', head:'Spending more than came in', sub:`Out by ${money0(-left)} so far in ${mName}. ${usualTxt}` };
  return { tone:'warn', head:'A bit behind a usual month', sub:`${money0(left)} left over so far. ${usualTxt}` };
}
