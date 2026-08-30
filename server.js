require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { uvPath } = require('@titaniumnetwork-dev/ultraviolet');
const { epoxyPath } = require('@mercuryworkshop/epoxy-transport');
const { baremuxPath } = require('@mercuryworkshop/bare-mux/node');
const wisp = require('wisp-server-node');
const { resolveDisplayName } = require('./config/admin');
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || require('./config/openrouter').getKey();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const BOT_SECRET = process.env.BOT_SECRET || crypto.randomBytes(32).toString('hex');
const DB_PATH = './database.sqlite';

const suggestionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const proxyCache = new Map();
const PROXY_CACHE_TTL = 2 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

const cookieJar = new Map();

const sharedHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32 });
const sharedHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32 });

function getJarCookies(host) {
  return cookieJar.get(host) || '';
}

function storeJarCookies(host, setCookieHeader) {
  if (!setCookieHeader) return;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const existing = new Map();
  (cookieJar.get(host) || '').split('; ').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) existing.set(pair.slice(0, idx), pair.slice(idx + 1));
  });
  cookies.forEach(c => {
    const mainPart = c.split(';')[0];
    const idx = mainPart.indexOf('=');
    if (idx > 0) existing.set(mainPart.slice(0, idx), mainPart.slice(idx + 1));
  });
  cookieJar.set(host, Array.from(existing.entries()).map(([k, v]) => `${k}=${v}`).join('; '));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path.startsWith('/proxy') || req.headers['x-original-url'];
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: 'Too many API requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage()
});

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run("ALTER TABLE user_suggestions ADD COLUMN genre TEXT DEFAULT 'Feedback suggestions'", () => {});
    db.run(`CREATE TABLE IF NOT EXISTS admin_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      user_identifier TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      genre TEXT DEFAULT 'Feedback suggestions',
      approved_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS proxy_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      invite_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      invite_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS changelogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      used_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
      const defaultCodes = ['BATPROX-2026', 'WELCOME-BAT', 'NIGHT-PROX'];
      defaultCodes.forEach(code => {
        db.run('INSERT OR IGNORE INTO invite_codes (code) VALUES (?)', [code]);
      });
    });

    db.run(`CREATE TABLE IF NOT EXISTS custom_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      owner TEXT,
      html TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS changelogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
      db.get('SELECT id FROM changelogs WHERE version = ?', ['beta v1.0'], (err, row) => {
        if (!err && !row) {
          db.run(
            'INSERT INTO changelogs (version, title, description) VALUES (?, ?, ?)',
            [
              'beta v1.0',
              'Website release - beta v1.0',
              '+ created and publish bat proxy.\n+ added website themes on release.\n+ added website background choice on release.\n+ added games on release.\n+ meet MocahAI, on release. (still in beta).\n+ added auto-login. Feature (suggested from a friend).\n+ added tab cloak.\n+ added blob cloak (better version), as soon as you get into the website for the first time.'
            ]
          );
        }
      });
    });

    db.run(`CREATE TABLE IF NOT EXISTS service_status (
      name TEXT PRIMARY KEY,
      color TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false
}));
app.disable('x-powered-by');

app.use(cors({
  origin: ['https://nightbat.cfd', 'https://www.nightbat.cfd', 'http://nightbat.cfd', 'http://www.nightbat.cfd', 'http://localhost:5179', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'http://localhost:5180'],
  credentials: true
}));

app.use(['/baremux', '/epoxy', '/uv'], (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});
app.use(express.static('public'));
app.use('/uv/', express.static(path.join(__dirname, 'public', 'uv')));
app.use('/uv/', express.static(uvPath));
app.use('/epoxy/', express.static(epoxyPath));
app.use('/baremux/', express.static(baremuxPath));

app.use(limiter);
app.use(express.json({ limit: '64kb' }));
app.use('/api/', apiLimiter);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

app.get('/api/my-games', (req, res) => {
  const gamesDir = path.join(__dirname, 'public', 'my-games');
  
  try {
    if (!fs.existsSync(gamesDir)) {
      return res.json({ games: [] });
    }
    
    const files = fs.readdirSync(gamesDir);
    const games = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.html', '.htm', '.swf', '.zip'].includes(ext);
      })
      .map(file => ({
        name: path.basename(file, path.extname(file)),
        filename: file,
        url: `/my-games/${file}`
      }));
    
    res.json({ games });
  } catch (error) {
    console.error('Error reading my-games directory:', error);
    res.status(500).json({ error: 'Failed to read games directory' });
  }
});

app.post('/api/suggestions', async (req, res) => {
  try {
    const { content, userIdentifier, genre } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Suggestion content is required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Suggestion content is too long (max 1000 characters)' });
    }

    const sanitizedContent = content.trim().replace(/[<>]/g, '');
    const identifier = userIdentifier || 'anonymous-' + Date.now();

    db.run(
      'INSERT INTO user_suggestions (content, user_identifier, genre) VALUES (?, ?, ?)',
      [sanitizedContent, identifier, genre === 'Website bug' ? 'Website bug' : 'Feedback suggestions'],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to save suggestion' });
        }
        res.json({ 
          success: true, 
          message: 'Suggestion submitted successfully',
          id: this.lastID,
          userIdentifier: identifier
        });
      }
    );
  } catch (error) {
    console.error('Suggestion submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function proxyAssetUrl(raw, base) {
  if (!raw) return raw;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('#') || trimmed.startsWith('blob:') || trimmed.startsWith('/proxy')) {
    return trimmed;
  }
  try {
    const abs = new URL(trimmed, base).href;
    return '/proxy?url=' + encodeURIComponent(abs);
  } catch {
    return trimmed;
  }
}

function rewriteCss(css, base) {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/gi, (match, quote, url) => {
    return 'url(' + quote + proxyAssetUrl(url, base) + quote + ')';
  });
}

function rewriteHtml(html, parsedUrl) {
  const base = parsedUrl.href;
  let out = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');
  out = out.replace(/(src|href|action|poster|data-src|data-href)=(["'])([^"']+)\2/gi, (match, attr, quote, url) => {
    return attr + '=' + quote + proxyAssetUrl(url, base) + quote;
  });
  out = rewriteCss(out, base);
  out = out.replace(/srcset=(["'])([^"']+)\1/gi, (match, quote, val) => {
    const parts = val.split(',').map((part) => {
      const bits = part.trim().split(/\s+/);
      bits[0] = proxyAssetUrl(bits[0], base);
      return bits.join(' ');
    });
    return 'srcset=' + quote + parts.join(', ') + quote;
  });
  const inject = `<script>(function(){window.__bpBase=${JSON.stringify(base)};function p(u){try{if(!u||typeof u!=='string')return u;if(u.indexOf('data:')===0||u.indexOf('blob:')===0||u.indexOf('javascript:')===0||u.indexOf('about:')===0||u.indexOf('mailto:')===0||u.charAt(0)==='#')return u;if(u.indexOf('/proxy?url=')===0)return u;var a=new URL(u,window.__bpBase||document.baseURI);if(a.pathname==='/proxy'||a.pathname.indexOf('/proxy')===0||a.pathname.indexOf('/api')===0||a.pathname.indexOf('/wisp')===0||a.pathname.indexOf('/uv')===0||a.pathname.indexOf('/epoxy')===0||a.pathname.indexOf('/baremux')===0||a.pathname.indexOf('/site')===0)return a.href;var b=new URL(window.__bpBase||document.baseURI);if(a.origin===window.location.origin){return '/proxy?url='+encodeURIComponent(b.protocol+'//'+b.host+a.pathname+a.search+a.hash);}return '/proxy?url='+encodeURIComponent(a.href);}catch(e){return u;}}
var of=window.fetch;window.fetch=function(i,n){try{if(typeof i==='string')return of(p(i),n);if(i&&typeof Request!=='undefined'&&i instanceof Request)return of(new Request(p(i.url),i),n);if(i&&i.url)return of(new Request(p(i.url),i),n);}catch(e){}return of(i,n);};
var OW=window.WebSocket;
function FakeSocket(u){var s=this;this.url=String(u);this.readyState=0;this.binaryType='blob';this.bufferedAmount=0;this.extensions='';this.protocol='';this._q=[];this.onopen=null;this.onmessage=null;this.onerror=null;this.onclose=null;this._qf=[];this.addEventListener=function(t,f){if(t==='open')s.onopen=f;else if(t==='message')s._qf.push(f);else if(t==='close')s.onclose=f;else if(t==='error')s.onerror=f;};this.removeEventListener=function(){};
setTimeout(function(){s.readyState=1;if(typeof s.onopen==='function')try{s.onopen({type:'open'});}catch(e){}},40);}
FakeSocket.prototype.send=function(d){this._q.push(d);};
FakeSocket.prototype.close=function(){this.readyState=3;if(typeof this.onclose==='function')try{this.onclose({type:'close',code:1000,wasClean:true});}catch(e){}};
window.WebSocket=function(u,pr){try{var a=new URL(u,window.__bpBase||document.baseURI);if(a.protocol==='ws:'||a.protocol==='wss:'){var same=a.host===window.location.host&&(a.pathname==='/wisp'||a.pathname.indexOf('/wisp/')===0);if(!same){return new FakeSocket(u);}}}catch(e){}try{return pr===undefined?new OW(u):new OW(u,pr);}catch(e2){return new FakeSocket(u);}};
window.WebSocket.prototype=OW.prototype;
window.WebSocket.CONNECTING=0;window.WebSocket.OPEN=1;window.WebSocket.CLOSING=2;window.WebSocket.CLOSED=3;
if(window.EventSource){var OE=window.EventSource;window.EventSource=function(u,c){try{return new OE(p(u),c);}catch(e){}return new OE(u,c);};window.EventSource.prototype=OE.prototype;}
var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(){var a=[].slice.call(arguments);if(typeof a[1]==='string')a[1]=p(a[1]);return oo.apply(this,a);};
if(navigator.sendBeacon){var osb=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){try{if(typeof u==='string')u=p(u);}catch(e){}return osb(u,d);};}
var osa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){try{if(typeof v==='string'&&(n==='src'||n==='href'||n==='action')&&v.indexOf('data:')!==0&&v.indexOf('blob:')!==0&&v.indexOf('javascript:')!==0&&v.charAt(0)!=='#')v=p(v);}catch(e){}return osa.call(this,n,v);};
function pp(proto,prop){var d=Object.getOwnPropertyDescriptor(proto,prop);if(d&&d.set){try{Object.defineProperty(proto,prop,{get:d.get,set:function(v){try{if(typeof v==='string')v=p(v);}catch(e){}d.set.call(this,v);},configurable:true});}catch(e){}}}
['HTMLScriptElement','HTMLImageElement','HTMLIFrameElement','HTMLSourceElement','HTMLAudioElement','HTMLVideoElement','HTMLEmbedElement'].forEach(function(c){var k=window[c];if(k)pp(k.prototype,'src');});
['HTMLLinkElement','HTMLAnchorElement','HTMLAreaElement'].forEach(function(c){var k=window[c];if(k)pp(k.prototype,'href');});
pp(HTMLFormElement.prototype,'action');
function notify(u){try{var n=new URL(u,window.__bpBase||document.baseURI);if(n.pathname==='/proxy')u=n.searchParams.get('url')||u;parent.postMessage({type:'batprox-nav',url:u},'*');}catch(x){}}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a'):null;if(!a||!a.href)return;e.preventDefault();var href=a.getAttribute('href')||a.href;notify(new URL(href,window.__bpBase||document.baseURI).href);window.location.href=p(href);},true);
document.addEventListener('submit',function(e){var f=e.target;if(!f||!f.action)return;e.preventDefault();window.location.href=p(f.action);},true);
function rewriteEl(el){['src','href','action','poster','data-src'].forEach(function(n){var v=el.getAttribute&&el.getAttribute(n);if(v&&v.indexOf('/proxy?url=')!==0&&v.indexOf('data:')!==0&&v.indexOf('blob:')!==0&&v.charAt(0)!=='#'){try{el.setAttribute(n,p(v));}catch(e){}}});}
if(document.documentElement)rewriteEl(document.documentElement);
if(window.MutationObserver){new MutationObserver(function(muts){muts.forEach(function(m){if(m.type==='attributes'&&m.target&&m.target.getAttribute)rewriteEl(m.target);m.addedNodes&&m.addedNodes.forEach(function(n){if(n.nodeType===1){rewriteEl(n);if(n.querySelectorAll)n.querySelectorAll('[src],[href],[action]').forEach(rewriteEl);}});});}).observe(document.documentElement||document,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','action','poster','data-src']});}
window.addEventListener('unhandledrejection',function(e){e.preventDefault();},{capture:true});
window.addEventListener('error',function(e){if(e&&e.message&&/OW is not defined|WebSocket|CORS|Failed to load/i.test(e.message))e.preventDefault();},{capture:true});
})();</script>`;
  const headOpen = out.match(/<head[^>]*>/i);
  if (headOpen) {
    out = out.replace(headOpen[0], headOpen[0] + inject);
  } else if (out.includes('</head>')) {
    out = out.replace('</head>', inject + '</head>');
  } else {
    out = inject + out;
  }
  return out;
}

const LUMIN_JSDELIVR = 'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/fonts.min.js';

async function sendLuminScript(res) {
  try {
    const response = await axios({
      method: 'GET',
      url: LUMIN_JSDELIVR,
      responseType: 'text',
      timeout: 12000,
      validateStatus: () => true
    });
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Access-Control-Allow-Origin', '*');
    if (response.status >= 400 || !response.data) {
      return res.status(502).send('self.onmessage=function(){};');
    }
    res.send(response.data);
  } catch {
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    res.status(502).send('self.onmessage=function(){};');
  }
}

app.get('/lumin.js', (_req, res) => {
  sendLuminScript(res);
});

app.get('/lumin.worker.js', (_req, res) => {
  sendLuminScript(res);
});

app.all('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return res.status(400).send('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Only HTTP and HTTPS protocols are allowed');
    }

    const originalOrigin = req.headers['x-original-origin'];
    const originalHost = req.headers['x-original-host'];

    const isSubresource = !req.headers['sec-fetch-dest'] || !['document', 'iframe', 'frame'].includes(req.headers['sec-fetch-dest']);
    const cacheKey = 'p:' + req.method + ':' + targetUrl;
    if (req.method === 'GET' && isSubresource) {
      const cached = proxyCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROXY_CACHE_TTL) {
        res.status(cached.status);
        res.set('Content-Type', cached.contentType);
        res.set('Access-Control-Allow-Origin', '*');
        res.set('X-Proxy-Response', 'true');
        res.set('X-Cache', 'HIT');
        return res.send(cached.body);
      }
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      responseType: 'arraybuffer',
      httpAgent: sharedHttpAgent,
      httpsAgent: sharedHttpsAgent,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': req.headers['sec-fetch-dest'] || 'document',
        'Sec-Fetch-Mode': req.headers['sec-fetch-mode'] || 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Referer': originalOrigin || parsedUrl.origin,
        ...(req.method !== 'GET' ? { 'Origin': originalOrigin || parsedUrl.origin } : {}),
        ...(getJarCookies(parsedUrl.hostname) ? { 'Cookie': getJarCookies(parsedUrl.hostname) } : {}),
        'Host': originalHost || parsedUrl.hostname
      },
      ...(req.method !== 'GET' && req.body && Object.keys(req.body).length > 0 ? { data: req.body } : {}),
      timeout: 12000,
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const buf = Buffer.from(response.data);
    storeJarCookies(parsedUrl.hostname, response.headers['set-cookie']);
    lastProxyOrigin = parsedUrl.origin;
    const isText = /html|css|javascript|json|xml|svg|text\//i.test(contentType);
    let body = isText ? buf.toString('utf8') : buf;

    if (typeof body === 'string' && contentType.includes('html')) {
      body = rewriteHtml(body, parsedUrl);
    } else if (typeof body === 'string' && contentType.includes('css')) {
      body = rewriteCss(body, parsedUrl.href);
    }

    if (req.method === 'GET' && isSubresource && response.status === 200) {
      proxyCache.set(cacheKey, {
        body,
        contentType,
        status: response.status,
        timestamp: Date.now()
      });
      if (proxyCache.size > MAX_CACHE_SIZE) {
        const oldest = proxyCache.keys().next().value;
        proxyCache.delete(oldest);
      }
    }

    res.status(response.status);
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('X-Proxy-Response', 'true');
    res.set('Permissions-Policy', 'unload=*, fullscreen=*, autoplay=*, camera=*, microphone=*, geolocation=*, payment=*');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.send(body);
  } catch (error) {
    console.error('Proxy error:', error.message);
    if (error.response) {
      res.status(error.response.status).send(`Proxy error: ${error.response.statusText}`);
    } else if (error.request) {
      res.status(502).send('Proxy error: No response from target server');
    } else {
      res.status(500).send(`Proxy error: ${error.message}`);
    }
  }
});

app.options('*', (req, res) => {
  const requestOrigin = req.headers['origin'];
  if (requestOrigin) {
    res.set('Access-Control-Allow-Origin', requestOrigin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

function getCacheKey(url, method) {
  return `${method}:${url}`;
}

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of proxyCache.entries()) {
    if (now - value.timestamp > PROXY_CACHE_TTL) {
      proxyCache.delete(key);
    }
  }
  if (proxyCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(proxyCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, proxyCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      proxyCache.delete(key);
    }
  }
}

setInterval(cleanCache, 30000);

async function proxyRequest(targetUrl, req, res) {
  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return res.status(400).send('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Only HTTP and HTTPS protocols are allowed');
    }

    lastProxyOrigin = parsedUrl.origin;

    const originalOrigin = req.headers['x-original-origin'];
    const originalHost = req.headers['x-original-host'];

    const cacheKey = getCacheKey(targetUrl, req.method);
    if (req.method === 'GET') {
      const cached = proxyCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROXY_CACHE_TTL) {
        res.set('Content-Type', cached.contentType);
        
        const requestOrigin = req.headers['origin'];
        if (requestOrigin) {
          res.set('Access-Control-Allow-Origin', requestOrigin);
        } else {
          res.set('Access-Control-Allow-Origin', '*');
        }
        
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.set('Access-Control-Allow-Headers', '*');
        res.set('X-Proxy-Response', 'true');
        res.set('X-Cache', 'HIT');
        return res.send(cached.data);
      }
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      responseType: 'arraybuffer',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': originalOrigin || parsedUrl.origin,
        'Origin': originalOrigin || parsedUrl.origin,
        'Host': originalHost || parsedUrl.hostname
      },
      ...(req.method !== 'GET' && req.body && Object.keys(req.body).length > 0 ? { data: req.body } : {}),
      timeout: 8000,
      maxRedirects: 5,
      validateStatus: () => true,
      httpAgent: sharedHttpAgent,
      httpsAgent: sharedHttpsAgent
    });
    
    const contentType = response.headers['content-type'] || 'application/json';
    let responseData = response.data;
    
    const isBinary = contentType.includes('font') || 
                     contentType.includes('image') || 
                     contentType.includes('video') || 
                     contentType.includes('audio') || 
                     contentType.includes('application/octet-stream') ||
                     contentType.includes('application/zip') ||
                     contentType.includes('application/pdf') ||
                     contentType.includes('woff') ||
                     contentType.includes('woff2') ||
                     contentType.includes('ttf') ||
                     contentType.includes('otf') ||
                     contentType.includes('eot');
    
    if (response.data instanceof ArrayBuffer || Buffer.isBuffer(response.data)) {
      if (isBinary) {
        responseData = Buffer.from(response.data);
      } else if (contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript') || contentType.includes('xml') || contentType.includes('html') || contentType.includes('css')) {
        try {
          responseData = Buffer.from(response.data).toString('utf-8');
        } catch (e) {
          responseData = Buffer.from(response.data);
        }
      } else {
        responseData = Buffer.from(response.data);
      }
    }
    
    if (req.method === 'GET' && response.status === 200 && responseData && typeof responseData === 'string' && !isBinary) {
      proxyCache.set(cacheKey, {
        data: responseData,
        contentType: contentType,
        timestamp: Date.now()
      });
    }
    
    res.set('Content-Type', contentType);
    
    const requestOrigin = req.headers['origin'];
    if (requestOrigin) {
      res.set('Access-Control-Allow-Origin', requestOrigin);
    } else {
      res.set('Access-Control-Allow-Origin', '*');
    }
    
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Expose-Headers', '*');
    res.set('X-Proxy-Response', 'true');
    res.set('X-Cache', 'MISS');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('X-Content-Type-Options');
    res.removeHeader('Frame-Options');
    res.removeHeader('Frame-Ancestors');
    res.removeHeader('Content-Security-Policy-Report-Only');
    res.removeHeader('Permissions-Policy');
    
    if (Buffer.isBuffer(responseData)) {
      res.send(responseData);
    } else {
      res.send(responseData);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    if (error.response) {
      res.status(error.response.status).send(`Proxy error: ${error.response.statusText}`);
    } else if (error.request) {
      res.status(502).send('Proxy error: No response from target server');
    } else {
      res.status(500).send(`Proxy error: ${error.message}`);
    }
  }
}

app.all('/ajax/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  if (!originalUrl) {
    return next();
  }
  return proxyRequest(originalUrl, req, res);
});

app.all('/api/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  if (!originalUrl) {
    return next();
  }
  return proxyRequest(originalUrl, req, res);
});

app.all('/ig_xsite_user_info*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  if (!originalUrl) {
    return next();
  }
  return proxyRequest(originalUrl, req, res);
});

app.all('/v1/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  if (!originalUrl) {
    return next();
  }
  return proxyRequest(originalUrl, req, res);
});

app.all('/v2/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  if (!originalUrl) {
    return next();
  }
  return proxyRequest(originalUrl, req, res);
});

let lastProxyOrigin = '';

app.all('/cdn-cgi/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  if (originalUrl) {
    return proxyRequest(originalUrl, req, res);
  }
  if (lastProxyOrigin) {
    return proxyRequest(lastProxyOrigin + req.originalUrl, req, res);
  }
  return next();
});

app.all('*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  
  if (!originalUrl) {
    return next();
  }

  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(originalUrl);
    } catch (e) {
      return res.status(400).send('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Only HTTP and HTTPS protocols are allowed');
    }

    const response = await axios({
      method: req.method,
      url: originalUrl,
      responseType: 'arraybuffer',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': parsedUrl.origin,
        'Origin': parsedUrl.origin
      },
      ...(req.method !== 'GET' && req.body && Object.keys(req.body).length > 0 ? { data: req.body } : {}),
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('X-Proxy-Response', 'true');
    
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Dynamic proxy error:', error.message);
    if (error.response) {
      res.status(error.response.status).send(`Proxy error: ${error.response.statusText}`);
    } else if (error.request) {
      res.status(502).send('Proxy error: No response from target server');
    } else {
      res.status(500).send(`Proxy error: ${error.message}`);
    }
  }
});

app.get('/api/admin/feedbacks', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT * FROM user_suggestions ORDER BY submitted_at DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve feedbacks' });
      }
      res.json({ feedbacks: rows });
    }
  );
});

app.post('/api/admin/approve-feedback', authenticateToken, requireAdmin, (req, res) => {
  const { suggestionId } = req.body;

  if (!suggestionId) {
    return res.status(400).json({ error: 'Suggestion ID is required' });
  }

  db.run(
    'UPDATE user_suggestions SET status = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['approved', suggestionId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to approve suggestion' });
      }
      res.json({ success: true, message: 'Suggestion approved successfully' });
    }
  );
});

app.post('/api/admin/decline-feedback', authenticateToken, requireAdmin, (req, res) => {
  const { suggestionId } = req.body;

  if (!suggestionId) {
    return res.status(400).json({ error: 'Suggestion ID is required' });
  }

  db.run(
    'UPDATE user_suggestions SET status = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['declined', suggestionId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to decline suggestion' });
      }
      res.json({ success: true, message: 'Suggestion declined' });
    }
  );
});

app.post('/api/admin/create-admin-user', (req, res) => {
  const { username, inviteCode, botSecret } = req.body;

  if (!botSecret || botSecret !== BOT_SECRET) {
    return res.status(403).json({ error: 'Invalid bot secret' });
  }
  if (!username || !inviteCode) {
    return res.status(400).json({ error: 'Username and invite code are required' });
  }
  const cleanUsername = String(username).trim();
  const cleanCode = String(inviteCode).trim();

  db.run(
    'INSERT INTO admin_users (username, invite_code) VALUES (?, ?)',
    [cleanUsername, cleanCode],
    function(err) {
      if (err) {
        if (String(err.message).includes('UNIQUE')) {
          return res.status(409).json({ error: 'Admin username already exists' });
        }
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create admin account' });
      }
      res.json({ success: true, message: 'admin account created into the website database.' });
    }
  );
});

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT id, username, invite_code, created_at FROM users ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve users' });
      }
      res.json({ users: rows });
    }
  );
});

app.post('/api/admin/create-user', authenticateToken, requireAdmin, (req, res) => {
  const { username, inviteCode } = req.body;

  if (!username || !inviteCode) {
    return res.status(400).json({ error: 'Username and invite code are required' });
  }
  const cleanUsername = String(username).trim();
  const cleanCode = String(inviteCode).trim();

  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
  }
  if (cleanCode.length < 4) {
    return res.status(400).json({ error: 'Invite code must be at least 4 characters' });
  }

  db.get('SELECT id FROM users WHERE username = ?', [cleanUsername], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    db.run(
      'INSERT INTO users (username, invite_code) VALUES (?, ?)',
      [cleanUsername, cleanCode],
      function(err2) {
        if (err2) {
          console.error('Database error:', err2);
          return res.status(500).json({ error: 'Failed to create account' });
        }
        res.json({ success: true, message: 'Account created', id: this.lastID });
      }
    );
  });
});

app.post('/api/admin/remove-user', authenticateToken, requireAdmin, (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  const cleanUsername = String(username).trim();

  db.run('DELETE FROM users WHERE username = ?', [cleanUsername], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to remove account' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    db.run('DELETE FROM invite_codes WHERE used_by = ?', [cleanUsername]);
    res.json({ success: true, message: 'Account removed' });
  });
});

app.post('/api/admin/revoke-key', authenticateToken, requireAdmin, (req, res) => {
  const { username, newCode } = req.body;
  if (!username || !newCode) {
    return res.status(400).json({ error: 'Username and new invite code are required' });
  }
  const cleanUsername = String(username).trim();
  const cleanCode = String(newCode).trim();

  if (cleanCode.length < 4) {
    return res.status(400).json({ error: 'Invite code must be at least 4 characters' });
  }

  db.run('UPDATE users SET invite_code = ? WHERE username = ?', [cleanCode, cleanUsername], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to revoke access key' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ success: true, message: 'Access key revoked and replaced' });
  });
});

app.delete('/api/changelogs/:id', authenticateToken, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Invalid changelog id' });
  }
  db.run('DELETE FROM changelogs WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to delete changelog' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Changelog not found' });
    }
    res.json({ success: true });
  });
});

app.get('/api/suggestions/:userIdentifier', (req, res) => {
  const { userIdentifier } = req.params;
  
  const cached = suggestionsCache.get(userIdentifier);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json({ notifications: cached.data });
  }
  
  db.all(
    'SELECT * FROM user_suggestions WHERE user_identifier = ? AND status IN (?, ?) ORDER BY approved_at DESC LIMIT 5',
    [userIdentifier, 'approved', 'declined'],
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve notifications' });
      }
      
      suggestionsCache.set(userIdentifier, {
        data: rows,
        timestamp: Date.now()
      });
      
      res.json({ notifications: rows });
    }
  );
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, inviteCode } = req.body;

    if (!username || !inviteCode) {
      return res.status(400).json({ error: 'Username and invite code are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    const cleanUsername = username.trim();
    const cleanCode = inviteCode.trim();

    const issueToken = (userId, isAdmin) => {
      const token = jwt.sign(
        { id: userId, username: cleanUsername, isAdmin: !!isAdmin },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({ success: true, token, user: { id: userId, username: resolveDisplayName(cleanUsername) } });
    };

    const ensureUserRow = (isAdmin, onDone) => {
      db.get('SELECT * FROM users WHERE username = ?', [cleanUsername], (uer, userRow) => {
        if (uer) {
          console.error('Database error:', uer);
          return res.status(500).json({ error: 'Database error' });
        }
        if (userRow) return onDone(userRow.id);
        db.run(
          'INSERT INTO users (username, invite_code) VALUES (?, ?)',
          [cleanUsername, cleanCode],
          function(ierr) {
            if (ierr) {
              console.error('Database error:', ierr);
              return res.status(500).json({ error: 'Failed to create account' });
            }
            onDone(this.lastID);
          }
        );
      });
    };

    db.get('SELECT * FROM admin_users WHERE username = ?', [cleanUsername], (aerr, adminRow) => {
      if (aerr) {
        console.error('Database error:', aerr);
        return res.status(500).json({ error: 'Database error' });
      }
      if (adminRow) {
        const matchAdmin = cleanCode === adminRow.invite_code;
        if (!matchAdmin) {
          return new Promise((resolve) => {
            db.get('SELECT * FROM users WHERE username = ?', [cleanUsername], (uerr, userRow) => {
              if (uerr) {
                console.error('Database error:', uerr);
                res.status(500).json({ error: 'Database error' });
              } else if (userRow && userRow.invite_code === cleanCode) {
                issueToken(userRow.id, true);
              } else {
                res.status(401).json({ error: 'Invalid credentials' });
              }
              resolve(null);
            });
          });
        }
        return ensureUserRow(true, (userId) => issueToken(userId, true));
      }

    db.get('SELECT * FROM users WHERE username = ?', [cleanUsername], (uerr, existingUser) => {
      if (uerr) {
        console.error('Database error:', uerr);
        return res.status(500).json({ error: 'Database error' });
      }
      if (existingUser) {
        if (existingUser.invite_code !== cleanCode) {
          return res.status(401).json({ error: 'Invite code does not match this account' });
        }
        return issueToken(existingUser.id, false);
      }

      db.get('SELECT * FROM invite_codes WHERE code = ?', [cleanCode], (err, codeRow) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!codeRow) {
          return res.status(401).json({ error: 'Invalid invite code' });
        }

        if (codeRow.used_by && codeRow.used_by !== cleanUsername) {
          return res.status(401).json({ error: 'Invite code already in use' });
        }

        db.run('UPDATE invite_codes SET used_by = ? WHERE code = ?', [cleanUsername, cleanCode], () => {
          ensureUserRow(false, (userId) => issueToken(userId, false));
        });
      });
    });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: { id: req.user.id, username: resolveDisplayName(req.user.username) }, isAdmin: !!req.user.isAdmin });
});

app.get('/api/changelogs', (req, res) => {
  db.all('SELECT id, version, title, description, created_at FROM changelogs ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to retrieve changelogs' });
    }
    res.json({ changelogs: rows || [] });
  });
});

app.post('/api/changelogs', authenticateToken, requireAdmin, (req, res) => {
  const { version, title, description } = req.body;
  if (!version || !title || !description) {
    return res.status(400).json({ error: 'Version, title and description are required' });
  }
  const cleanVersion = String(version).trim().slice(0, 30);
  const cleanTitle = String(title).trim().slice(0, 120);
  const cleanDescription = String(description).trim().slice(0, 2000);
  db.run(
    'INSERT INTO changelogs (version, title, description) VALUES (?, ?, ?)',
    [cleanVersion, cleanTitle, cleanDescription],
    function(err) {
      if (err) {
        if (String(err.message).includes('UNIQUE')) {
          return res.status(409).json({ error: 'That version already exists' });
        }
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to post changelog' });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get(
      'SELECT * FROM admin_accounts WHERE username = ?',
      [username],
      async (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!row) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, row.password_hash);
        
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { id: row.id, username: row.username },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({ 
          success: true, 
          token,
          user: { id: row.id, username: row.username }
        });
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/create-account', async (req, res) => {
  try {
    const { username, password, botSecret } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!botSecret || botSecret !== BOT_SECRET) {
      return res.status(403).json({ error: 'Invalid bot secret' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO admin_accounts (username, password_hash) VALUES (?, ?)',
      [username, passwordHash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'Username already exists' });
          }
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create account' });
        }
        res.json({ 
          success: true, 
          message: 'Account created successfully',
          id: this.lastID 
        });
      }
    );
  } catch (error) {
    console.error('Account creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const url = new URL(targetUrl);
    
    if (!['http:', 'https:'].includes(url.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS protocols are allowed' });
    }

    const proxyOptions = {
      target: targetUrl,
      changeOrigin: true,
      secure: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('X-Forwarded-For', req.ip);
        proxyReq.setHeader('X-Real-IP', req.ip);
      },
      onProxyRes: (proxyRes, req, res) => {
        proxyRes.headers['X-Frame-Options'] = 'ALLOWALL';
        proxyRes.headers['Content-Security-Policy'] = "frame-ancestors 'self' *;";
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];
      },
      selfHandleResponse: false
    };

    const proxy = createProxyMiddleware(proxyOptions);
    proxy(req, res, next);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
});

const { execFile } = require('child_process');
const os = require('os');

function unzipArchive(zipPath, destDir) {
  return new Promise((resolve) => {
    execFile('tar', ['-xf', zipPath, '-C', destDir], { windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

function listDir(dir, base, depth, out) {
  if (depth > 3) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.forEach((e) => {
    const full = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) {
      out.push(rel + '/');
      listDir(full, rel, depth + 1, out);
    } else {
      let size = '';
      try {
        const st = fs.statSync(full);
        size = ' (' + st.size + ' bytes)';
      } catch {
      }
      out.push(rel + size);
    }
  });
}

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { error: 'AI rate limit reached. Wait a minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/ai/chat', aiLimiter, upload.array('files', 20), async (req, res) => {
  try {
    let message = '';

    if (req.body.message) {
      message = String(req.body.message).slice(0, 4000);
    }

    const files = req.files;
    if (!message && (!files || files.length === 0)) {
      return res.status(400).json({ error: 'Message or file is required' });
    }

    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('who made this website') || lowerMessage.includes('who created this website') || lowerMessage.includes('who made this site')) {
      return res.json({
        response: 'MicahG, is the creator of this website. And the creator of me. He is going to keep on improving me, and going to keep on improving this entire website in general.'
      });
    }

    const terminal = [];
    const imageParts = [];
    let fileContext = '';

    if (files && files.length > 0) {
      const workspace = path.join(os.tmpdir(), 'batprox-ai-workspace');
      if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });

      for (const file of files) {
        const isImage = (file.mimetype || '').startsWith('image/');
        if (isImage) {
          const b64 = file.buffer.toString('base64');
          imageParts.push({
            type: 'image_url',
            image_url: { url: `data:${file.mimetype};base64,${b64}` }
          });
          terminal.push(`$ attach --image ${file.originalname} (${Math.round(file.size / 1024)} KB)`);
          terminal.push(`[ok] image loaded into vision context`);
          continue;
        }

        const safeName = file.originalname.replace(/[^\w.\- ]/g, '_');
        const ext = path.extname(safeName).toLowerCase();

        if (ext === '.zip') {
          const zipPath = path.join(workspace, safeName);
          fs.writeFileSync(zipPath, file.buffer);
          const destDir = path.join(workspace, safeName.replace(/\.zip$/i, ''));
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          terminal.push(`$ tar -xf "${safeName}" -C workspace/${path.basename(destDir)}`);
          const ok = await unzipArchive(zipPath, destDir);
          if (ok) {
            terminal.push(`[ok] archive extracted`);
            const listing = [];
            listDir(destDir, path.basename(destDir), 0, listing);
            terminal.push('$ ls -R workspace');
            listing.slice(0, 60).forEach((line) => terminal.push(line));
            fileContext += `\n\n[Extracted archive "${safeName}" contains:]\n${listing.slice(0, 60).join('\n')}`;
          } else {
            terminal.push(`[failed] could not extract archive`);
            fileContext += `\n\n[Archive "${safeName}" could not be extracted.]`;
          }
          continue;
        }

        let contentSnippet = '';
        if (file.size < 20000) {
          try {
            contentSnippet = file.buffer.toString('utf8').slice(0, 4000);
          } catch {
          }
        }
        terminal.push(`$ cat "${safeName}"`);
        if (contentSnippet) {
          terminal.push(`[read ${file.size} bytes]`);
          fileContext += `\n\n[File "${safeName}" content:]\n${contentSnippet}`;
        } else {
          terminal.push(`[binary file, ${file.size} bytes]`);
          fileContext += `\n\n[File "${safeName}" is binary, ${file.size} bytes.]`;
        }
      }
    }

    let userContent = message;
    if (fileContext) {
      userContent = message + '\n' + fileContext;
    }

    const userMessage = imageParts.length > 0
      ? [{ type: 'text', text: userContent || 'Describe the attached image(s).' }, ...imageParts]
      : userContent;

    const messages = [
      { role: 'system', content: 'You are MocahAI, a highly intelligent AI assistant created by MicahG. You are knowledgeable in algebra 1, algebra 2, geometry 1, geometry 2, physics, chemistry, biology, science, english, history, geography, computer science, calculus, statistics, trigonometry, literature, writing, and many other academic subjects. Provide accurate, detailed, and helpful responses. Be thorough but concise. Use markdown formatting when appropriate with **bold** for emphasis, *italic* for important terms, and bullet points for lists.' },
      { role: 'user', content: userMessage }
    ];

    let data = null;
    let providerError = 'Failed to get AI response';

    try {
      for (let attempt = 0; attempt < 3 && !data; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 2500 * attempt));
        }
        const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'HTTP-Referer': 'https://nightbat.cfd',
            'X-Title': 'Bat Prox'
          },
          body: JSON.stringify({
            model: 'stealth/ox-alpha',
            messages,
            stream: false,
            max_tokens: 1200,
            temperature: 0.6
          })
        });

        if (orResponse.ok) {
          data = await orResponse.json();
        } else {
          const errorText = await orResponse.text();
          try {
            const parsed = JSON.parse(errorText);
            providerError = parsed.error?.message || parsed.error || providerError;
          } catch {
            if (errorText) providerError = errorText.slice(0, 200);
          }
          console.error(`OpenRouter API error (attempt ${attempt + 1}):`, errorText.slice(0, 200));
          if (orResponse.status !== 429 && orResponse.status < 500) {
            break;
          }
        }
      }
    } catch (orErr) {
      console.error('OpenRouter unreachable:', orErr.message);
      providerError = 'OpenRouter unreachable';
    }

    if (!data || !data.choices || !data.choices[0]) {
      try {
        const fallbackResponse = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'openai',
            messages,
            stream: false,
            max_tokens: 800,
            temperature: 0.6
          })
        });

        if (fallbackResponse.ok) {
          data = await fallbackResponse.json();
        } else {
          const fallbackError = await fallbackResponse.text();
          console.error('Fallback AI error:', fallbackError);
        }
      } catch (fallbackErr) {
        console.error('Fallback AI unreachable:', fallbackErr.message);
      }
    }

    if (!data || !data.choices || !data.choices[0]) {
      return res.status(502).json({ error: providerError });
    }

    const aiResponse = data.choices[0]?.message?.content || 'No response from AI';

    res.json({ response: aiResponse, terminal });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/ai/status/api', (req, res) => {
  res.send('MochaAI active');
});

app.get('/api/my-games', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const gamesDir = path.join(__dirname, 'public', 'my-games');
  
  try {
    if (!fs.existsSync(gamesDir)) {
      return res.json({ games: [] });
    }
    
    const files = fs.readdirSync(gamesDir);
    const games = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.html', '.htm', '.swf', '.zip'].includes(ext);
      })
      .map(file => ({
        name: path.basename(file, path.extname(file)),
        filename: file,
        url: `/my-games/${file}`
      }));
    
    res.json({ games });
  } catch (error) {
    console.error('Error reading my-games directory:', error);
    res.status(500).json({ error: 'Failed to read games directory' });
  }
});

app.get('/api/status-overrides', (req, res) => {
  db.all('SELECT name, color FROM service_status', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to load status overrides' });
    }
    res.json({ overrides: rows || [] });
  });
});

app.post('/api/admin/status', authenticateToken, requireAdmin, (req, res) => {
  const { name, color } = req.body || {};
  const cleanName = String(name || '').trim().slice(0, 60);
  const cleanColor = String(color || '').trim().toLowerCase();

  if (!cleanName) {
    return res.status(400).json({ error: 'Service name is required' });
  }
  if (!['green', 'purple', 'red', 'auto'].includes(cleanColor)) {
    return res.status(400).json({ error: 'Color must be green, purple, red or auto' });
  }

  if (cleanColor === 'auto') {
    db.run('DELETE FROM service_status WHERE name = ?', [cleanName], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to reset status' });
      }
      res.json({ success: true, name: cleanName, color: 'auto' });
    });
    return;
  }

  db.run(
    `INSERT INTO service_status (name, color) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET color = excluded.color, updated_at = CURRENT_TIMESTAMP`,
    [cleanName, cleanColor],
    function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save status' });
      }
      res.json({ success: true, name: cleanName, color: cleanColor });
    }
  );
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const SITE_NAME_RE = /^[a-zA-Z0-9._-]{1,40}$/;

app.get('/api/sites', (req, res) => {
  db.all('SELECT name, owner, created_at, updated_at FROM custom_sites ORDER BY updated_at DESC', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to list sites' });
    }
    res.json({ sites: rows || [] });
  });
});

app.get('/api/sites/:name', (req, res) => {
  const name = String(req.params.name || '');
  if (!SITE_NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Invalid site name' });
  }
  db.get('SELECT name, owner, html, updated_at FROM custom_sites WHERE name = ?', [name], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to load site' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json({ site: row });
  });
});

app.post('/api/sites', (req, res) => {
  const { name, html, owner } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanHtml = String(html || '');
  const cleanOwner = String(owner || 'anonymous').slice(0, 40);

  if (!SITE_NAME_RE.test(cleanName)) {
    return res.status(400).json({ error: 'Site name must be 1-40 characters (letters, numbers, . _ - only)' });
  }
  if (!cleanHtml.trim()) {
    return res.status(400).json({ error: 'HTML content is required' });
  }
  if (cleanHtml.length > 200000) {
    return res.status(400).json({ error: 'HTML too large (max 200KB)' });
  }

  db.run(
    `INSERT INTO custom_sites (name, owner, html) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET html = excluded.html, updated_at = CURRENT_TIMESTAMP`,
    [cleanName, cleanOwner, cleanHtml],
    function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save site' });
      }
      res.json({ success: true, name: cleanName });
    }
  );
});

app.delete('/api/sites/:name', (req, res) => {
  const name = String(req.params.name || '');
  if (!SITE_NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Invalid site name' });
  }
  db.run('DELETE FROM custom_sites WHERE name = ?', [name], function (err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to delete site' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json({ success: true });
  });
});

app.get('/site/:name', (req, res) => {
  const name = String(req.params.name || '');
  if (!SITE_NAME_RE.test(name)) {
    return res.status(400).send('Invalid site name');
  }
  db.get('SELECT html FROM custom_sites WHERE name = ?', [name], (err, row) => {
    if (err || !row) {
      return res.status(404).send('Site not found');
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-store');
    res.send(row.html);
  });
});

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.headers['x-original-url']) return next();
  const p = req.path;
  if (p === '/api' || p.startsWith('/api/') || p.startsWith('/proxy') || p.startsWith('/uv') || p.startsWith('/epoxy') || p.startsWith('/baremux') || p.startsWith('/wisp') || p.startsWith('/site') || p === '/health' || p === '/sw.js' || p === '/uv-sw.js' || p === '/lumin.js' || p === '/lumin.worker.js' || p.startsWith('/my-games') || p.startsWith('/cdn-cgi')) {
    return next();
  }
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const routeWisp = wisp.routeRequest || (wisp.default && wisp.default.routeRequest);

const server = http.createServer();
server.on('request', (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  app(req, res);
});
server.on('upgrade', (req, socket, head) => {
  if (req.url && (req.url.startsWith('/wisp/') || req.url === '/wisp' || req.url.endsWith('/wisp/'))) {
    routeWisp(req, socket, head);
    return;
  }
  socket.end();
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Another BatProx server is likely still running.`);
    console.error(`Fix: close the other instance, or run:  npx kill-port ${PORT}`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/proxy?url=<target_url>`);
});
