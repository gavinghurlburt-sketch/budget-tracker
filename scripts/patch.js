// Builds www/index.html from index.html for the iOS app:
// zoom lock, safe areas, bundled fonts + libraries (offline), haptics, native button feel, sheet dialogs.
const fs = require('fs');
const path = require('path');
const p = 'www/index.html';
let s = fs.readFileSync(p, 'utf8');

// 1. zoom lock + light-only form controls
s = s.replace(/<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n<meta name="color-scheme" content="light">');

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
  html{color-scheme:light;-webkit-text-size-adjust:100%;touch-action:manipulation;}
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
