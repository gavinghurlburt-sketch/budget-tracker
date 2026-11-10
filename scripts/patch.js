// Builds www/index.html from index.html for the iOS app:
// zoom lock, safe areas, bundled fonts + libraries (offline), haptics, native button feel, sheet dialogs.
const fs = require('fs');
const path = require('path');
const p = 'www/index.html';
let s = fs.readFileSync(p, 'utf8');

// 1. zoom lock + light-only form controls
s = s.replace(/<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n<meta name="color-scheme" content="dark">');

// 2. bundle libraries (replace CDN scripts)
fs.mkdirSync('www/vendor', { recursive: true });
fs.copyFileSync('node_modules/chart.js/dist/chart.umd.js', 'www/vendor/chart.umd.js');
fs.copyFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'www/vendor/supabase.js');
s = s.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js[^"]*"><\/script>/, '<script src="vendor/chart.umd.js"></script>');
s = s.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^"]*"><\/script>/, '<script src="vendor/supabase.js"></script>');

// 3. bundle fonts
fs.mkdirSync('www/fonts', { recursive: true });
const faces = [];
const add = (pkg, family, weights) => weights.forEach(w => {
  const f = `${pkg}-latin-${w}-normal.woff2`;
  fs.copyFileSync(path.join('node_modules/@fontsource', pkg, 'files', f), path.join('www/fonts', f));
  faces.push(`@font-face{font-family:"${family}";font-weight:${w};font-style:normal;font-display:swap;src:url(fonts/${f}) format("woff2");}`);
});
add('fredoka', 'Fredoka', [500, 600]);
add('nunito', 'Nunito', [400, 600, 700, 800]);
s = s.replace(/<link rel="preconnect"[^>]*>\s*/g, '');
s = s.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, `<style>${faces.join('')}</style>`);

// 4. iOS CSS + scripts
const css = `<style>
  html{color-scheme:dark;-webkit-text-size-adjust:100%;touch-action:manipulation;}
  /* safe areas */
  html body .wrap{padding-top:calc(env(safe-area-inset-top) + 16px);padding-bottom:calc(env(safe-area-inset-bottom) + 64px);padding-left:max(20px,env(safe-area-inset-left));padding-right:max(20px,env(safe-area-inset-right));}
  html body .toast{bottom:calc(env(safe-area-inset-bottom) + 20px);}
  /* native button feel */
  button,.btn,.tab,.icon-btn{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:manipulation;transition:transform .08s ease,opacity .08s ease,background-color .12s ease,filter .12s ease;}
  button:active{transform:scale(.95);opacity:.85;}
  @media (hover:none){.btn:hover{filter:none;}.btn.ghost:hover,.tab:hover,.icon-btn:hover{background:transparent;}.tab[aria-selected="true"]:hover{background:var(--paper);}}
  html body .btn{min-height:44px;}
  html body .btn.small{min-height:36px;}
  html body .tab{min-height:44px;}
  html body .icon-btn{width:44px;height:44px;}
  /* full-screen sheet dialogs */
  html body dialog[open]{position:fixed;inset:0;margin:0;width:100%;max-width:none;height:100%;max-height:none;border:none;border-radius:0;overflow-y:auto;-webkit-overflow-scrolling:touch;}
  html body .dlg-head{position:sticky;top:0;z-index:3;background:var(--paper);padding:calc(env(safe-area-inset-top) + 14px) max(20px,env(safe-area-inset-right)) 10px max(20px,env(safe-area-inset-left));}
  html body .dlg-body{padding-left:max(20px,env(safe-area-inset-left));padding-right:max(20px,env(safe-area-inset-right));padding-bottom:0;}
  html body .dlg-actions{position:sticky;bottom:0;z-index:3;background:var(--paper);border-top:2px dashed var(--line);margin:6px calc(-1 * max(20px,env(safe-area-inset-left))) 0;padding:12px max(20px,env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 12px);}
  /* solid status-bar strip so the clock/battery never sit on top of page text */
  html body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top);background:var(--bg);z-index:50;pointer-events:none;}
  /* tags stay on one line instead of splitting into pieces */
  html body .chip{white-space:nowrap;display:inline-block;line-height:1.5;}
  html body td:first-child{white-space:nowrap;}
  /* lock the page behind an open form so scrolling can't chain to it */
  html:has(dialog[open]),html:has(dialog[open]) body{overflow:hidden;overscroll-behavior:none;}
  html body dialog[open]{overscroll-behavior-y:contain;}
</style>
<script>
  ["gesturestart","gesturechange","gestureend"].forEach(function(e){document.addEventListener(e,function(ev){ev.preventDefault();});});
  document.addEventListener("touchmove",function(ev){
    var m=document.querySelector("dialog[open]");
    if(m&&!(ev.target.closest&&ev.target.closest("dialog[open]"))) ev.preventDefault();
  },{passive:false});
  var _lt=0;document.addEventListener("touchend",function(ev){var n=Date.now();if(n-_lt<300)ev.preventDefault();_lt=n;},{passive:false});
  (function(){
    var H=null;
    function hp(){ if(H) return H; try{ var C=window.Capacitor; H=(C.Plugins&&C.Plugins.Haptics)||C.registerPlugin('Haptics'); }catch(e){} return H; }
    document.addEventListener("pointerdown",function(ev){
      var b=ev.target.closest&&ev.target.closest("button,.btn");
      if(!b||b.disabled) return;
      var h=hp(); if(!h) return;
      var c=b.classList, strong=c.contains("btn")&&!c.contains("ghost")&&!c.contains("small")&&!c.contains("danger");
      try{ h.impact({style:strong?"MEDIUM":"LIGHT"}); }catch(e){}
    },{passive:true});
  })();
</script>
</head>`;
s = s.replace('</head>', css);
fs.writeFileSync(p, s);

