/* ---------- Safe to spend today (iPhone build) ----------
   One number under the verdict on Home: what's left this month after bills still to pay and envelope money
   still unspent, counting steady pay that hasn't arrived yet, spread over the days left. Tap it to see the math.
   Only for the current month; it reads the same data every other page uses and saves nothing. */
function safeToSpend(){
  const ym = CUR, today = todayStr(), daysLeft = Math.max(1, daysIn(ym) - +today.slice(8, 10) + 1);
  const cameIn = monthIncome(ym), wentOut = monthExpenses(ym), aside = monthSetAside(ym);
  // steady pay still to come this month (a paycheck that hasn't landed yet)
  const payToCome = sum(S.sources.filter(s => s.active !== false && s.kind === 'fixed')
    .map(s => Math.max(0, (+s.expected || 0) - sourceMonth(s.id, ym))));
  // bills still to pay this month: monthly or more often; a quarterly or yearly bill counts once it's paid
  const billsToPay = sum(S.bills.filter(b => b.active !== false && (FREQ_FACTOR[b.frequency] || 1) >= 1)
    .map(b => Math.max(0, billMonthly(b) - sum(S.expenses.filter(e => e.billId === b.id && ymOf(e.date) === ym).map(e => e.amount)))));
  // envelope money not spent yet is already spoken for
  const envLeft = sum((S.envelopes || []).map(e => Math.max(0, (+e.amount || 0) - envSpent(e, ym))));
  const month = cameIn + payToCome - wentOut - aside - billsToPay - envLeft;
  return { month, today: month / daysLeft, daysLeft, cameIn, payToCome, wentOut, aside, billsToPay, envLeft };
}
const renderHomeBeforeSafe = renderHome;
renderHome = function(){
  renderHomeBeforeSafe();
  const head = $('#panel-home .gap-head'); if(!head || view.month !== CUR || !(S.income.length || S.expenses.length)) return;
  const s = safeToSpend(), ok = s.month > 0;
  head.querySelector('.wave-verdict').insertAdjacentHTML('afterend', `
    <button type="button" class="safe-spend ${ok ? '' : 'short'}" data-action="safe-why">
      <b>${ok ? money0(Math.floor(s.today)) : '$0'}</b><span>safe to spend today</span>
      <small>${ok ? `${money0(s.month)} for the rest of ${monthName(CUR)}, after bills and envelopes` : `Bills and envelopes need ${money0(-s.month)} more than you have this month`}</small>
    </button>`);
};
actions['safe-why'] = () => {
  const s = safeToSpend(), row = (l, v, cls) => `<div class="safe-row ${cls || ''}"><span>${l}</span><b>${v}</b></div>`;
  openDialog('Safe to spend', `
    <p class="safe-lead">What's free for anything else this month, spread over the ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left.</p>
    <div class="safe-math">
      ${row('Came in so far', money0(s.cameIn), 'in')}
      ${s.payToCome ? row('Steady pay still coming', '+ ' + money0(s.payToCome), 'in') : ''}
      ${row('Went out so far', '− ' + money0(s.wentOut), 'out')}
      ${s.aside ? row('Set aside for goals', '− ' + money0(s.aside), 'aside') : ''}
      ${row('Bills still to pay', '− ' + money0(s.billsToPay), 'out')}
      ${S.envelopes && S.envelopes.length ? row('Envelope money not spent yet', '− ' + money0(s.envLeft), 'out') : ''}
      ${row(`Left for the rest of ${monthName(CUR)}`, money0(s.month), 'total ' + (s.month >= 0 ? 'in' : 'out'))}
      ${row('Per day', s.month > 0 ? money0(Math.floor(s.today)) : '$0', 'total')}
    </div>
    <div class="dlg-actions"><button type="button" class="btn" data-action="close-dialog">Got it</button></div>`);
};
