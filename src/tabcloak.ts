export interface TabCloakPreset {
  id: string;
  title: string;
  icon: string;
}

export const TAB_CLOAKS: TabCloakPreset[] = [
  { id: 'newtab', title: 'New Tab', icon: '/newtab.svg' },
  { id: 'google', title: 'Google', icon: 'https://www.google.com/favicon.ico' },
  { id: 'classroom', title: 'Home', icon: 'https://ssl.gstatic.com/classroom/favicon.png' },
  { id: 'docs', title: 'Google Docs', icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico' },
  { id: 'gmail', title: 'Inbox - Gmail', icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico' },
  { id: 'drive', title: 'My Drive - Google Drive', icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png' },
  { id: 'wikipedia', title: 'Wikipedia', icon: 'https://www.wikipedia.org/static/favicon/wikipedia.ico' },
  { id: 'canvas', title: 'Dashboard', icon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico' },
  { id: 'schoology', title: 'Home | Schoology', icon: 'https://www.schoology.com/sites/default/files/favicon_0.ico' },
  { id: 'bing', title: 'Bing', icon: 'https://www.bing.com/sa/simg/favicon-2x.ico' },
  { id: 'outlook', title: 'Outlook', icon: 'https://res.cdn.office.net/officeinc/officestart/favicon.ico' }
];

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem('batprox-settings') || '{}');
  } catch {
    return {};
  }
}

export function applyTabCloak() {
  const s = readSettings();
  const preset = TAB_CLOAKS.find((p) => p.id === (s.tabCloak || 'newtab')) || TAB_CLOAKS[0];
  document.title = preset.title;
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = preset.icon;
  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'bp-parent', title: preset.title, icon: preset.icon }, '*');
    } catch {
    }
  }
}