// 5. glass redesign (scripts/native-glass.css): one continuous surface, frosted glass
//    buttons, a floating icon tab bar at the bottom and three slowly drifting glow orbs.
const glass = fs.readFileSync(path.join(__dirname, 'native-glass.css'), 'utf8');
s = s.replace('</head>', `<style>${glass}</style>\n</head>`);
s = s.replace(/<body>/, '<body>\n<div id="glowOrbs" aria-hidden="true"><i></i><i></i><i></i></div>');
// tabs: an icon each, plus a name that only shows on the open tab
const ic = d => `<span class="tab-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`;
const TAB_ICONS = {
  income: ['Income', ic('<rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>')],
  expenses: ['Expenses', ic('<path d="M3 4h2.2l2.3 11h10.4l2.1-8H6.4"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="16.5" cy="19.5" r="1.4"/>')],
  bills: ['Bills', ic('<path d="M6 3h12v18l-2.4-1.6L13.2 21 12 20.2 10.8 21l-2.4-1.6L6 21z"/><path d="M9 8h6M9 12h6M9 16h3.5"/>')],
  goals: ['Goals', ic('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>')],
  insights: ['Charts', ic('<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4 3 2.5 5-6.5"/>')]
};
s = s.replace(/<button class="tab" role="tab" data-tab="(\w+)">[^<]*<\/button>/g, (m, k) =>
  TAB_ICONS[k] ? `<button class="tab" role="tab" data-tab="${k}" aria-label="${TAB_ICONS[k][0]}">${TAB_ICONS[k][1]}<span class="tab-lbl">${TAB_ICONS[k][0]}</span></button>` : m);
// dark mode: chart colours + the theme colour. Green is income, a soft coral is spending.
const swaps = [
  ['<meta name="theme-color" content="#EFE3CF">', '<meta name="theme-color" content="#0F1512">'],
  ["const PERSON_COLORS = ['#6DB768','#C49A64'];", "const PERSON_COLORS = ['#74D17E','#D8BC6A'];"],
  ["const SHARED_COLOR = '#E6D3B3';", "const SHARED_COLOR = '#7FB0A2';"],
  ["Chart.defaults.color = '#7D6A55';", "Chart.defaults.color = '#A1B2A6';"],
  ["'#4E9A55'", "'#74D17E'"],
  ["'#E0852F'", "'#F29A8E'"],
  ['rgba(159,212,154,', 'rgba(116,209,126,'],
  ['rgba(246,178,107,', 'rgba(242,154,142,'],
  ["['#F6B26B','#9FD49A','#D9B98C','#F9CF9E','#7FBF7A','#E8955A','#C7DDB5','#B8946A','#FBE0BF','#A7C98F','#E5C9A3']",
   "['#74D17E','#E2BE5E','#5FB3A1','#A9D9A0','#C9A84E','#3E8F80','#D6E7B8','#8FA89A','#F0D88E','#4E9A55','#B9C7BB']"]
];
swaps.forEach(([a, b]) => { s = s.split(a).join(b); });
// charts: gridlines and doughnut seams that read on the glass surface
s = s.split("grid:{color:'#EFE3CF'}").join("grid:{color:'rgba(255,255,255,.08)'}");
s = s.split("borderColor:'#fff', borderWidth:3").join("borderColor:'#0F1512', borderWidth:3");
fs.writeFileSync(p, s);
