// DEV-BUILD-ONLY admin backend. Bundled solely by the dev build
// (electron-builder.dev.js); the public build excludes src/admin/** entirely, so
// none of this ships to users.
//
// Publishes the developer-curated global dictionary to Supabase: the admin signs
// in (Supabase Auth, email/password), then writes dictionary_entries and bumps
// dictionary_meta.version via PostgREST. RLS lets only the is_admin user through.
// All over plain https — no supabase-js bundled. See SUPABASE_INTEGRATION.md.

const https = require('https');
const { URL } = require('url');
const cfg = require('../supabaseConfig');

// In-memory access token (short-lived). The refresh token is persisted securely
// so the developer doesn't have to sign in every launch.
let accessToken = null;

function httpsRequest(method, urlStr, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = bodyObj !== undefined ? JSON.stringify(bodyObj) : null;
    const req = https.request({
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: Object.assign({}, headers,
        payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch (_) { parsed = body; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const errMsg = (r) => (r && r.body && (r.body.message || r.body.error_description || r.body.msg || r.body.error || r.body.hint)) || '';

function register({ ipcMain, shell, store, saveSecureToken, getSecureToken, globalDict, app, dialog, BrowserWindow }) {

  // Dev-only dataset studio backend (local Whisper fine-tuning data prep).
  require('./datasetStudio').register({ ipcMain, app, dialog, shell, BrowserWindow });
  // Dev-only training backend (runs local scripts + safe app-model file ops).
  require('./training').register({ ipcMain, app, dialog, shell, BrowserWindow });

  async function refreshAccess() {
    const rt = getSecureToken('adminSbRefresh');
    if (!rt) return null;
    const res = await httpsRequest('POST', `${cfg.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      { apikey: cfg.SUPABASE_PUBLISHABLE_KEY }, { refresh_token: rt });
    if (res.status === 200 && res.body && res.body.access_token) {
      accessToken = res.body.access_token;
      saveSecureToken('adminSbRefresh', res.body.refresh_token);
      return accessToken;
    }
    return null;
  }

  async function ensureToken() {
    if (accessToken) return accessToken;
    return refreshAccess();
  }

  const restHeaders = () => ({ apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, Prefer: 'return=minimal' });

  // ─── Dictionary editing (local) ───────────────────────────────────────────
  ipcMain.handle('admin-get-global-dict', () => globalDict.getGlobalDictionary());
  ipcMain.handle('admin-save-global-dict', (_e, data) => globalDict.saveGlobalDictionary(data));

  // ─── Supabase Auth ────────────────────────────────────────────────────────
  ipcMain.handle('admin-sign-in', async (_e, { email, password }) => {
    try {
      const res = await httpsRequest('POST', `${cfg.SUPABASE_URL}/auth/v1/token?grant_type=password`,
        { apikey: cfg.SUPABASE_PUBLISHABLE_KEY }, { email, password });
      if (res.status === 200 && res.body && res.body.access_token) {
        accessToken = res.body.access_token;
        saveSecureToken('adminSbRefresh', res.body.refresh_token);
        const em = (res.body.user && res.body.user.email) || email;
        store.set('adminSbEmail', em);
        return { ok: true, email: em };
      }
      return { ok: false, error: errMsg(res) || `Sign-in failed (${res.status})` };
    } catch (e) { return { ok: false, error: e.message || String(e) }; }
  });

  ipcMain.handle('admin-sign-out', () => {
    accessToken = null;
    saveSecureToken('adminSbRefresh', null);
    store.delete('adminSbEmail');
    return { ok: true };
  });

  ipcMain.handle('admin-auth-status', () => ({
    signedIn: !!(accessToken || getSecureToken('adminSbRefresh')),
    email: store.get('adminSbEmail') || ''
  }));

  // ─── Publish to Supabase ──────────────────────────────────────────────────
  // Replaces dictionary_entries with the admin's current list and bumps the
  // version. Also writes the local cache so the dev app uses it immediately.
  ipcMain.handle('admin-publish-supabase', async (_e, data) => {
    let token = await ensureToken();
    if (!token) return { ok: false, error: 'Not signed in — sign in with your admin email first.' };

    const base = `${cfg.SUPABASE_URL}/rest/v1`;
    const allRows = `${base}/dictionary_entries?from_text=not.is.null`; // filter matches every row
    const rows = (data.entries || []).map((e) => ({
      from_text: e.from, to_text: e.to, phrase: !!e.phrase, manglish: !!e.manglish, stage: e.stage || 'post', enabled: true
    }));
    const version = Number(data.version) || 1;

    try {
      // Clear existing entries (retry once after a token refresh on 401).
      let del = await httpsRequest('DELETE', allRows, restHeaders());
      if (del.status === 401) {
        token = await refreshAccess();
        if (!token) return { ok: false, error: 'Session expired — please sign in again.' };
        del = await httpsRequest('DELETE', allRows, restHeaders());
      }
      if (del.status >= 300) return { ok: false, error: `Delete failed (${del.status}): ${errMsg(del)}` };

      // Insert the current set.
      if (rows.length) {
        const ins = await httpsRequest('POST', `${base}/dictionary_entries`, restHeaders(), rows);
        if (ins.status >= 300) return { ok: false, error: `Insert failed (${ins.status}): ${errMsg(ins)}` };
      }

      // Bump the published version so every app picks it up on next launch.
      const pat = await httpsRequest('PATCH', `${base}/dictionary_meta?id=eq.1`, restHeaders(),
        { version, updated_at: new Date().toISOString() });
      if (pat.status >= 300) return { ok: false, error: `Version bump failed (${pat.status}): ${errMsg(pat)}` };

      globalDict.saveGlobalDictionary({ version, entries: data.entries });
      return { ok: true, version };
    } catch (e) { return { ok: false, error: e.message || String(e) }; }
  });

  // ─── Website quick-open ───────────────────────────────────────────────────
  ipcMain.handle('admin-open-website', (_e, url) => {
    const target = (url || store.get('adminWebsiteUrl') || '').trim();
    if (target) { store.set('adminWebsiteUrl', target); shell.openExternal(target); return { ok: true }; }
    return { ok: false, error: 'No URL provided.' };
  });
  ipcMain.handle('admin-get-website', () => store.get('adminWebsiteUrl') || '');
}

module.exports = { register };
