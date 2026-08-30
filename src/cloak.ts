export function launchAboutBlankCloak(targetUrl?: string) {
  if (window.self !== window.top) return;
  const href = targetUrl || location.href;
  const framedHref = href + (href.includes('?') ? '&' : '?') + 'bpab=1';
  const origin = location.origin;
  const html = `<!DOCTYPE html><html><head><title>New Tab</title><link rel="icon" href="${origin}/newtab.svg"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;position:fixed;inset:0}</style></head><body><iframe src="${framedHref}" allow="fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; picture-in-picture"></iframe><script>window.addEventListener('message',function(e){if(!e.data||e.data.type!=='bp-parent')return;if(e.data.title)document.title=e.data.title;if(e.data.icon){var l=document.querySelector('link[rel*="icon"]')||document.createElement('link');l.rel='icon';l.href=e.data.icon;document.head.appendChild(l);}if(e.data.redirect)location.replace(e.data.redirect);});<\/script></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);

  const win = window.open('about:blank', '_blank');
  if (!win) return;
  const doc = win.document;
  doc.open();
  doc.write('<!DOCTYPE html><html><head><title>New Tab</title><link rel="icon" href="' + location.origin + '/newtab.svg"><script>window.addEventListener("message",function(e){if(!e.data||e.data.type!=="bp-parent")return;if(e.data.title)document.title=e.data.title;if(e.data.icon){var l=document.querySelector("link[rel*=\'icon\']")||document.createElement("link");l.rel="icon";l.href=e.data.icon;document.head.appendChild(l);}if(e.data.redirect)location.replace(e.data.redirect);});<\/script><style>html,body{margin:0;padding:0;overflow:hidden;height:100%}iframe{position:fixed;top:0;left:0;width:100%;height:100%;border:none;}</style></head><body></body></html>');
  doc.close();
  const frame = doc.createElement('iframe');
  frame.src = blobUrl;
  frame.setAttribute('allow', 'fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; picture-in-picture');
  doc.body.appendChild(frame);
  try {
    win.history.pushState(null, '', 'about:blank');
    win.history.pushState(null, '', 'about:blank');
  } catch {
  }
  window.location.replace('https://www.google.com');
}

let dashboardSwitchFired = false;

export function switchDashboardToAboutBlank() {
  if (dashboardSwitchFired) return;
  if (new URLSearchParams(location.search).has('bpab')) return;
  dashboardSwitchFired = true;
  if (window.self !== window.top) {
    try {
      window.parent.postMessage({ type: 'bp-aboutblank', url: location.href }, '*');
    } catch {
    }
    return;
  }
  launchAboutBlankCloak();
}

export function isAboutBlankTabEnabled() {
  try {
    const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
    return s.aboutBlankTab === true;
  } catch {
    return false;
  }
}

export function launchBlobCloak() {
  if (window.self !== window.top) return;
  if (location.protocol === 'blob:') return;
  const href = location.href;
  const origin = location.origin;
  const html = `<!DOCTYPE html><html><head><title>New Tab</title><link rel="icon" href="${origin}/newtab.svg"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;position:fixed;inset:0}</style></head><body><iframe src="${href}" allow="fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; picture-in-picture"></iframe><script>function openAboutBlank(u){var fh=u+(u.indexOf('?')===-1?'?':'&')+'bpab=1';var w=window.open('about:blank','_blank');if(!w)return;var d=w.document;d.open();d.write('<!DOCTYPE html><html><head><title>New Tab</title><style>html,body{margin:0;padding:0;overflow:hidden;height:100%}iframe{position:fixed;top:0;left:0;width:100%;height:100%;border:none;}</style></head><body></body></html>');d.close();var f=d.createElement('iframe');f.src='${origin}/cloak-frame.html?target='+encodeURIComponent(fh);f.setAttribute('allow','fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; picture-in-picture');d.body.appendChild(f);try{w.history.pushState(null,'','about:blank');w.history.pushState(null,'','about:blank');}catch(e){}location.replace('https://www.google.com');}window.addEventListener('message',function(e){if(!e.data||e.data.type!=='bp-parent'&&e.data.type!=='bp-aboutblank')return;if(window.top&&window.top!==window){try{window.top.postMessage(e.data,'*');}catch(err){}}if(e.data.type==='bp-aboutblank'&&e.data.url){openAboutBlank(e.data.url);return;}if(e.data.title)document.title=e.data.title;if(e.data.icon){var l=document.querySelector('link[rel*="icon"]')||document.createElement('link');l.rel='icon';l.href=e.data.icon;document.head.appendChild(l);}if(e.data.redirect)location.replace(e.data.redirect);});<\/script></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  location.replace(url);
}
