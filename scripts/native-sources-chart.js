/* ---------- Every income source, as split bars (iPhone build) ----------
   The stats page's income source table becomes one glass bar per person, split into their sources, with the
   person's monthly total. Bars share one scale so the two people compare at a glance. A small key under each bar
   names every piece and its amount. Sources with nothing coming in are left out. */
// each person's biggest source wears their own colour; the rest take clearly different tints (no second green or gold)
const SRC_TINTS = ['#6FC3B8', '#7AA7E0', '#B79BE8', '#E59A8C', '#D78FB8', '#8FD0E0', '#E8A86B', '#A9B4E8'];
function sourceSplit(){
  return S.people.map(p => {
    const own = personColor(p.id), tints = [own, ...SRC_TINTS];
    const parts = S.sources.filter(s => s.personId === p.id && s.active !== false)
      .map(s => ({ s, v:Math.round(projectSource(s)) })).filter(r => r.v > 0).sort((a, b) => b.v - a.v)
      .map((r, i) => Object.assign(r, { c:tints[i % tints.length] }));
    return { p, own, parts, total:sum(parts.map(r => r.v)) };
  }).filter(x => x.total > 0);
}
const renderInsightsBeforeSources = renderInsights;
renderInsights = function(){
  renderInsightsBeforeSources();
  const h = [...document.querySelectorAll('#panel-insights .card h3')].find(x => x.textContent.trim() === 'Every income source');
  if(!h) return;
  const card = h.parentElement, people = sourceSplit(), top = Math.max(1, ...people.map(x => x.total));
  card.classList.add('src-card');
  card.innerHTML = `<h3>Every income source</h3><small>What each of you brings in a month, split by source</small>
    ${people.length ? people.map(x => `
      <div class="src-person" style="--own:${x.own}">
        <div class="src-head"><span><i></i>${esc(x.p.name)}</span><b>${money0(x.total)}</b></div>
        <div class="src-bar" style="width:${Math.max(18, x.total / top * 100)}%" role="img" aria-label="${esc(x.p.name)}: ${x.parts.map(r => `${esc(r.s.name)} ${money0(r.v)}`).join(', ')}">
          ${x.parts.map(r => `<span style="flex:${r.v} 1 0; --t:${r.c}"></span>`).join('')}
        </div>
        <div class="src-key">${x.parts.map(r => `<span style="--t:${r.c}"><i></i>${esc(r.s.name)} <b>${money0(r.v)}</b></span>`).join('')}</div>
      </div>`).join('')
    : '<div class="empty-note">Add income sources on the Income tab.</div>'}`;
};
