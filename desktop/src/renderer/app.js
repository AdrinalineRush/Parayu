let state = { history: [], dictionary: [], snippets: [], stats: {}, hotkey: '' };
let currentView = 'home';
const recorder = new Recorder();
let recording = false;
let lastPasteError = null;
let onbStep = 0;
let modelsCache = null; // Brain Switch catalog, fetched lazily from the main process
let previewModelId = null; // which model the Brain Switch detail box is showing
let insightsTab = 'usage'; // 'usage' | 'voice' on the Insights home screen
let micOutsideClick = null; // single outside-click handler for the mic dropdown (re-bound, never stacked)
let liveClockTimer = null;

// ---- Screenwriting (live multi-language transcription + translation) ----
const SCREEN_LANGS = [
  { code: 'en', name: 'English' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'ta', name: 'Tamil' },
  { code: 'kn', name: 'Kannada' },
  { code: 'hi', name: 'Hindi' }
];
let screenwritingTargets = new Set(['en', 'ml', 'ta', 'kn', 'hi']);
let screenwritingLines = []; // [{ source, sourceLang, translations: { en, ml, ta, kn, hi } }]
let screenwritingSetupStatus = null; // null | { state: 'checking'|'missing'|'installing'|'ready'|'error', message }
let screenwritingBusy = false; // true while a segment is being translated
let screenwritingHasToken = null; // null (unknown) | true | false — whether an HF token is saved

let activeProWritingTab = 'screenplay'; // 'screenplay' | 'translation' | 'education' | 'drafts'
let activeBlockIndex = 0;
let screenplayBlocks = [];
try {
  const saved = localStorage.getItem('parayu_screenplay_blocks');
  if (saved) screenplayBlocks = JSON.parse(saved);
} catch (e) {
  console.error('Error loading screenplay blocks:', e);
}
if (!screenplayBlocks || screenplayBlocks.length === 0) {
  screenplayBlocks = [
    { type: 'scene-heading', text: 'INT. STUDY - NIGHT' },
    { type: 'action', text: 'A single desk lamp illuminates a blank computer screen. ARJUN (30s) sits staring at it, tapping his fingers nervously.' },
    { type: 'character', text: 'ARJUN' },
    { type: 'parenthetical', text: '(to himself)' },
    { type: 'dialogue', text: 'Alright. Let\'s write the next great screenplay. One page at a time.' }
  ];
}

function saveScreenplayToStorage() {
  try {
    localStorage.setItem('parayu_screenplay_blocks', JSON.stringify(screenplayBlocks));
  } catch (e) {
    console.error('Error saving screenplay blocks:', e);
  }
}

let currentZoomMode = '100'; // '100' | 'fit-page' | 'fit-width' | '75' | '50'
let activeSidebarTab = 'scenes'; // 'scenes' | 'characters'
let sidebarCollapsed = false;
let editingCharacterName = null;
let characterBios = {};
try {
  const savedBios = localStorage.getItem('parayu_character_bios');
  if (savedBios) characterBios = JSON.parse(savedBios);
} catch (e) {
  console.error('Error loading character bios:', e);
}

function saveCharacterBios() {
  try {
    localStorage.setItem('parayu_character_bios', JSON.stringify(characterBios));
  } catch (e) {
    console.error('Error saving character bios:', e);
  }
}

async function refresh() {
  state = await window.parayu.getState();
  if (!state.onboarded) { renderOnboarding(); return; }
  removeOnboarding();
  render();
  maybeLoadAdmin();
}

// Dev build only: load the admin panel script once. In the public build the file
// is excluded AND flavor !== 'dev', so this never injects anything.
let adminLoaded = false;
function maybeLoadAdmin() {
  if (adminLoaded || !state || state.flavor !== 'dev') return;
  adminLoaded = true;
  const s = document.createElement('script');
  s.src = 'admin/admin.js';
  s.onerror = () => { adminLoaded = false; }; // tolerate a missing file
  document.body.appendChild(s);
}

function removeOnboarding() {
  const el = document.getElementById('onb');
  if (el) el.remove();
}

const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent || '');
const DEV_DEMO_EMAIL = 'demo@parayu.dev';
const DEV_DEMO_PASSWORD = 'ParayuDev!2026';

function subscription() {
  return state.subscription || { plan: 'free', planLabel: 'Free', mode: 'free', allowedFeatures: [], allowedModels: ['tiny', 'base'] };
}

function featureEnabled(feature) {
  const sub = subscription();
  return Array.isArray(sub.allowedFeatures) && sub.allowedFeatures.includes(feature);
}

function canUseModel(modelId) {
  const sub = subscription();
  return Array.isArray(sub.allowedModels) && sub.allowedModels.includes(modelId);
}

function isPaidPlan() {
  const sub = subscription();
  return sub.plan === 'base' || sub.plan === 'pro' || sub.plan === 'enterprise';
}

function proFeatureMessage(label) {
  return `${label} requires an active paid plan. Refresh your subscription in Settings if you are already subscribed.`;
}

async function activateDevDemoAccess() {
  if (state.flavor !== 'dev' || !window.parayu.devDemoLogin) {
    return { ok: false, error: 'Dev demo access is only available in the Dev build.' };
  }
  const result = await window.parayu.devDemoLogin({
    email: DEV_DEMO_EMAIL,
    password: DEV_DEMO_PASSWORD
  });
  if (!result || !result.ok) return result || { ok: false, error: 'Dev demo login failed.' };
  state.userProfile = result.profile;
  state.subscription = result.state;
  await refresh();
  return result;
}

// The "Allow pasting into apps" step covers macOS Accessibility trust, which has
// no equivalent on Windows (SendKeys works without it) — so it's filtered out
// below on non-Mac platforms rather than showing an irrelevant step.
const ONB_STEPS_ALL = [
  {
    welcome: true,
    title: 'Welcome to Parayu',
    body: 'Speak, and Parayu turns it into text — anywhere on your Mac, fully on-device and private. Let’s get you set up in 3 quick steps.',
    cta: 'Get started'
  },
  {
    icon: 'mic',
    title: 'Enable your microphone',
    body: 'Parayu listens only while you hold or toggle your hotkey. Nothing is recorded otherwise, and audio never leaves your Mac.',
    cta: 'Enable microphone',
    action: 'mic'
  },
  {
    icon: 'cursor',
    title: 'Allow pasting into apps',
    body: 'To drop your words into whatever app you’re using, Parayu needs Accessibility access. Enable “Parayu” in the list that opens, then come back.',
    cta: 'Open Accessibility settings',
    action: 'accessibility'
  },
  {
    icon: 'key',
    title: 'Choose your shortcut',
    body: 'Pick how you trigger Parayu. Toggle: tap to start, tap to stop. Push to talk: hold a key while you speak.',
    custom: 'hotkey',
    cta: 'Continue',
    action: 'next'
  },
  {
    icon: 'check',
    title: 'You’re all set',
    body: 'Press your shortcut and start talking. You can change everything in Settings anytime.',
    cta: 'Start using Parayu',
    action: 'finish'
  }
];

const ONB_STEPS = ONB_STEPS_ALL.filter((s) => IS_MAC || s.action !== 'accessibility');

// The "Choose your shortcut" step mirrors the Settings → Dictation mode UI:
// the Toggle / Push to talk switch plus, for push-to-talk, the hold-key picker.
function onbHotkeyControlsHtml() {
  const pt = state.dictationMode === 'pushToTalk';
  return `
    <div class="onb-controls">
      <p class="onb-label">Dictation mode</p>
      <div class="onb-seg">
        <button class="mode-btn ${!pt ? 'mode-active' : ''}" data-mode="toggle">Toggle</button>
        <button class="mode-btn ${pt ? 'mode-active' : ''}" data-mode="pushToTalk">Push to talk</button>
      </div>
      <p class="onb-hint">${pt
        ? 'Hold the key below to record, release to transcribe.'
        : 'Tap your hotkey to start, tap again to stop.'}</p>
      ${pt ? `
        <p class="onb-label" style="margin-top:16px">Hold-to-talk key</p>
        <div class="onb-seg">
          ${['Alt', 'Meta', 'Ctrl'].map((mod) => `
            <button class="mode-btn ${state.hotkey === mod ? 'mode-active' : ''}" data-holdkey="${mod}">${holdKeyLabel(mod)}</button>
          `).join('')}
        </div>
        <p class="onb-hint">A held modifier produces no text — pick one your other apps don't use alone.</p>
      ` : ''}
    </div>
  `;
}

function onbIconSvg(name) {
  const icons = {
    mic: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>',
    cursor: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7 18 2-7 7-2z"/></svg>',
    key: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 19 4l2 2-2 2 1.5 1.5L18 12l-2-2"/></svg>'
  };
  return icons[name] || '';
}

function renderOnboarding() {
  const step = ONB_STEPS[onbStep];
  let host = document.getElementById('onb');
  if (!host) {
    host = document.createElement('div');
    host.id = 'onb';
    host.className = 'onb';
    document.body.appendChild(host);
  }
  const dots = ONB_STEPS.map((_, i) => `<span class="${i === onbStep ? 'on' : ''}"></span>`).join('');
  host.innerHTML = `
    <div class="onb-card">
      ${step.welcome ? `<img class="onb-logo" src="logo.png" alt="Parayu" />` : `<div class="onb-icon">${onbIconSvg(step.icon)}</div>`}
      <h2>${step.title}</h2>
      <p>${step.body}</p>
      ${step.custom === 'hotkey' ? onbHotkeyControlsHtml() : ''}
      <button class="onb-btn" id="onb-cta">${step.cta}</button>
      <div class="onb-ok" id="onb-ok"></div>
      ${onbStep > 0 && onbStep < ONB_STEPS.length - 1 ? `<button class="onb-skip" id="onb-skip">Skip for now</button>` : ''}
      <div class="onb-dots">${dots}</div>
    </div>
  `;

  const ok = host.querySelector('#onb-ok');
  host.querySelector('#onb-cta').onclick = async () => {
    if (step.action === 'mic') {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        ok.textContent = '✓ Microphone enabled';
        setTimeout(onbNext, 600);
      } catch (_e) {
        ok.style.color = '#ff8a8a';
        ok.textContent = 'Microphone was blocked. Enable it in System Settings → Privacy → Microphone.';
      }
    } else if (step.action === 'accessibility') {
      await window.parayu.checkAccessibility(true);
      await window.parayu.openAccessibilitySettings();
      ok.textContent = 'After enabling Parayu in the list, click Continue.';
      const btn = host.querySelector('#onb-cta');
      btn.textContent = 'Continue';
      btn.onclick = onbNext;
    } else if (step.action === 'finish') {
      await window.parayu.completeOnboarding();
      await refresh();
    } else {
      onbNext();
    }
  };
  const skip = host.querySelector('#onb-skip');
  if (skip) skip.onclick = onbNext;

  host.querySelectorAll('.mode-btn[data-mode]').forEach((btn) => {
    btn.onclick = async () => {
      const mode = await window.parayu.setDictationMode(btn.dataset.mode);
      // Push-to-talk needs a bare modifier; if the saved hotkey is still a combo,
      // default to Option so the picker has a selection and the key actually works.
      if (mode === 'pushToTalk' && state.hotkey.includes('+')) {
        const result = await window.parayu.setHotkey('Alt');
        state.hotkey = result.hotkey;
      }
      await refresh();
    };
  });

  host.querySelectorAll('[data-holdkey]').forEach((btn) => {
    btn.onclick = async () => {
      const result = await window.parayu.setHotkey(btn.dataset.holdkey);
      state.hotkey = result.hotkey;
      await refresh();
    };
  });
}

function onbNext() {
  if (onbStep < ONB_STEPS.length - 1) { onbStep++; renderOnboarding(); }
}

let micTest = null;

async function toggleMicTest(btn) {
  const meter = document.getElementById('mic-meter');
  const status = document.getElementById('mic-status');
  if (micTest) { stopMicTest(btn); return; }
  try {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: state.noiseSuppression !== false,
        autoGainControl: state.boostQuietVoices !== false,
        ...(state.micDeviceId ? { deviceId: { exact: state.micDeviceId } } : {})
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const bars = Array.from(meter.querySelectorAll('span'));
    let raf;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
      const level = Math.min(1, Math.sqrt(sum / data.length) * 6);
      const lit = Math.round(level * bars.length);
      bars.forEach((b, i) => b.classList.toggle('on', i < lit));
      raf = requestAnimationFrame(tick);
    };
    tick();
    micTest = { stream, ctx, raf: () => raf, bars };
    micTest.stopRaf = () => cancelAnimationFrame(raf);
    btn.classList.add('testing');
    btn.innerHTML = `${micIconSvg()} Stop test`;
    if (status) status.innerHTML = `${setIcon('info')}<span>Listening — speak to see your level.</span>`;
  } catch (_e) {
    if (status) status.innerHTML = `${setIcon('info')}<span>Couldn't access the microphone. Check Privacy &amp; Security → Microphone.</span>`;
  }
}

function stopMicTest(btn) {
  if (!micTest) return;
  micTest.stopRaf();
  micTest.stream.getTracks().forEach((t) => t.stop());
  micTest.ctx.close();
  micTest.bars.forEach((b) => b.classList.remove('on'));
  micTest = null;
  if (btn) { btn.classList.remove('testing'); btn.innerHTML = `${micIconSvg()} Test microphone`; }
}

function setView(view) {
  if (micTest) stopMicTest(document.getElementById('mic-test-btn'));
  // Tear down an in-progress hotkey capture so its keydown listener/timeout
  // don't leak when the user leaves Settings mid-recording.
  if (hotkeyCaptureCleanup) hotkeyCaptureCleanup();
  currentView = view;
  document.querySelectorAll('nav .item').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  render();
  updateTrainerCaptureMode();
}

// Dev-only: tell main whether the Dataset Studio (admin) page is the focused
// view, so push-to-talk drives its clip recorder instead of dictation. No-op in
// the public build (no admin view, and the bridge method is harmless).
function updateTrainerCaptureMode() {
  if (window.parayu && window.parayu.setTrainerCaptureMode) {
    window.parayu.setTrainerCaptureMode(currentView === 'admin');
  }
}
window.addEventListener('focus', updateTrainerCaptureMode);
window.addEventListener('blur', updateTrainerCaptureMode);

function renderLimitBanner() {
  if (subscription().plan !== 'free') return '';
  
  const stats = state.stats || {};
  const total = stats.totalWords || 0;
  const limit = 1000;
  
  if (total >= limit) {
    return `
      <div class="limit-banner error" style="background: rgba(224, 68, 68, 0.08); border: 1.5px solid rgba(224, 68, 68, 0.2); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; animation: fadeIn 0.3s ease-out; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: rgba(224, 68, 68, 0.1); color: #e04444; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 18px; height: 18px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <div style="font-size: 13.5px; font-weight: 700; color: #1a202c; margin-bottom: 2px;">Word limit reached (1,000 words)</div>
            <div style="font-size: 12px; color: #718096; line-height: 1.4;">You have dictated ${total.toLocaleString()} words this month. Upgrade to Pro for unlimited transcription.</div>
          </div>
        </div>
        <button class="limit-btn" id="limit-upgrade-btn" style="background: var(--accent); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap;">Upgrade Plan</button>
      </div>
    `;
  }
  
  if (total >= 800) {
    const remaining = limit - total;
    return `
      <div class="limit-banner warning" style="background: rgba(224, 138, 61, 0.08); border: 1.5px solid rgba(224, 138, 61, 0.2); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; animation: fadeIn 0.3s ease-out; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: rgba(224, 138, 61, 0.1); color: #e08a3d; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 18px; height: 18px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <div style="font-size: 13.5px; font-weight: 700; color: #1a202c; margin-bottom: 2px;">Approaching monthly word limit</div>
            <div style="font-size: 12px; color: #718096; line-height: 1.4;">You have used ${total.toLocaleString()} of your ${limit.toLocaleString()} monthly words. ${remaining} words remaining.</div>
          </div>
        </div>
        <button class="limit-btn" id="limit-upgrade-btn" style="background: var(--accent); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap;">Upgrade Plan</button>
      </div>
    `;
  }
  
  return '';
}

function render() {
  const main = document.getElementById('main');
  let viewContent = '';
  if (currentView === 'home') {
    viewContent = `<div class="insights">${renderInsights()}</div>`;
  } else if (currentView === 'history') {
    viewContent = renderHistory();
  } else if (currentView === 'dictionary') {
    viewContent = `<div class="scroll-area">${renderDictionary()}</div>`;
  } else if (currentView === 'snippets') {
    viewContent = `<div class="scroll-area">${renderSnippets()}</div>`;
  } else if (currentView === 'screenwriting') {
    viewContent = renderScreenwriting();
  } else if (window.__parayuViews && window.__parayuViews[currentView]) {
    // Pluggable views (e.g. the dev-only Admin panel) register a renderer here.
    viewContent = `<div class="scroll-area">${window.__parayuViews[currentView].render()}</div>`;
  } else {
    viewContent = `<div class="settings-page">${renderSettings()}</div>`;
  }
  
  const limitBanner = (currentView === 'home' || currentView === 'history') ? renderLimitBanner() : '';
  main.classList.toggle('home-main', currentView === 'home');
  main.innerHTML = `<div class="view-container ${currentView === 'home' ? 'home-view-container' : ''}">${limitBanner}${viewContent}</div>`;
  
  const limitUpgradeBtn = document.getElementById('limit-upgrade-btn');
  if (limitUpgradeBtn) {
    limitUpgradeBtn.onclick = () => openProfileModal();
  }
  
  // Synchronize sidebar profile details
  const profile = state.userProfile || { registered: false, name: '', email: '', plan: 'Base Plan' };
  const avatarEl = document.querySelector('.user-avatar');
  const nameEl = document.querySelector('.user-name');
  const planEl = document.querySelector('.user-plan');
  
  if (profile.registered) {
    if (avatarEl) {
      avatarEl.style.background = 'linear-gradient(135deg, var(--accent), #ff9b3d)';
      avatarEl.style.color = '#ffffff';
      if (profile.name) {
        const parts = profile.name.trim().split(/\s+/);
        avatarEl.textContent = parts.length >= 2 
          ? (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase() 
          : profile.name.charAt(0).toUpperCase();
      } else {
        avatarEl.textContent = 'U';
      }
    }
    if (nameEl) nameEl.textContent = profile.name || 'User';
    if (planEl) planEl.textContent = subscription().planLabel || 'Free';
  } else {
    if (avatarEl) {
      avatarEl.style.background = '#e1e5ea';
      avatarEl.style.color = '#718096';
      avatarEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; display: block;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
    if (nameEl) nameEl.textContent = 'Guest User';
    if (planEl) planEl.textContent = subscription().planLabel || 'Free';
  }

  // Synchronize pro/upsell card
  const proCard = document.querySelector('.pro-card');
  if (proCard) {
    if (subscription().plan === 'pro') {
      proCard.innerHTML = `
        <div class="pro-icon-wrap" style="background: rgba(31, 111, 99, 0.08); color: var(--success);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="pro-title">Pro Plan Active</div>
        <div class="pro-desc">Enjoy Malayalam translation & premium AI cleanup features.</div>
        <button class="pro-btn" id="pro-manage-btn">Manage License</button>
      `;
    } else if (subscription().plan === 'enterprise') {
      proCard.innerHTML = `
        <div class="pro-icon-wrap" style="background: rgba(160, 43, 176, 0.08); color: var(--purple);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div class="pro-title">Enterprise Plan</div>
        <div class="pro-desc">Team-wide volumes active. Contact your IT administrator.</div>
        <button class="pro-btn" id="pro-manage-btn">License details</button>
      `;
    } else {
      proCard.innerHTML = `
        <div class="pro-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9Z" fill="currentColor"/></svg>
        </div>
        <div class="pro-title">Unlock Pro Features</div>
        <div class="pro-desc">Remove limits, sync across devices and more.</div>
        <button class="pro-btn" id="pro-manage-btn">Upgrade Now <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;display:inline;"><polyline points="9 18 15 12 9 6"/></svg></button>
        ${state.flavor === 'dev' ? '<button class="pro-btn dev-demo-card-btn" id="dev-demo-card-btn" type="button">Use Dev Demo</button>' : ''}
      `;
    }
    const manageBtn = document.getElementById('pro-manage-btn');
    if (manageBtn) manageBtn.onclick = () => openProfileModal();
    const devDemoCardBtn = document.getElementById('dev-demo-card-btn');
    if (devDemoCardBtn) {
      devDemoCardBtn.onclick = async () => {
        devDemoCardBtn.disabled = true;
        devDemoCardBtn.textContent = 'Unlocking...';
        const result = await activateDevDemoAccess();
        if (!result || !result.ok) {
          alert((result && result.error) || 'Dev demo login failed.');
          devDemoCardBtn.disabled = false;
          devDemoCardBtn.textContent = 'Use Dev Demo';
          return;
        }
        openProfileModal();
      };
    }
  }

  // The History view shows its own paste/error warning inline; on every other
  // view, surface errors as a dismissible banner so failures are never silent.
  if (lastPasteError && currentView !== 'history') {
    const notice = document.createElement('div');
    notice.className = 'global-notice';
    notice.innerHTML = `<span>${escapeHtml(lastPasteError)}</span><button class="notice-close" aria-label="Dismiss">×</button>`;
    notice.querySelector('.notice-close').onclick = () => { lastPasteError = null; notice.remove(); };
    main.insertBefore(notice, main.firstChild);
  }
  wireView();
  wireLanguageSelector();
  if (currentView === 'screenwriting' && activeProWritingTab === 'screenplay') {
    updateScreenplayZoom();
  }
  // Let a pluggable view (e.g. the dev-only Admin panel) bind its own events.
  const ext = window.__parayuViews && window.__parayuViews[currentView];
  if (ext && ext.wire) ext.wire();
}

// Parayu History — the dictation log that used to be the home screen.
function renderHistory() {
  const items = state.history.map((h) => `
    <div class="card history-card" data-copy="${escapeHtml(h.text)}" title="Double-click to copy">
      <div class="row"><span class="time">${formatTime(h.timestamp)}</span><span class="copied-badge">Copied</span></div>
      <div>${escapeHtml(h.text)}</div>
    </div>
  `).join('') || '<p style="color:var(--muted)">No transcriptions yet. Press your hotkey and start talking.</p>';

  const pasteWarning = lastPasteError ? `
    <div class="card" style="border-color:#e08a3d;background:#fff6ec;">
      <strong>Couldn't auto-paste:</strong> ${escapeHtml(lastPasteError)}
    </div>
  ` : '';

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div class="status"><span class="dot ${recording ? 'recording' : ''}"></span>
        ${recording ? 'Listening… press hotkey again to stop' : `<span>Press</span> ${hotkeyChipsHtml(state.hotkey)} <span>to start dictating</span>`}</div>
      ${renderLanguageSelector()}
    </div>
    ${pasteWarning}
    <div class="scroll-area">${items}</div>
  `;
}

// ---- Language selector (Home + History) ----

function languageName(code) {
  const l = (window.PARAYU_LANGUAGES || []).find((x) => x.code === code);
  return l ? l.name : 'English';
}

// Prominent language picker. Reuses the existing inputLanguage setting (so the
// Settings control stays in sync). Only English + Malayalam are supported;
// picking any other shows a "coming soon" popup and does NOT switch.
function renderLanguageSelector() {
  const code = state.inputLanguage || 'en';
  const supported = window.PARAYU_SUPPORTED_LANGS || new Set(['en', 'ml']);
  const items = (window.PARAYU_LANGUAGES || []).map((l) => `
    <div class="lang-item ${l.code === code ? 'is-active' : ''}" data-lang-code="${l.code}" data-supported="${supported.has(l.code) ? '1' : '0'}">
      <span>${escapeHtml(l.name)}</span>
      ${supported.has(l.code) ? '' : '<span class="lang-beta">beta</span>'}
    </div>`).join('');
  return `
    <div class="lang-select">
      <button class="lang-pill" id="lang-pill" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>${escapeHtml(languageName(code))}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="lang-dropdown" id="lang-dropdown">
        <input class="lang-search" id="lang-search" placeholder="Search language…" />
        <div class="lang-list" id="lang-list">${items}</div>
      </div>
    </div>`;
}

function filterLanguageList(q) {
  const term = (q || '').trim().toLowerCase();
  document.querySelectorAll('#lang-list .lang-item').forEach((it) => {
    it.style.display = (it.textContent || '').toLowerCase().includes(term) ? '' : 'none';
  });
}

function showBetaLangPopup(name) {
  const old = document.getElementById('beta-lang-modal');
  if (old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'beta-lang-modal';
  ov.className = 'beta-modal-overlay';
  ov.innerHTML = `
    <div class="beta-modal">
      <div class="beta-emoji">🚧</div>
      <h3>${escapeHtml(name)} is coming soon</h3>
      <p>This language is in beta — we're still polishing it. Right now Parayu fully supports <strong>English</strong> and <strong>Malayalam</strong>.</p>
      <button class="beta-ok" type="button">Got it</button>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('.beta-ok').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

async function selectLanguage(code, isSupported) {
  const dd = document.getElementById('lang-dropdown');
  if (dd) dd.classList.remove('open');
  if (!isSupported) { showBetaLangPopup(languageName(code)); return; }
  if (code === 'ml') {
    if (!featureEnabled('malayalam_to_english_premium')) {
      lastPasteError = proFeatureMessage('Malayalam dictation and translation');
      render();
      openProfileModal();
      return;
    }
  }
  state.inputLanguage = await window.parayu.setInputLanguage(code);
  await refresh();
}

function wireLanguageSelector() {
  const pill = document.getElementById('lang-pill');
  const dd = document.getElementById('lang-dropdown');
  if (!pill || !dd) return;
  pill.onclick = (e) => {
    e.stopPropagation();
    const opening = !dd.classList.contains('open');
    dd.classList.toggle('open');
    if (opening) {
      const s = document.getElementById('lang-search');
      if (s) { s.value = ''; filterLanguageList(''); setTimeout(() => s.focus(), 0); }
    }
  };
  const search = document.getElementById('lang-search');
  if (search) {
    search.oninput = () => filterLanguageList(search.value);
    search.onclick = (e) => e.stopPropagation();
  }
  document.querySelectorAll('#lang-list .lang-item').forEach((it) => {
    it.onclick = (e) => { e.stopPropagation(); selectLanguage(it.dataset.langCode, it.dataset.supported === '1'); };
  });
}

// ---- Insights dashboard ----

function userLocaleInfo() {
  const opts = Intl.DateTimeFormat().resolvedOptions();
  const locale = opts.locale || navigator.language || 'en-US';
  const timeZone = opts.timeZone || '';
  const region = (locale.match(/-([A-Z]{2})\b/i) || [])[1]
    || (timeZone.includes('/') ? timeZone.split('/')[0] : '')
    || 'Local';
  return { locale, timeZone, region };
}

function formatLiveDateTime() {
  const now = new Date();
  const { locale, timeZone, region } = userLocaleInfo();
  const date = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(now);
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timeZone || undefined
  }).format(now);
  const zone = timeZone ? timeZone.replace(/_/g, ' ') : region;
  return { date, time, zone, region };
}

function liveDateSelectorHtml() {
  const live = formatLiveDateTime();
  return `
    <div class="date-selector" title="${escapeHtml(`${live.date}, ${live.time} · ${live.zone}`)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <span id="live-date-time">${escapeHtml(`${live.date} · ${live.time}`)}</span>
      <span style="font-size:12px;color:var(--muted);font-weight:700;">${escapeHtml(live.zone)}</span>
    </div>
  `;
}

function updateLiveDateTime() {
  const el = document.getElementById('live-date-time');
  if (!el) return;
  const live = formatLiveDateTime();
  el.textContent = `${live.date} · ${live.time}`;
  const parent = el.closest('.date-selector');
  if (parent) parent.title = `${live.date}, ${live.time} · ${live.zone}`;
}

function ensureLiveClock() {
  if (liveClockTimer) return;
  liveClockTimer = setInterval(updateLiveDateTime, 60000);
}

function renderInsights() {
  ensureLiveClock();
  const stats = state.stats || {};
  const total = stats.totalWords || 0;
  const wpm = avgWpm(state.history, stats);
  const fixes = (stats.wordsCorrected || 0) + (stats.dictionaryFixes || 0);
  const tabs = `
    <div class="ins-tabs">
      <button class="ins-tab ${insightsTab === 'usage' ? 'on' : ''}" data-ins-tab="usage">Your Usage</button>
      <button class="ins-tab ${insightsTab === 'voice' ? 'on' : ''}" data-ins-tab="voice">Your Voice</button>
    </div>`;
  return `
    <div class="insights-header-row">
      <div class="ins-hero-copy">
        <div class="ins-eyebrow">Local analytics</div>
        <div class="ins-title">
          Insights
          <span class="ins-title-mark">${insIcon('spark')}</span>
        </div>
        <div class="ins-subtitle">A live view of dictation speed, editing impact, desktop usage, and consistency.</div>
        <div class="ins-summary-strip">
          <span><strong>${total.toLocaleString()}</strong> words</span>
          <span><strong>${wpm}</strong> wpm</span>
          <span><strong>${fixes}</strong> fixes</span>
          <span class="${state.modelReady ? 'ok' : 'warn'}">${state.modelReady ? 'Model ready' : 'Setup needed'}</span>
        </div>
      </div>
      <div class="ins-toolbar">
        <div class="ins-toolbar-controls">
          ${renderLanguageSelector()}
          ${liveDateSelectorHtml()}
        </div>
        ${tabs}
      </div>
    </div>
    ${insightsTab === 'voice' ? renderVoiceTab() : renderUsageTab()}
  `;
}

function renderUsageTab() {
  const stats = state.stats || {};
  const wpm = avgWpm(state.history, stats);
  const corrected = stats.wordsCorrected || 0;
  const dictFixes = stats.dictionaryFixes || 0;
  const totalFixes = corrected + dictFixes;
  const total = stats.totalWords || 0;

  return `
    <div class="ins-grid">
      <div class="ins-card metric-card speed-card">
        <div class="ins-card-header">
          <span class="ins-card-title">Typing Speed</span>
          <span class="ins-card-icon red">${insIcon('speed')}</span>
        </div>
        <div class="gauge-wrap">
          ${gaugeSvg(wpm)}
          <div class="gauge-trend">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            <span>+18% vs last week</span>
          </div>
        </div>
        <div class="metric-foot">
          <span>Target 120 wpm</span>
          <strong>${Math.max(0, 120 - wpm)} to goal</strong>
        </div>
      </div>

      <div class="ins-card metric-card">
        <div class="ins-card-header">
          <span class="ins-card-title">Smart Editing</span>
          <span class="ins-card-icon purple">${insIcon('wand')}</span>
        </div>
        <div class="ins-big">${totalFixes}</div>
        <div class="ins-cap">Fixes made by Parayu</div>
        <div class="metric-mini-note">Cleanup, dictionary corrections, and snippet expansions tracked locally.</div>
        <div class="ins-stat-row">
          <div class="ins-stat-pill" onclick="setView('history')">
            <div class="ins-pill-icon green">${insIcon('check-circle')}</div>
            <div class="ins-pill-details">
              <div class="ins-pill-num-wrap">
                <span class="ins-pill-num">${corrected}</span>
                <span class="ins-pill-label">corrections</span>
              </div>
              <span class="ins-pill-chevron">${setIcon('chevron')}</span>
            </div>
          </div>
          <div class="ins-stat-pill" onclick="setView('dictionary')">
            <div class="ins-pill-icon purple">${insIcon('book-open')}</div>
            <div class="ins-pill-details">
              <div class="ins-pill-num-wrap">
                <span class="ins-pill-num">${dictFixes}</span>
                <span class="ins-pill-label">dictionary</span>
              </div>
              <span class="ins-pill-chevron">${setIcon('chevron')}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="ins-card metric-card">
        <div class="ins-card-header">
          <span class="ins-card-title">Dictation Volume</span>
          <span class="ins-card-icon green">${insIcon('keyboard-mic')}</span>
        </div>
        <div class="ins-big">${total.toLocaleString()}</div>
        <div class="ins-cap">Total words dictated</div>
        <div class="metric-mini-note">Words pasted through Parayu across desktop apps.</div>
        <div class="ins-stat-row">
          <div class="ins-stat-pill" onclick="setView('history')">
            <div class="ins-pill-icon green">${insIcon('desktop')}</div>
            <div class="ins-pill-details">
              <div class="ins-pill-num-wrap">
                <span class="ins-pill-num">${total}</span>
                <span class="ins-pill-label">words pasted</span>
              </div>
              <span class="ins-pill-chevron">${setIcon('chevron')}</span>
            </div>
          </div>
          <div class="ins-stat-pill" onclick="setView('settings')">
            <div class="ins-pill-icon green" style="background:${state.modelReady ? 'rgba(46, 200, 102, 0.08)' : 'rgba(201, 162, 39, 0.08)'}; color:${state.modelReady ? '#2ec866' : '#c9a227'};">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:currentColor; box-shadow:0 0 8px currentColor; ${state.modelReady ? 'animation:pulse 1.5s infinite;' : ''}"></span>
            </div>
            <div class="ins-pill-details">
              <div class="ins-pill-num-wrap" style="flex-direction:column; align-items:flex-start; gap: 2px;">
                <span class="ins-pill-num" style="font-size:14px; color:${state.modelReady ? '#2ec866' : '#c9a227'}; font-weight:700;">${state.modelReady ? 'Ready' : 'Setup needed'}</span>
                <span class="ins-pill-label" style="font-size:11px; margin-top:0;">${state.modelReady ? 'on-device engine' : 'download a model'}</span>
              </div>
              <span class="ins-pill-chevron">${setIcon('chevron')}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="ins-card span2">${renderDesktopUsage()}</div>
      <div class="ins-card">${renderStreak(stats)}</div>
    </div>
  `;
}

function renderVoiceTab() {
  const stats = state.stats || {};
  const total = stats.totalWords || 0;
  const goal = 1000;
  const pct = Math.min(100, Math.round((total / goal) * 100));
  const remaining = Math.max(0, goal - total);
  return `
    <div class="ins-grid voice-grid">
      <div class="ins-card">
        <div class="ins-card-header">
          <span class="ins-card-title">Voice Metrics</span>
          <span class="ins-card-icon red">${insIcon('keyboard-mic')}</span>
        </div>
        <div class="voice-stats-list">
          <div class="voice-stat-item">
            <span class="voice-stat-num">${total}</span>
            <span class="voice-stat-label">Total words</span>
          </div>
          <div class="voice-stat-item">
            <span class="voice-stat-num">${avgWpm(state.history, stats)}</span>
            <span class="voice-stat-label">Words per minute</span>
          </div>
          <div class="voice-stat-item">
            <span class="voice-stat-num">${stats.streak || 0}</span>
            <span class="voice-stat-label">Day streak</span>
          </div>
        </div>
      </div>
      <div class="ins-card span2">
        <div class="ins-voice-lock">
          <div class="lock-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div class="lock-content">
            <h3>Your Voice Profile</h3>
            <p>Unlock customized speech patterns, vocabulary analysis, and pitch insights as you dictate.</p>
            <div class="lock-progress-container">
              <div class="lock-track"><div class="lock-fill" style="width:${pct}%"></div></div>
              <div class="lock-cap">${remaining > 0 ? `Unlocks in <strong>${remaining.toLocaleString()}</strong> words` : 'Unlocked & ready!'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Average words per minute from history items, filtering out silence and short taps.
// Falls back to stats if history is empty.
function avgWpm(history, stats) {
  let totalWords = 0;
  let totalSecs = 0;
  for (const h of history || []) {
    const duration = h.durationSec !== undefined ? h.durationSec : (h.words / (140 / 60));
    // Filter out short taps and noise/silence hallucinations
    if (h.words <= 2 || duration < 1.2) continue;
    totalWords += h.words;
    totalSecs += duration;
  }
  if (totalSecs < 3) {
    const secs = (stats && stats.speakingSeconds) || 0;
    if (secs < 3) return 0;
    return Math.round(((stats && stats.totalWords) || 0) / (secs / 60));
  }
  return Math.round(totalWords / (totalSecs / 60));
}

// Semicircular WPM gauge, filled proportionally up to a 160 wpm ceiling.
function gaugeSvg(wpm) {
  const max = 160;
  const frac = Math.max(0, Math.min(1, wpm / max));
  const r = 70, cx = 85, cy = 85;
  const a = Math.PI * (1 - frac); // sweep from left (π) toward right (0)
  const ex = cx + r * Math.cos(a), ey = cy - r * Math.sin(a);
  // Half-circle gauge: the fill sweep is always ≤ 180° (frac maxes at 1), so the
  // SVG large-arc-flag must stay 0. Using 1 here drew the major arc the long way
  // around (through the bottom) whenever frac > 0.5, breaking the gauge.
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fill = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
  return `
    <div class="gauge">
      <svg viewBox="0 0 170 96">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#e81f3a" />
            <stop offset="60%" stop-color="#d81d54" />
            <stop offset="100%" stop-color="#a02bb0" />
          </linearGradient>
          <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#e01e41" flood-opacity="0.45" />
          </filter>
        </defs>
        <path d="${track}" fill="none" stroke="#ebe7df" stroke-width="14" stroke-linecap="round"/>
        <path class="gauge-fill" d="${fill}" fill="none" stroke="url(#gaugeGrad)" stroke-width="14" stroke-linecap="round" filter="url(#gaugeShadow)"/>
      </svg>
      <div class="gauge-center">
        <div class="g-big">${wpm || '0'}</div>
        <div class="g-sub">wpm</div>
      </div>
    </div>`;
}

function renderDesktopUsage() {
  const usage = state.appUsage || {};
  const entries = Object.entries(usage)
    .map(([name, v]) => ({ name, words: (v && v.words) || 0 }))
    .filter((e) => e.words > 0)
    .sort((a, b) => b.words - a.words);
  const head = `
    <div class="usage-head">
      <h2 class="usage-title">Desktop Integration</h2>
      <span class="usage-meta">Apps Integration | ${entries.length}</span>
    </div>`;

  if (!entries.length) {
    return head + '<p class="ins-empty">No app usage yet — dictate into another app and it’ll show up here.</p>';
  }

  const max = entries[0].words;
  const getAppColorGradient = (name) => {
    const lname = name.toLowerCase();
    if (lname.includes('claude')) return 'linear-gradient(135deg, #f3805c 0%, #e65c40 100%)';
    if (lname.includes('antigravity')) return 'linear-gradient(135deg, #e81f3a 0%, #a02bb0 100%)';
    if (lname.includes('parayu')) return 'linear-gradient(135deg, #3aa0ff 0%, #0072ff 100%)';
    if (lname.includes('chrome') || lname.includes('browser')) return 'linear-gradient(135deg, #ffcd38 0%, #f57c00 100%)';
    if (lname.includes('slack')) return 'linear-gradient(135deg, #4a154b 0%, #360f37 100%)';
    if (lname.includes('vscode') || lname.includes('code')) return 'linear-gradient(135deg, #007acc 0%, #005999 100%)';
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const colors = [
      ['#ff5f6d', '#ffc371'],
      ['#11998e', '#38ef7d'],
      ['#c31432', '#240b36'],
      ['#7f00ff', '#e100ff'],
      ['#00c6ff', '#0072ff'],
      ['#fe8c00', '#f83600']
    ];
    const pair = colors[Math.abs(hash) % colors.length];
    return `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`;
  };

  const rows = entries.slice(0, 4).map((e) => {
    const pct = Math.round((e.words / max) * 100);
    const initial = e.name ? e.name.charAt(0).toUpperCase() : '?';
    const bgGradient = getAppColorGradient(e.name);
    return `
      <div class="usage-item">
        <div class="usage-info">
          <div class="usage-app-badge" style="background: ${bgGradient}">${initial}</div>
          <span class="usage-app-name">${escapeHtml(e.name)}</span>
          <span class="usage-app-words">${e.words} words</span>
        </div>
        <div class="usage-track">
          <div class="usage-fill" style="width: ${pct}%"></div>
        </div>
      </div>`;
  }).join('');

  return head + `<div class="usage-list">${rows}</div>`;
}

function renderStreak(stats) {
  const days = dailyWords(state.history); // Map: 'YYYY-M-D' -> words
  const today = new Date();
  const weeks = 18; // ~4 months, fits perfectly without scrolling
  // Build columns of 7 days ending today, aligned so each column is a week.
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  // Align start to a Sunday so weekday rows line up.
  start.setDate(start.getDate() - start.getDay());

  let cells = '';
  const cur = new Date(start);
  const todayKey = dayKey(today);
  while (cur <= today) {
    const w = days.get(dayKey(cur)) || 0;
    const lvl = w === 0 ? 0 : w < 20 ? 1 : w < 60 ? 2 : w < 150 ? 3 : 4;
    const isToday = dayKey(cur) === todayKey ? ' heat-today' : '';
    cells += `<div class="heat-cell heat-${lvl}${isToday}" title="${escapeHtml(cur.toDateString())}: ${w} words"></div>`;
    cur.setDate(cur.getDate() + 1);
  }

  return `
    <div class="streak-head">
      <h2 class="streak-title">
        <span class="streak-glyph">${insIcon('flame')}</span> ${stats.streak || 0} day streak
      </h2>
      <span class="streak-meta">Longest | ${stats.longestStreak || 0} days</span>
    </div>
    <div class="heat-scroll"><div class="heat">${cells}</div></div>
    <div class="heat-legend">
      <span>Less</span>
      <span class="heat-cell heat-0"></span>
      <span class="heat-cell heat-1"></span>
      <span class="heat-cell heat-2"></span>
      <span class="heat-cell heat-3"></span>
      <span class="heat-cell heat-4"></span>
      <span>More</span>
    </div>`;
}

function dayKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function dailyWords(history) {
  const m = new Map();
  for (const h of history || []) {
    const d = new Date(h.timestamp);
    const k = dayKey(d);
    m.set(k, (m.get(k) || 0) + (h.words || 0));
  }
  return m;
}

function insIcon(name) {
  const s = (p, fill) => `<svg viewBox="0 0 24 24" fill="${fill || 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const icons = {
    desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    app: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    spark: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-6.8 0-2.8-1.6-5.1-4.3-7.2.1 2.3-.8 3.8-2.1 4.7.2-3.1-1.3-5.7-4.2-7.7.2 3.3-2.4 5.8-3.2 8.3C4.2 17.6 7.3 22 12 22z"/><path d="M12 22c1.8 0 3.2-1.2 3.2-3 0-1.4-.8-2.5-2.2-3.6-.1 1.3-.7 2.1-1.6 2.6 0-1.7-.8-3-2.2-4.1.1 1.9-1.2 3.1-1.5 4.6C7.2 20.5 9.3 22 12 22z"/>',
    speed: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    wand: '<path d="m19 2 3 3L6 21H3v-3L17.5 3.5zm-5 3.5 2.5 2.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    'keyboard-mic': '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/>'
  };
  return s(icons[name] || '');
}

function renderDictionary() {
  const rows = state.dictionary.map((d, i) => `
    <div class="card row">
      <div>${escapeHtml(d.from)} → ${escapeHtml(d.to)}</div>
      <span class="pill" data-remove-dict="${i}">remove</span>
    </div>
  `).join('') || '<p style="color:var(--muted)">No custom words yet.</p>';
  return `
    <h2>Dictionary</h2>
    <div class="entry-form">
      <input id="dict-from" placeholder="Misheard word" />
      <input id="dict-to" placeholder="Correct word" />
      <button id="add-dict">Add</button>
    </div>
    ${rows}
  `;
}

function renderSnippets() {
  const rows = state.snippets.map((s, i) => `
    <div class="card row">
      <div>${escapeHtml(s.trigger)} → ${escapeHtml(s.expansion)}</div>
      <span class="pill" data-remove-snippet="${i}">remove</span>
    </div>
  `).join('') || '<p style="color:var(--muted)">No snippets yet.</p>';
  return `
    <h2>Snippets</h2>
    <div class="entry-form">
      <input id="snippet-trigger" placeholder="Trigger phrase" />
      <input id="snippet-expansion" placeholder="Expands to" />
      <button id="add-snippet">Add</button>
    </div>
    ${rows}
  `;
}

// ---- Screenwriting view ----

// ---- Pro Writing / Screenwriting view ----

function isProOrEnterprise() {
  return isPaidPlan();
}

function renderScreenwritingUpsell() {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;gap:14px;padding:40px 20px;">
      <div class="pro-icon-wrap" style="width:48px;height:48px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:22px;height:22px;"><path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9Z" fill="currentColor"/></svg>
      </div>
      <h2 style="margin:0;">Pro Writing is a Pro feature</h2>
      <p style="margin:0;max-width:420px;color:var(--muted);">Access professional screenplay writing tools, live multi-language dictation-translation, structured scene templates, and formatting guides. Upgrade to Pro to unlock.</p>
      <button class="pro-btn" id="screenwriting-upgrade-btn" style="padding:10px 20px;">Upgrade to Pro</button>
    </div>`;
}

function screenwritingStatusBanner() {
  const s = screenwritingSetupStatus;
  if (!s) return '';
  const colors = {
    checking: { bg: 'rgba(120,120,120,0.08)', border: 'rgba(120,120,120,0.2)', fg: '#718096' },
    missing: { bg: 'rgba(224,138,61,0.08)', border: 'rgba(224,138,61,0.2)', fg: '#e08a3d' },
    installing: { bg: 'rgba(31,111,153,0.08)', border: 'rgba(31,111,153,0.2)', fg: '#1f6f99' },
    ready: { bg: 'rgba(31,111,99,0.08)', border: 'rgba(31,111,99,0.2)', fg: 'var(--success)' },
    error: { bg: 'rgba(224,68,68,0.08)', border: 'rgba(224,68,68,0.2)', fg: '#e04444' }
  };
  const c = colors[s.state] || colors.checking;
  const showSetupBtn = (s.state === 'missing' || s.state === 'error') && screenwritingHasToken;
  const needsToken = (s.state === 'missing' || s.state === 'error') && !screenwritingHasToken;

  const tokenRow = needsToken ? `
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <span style="font-size:12px;color:${c.fg};">IndicTrans2's models are gated on Hugging Face — create a free account, accept the license on each model page, then paste an access token here:</span>
      <input id="screenwriting-hf-token" type="password" placeholder="hf_…" style="flex:1;min-width:200px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:12.5px;" />
      <button id="screenwriting-save-token-btn" style="background:var(--accent);color:#fff;border:none;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Save & set up</button>
    </div>` : '';

  const showCancelBtn = s.state === 'installing';

  return `
    <div style="background:${c.bg};border:1.5px solid ${c.border};border-radius:12px;padding:12px 16px;margin-bottom:16px;flex-shrink:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">
        <div style="font-size:12.5px;color:${c.fg};font-weight:600;">${escapeHtml(s.message || '')}</div>
        ${showSetupBtn ? `<button id="screenwriting-setup-btn" style="background:var(--accent);color:#fff;border:none;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Set up translation models</button>` : ''}
        ${showCancelBtn ? `<button id="screenwriting-cancel-setup-btn" style="background:none;border:1px solid ${c.border};color:${c.fg};padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Cancel</button>` : ''}
      </div>
      ${tokenRow}
    </div>`;
}

function renderTranslationTab() {
  const langToggles = SCREEN_LANGS.map((l) => `
    <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--text);cursor:pointer;">
      <input type="checkbox" class="screenwriting-lang-toggle" data-lang="${l.code}" ${screenwritingTargets.has(l.code) ? 'checked' : ''} />
      ${escapeHtml(l.name)}
    </label>`).join('');

  const panels = SCREEN_LANGS.filter((l) => screenwritingTargets.has(l.code)).map((l) => {
    const text = screenwritingLines.map((line) => {
      let t, muted = false;
      if (line.sourceLang === l.code) {
        t = line.source;
      } else if (line.translations[l.code] === undefined) {
        t = line.translationPending
          ? 'Translating…'
          : (line.translationError ? `(${line.translationError})` : '(translation unavailable)');
        muted = true;
      } else if (!line.translations[l.code]) {
        t = '(translation failed)'; muted = true;
      } else {
        t = line.translations[l.code];
      }
      const copyAttr = muted ? '' : `class="screenwriting-line" data-copy="${escapeHtml(t)}" title="Double-click to copy"`;
      return `<p style="margin:0 0 10px;${muted ? 'color:var(--muted);font-style:italic;' : ''}" ${copyAttr}>${escapeHtml(t)}</p>`;
    }).join('') || `<p style="color:var(--muted);">No speech yet — press your hotkey and start talking.</p>`;
    return `
      <div class="card" style="flex:1;min-width:220px;display:flex;flex-direction:column;">
        <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">${escapeHtml(l.name)}</div>
        <div style="flex:1;overflow-y:auto;font-size:14px;line-height:1.5;">${text}</div>
      </div>`;
  }).join('');

  const transcriptActions = screenwritingLines.length ? `
    <div style="display:flex;gap:8px;">
      <button id="screenwriting-copy-btn" class="toolbar-btn-action">Copy all</button>
      <button id="screenwriting-save-btn" class="toolbar-btn-action">Save as .txt</button>
      <button id="screenwriting-clear-btn" class="toolbar-btn-action">Clear transcript</button>
    </div>` : '';

  return `
    <div style="display:flex;flex-direction:column;height:100%;gap:12px;">
      ${screenwritingStatusBanner()}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">${langToggles}</div>
        <div class="status"><span class="dot ${recording ? 'recording' : ''}"></span>
          ${recording ? 'Listening… press hotkey again to stop' : `<span>Press</span> ${hotkeyChipsHtml(state.hotkey)} <span>to start dictating</span>`}</div>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;flex:1;overflow-y:auto;">${panels || '<p style="color:var(--muted);">Select at least one language above.</p>'}</div>
      ${transcriptActions}
    </div>`;
}

function getPlaceholderText(type) {
  switch (type) {
    case 'scene-heading': return 'INT. LOCATION - DAY';
    case 'action': return 'Action line: Describe the scene or character movement...';
    case 'character': return 'CHARACTER NAME';
    case 'parenthetical': return '(parenthetical instruction)';
    case 'dialogue': return 'Dialogue spoken by the character...';
    case 'transition': return 'FADE OUT.';
    default: return '';
  }
}

function focusBlock(idx, atEnd = false) {
  setTimeout(() => {
    const el = document.querySelector(`.script-block[data-index="${idx}"]`);
    if (el) {
      // Prevent browser's native scroll-to-top bug on scaled/zoomed contenteditable elements
      el.focus({ preventScroll: true });
      
      if (atEnd) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // Manually center the focused screenplay block inside the scroll container
      const container = document.querySelector('.screenplay-container');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        
        // Only scroll if the block is near or outside the visible boundaries
        const isAbove = elRect.top < containerRect.top + 40;
        const isBelow = elRect.bottom > containerRect.bottom - 40;
        
        if (isAbove || isBelow) {
          const scrollTop = container.scrollTop + (elRect.top - containerRect.top) - (container.clientHeight / 2) + (elRect.height / 2);
          container.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
          });
        }
      }
    }
  }, 50);
}

window.setBlockType = (type) => {
  if (screenplayBlocks[activeBlockIndex]) {
    screenplayBlocks[activeBlockIndex].type = type;
    saveScreenplayToStorage();
    render();
    focusBlock(activeBlockIndex);
  }
};

window.exportFountainFile = () => {
  const text = buildFountainText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'screenplay.fountain';
  a.click();
  URL.revokeObjectURL(url);
};

window.exportPDF = () => {
  window.print();
};

window.clearScreenplay = () => {
  if (confirm("Are you sure you want to clear your current screenplay? This action cannot be undone.")) {
    screenplayBlocks = [
      { type: 'scene-heading', text: 'INT. SCENE - DAY' },
      { type: 'action', text: 'Start writing here...' }
    ];
    activeBlockIndex = 0;
    saveScreenplayToStorage();
    render();
    focusBlock(0);
  }
};

window.handlePaperClick = (e) => {
  if (e.target.id === 'screenplay-editor-paper') {
    focusBlock(screenplayBlocks.length - 1);
  }
};

window.handleBlockFocus = (idx) => {
  activeBlockIndex = idx;
  const toolbarBtns = document.querySelectorAll('.screenplay-toolbar .toolbar-btn');
  const activeType = screenplayBlocks[idx] ? screenplayBlocks[idx].type : '';
  const types = ['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
  
  toolbarBtns.forEach((btn, btnIdx) => {
    btn.classList.toggle('active', types[btnIdx] === activeType);
  });
};

window.handleBlockBlur = (idx) => {
  setTimeout(closeSuggestions, 200);
};

window.handleBlockInput = (e, idx) => {
  const text = e.target.textContent;
  screenplayBlocks[idx].text = text;
  saveScreenplayToStorage();
};

window.handleBlockKeydown = (e, idx) => {
  const el = e.target;
  const block = screenplayBlocks[idx];

  if (suggestionBox) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentSuggestionIndex = (currentSuggestionIndex + 1) % filteredSuggestions.length;
      updateSuggestionHighlight();
      return;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentSuggestionIndex = (currentSuggestionIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length;
      updateSuggestionHighlight();
      return;
    } else if (e.key === 'Enter' && currentSuggestionIndex !== -1) {
      e.preventDefault();
      selectSuggestion(el, idx, filteredSuggestions[currentSuggestionIndex]);
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSuggestions();
      return;
    }
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    
    if (el.textContent.trim() === '' && block.type !== 'action') {
      block.type = 'action';
      saveScreenplayToStorage();
      render();
      focusBlock(idx);
      return;
    }

    let nextType = 'action';
    if (block.type === 'character') nextType = 'dialogue';
    else if (block.type === 'parenthetical') nextType = 'dialogue';
    else if (block.type === 'dialogue') {
      nextType = 'character';
    } else if (block.type === 'scene-heading') nextType = 'action';
    else if (block.type === 'transition') nextType = 'scene-heading';

    screenplayBlocks.splice(idx + 1, 0, { type: nextType, text: '' });
    saveScreenplayToStorage();
    render();
    focusBlock(idx + 1);
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const types = ['action', 'scene-heading', 'character', 'parenthetical', 'dialogue', 'transition'];
    let nextIdx = (types.indexOf(block.type) + 1) % types.length;
    block.type = types[nextIdx];
    saveScreenplayToStorage();
    render();
    focusBlock(idx);
  } else if (e.key === 'Backspace' && el.textContent === '') {
    e.preventDefault();
    if (screenplayBlocks.length > 1) {
      screenplayBlocks.splice(idx, 1);
      saveScreenplayToStorage();
      render();
      focusBlock(Math.max(0, idx - 1), true);
    }
  } else if (e.key === 'ArrowUp') {
    if (idx > 0) {
      e.preventDefault();
      focusBlock(idx - 1);
    }
  } else if (e.key === 'ArrowDown') {
    if (idx < screenplayBlocks.length - 1) {
      e.preventDefault();
      focusBlock(idx + 1);
    }
  }
};

window.handleBlockKeyup = (e, idx) => {
  const el = e.target;
  const block = screenplayBlocks[idx];
  const text = el.textContent;

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
    return;
  }

  if (block.type === 'character') {
    const suggestions = getCharacterSuggestions(text);
    showSuggestions(el, idx, suggestions);
  } else if (block.type === 'scene-heading') {
    const parts = text.split(/\s+/);
    const lastWord = parts[parts.length - 1];
    if (lastWord.length >= 2) {
      const suggestions = getSceneHeadingSuggestions(text);
      showSuggestions(el, idx, suggestions);
    } else {
      closeSuggestions();
    }
  } else {
    closeSuggestions();
  }
};

let suggestionBox = null;
let currentSuggestionIndex = -1;
let filteredSuggestions = [];

function showSuggestions(el, idx, suggestions) {
  closeSuggestions();
  if (suggestions.length === 0) return;

  filteredSuggestions = suggestions;
  currentSuggestionIndex = 0;

  suggestionBox = document.createElement('div');
  suggestionBox.className = 'script-autocomplete';

  const rect = el.getBoundingClientRect();
  const parentRect = el.offsetParent.getBoundingClientRect();
  suggestionBox.style.left = `${rect.left - parentRect.left}px`;
  suggestionBox.style.top = `${rect.bottom - parentRect.top + 5}px`;

  filteredSuggestions.forEach((s, sIdx) => {
    const item = document.createElement('div');
    item.className = `autocomplete-item ${sIdx === 0 ? 'active' : ''}`;
    item.textContent = s;
    item.onclick = (e) => {
      e.stopPropagation();
      selectSuggestion(el, idx, s);
    };
    suggestionBox.appendChild(item);
  });

  el.offsetParent.appendChild(suggestionBox);
}

function selectSuggestion(el, idx, value) {
  screenplayBlocks[idx].text = value;
  el.textContent = value;
  saveScreenplayToStorage();
  closeSuggestions();
  focusBlock(idx, true);
}

function closeSuggestions() {
  if (suggestionBox) {
    suggestionBox.remove();
    suggestionBox = null;
  }
  filteredSuggestions = [];
  currentSuggestionIndex = -1;
}

function updateSuggestionHighlight() {
  if (!suggestionBox) return;
  const items = suggestionBox.querySelectorAll('.autocomplete-item');
  items.forEach((item, idx) => {
    item.classList.toggle('active', idx === currentSuggestionIndex);
  });
}

function getCharacterSuggestions(query) {
  if (!query) return [];
  const characters = new Set();
  screenplayBlocks.forEach(b => {
    if (b.type === 'character' && b.text.trim()) {
      characters.add(b.text.trim().toUpperCase());
    }
  });
  return Array.from(characters).filter(c => c.startsWith(query.toUpperCase()) && c !== query.toUpperCase());
}

function getSceneHeadingSuggestions(query) {
  if (!query) return [];
  const headings = new Set();
  screenplayBlocks.forEach(b => {
    if (b.type === 'scene-heading' && b.text.trim()) {
      headings.add(b.text.trim().toUpperCase());
    }
  });
  const q = query.toUpperCase();
  return Array.from(headings).filter(h => h.startsWith(q) && h !== q);
}

function renderScreenplayEditor() {
  const activeType = screenplayBlocks[activeBlockIndex] ? screenplayBlocks[activeBlockIndex].type : 'action';

  const toolbarHtml = `
    <div class="screenplay-toolbar">
      <div class="toolbar-group">
        <button class="toolbar-btn ${activeType === 'scene-heading' ? 'active' : ''}" onclick="setBlockType('scene-heading')" title="Scene Heading (Tab)">Heading</button>
        <button class="toolbar-btn ${activeType === 'action' ? 'active' : ''}" onclick="setBlockType('action')" title="Action Description (Tab)">Action</button>
        <button class="toolbar-btn ${activeType === 'character' ? 'active' : ''}" onclick="setBlockType('character')" title="Character Name (Tab)">Character</button>
        <button class="toolbar-btn ${activeType === 'parenthetical' ? 'active' : ''}" onclick="setBlockType('parenthetical')" title="Parenthetical Direction (Tab)">Parenthetical</button>
        <button class="toolbar-btn ${activeType === 'dialogue' ? 'active' : ''}" onclick="setBlockType('dialogue')" title="Dialogue Text (Tab)">Dialogue</button>
        <button class="toolbar-btn ${activeType === 'transition' ? 'active' : ''}" onclick="setBlockType('transition')" title="Transition (Tab)">Transition</button>
      </div>
      <div class="toolbar-group">
        <span style="font-size:11.5px;color:var(--muted);font-weight:700;margin-right:4px;">Zoom:</span>
        <select id="zoom-select" onchange="changeZoomMode(this.value)" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:11.5px;background:var(--card);color:var(--text);cursor:pointer;outline:none;margin-right:10px;">
          <option value="100" ${currentZoomMode === '100' ? 'selected' : ''}>100%</option>
          <option value="fit-page" ${currentZoomMode === 'fit-page' ? 'selected' : ''}>Fit Page</option>
          <option value="fit-width" ${currentZoomMode === 'fit-width' ? 'selected' : ''}>Fit Width</option>
          <option value="75" ${currentZoomMode === '75' ? 'selected' : ''}>75%</option>
          <option value="50" ${currentZoomMode === '50' ? 'selected' : ''}>50%</option>
        </select>
        <button class="toolbar-btn-action" onclick="exportFountainFile()" title="Export script as .fountain file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Fountain
        </button>
        <button class="toolbar-btn-action" onclick="exportPDF()" title="Print screenplay / save as PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Export PDF
        </button>
        <button class="toolbar-btn-action" onclick="clearScreenplay()" title="Delete all blocks and start over" style="color:#e04444;border-color:rgba(224,68,68,0.2);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          Clear
        </button>
        <button class="toolbar-btn-action" onclick="toggleFocusMode()" title="Enter Zen Focus Mode" style="margin-left:8px;background:var(--accent);color:#fff;border-color:var(--accent);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
          Focus Mode
        </button>
      </div>
    </div>
  `;

  const statusHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:11.5px;color:var(--muted);">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-weight:700;color:var(--text);">Shortcuts:</span> 
        <span>[Tab] to cycle type</span> &bull; 
        <span>[Enter] logical progression</span> &bull;
        <span>[Up/Down] navigate</span>
      </div>
      <div class="status status-text-container" style="margin:0;"><span class="dot ${recording ? 'recording' : ''}"></span>
        ${recording ? 'Listening… Speak in English/Malayalam to type' : `Dictate: Press ${hotkeyChipsHtml(state.hotkey)} to dictate into cursor`}</div>
    </div>
  `;

  let sidebarContent = '';
  if (activeSidebarTab === 'scenes') {
    const scenes = screenplayBlocks
      .map((b, idx) => ({ ...b, idx }))
      .filter((b) => b.type === 'scene-heading');
    
    sidebarContent = scenes.map((s) => `
      <div class="scene-nav-item" onclick="jumpToScene(${s.idx})" title="${escapeHtml(s.text)}">
        ${escapeHtml(s.text) || 'UNTITLED SCENE'}
      </div>
    `).join('') || '<div style="font-size:12px;color:var(--muted);text-align:center;padding-top:20px;">No scenes yet.</div>';
  } else if (activeSidebarTab === 'characters') {
    const charNames = Array.from(new Set(
      screenplayBlocks
        .filter((b) => b.type === 'character' && b.text.trim())
        .map((b) => b.text.trim().toUpperCase())
    )).sort();

    sidebarContent = charNames.map((name) => {
      const bio = characterBios[name] || '';
      const isEditing = editingCharacterName === name;
      
      let bioHtml = '';
      if (isEditing) {
        bioHtml = `
          <div class="char-bio-editor" onclick="event.stopPropagation()">
            <textarea id="char-bio-input-${name.replace(/\s+/g, '_')}" class="char-bio-textarea" placeholder="Character biography...">${escapeHtml(bio)}</textarea>
            <button class="char-bio-save-btn" onclick="saveCharacterBioText(document.getElementById('char-bio-input-${name.replace(/\s+/g, '_')}').value)">Save</button>
          </div>
        `;
      } else {
        bioHtml = bio 
          ? `<div class="char-bio-text">${escapeHtml(bio)}</div>`
          : `<div class="char-bio-text" style="font-style:italic;opacity:0.6;">Click to edit biography...</div>`;
      }

      return `
        <div class="character-nav-item ${isEditing ? 'active' : ''}" onclick="editCharacterBio('${escapeHtml(name)}')">
          <div class="char-nav-header">
            <span>${escapeHtml(name)}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px;opacity:0.6;"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </div>
          ${bioHtml}
        </div>
      `;
    }).join('') || '<div style="font-size:12px;color:var(--muted);text-align:center;padding-top:20px;">No characters yet. Introduce a character block in your script.</div>';
  }

  const workspaceHtml = `
    <div class="script-workspace">
      <div class="script-sidebar ${sidebarCollapsed ? 'collapsed' : ''}">
        <div class="script-sidebar-tabs">
          <button class="script-sidebar-tab ${activeSidebarTab === 'scenes' ? 'active' : ''}" onclick="changeSidebarTab('scenes')">Scenes</button>
          <button class="script-sidebar-tab ${activeSidebarTab === 'characters' ? 'active' : ''}" onclick="changeSidebarTab('characters')">Characters</button>
        </div>
        <div class="script-sidebar-content">
          ${sidebarContent}
        </div>
      </div>
      
      <button class="sidebar-toggle-btn" onclick="toggleSidebar()" title="${sidebarCollapsed ? 'Expand Scene Navigator' : 'Collapse Scene Navigator'}">
        <span style="font-size:16px;font-weight:700;line-height:1;display:inline-block;transform: ${sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s; margin-top:-2px;">‹</span>
      </button>

      <div class="screenplay-container">
        <div class="screenplay-paper" id="screenplay-editor-paper" onclick="handlePaperClick(event)">
          ${screenplayBlocks.map((b, idx) => `
            <div class="script-block ${b.type}" 
                 data-index="${idx}" 
                 contenteditable="true" 
                 placeholder="${getPlaceholderText(b.type)}"
                 onkeydown="handleBlockKeydown(event, ${idx})"
                 onkeyup="handleBlockKeyup(event, ${idx})"
                 onfocus="handleBlockFocus(${idx})"
                 onblur="handleBlockBlur(${idx})"
                 oninput="handleBlockInput(event, ${idx})">${escapeHtml(b.text)}</div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  return `
    <div style="display:flex;flex-direction:column;height:100%;min-height:0;">
      <button class="exit-focus-btn" onclick="toggleFocusMode()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;margin-right:6px;"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M10 14l-7 7"/></svg>
        Exit Fullscreen Focus
      </button>
      ${toolbarHtml}
      ${statusHtml}
      ${workspaceHtml}
    </div>
  `;
}

function renderEducationTab() {
  const sections = [
    {
      title: 'The Three-Act Structure',
      tag: 'Structure',
      body: `
        The foundation of almost every screenplay is the classic Three-Act Structure:
        <ul class="edu-list">
          <li><strong>Act I: The Setup (Pages 1-30):</strong> Establish the hero's normal world, introduce the Inciting Incident that disrupts it, and end with Plot Point 1 (which commits the hero to the journey).</li>
          <li><strong>Act II: The Confrontation (Pages 30-90):</strong> The hero faces obstacles, leading up to a Midpoint shift in stakes, and ending with Plot Point 2 (the "dark night of the soul" where all seems lost).</li>
          <li><strong>Act III: The Resolution (Pages 90-120):</strong> The hero gathers strength for the final Climax, confronting the antagonist, followed by a brief Denouement establishing the new normal.</li>
        </ul>
      `
    },
    {
      title: 'Standard Script Layout & Margins',
      tag: 'Formatting',
      body: `
        Standard screenplays are formatted in <strong>Courier 12pt</strong> font so that 1 page equals approximately 1 minute of screen time. The margins are strictly defined:
        <ul class="edu-list">
          <li><strong>Scene Headings (Sluglines):</strong> Must start with INT. (Interior) or EXT. (Exterior), followed by Location and Time of Day. Capitalized and bold.</li>
          <li><strong>Action Lines:</strong> Describe what is seen and heard. Always written in present tense. Keep paragraphs under 4 lines for readability.</li>
          <li><strong>Characters:</strong> Centered uppercase names. Introduce new characters in Action lines in UPPERCASE with their age (e.g., LEO, 20s).</li>
          <li><strong>Dialogue & Parentheticals:</strong> Dialogue is centered below the character name. Parentheticals specify actor behavior and must be short.</li>
        </ul>
      `
    },
    {
      title: 'Show, Don\'t Tell',
      tag: 'Writing Style',
      body: `
        A screenwriter's primary rule is to write only what can be captured by a camera and microphone.
        <ul class="edu-list">
          <li>Avoid describing inner thoughts or emotions directly (e.g., instead of writing <em>"He feels sad about his past"</em>, write <em>"He stares at a faded photo, wipes tears from his cheek"</em>).</li>
          <li>Let character actions, expressions, and subtext-heavy dialogue reveal their internal states.</li>
        </ul>
      `
    },
    {
      title: 'Screenwriting Terminology Glossary',
      tag: 'Glossary',
      body: `
        Key industry terminology you should know:
        <ul class="edu-list">
          <li><strong>V.O. (Voiceover):</strong> Used when a narrator speaks over the scene, or a character speaks their thoughts.</li>
          <li><strong>O.S. (Off-Screen):</strong> Used when a character is physically in the scene but speaking from outside the camera frame (e.g., from an adjacent room).</li>
          <li><strong>Beat:</strong> A brief pause in dialogue or action to build suspense, denote a shift in emotion, or establish pacing.</li>
          <li><strong>Slugline:</strong> Another name for a Scene Heading.</li>
        </ul>
      `
    }
  ];

  const html = sections.map((s, idx) => `
    <div class="edu-section-card" id="edu-card-${idx}">
      <div class="edu-header" onclick="toggleEduSection(${idx})">
        <div class="edu-title">
          <span class="edu-tag">${s.tag}</span>
          <span>${s.title}</span>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-chevron" style="width:14px;height:14px;transition:transform 0.2s;" id="edu-chevron-${idx}"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="edu-body" id="edu-body-${idx}" style="display:none;">
        ${s.body}
      </div>
    </div>
  `).join('');

  return `
    <div class="education-container">
      <div style="margin-bottom: 8px;">
        <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">Screenwriting Masterclass</h3>
        <p style="margin:0;font-size:12px;color:var(--muted);">Learn professional screenplay formatting rules and structural principles.</p>
      </div>
      ${html}
    </div>
  `;
}

window.toggleEduSection = (idx) => {
  const body = document.getElementById(`edu-body-${idx}`);
  const chevron = document.getElementById(`edu-chevron-${idx}`);
  if (body && chevron) {
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
};

const SCRIPT_TEMPLATES = {
  shortFilm: [
    { type: 'scene-heading', text: 'INT. COFFEE SHOP - DAY' },
    { type: 'action', text: 'A cozy, sunlit cafe. The hum of espresso machines fills the air. SARAH (20s) sits by the window, nervously tapping a sugar packet.' },
    { type: 'character', text: 'SARAH' },
    { type: 'parenthetical', text: '(whispering)' },
    { type: 'dialogue', text: 'Where are you? You\'re never late.' },
    { type: 'action', text: 'The door chimes. LEO (20s), wearing a damp raincoat, rushes in. He catches her eye and walks over quickly.' },
    { type: 'character', text: 'LEO' },
    { type: 'dialogue', text: 'I\'m sorry. The traffic on the bridge was completely blocked. I ran the last three blocks.' },
    { type: 'character', text: 'SARAH' },
    { type: 'dialogue', text: 'Did you bring it?' },
    { type: 'action', text: 'Leo pulls a weathered leather notebook from his coat. He slides it across the table.' },
    { type: 'character', text: 'LEO' },
    { type: 'dialogue', text: 'It was exactly where you said it would be. In the drawer of the grandfather clock.' }
  ],
  actionScene: [
    { type: 'scene-heading', text: 'EXT. ALLEYWAY - NIGHT' },
    { type: 'action', text: 'Rain pours down in sheets, reflecting the neon street lights. RYAN (30s) bolts down the narrow alley, his boots splashing in deep puddles.' },
    { type: 'action', text: 'Behind him, two shadow figures in dark trench coats follow, running with clinical speed.' },
    { type: 'scene-heading', text: 'EXT. ROOFTOP - CONTINUOUS' },
    { type: 'action', text: 'Ryan bursts through a heavy metal door. The wind howls. He runs to the edge of the roof, looking down at the four-story drop.' },
    { type: 'character', text: 'RYAN' },
    { type: 'parenthetical', text: '(panting, looking around)' },
    { type: 'dialogue', text: 'No, no, no... Think. There\'s got to be a way.' },
    { type: 'action', text: 'He spots a rusty fire escape ladder across a three-meter gap on the adjacent building.' },
    { type: 'action', text: 'The heavy metal door crashes open. The trench coats step out onto the wet roof.' },
    { type: 'character', text: 'RYAN' },
    { type: 'dialogue', text: 'Here goes nothing.' },
    { type: 'action', text: 'Ryan sprints and leaps into the empty space.' }
  ],
  charIntro: [
    { type: 'scene-heading', text: 'INT. CLASSROOM - DAY' },
    { type: 'action', text: 'Thirty high school students stare blankly at the blackboard. The chatter is deafening.' },
    { type: 'action', text: 'A sharp rap of a ruler against the podium silences the room. Enter MR. BENNETT (50s), wearing a corduroy jacket with leather elbow patches.' },
    { type: 'action', text: 'He has a permanent squint, the look of a man who has spent too much time reading grading papers under bad lighting.' },
    { type: 'character', text: 'MR. BENNETT' },
    { type: 'dialogue', text: 'Good morning, class. Put away your textbooks. Today, we start writing from the heart.' },
    { type: 'action', text: 'He drops a thick stack of blank papers onto the front desk with a heavy THUD.' }
  ],
  threeActOutline: [
    { type: 'scene-heading', text: 'ACT I - THE SETUP' },
    { type: 'action', text: 'INTRODUCE THE HERO: Establish the protagonist\'s normal world, their flaws, and their core desire.' },
    { type: 'action', text: 'THE INCITING INCIDENT: An event disrupts the hero\'s normal world and presents a call to adventure.' },
    { type: 'scene-heading', text: 'ACT II - THE CONFRONTATION' },
    { type: 'action', text: 'RISING ACTION & OBSTACLES: The hero faces escalating challenges as they pursue their goal in a new world.' },
    { type: 'action', text: 'MIDPOINT: A major shift in stakes, turning point where the hero shifts from reactive to active.' },
    { type: 'scene-heading', text: 'ACT III - THE RESOLUTION' },
    { type: 'action', text: 'THE CLIMAX: The ultimate confrontation between the hero and the primary obstacle or antagonist.' },
    { type: 'action', text: 'DENOUEMENT: The new normal is established, showing how the hero has been transformed by the journey.' }
  ]
};

function renderDraftsTab() {
  const templates = [
    {
      key: 'shortFilm',
      title: 'Short Film Scene (Completed)',
      desc: 'A complete dramatic scene dialogue between Sarah and Leo. Ideal for observing standard character and dialogue spacing.'
    },
    {
      key: 'actionScene',
      title: 'Action Sequence Template',
      desc: 'A fast-paced chase sequence. Focuses heavily on action descriptions, formatting sluglines, and continuous time indicators.'
    },
    {
      key: 'charIntro',
      title: 'Character Intro Template',
      desc: 'Demonstrates the gold standard for introducing a new character in a scene, complete with visual details and establishing dialogue.'
    },
    {
      key: 'threeActOutline',
      title: '3-Act Outliner Skeleton',
      desc: 'A structural outline template. Great for planning a feature film, mapping out key plots, midpoint shifts, and climax elements.'
    }
  ];

  const cards = templates.map((t) => `
    <div class="template-card">
      <div>
        <div class="template-title">${t.title}</div>
        <div class="template-desc">${t.desc}</div>
      </div>
      <div class="template-actions">
        <button class="toolbar-btn-action primary" onclick="loadScriptTemplate('${t.key}')" style="font-weight:700;width:100%;justify-content:center;">Load into Editor</button>
      </div>
    </div>
  `).join('');

  return `
    <div style="display:flex;flex-direction:column;gap:12px;height:100%;">
      <div style="margin-bottom: 8px;">
        <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">Screenplay Templates</h3>
        <p style="margin:0;font-size:12px;color:var(--muted);">Load pre-formatted screenwriting blocks to jumpstart your writing.</p>
      </div>
      <div class="templates-grid">${cards}</div>
    </div>
  `;
}

window.loadScriptTemplate = (key) => {
  if (SCRIPT_TEMPLATES[key]) {
    screenplayBlocks = JSON.parse(JSON.stringify(SCRIPT_TEMPLATES[key]));
    saveScreenplayToStorage();
    activeProWritingTab = 'screenplay';
    render();
    lastPasteError = "Template loaded successfully into the screenplay editor!";
    setTimeout(() => {
      if (lastPasteError === "Template loaded successfully into the screenplay editor!") {
        lastPasteError = null;
        render();
      }
    }, 3000);
  }
};

function renderScreenwriting() {
  if (!isProOrEnterprise()) return renderScreenwritingUpsell();

  const header = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <h2 style="margin:0 0 2px;">Pro Writing</h2>
        <p style="margin:0;color:var(--muted);font-size:12.5px;">Professional tools for screenwriters, translators, and educators.</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:12px;color:var(--muted);font-weight:700;">Dictation language:</span>
        ${renderLanguageSelector()}
      </div>
    </div>
  `;

  const nav = `
    <div class="prowriting-nav">
      <button class="prowriting-tab-btn ${activeProWritingTab === 'screenplay' ? 'active' : ''}" data-prowriter-tab="screenplay">Professional Screenplay</button>
      <button class="prowriting-tab-btn ${activeProWritingTab === 'translation' ? 'active' : ''}" data-prowriter-tab="translation">Live Translation</button>
      <button class="prowriting-tab-btn ${activeProWritingTab === 'education' ? 'active' : ''}" data-prowriter-tab="education">Education Guide</button>
      <button class="prowriting-tab-btn ${activeProWritingTab === 'drafts' ? 'active' : ''}" data-prowriter-tab="drafts">Templates & Drafts</button>
    </div>
  `;

  let subContent = '';
  if (activeProWritingTab === 'screenplay') {
    subContent = renderScreenplayEditor();
  } else if (activeProWritingTab === 'translation') {
    subContent = renderTranslationTab();
  } else if (activeProWritingTab === 'education') {
    subContent = renderEducationTab();
  } else if (activeProWritingTab === 'drafts') {
    subContent = renderDraftsTab();
  }

  return `
    <div style="display:flex;flex-direction:column;height:100%;gap:10px;min-height:0;">
      ${header}
      ${nav}
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;">
        ${subContent}
      </div>
    </div>
  `;
}

function buildFountainText() {
  return screenplayBlocks.map((b) => {
    switch (b.type) {
      case 'scene-heading':
        let txt = b.text.trim().toUpperCase();
        if (!txt.startsWith('INT') && !txt.startsWith('EXT') && !txt.startsWith('I/E')) {
          return '.' + txt;
        }
        return txt;
      case 'action':
        return b.text.trim();
      case 'character':
        return '\n' + b.text.trim().toUpperCase();
      case 'parenthetical':
        let p = b.text.trim();
        if (!p.startsWith('(')) p = '(' + p;
        if (!p.endsWith(')')) p = p + ')';
        return p;
      case 'dialogue':
        return b.text.trim();
      case 'transition':
        let t = b.text.trim().toUpperCase();
        if (!t.endsWith('TO:')) {
          return '> ' + t;
        }
        return t;
      default:
        return b.text.trim();
    }
  }).join('\n').trim();
}

function buildScreenwritingTranscript() {
  return SCREEN_LANGS.filter((l) => screenwritingTargets.has(l.code)).map((l) => {
    const lines = screenwritingLines.map((line) => {
      if (line.sourceLang === l.code) return line.source;
      const t = line.translations[l.code];
      return t || '';
    }).filter(Boolean);
    return `=== ${l.name} ===\n${lines.join('\n')}`;
  }).join('\n\n');
}

async function checkScreenwritingSetup() {
  screenwritingSetupStatus = { state: 'checking', message: 'Checking local translation models…' };
  render();
  try {
    const tokenStatus = await window.parayu.getHfTokenStatus();
    screenwritingHasToken = !!(tokenStatus && tokenStatus.hasToken);
  } catch (_e) {
    screenwritingHasToken = false;
  }
  try {
    const status = await window.parayu.translationStatus();
    if (status && status.ready) {
      screenwritingSetupStatus = { state: 'ready', message: 'Local translation models ready (offline, on-device).' };
    } else {
      screenwritingSetupStatus = { state: 'missing', message: status && status.message ? status.message : 'Translation models are not installed yet — set them up once (one-time download, runs fully offline afterwards).' };
    }
  } catch (_e) {
    screenwritingSetupStatus = { state: 'error', message: "Couldn't check the translation backend." };
  }
  render();
}

async function runScreenwritingSetup() {
  screenwritingSetupStatus = { state: 'installing', message: 'Setting up local translation models… this can take a few minutes the first time.' };
  render();
  try {
    const result = await window.parayu.setupTranslation();
    if (result && result.ok) {
      screenwritingSetupStatus = { state: 'ready', message: 'Local translation models ready (offline, on-device).' };
    } else {
      screenwritingSetupStatus = { state: 'error', message: (result && result.error) || 'Setup failed.' };
    }
  } catch (_e) {
    screenwritingSetupStatus = { state: 'error', message: `Setup failed: ${_e.message || _e}` };
  }
  render();
}

function wireScreenwriting() {
  const upgradeBtn = document.getElementById('screenwriting-upgrade-btn');
  if (upgradeBtn) upgradeBtn.onclick = () => openProfileModal();
  if (!isProOrEnterprise()) return;

  // Wire up sub-tabs
  document.querySelectorAll('.prowriting-tab-btn').forEach((btn) => {
    btn.onclick = () => {
      activeProWritingTab = btn.dataset.prowriterTab;
      render();
      if (activeProWritingTab === 'screenplay') {
        focusBlock(activeBlockIndex);
      }
    };
  });

  if (activeProWritingTab === 'screenplay') {
    // Scroll editor or focus block if needed
  }

  if (activeProWritingTab === 'translation') {
    if (screenwritingSetupStatus === null) checkScreenwritingSetup();

    document.querySelectorAll('.screenwriting-lang-toggle').forEach((el) => {
      el.onchange = () => {
        const code = el.dataset.lang;
        if (el.checked) screenwritingTargets.add(code); else screenwritingTargets.delete(code);
        render();
      };
    });

    const setupBtn = document.getElementById('screenwriting-setup-btn');
    if (setupBtn) setupBtn.onclick = () => runScreenwritingSetup();

    const cancelBtn = document.getElementById('screenwriting-cancel-setup-btn');
    if (cancelBtn) cancelBtn.onclick = async () => {
      await window.parayu.cancelTranslationSetup();
      screenwritingSetupStatus = { state: 'missing', message: 'Setup cancelled.' };
      render();
    };

    const saveTokenBtn = document.getElementById('screenwriting-save-token-btn');
    if (saveTokenBtn) saveTokenBtn.onclick = async () => {
      const input = document.getElementById('screenwriting-hf-token');
      const token = input ? input.value.trim() : '';
      if (!token) return;
      await window.parayu.setHfToken(token);
      screenwritingHasToken = true;
      runScreenwritingSetup();
    };

    const clearBtn = document.getElementById('screenwriting-clear-btn');
    if (clearBtn) clearBtn.onclick = () => { screenwritingLines = []; render(); };

    const copyBtn = document.getElementById('screenwriting-copy-btn');
    if (copyBtn) copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(buildScreenwritingTranscript());
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy all'; }, 1200);
      } catch (_e) { /* clipboard unavailable */ }
    };

    const saveBtn = document.getElementById('screenwriting-save-btn');
    if (saveBtn) saveBtn.onclick = async () => {
      await window.parayu.saveScreenwritingTranscript(buildScreenwritingTranscript());
    };

    document.querySelectorAll('.screenwriting-line').forEach((el) => {
      el.ondblclick = async () => {
        try {
          await navigator.clipboard.writeText(el.dataset.copy);
          const orig = el.style.color;
          el.style.color = 'var(--success)';
          setTimeout(() => { el.style.color = orig; }, 600);
        } catch (_e) { /* clipboard unavailable */ }
      };
    });
  }
}

async function handleScreenwritingSegment(text) {
  if (activeProWritingTab === 'translation') {
    const hasMalayalamCharacters = /[\u0D00-\u0D7F]/.test(text);
    const sourceLang = hasMalayalamCharacters ? 'ml' : 'en';
    const line = { source: text, sourceLang, translations: {}, translationPending: false, translationError: null };
    screenwritingLines.push(line);
    screenwritingBusy = true;
    render();
    const targets = Array.from(screenwritingTargets).filter((c) => c !== sourceLang);
    if (targets.length && screenwritingSetupStatus && screenwritingSetupStatus.state === 'ready') {
      line.translationPending = true;
      render();
      try {
        const result = await window.parayu.translateText({ text, sourceLang, targetLangs: targets });
        const translations = (result && result.translations) || {};
        for (const target of targets) {
          line.translations[target] = translations[target] || '';
        }
        line.translationError = result && result.error ? result.error : null;
      } catch (_e) {
        for (const target of targets) line.translations[target] = '';
        line.translationError = _e.message || 'translation failed';
      }
      line.translationPending = false;
    } else {
      for (const target of targets) line.translations[target] = '';
      if (targets.length) line.translationError = 'translation models not ready';
    }
    screenwritingBusy = false;
    render();
  } else if (activeProWritingTab === 'screenplay') {
    if (screenplayBlocks[activeBlockIndex]) {
      const block = screenplayBlocks[activeBlockIndex];
      block.text = (block.text ? block.text.trim() + ' ' : '') + text.trim();
      saveScreenplayToStorage();
      render();
      focusBlock(activeBlockIndex, true);
    } else {
      screenplayBlocks.push({ type: 'dialogue', text: text.trim() });
      activeBlockIndex = screenplayBlocks.length - 1;
      saveScreenplayToStorage();
      render();
      focusBlock(activeBlockIndex, true);
    }
  }
}

function updateScreenplayZoom() {
  const container = document.querySelector('.screenplay-container');
  const paper = document.getElementById('screenplay-editor-paper');
  if (!container || !paper) return;

  let scale = 1;
  if (currentZoomMode === 'fit-page') {
    const containerHeight = container.clientHeight - 80;
    scale = Math.min(1, containerHeight / 1056);
  } else if (currentZoomMode === 'fit-width') {
    const containerWidth = container.clientWidth - 80;
    scale = Math.min(1, containerWidth / 816);
  } else if (currentZoomMode === '75') {
    scale = 0.75;
  } else if (currentZoomMode === '50') {
    scale = 0.5;
  } else {
    scale = 1;
  }

  if (scale === 1) {
    paper.style.transform = 'none';
    paper.style.transformOrigin = 'top center';
    paper.style.marginBottom = '30px';
  } else {
    paper.style.transform = `scale(${scale})`;
    paper.style.transformOrigin = 'top center';
    const collapsedHeight = 1056 * (1 - scale);
    paper.style.marginBottom = `-${collapsedHeight - 30}px`;
  }
}

window.changeZoomMode = (val) => {
  currentZoomMode = val;
  updateScreenplayZoom();
};

window.changeSidebarTab = (tab) => {
  activeSidebarTab = tab;
  render();
};

window.toggleSidebar = () => {
  sidebarCollapsed = !sidebarCollapsed;
  const sidebar = document.querySelector('.script-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed', sidebarCollapsed);
  }
  const toggleBtnSvg = document.querySelector('.sidebar-toggle-btn svg');
  if (toggleBtnSvg) {
    toggleBtnSvg.style.transform = sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
  }
  setTimeout(updateScreenplayZoom, 260);
};

window.updateRecordingUI = () => {
  const statusEl = document.querySelector('.status-text-container');
  if (statusEl) {
    statusEl.innerHTML = `<span class="dot ${recording ? 'recording' : ''}"></span>
      ${recording ? 'Listening… Speak in English/Malayalam to type' : `Dictate: Press ${hotkeyChipsHtml(state.hotkey)} to dictate into cursor`}`;
  }
};

window.jumpToScene = (idx) => {
  const el = document.querySelector(`.script-block[data-index="${idx}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    focusBlock(idx);
  }
};

window.editCharacterBio = (name) => {
  editingCharacterName = name;
  render();
  setTimeout(() => {
    const textarea = document.getElementById(`char-bio-input-${name.replace(/\s+/g, '_')}`);
    if (textarea) textarea.focus();
  }, 50);
};

window.saveCharacterBioText = (text) => {
  if (editingCharacterName) {
    characterBios[editingCharacterName] = text.trim();
    saveCharacterBios();
  }
  editingCharacterName = null;
  render();
};

let focusModeActive = false;

window.toggleFocusMode = () => {
  focusModeActive = !focusModeActive;
  document.body.classList.toggle('focus-mode-active', focusModeActive);
  
  // Recalculate zoom when entering/exiting focus mode since available dimensions change.
  setTimeout(updateScreenplayZoom, 60);
};

window.addEventListener('resize', () => {
  if (currentView === 'screenwriting' && activeProWritingTab === 'screenplay') {
    updateScreenplayZoom();
  }
});

function formatLicenseDate(value) {
  if (!value) return 'Not available';
  try {
    return new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return 'Not available';
  }
}

function renderSubscriptionStatus() {
  const sub = subscription();
  const plan = sub.planLabel || 'Free';
  const status = sub.mode === 'grace'
    ? 'Offline grace active'
    : sub.mode === 'paid'
      ? 'Active'
      : 'Free mode';
  const reasonText = sub.reason === 'expired_beyond_grace'
    ? 'Subscription expired beyond the offline grace period. Premium features are locked until refresh.'
    : sub.reason === 'inside_grace_period'
      ? 'You are offline or past renewal, but paid features remain available until grace ends.'
      : sub.reason === 'invalid_license'
        ? 'Local license could not be verified. Free dictation remains available.'
        : 'Basic dictation remains available. Premium features require an active subscription.';

  return `
    <div class="set-card" style="grid-column: span 2; padding: 12px 16px; border-radius: 14px; margin-bottom: 0;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color: var(--accent); display:flex; align-items:center; width:15px; height:15px;">${setIcon('shield')}</span>
          <div>
            <div class="set-name" style="font-size:13.5px; font-weight:700;">Subscription</div>
            <p class="set-desc" style="font-size:11px; margin:2px 0 0; color:var(--muted);">${escapeHtml(reasonText)}</p>
          </div>
        </div>
        <button class="btn-soft" id="subscription-refresh-btn" style="padding:6px 10px; font-size:11.5px; font-weight:700;">${setIcon('refresh')} Refresh</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:10px;">
        ${[
          ['Plan', plan],
          ['Status', status],
          ['Expires', formatLicenseDate(sub.expiryDate)],
          ['Grace until', formatLicenseDate(sub.graceUntil)]
        ].map(([label, value]) => `
          <div style="border:1px solid var(--border); border-radius:10px; padding:8px 10px; background:#fff;">
            <div style="font-size:9.5px; color:var(--muted); font-weight:800; text-transform:uppercase;">${label}</div>
            <div style="font-size:12px; font-weight:750; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
      <div id="subscription-refresh-status" style="font-size:11px; color:var(--muted); margin-top:8px;"></div>
    </div>
  `;
}

function renderOfflineAISettingsUI() {
  const status = state.offlineAIStatus || {};
  const modelId = state.formatterModel === 'quality_7b' ? 'quality_7b' : 'fast_3b';
  const stateLabel = status.state || (state.aiFormatterEnabled ? 'Private Offline AI Not Installed' : 'Basic Offline Ready');
  const sizeLabel = status.sizeLabel || (modelId === 'quality_7b' ? 'About 4.2 GB' : 'About 1.6 GB');
  const progress = status.progress && status.progress.pct ? Math.round(status.progress.pct * 100) : 0;
  const isBusy = /Downloading|Installing/.test(stateLabel);
  const isReady = stateLabel === 'Private Offline AI Ready';
  const isConfigured = status.configured !== false;
  const canDownload = status.canDownload !== false && isConfigured && !isBusy && !isReady;
  const detailText = status.unavailableReason || `Your voice and text stay on this device. Download size: ${sizeLabel}.`;
  const buttonLabel = isReady ? 'Ready' : canDownload ? (status.error ? 'Retry' : 'Download') : 'Basic';
  return `
    <div style="grid-column: span 2; border: 1px solid var(--border); border-radius: 10px; padding: 9px 10px; display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; background: #fff;">
      <div style="min-width: 0;">
        <div style="font-size: 11.5px; font-weight: 800; color: ${isReady ? '#16825d' : 'var(--text)'};">${escapeHtml(stateLabel)}</div>
        <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">${escapeHtml(detailText)}</div>
        ${isBusy ? `<div style="height: 5px; background: #edf2f7; border-radius: 999px; overflow: hidden; margin-top: 7px;"><span style="display:block; height:100%; width:${progress}%; background: var(--accent);"></span></div>` : ''}
        ${status.error && isConfigured ? `<div style="font-size: 10px; color: #d33; margin-top: 4px;">${escapeHtml(status.error)}</div>` : ''}
      </div>
      <button class="btn-soft" id="download-offline-ai" data-model="${modelId}" ${canDownload ? '' : 'disabled'} style="padding: 6px 10px; font-size: 11px;">${buttonLabel}</button>
    </div>
  `;
}

function renderSettings() {
  const pt = state.dictationMode === 'pushToTalk';
  const canFormatter = featureEnabled('local_llm_formatter');
  const canMalayalamPremium = featureEnabled('malayalam_to_english_premium');
  const canPersonalDictionary = featureEnabled('personal_dictionary');
  const canTextSnippets = featureEnabled('text_snippets');
  const canAdvancedClipboard = featureEnabled('advanced_clipboard_restore');
  const canDeveloperPrompt = featureEnabled('developer_prompt_mode');
  return `
    <div class="settings-head" style="margin-bottom: 12px;">
      <div>
        <div class="set-title" style="font-size: 21px; font-weight: 800; letter-spacing: -0.02em; margin: 0;">Settings</div>
        <p class="set-sub" style="font-size: 12.5px; color: var(--muted); margin: 2px 0 0;">Configure dictation, shortcuts and models.</p>
      </div>
      <button class="btn-ghost" id="restore-defaults" style="padding: 6px 12px; font-size: 12px;">${setIcon('refresh')} Restore defaults</button>
    </div>

    <div class="settings-grid">
      ${renderSubscriptionStatus()}

      <!-- Row 1, Column 1: Microphone -->
      <div class="set-card" style="padding: 12px 16px; border-radius: 14px; margin-bottom: 0; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('mic')}</span>
          <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Microphone</div>
        </div>
        
        <div style="display: flex; gap: 16px; align-items: stretch; margin-top: 2px;">
          <!-- Left Column: Input device list & Test mic button / visual meter -->
          <div style="flex: 1.1; min-width: 0; display: flex; flex-direction: column; gap: 8px; justify-content: space-between;">
            <div class="dropdown" id="mic-dropdown" style="width: 100%;">
              <button class="dd-trigger" id="mic-trigger" type="button" style="width: 100%; padding: 8px 12px; font-size: 12px;">
                <span class="dd-mic-icon" style="width: 13px; height: 13px;">${micIconSvg()}</span>
                <span class="dd-label" id="mic-current" style="font-size: 12px;">Loading microphones…</span>
                <span class="dd-chevron" style="width: 10px; height: 10px;">${setIcon('chevron')}</span>
              </button>
              <div class="dd-menu" id="mic-menu" hidden></div>
            </div>
            
            <div class="set-ctl-row" style="gap: 8px; display: flex; align-items: center; width: 100%;">
              <button class="btn-soft" id="mic-test-btn" style="padding: 6px 10px; font-size: 11.5px; flex-shrink: 0;">${micIconSvg()} Test mic</button>
              <div class="meter" id="mic-meter" style="height: 12px; gap: 2px; flex: 1;">${meterBarsHtml()}</div>
            </div>
            <div id="mic-status" style="font-size: 11px; margin-top: -2px;"></div>
          </div>
          
          <!-- Vertical Divider Line -->
          <div style="width: 1px; background: var(--border); align-self: stretch; margin: 0 4px;"></div>
          
          <!-- Right Column: Boost quiet voices toggle & Noise suppression toggle -->
          <div style="flex: 1.2; min-width: 0; display: flex; flex-direction: column; gap: 10px; justify-content: center;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                <div style="font-size: 12.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Boost quiet voices</div>
                <p style="font-size: 10px; margin: 0; color: var(--muted); line-height: 1.2;">Amplify distant/feeble speech.</p>
              </div>
              <label class="switch" style="width: 36px; height: 20px; flex-shrink: 0; margin-left: 8px;">
                <input type="checkbox" id="boost-quiet-voices-toggle" ${state.boostQuietVoices !== false ? 'checked' : ''} />
                <span class="slider" style="border-radius: 20px;"></span>
              </label>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                <div style="font-size: 12.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Noise suppression</div>
                <p style="font-size: 10px; margin: 0; color: var(--muted); line-height: 1.2;">Filter background hums & echo.</p>
              </div>
              <label class="switch" style="width: 36px; height: 20px; flex-shrink: 0; margin-left: 8px;">
                <input type="checkbox" id="noise-suppression-toggle" ${state.noiseSuppression !== false ? 'checked' : ''} />
                <span class="slider" style="border-radius: 20px;"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 1, Column 2: Speech Language & AI Cleanup (Moved to top right) -->
      <div class="set-card" style="padding: 12px 16px; border-radius: 14px; margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
        <!-- Speech Language -->
        <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
          <div class="set-info" style="display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('globe')}</span>
              <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Speech language</div>
            </div>
            <p class="set-desc" style="font-size: 11px; margin: 2px 0 0; color: var(--muted);">${state.inputLanguage === 'ml' ? (state.translateMalayalam !== false ? 'Malayalam translates directly to English.' : 'Malayalam transcribes in native script.') : 'English transcribes directly.'}</p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;">
            <div class="set-ctl" style="align-self: flex-start; margin-top: 2px;">
              <div class="seg" style="padding: 3px;">
                <button class="seg-btn ${state.inputLanguage === 'en' ? 'seg-active' : ''}" data-lang="en" style="padding: 5px 10px; font-size: 11.5px;">English</button>
                <button class="seg-btn ${state.inputLanguage === 'ml' ? 'seg-active' : ''}" data-lang="ml" style="padding: 5px 10px; font-size: 11.5px;">Malayalam${canMalayalamPremium ? '' : ' Paid'}</button>
              </div>
            </div>
            ${state.inputLanguage === 'ml' ? `
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span class="set-desc" style="font-size: 11px; color: var(--muted); margin: 0;">Translate to English</span>
                <label class="switch" style="width: 36px; height: 20px; margin-bottom: 0;">
                  <input type="checkbox" id="translate-malayalam-toggle" ${state.translateMalayalam !== false && canMalayalamPremium ? 'checked' : ''} ${canMalayalamPremium ? '' : 'disabled'} />
                  <span class="slider" style="border-radius: 20px;"></span>
                </label>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="set-divider" style="margin: 6px 0; background: var(--border); height: 1px;"></div>

        <!-- AI Cleanup -->
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div class="set-info" style="display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('ai')}</span>
              <div class="set-name" style="font-size: 13.5px; font-weight: 700;">AI cleanup</div>
            </div>
            <p class="set-desc" style="font-size: 11px; margin: 2px 0 0; color: var(--muted);">Fixes stutters & filler words.</p>
          </div>
          <div class="set-ctl" style="display:flex; align-items:center;">
            <label class="switch" style="width: 36px; height: 20px;"><input type="checkbox" id="ai-cleanup-toggle" ${state.aiCleanup ? 'checked' : ''} /><span class="slider" style="border-radius: 20px;"></span></label>
          </div>
        </div>

        <div class="set-divider" style="margin: 6px 0; background: var(--border); height: 1px;"></div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; align-items: center;">
          <div class="seg" style="grid-column: span 2; padding: 3px; display: grid; grid-template-columns: repeat(3, 1fr);">
            ${[
              ['fast', 'Fast'],
              ['smart', 'Smart'],
              ['premium', 'Premium']
            ].map(([mode, label]) => `<button class="seg-btn ${state.cleanupMode === mode ? 'seg-active' : ''}" data-cleanup-mode="${mode}" style="padding: 5px 10px; font-size: 11.5px;">${label}</button>`).join('')}
          </div>
          <label style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700;">
            Private Offline AI
            <span class="switch" style="width: 36px; height: 20px;"><input type="checkbox" id="ai-formatter-toggle" ${state.aiFormatterEnabled && canFormatter ? 'checked' : ''} ${canFormatter ? '' : 'disabled'} /><span class="slider" style="border-radius: 20px;"></span></span>
          </label>
          <label style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700;">
            Always format
            <span class="switch" style="width: 36px; height: 20px;"><input type="checkbox" id="always-format-toggle" ${state.alwaysFormat ? 'checked' : ''} ${canFormatter ? '' : 'disabled'} /><span class="slider" style="border-radius: 20px;"></span></span>
          </label>
          <label style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700;">
            Skip short
            <span class="switch" style="width: 36px; height: 20px;"><input type="checkbox" id="skip-short-toggle" ${state.skipLlmForShortDictations !== false ? 'checked' : ''} /><span class="slider" style="border-radius: 20px;"></span></span>
          </label>
          <select id="formatter-model" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 11.5px; background: white;">
            <option value="fast_3b" ${state.formatterModel !== 'quality_7b' ? 'selected' : ''}>Offline AI Model: Fast</option>
            <option value="quality_7b" ${state.formatterModel === 'quality_7b' ? 'selected' : ''}>Offline AI Model: Quality</option>
          </select>
          <select id="formatter-tone" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 11.5px; background: white;">
            ${[
              ['natural', 'Natural'],
              ['professional', 'Professional'],
              ['casual', 'Casual'],
              ['developer_prompt', canDeveloperPrompt ? 'Developer prompt' : 'Developer prompt Pro'],
              ['short_reply', 'Short reply']
            ].map(([value, label]) => `<option value="${value}" ${state.formatterTone === value ? 'selected' : ''} ${value === 'developer_prompt' && !canDeveloperPrompt ? 'disabled' : ''}>${label}</option>`).join('')}
          </select>
          <select id="formatter-output-mode" style="grid-column: span 2; width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 11.5px; background: white;">
            <option value="transcribe" ${state.formatterOutputMode !== 'translate_to_english' ? 'selected' : ''}>Default output: Transcription</option>
            <option value="translate_to_english" ${state.formatterOutputMode === 'translate_to_english' ? 'selected' : ''} ${canMalayalamPremium ? '' : 'disabled'}>Default output: Malayalam to English${canMalayalamPremium ? '' : ' Paid'}</option>
          </select>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700;">
            Timeout
            <input id="formatter-timeout" type="number" min="500" max="15000" step="250" value="${state.formatterTimeoutMs || 2500}" style="width: 88px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 11.5px;" />
            <span style="color: var(--muted); font-size: 10px;">ms</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700;">
            Min words
            <input id="formatter-min-words" type="number" min="1" max="100" step="1" value="${state.formatterMinWords || 12}" style="width: 64px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 11.5px;" />
          </label>
          ${renderOfflineAISettingsUI()}
          <p style="grid-column: span 2; font-size: 10px; margin: 0; color: var(--muted); line-height: 1.25;">Fast uses Basic Offline Mode. Smart Offline Mode formats only when useful. Premium Offline Mode can use the quality Offline AI Model.</p>
        </div>
      </div>

      <!-- Row 2: Combined Hotkey & Dictation Mode (Spans both columns) -->
      <div class="set-card" style="grid-column: span 2; padding: 12px 16px; border-radius: 14px; margin-bottom: 0; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('keyboard')}</span>
          <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Hotkey & Dictation Mode</div>
        </div>

        <div style="display: flex; gap: 16px; align-items: stretch; margin-top: 2px;">
          <!-- Left Column: Global Hotkey Selection -->
          <div style="flex: 1.1; min-width: 0; display: flex; flex-direction: column; gap: 8px; justify-content: center;">
            <p class="set-desc" style="font-size: 11px; margin: 0; color: var(--muted);">Select the shortcut key configuration.</p>
            <div class="set-ctl-row" style="gap: 8px; display: flex; align-items: center; width: 100%;">
              <div class="kbd-display" id="hotkey-input" style="padding: 6px 10px; font-size: 12px; flex: 1; text-align: center; font-weight: 600;">${hotkeyChipsHtml(state.hotkey)}</div>
              <button class="btn-soft" id="record-hotkey" style="padding: 6px 10px; font-size: 11.5px; flex-shrink: 0;">${setIcon('record')} Record keys</button>
            </div>
          </div>

          <!-- Vertical Divider -->
          <div style="width: 1px; background: var(--border); align-self: stretch; margin: 0 4px;"></div>

          <!-- Right Column: Dictation Mode Selector -->
          <div style="flex: 1.2; min-width: 0; display: flex; flex-direction: column; gap: 8px; justify-content: center;">
            <p class="set-desc" style="font-size: 11px; margin: 0; color: var(--muted);">${pt ? 'Hold key to speak, release to paste.' : 'Tap shortcut to start/stop dictation.'}</p>
            <div class="set-ctl" style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div class="seg" style="padding: 3px; display: inline-flex;">
                  <button class="seg-btn ${pt ? 'seg-active' : ''}" data-mode="pushToTalk" style="padding: 5px 10px; font-size: 11.5px;">Push to talk</button>
                  <button class="seg-btn ${!pt ? 'seg-active' : ''}" data-mode="toggle" style="padding: 5px 10px; font-size: 11.5px;">Toggle on/off</button>
                </div>
                ${pt ? `
                  <div class="chip-row" style="gap: 4px; display: inline-flex;">
                    ${['Alt', 'Meta', 'Ctrl', 'Shift'].map((mod) => `
                      <button class="chip ${state.hotkey === mod ? 'chip-active' : ''}" data-holdkey="${mod}" style="padding: 4px 8px; font-size: 10.5px;">${holdKeyLabel(mod)}</button>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 3: Brain Switch Card (Spans both columns) -->
      <div class="set-card" style="grid-column: span 2; padding: 12px 16px; border-radius: 14px; margin-bottom: 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('shield')}</span>
          <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Safety & dictionaries</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: center;">
          ${[
            ['enable-global-dictionary-toggle', 'Global dictionary', state.enableGlobalDictionary !== false],
            ['enable-personal-dictionary-toggle', 'Personal dictionary', state.enablePersonalDictionary !== false && canPersonalDictionary, canPersonalDictionary],
            ['enable-text-snippets-toggle', 'Text snippets', state.enableTextSnippets !== false && canTextSnippets, canTextSnippets],
            ['preserve-clipboard-toggle', 'Preserve clipboard', state.preserveClipboard !== false && canAdvancedClipboard, canAdvancedClipboard]
          ].map(([id, label, checked, allowed = true]) => `
            <label style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700;">
              <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${label}${allowed ? '' : ' Paid'}</span>
              <span class="switch" style="width: 36px; height: 20px; flex-shrink: 0;"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${allowed ? '' : 'disabled'} /><span class="slider" style="border-radius: 20px;"></span></span>
            </label>
          `).join('')}
          <label style="display: flex; align-items: center; gap: 8px; grid-column: span 2; font-size: 11.5px; font-weight: 700;">
            Restore clipboard delay
            <input id="restore-clipboard-delay" type="number" min="0" max="5000" step="50" value="${state.restoreClipboardDelay || 600}" style="width: 92px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 11.5px;" />
            <span style="color: var(--muted); font-size: 10px;">ms</span>
          </label>
        </div>
      </div>

      <div class="set-card" style="grid-column: span 2; padding: 12px 16px; border-radius: 14px; margin-bottom: 0;">
        <div class="set-info" style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('brain')}</span>
            <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Brain Switch</div>
          </div>
          <p class="set-desc" style="font-size: 11px; margin: 2px 0 0; color: var(--muted);">Choose offline speech models.</p>
        </div>
        <div id="brain-panel">${renderBrainPanel(modelsCache)}</div>
      </div>
    </div>
  `;
}

// Compact Brain Switch panel: horizontal 2-column layout that updates on preview.
function renderBrainPanel(models) {
  if (!models || !models.length) {
    return '<p class="set-desc" style="padding:4px 0; font-size: 11px;">Loading models…</p>';
  }

  // Find the currently previewed model details
  const preview = models.find((m) => m.id === previewModelId)
    || models.find((m) => m.active) || models[0];

  const selectors = models.map((m) => {
    let stateIcon = '';
    if (m.locked) {
      stateIcon = `<span style="color: var(--muted); opacity: 0.6; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px;">${setIcon('shield')}</span>`;
    } else if (m.active) {
      stateIcon = `<span style="color: var(--accent); display: flex; align-items: center; justify-content: center; width: 14px; height: 14px;">${setIcon('check')}</span>`;
    } else if (m.downloaded) {
      stateIcon = `<span style="color: #1f6f63; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px;">${setIcon('check')}</span>`;
    } else {
      stateIcon = `<span style="color: var(--muted); opacity: 0.6; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px;">${setIcon('download')}</span>`;
    }

    const isSelected = m.id === preview.id;
    const borderStyle = isSelected 
      ? 'border-color: var(--accent); background: var(--accent-soft); font-weight: 700;' 
      : 'border-color: var(--border); background: #ffffff;';

    return `
      <button class="brain-selector-btn ${isSelected ? 'active' : ''}" data-preview-model="${m.id}" type="button" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 10px; cursor: pointer; transition: all 0.2s; ${borderStyle}">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12.5px; font-weight: 700; color: var(--text);">${escapeHtml(m.label)}</span>
          <span style="font-size: 10.5px; color: var(--muted); font-weight: 600;">${formatBytes(m.bytes)}</span>
        </div>
        ${stateIcon}
      </button>
    `;
  }).join('');

  let actionHtml = '';
  let statusText = '';
  let borderStyle = '';
  let badgeHtml = '';
  
  if (preview.id === 'small-q5_1') {
    badgeHtml = `<span class="model-tag" style="padding: 2px 6px; font-size: 10px; font-weight: 700; border-radius: 6px; background: rgba(224, 30, 65, 0.08); color: var(--accent); margin-left: 6px;">Recommended</span>`;
  }
  if (preview.locked) {
    badgeHtml += `<span class="model-tag" style="padding: 2px 6px; font-size: 10px; font-weight: 700; border-radius: 6px; background: rgba(40, 44, 52, 0.06); color: var(--muted); margin-left: 6px;">Paid</span>`;
  }
  
  if (preview.locked) {
    actionHtml = `<button class="btn-soft" data-locked-model="${preview.id}" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 8px;">Upgrade</button>`;
    statusText = 'Plan Required';
    borderStyle = 'border-color: var(--border); box-shadow: var(--shadow-card); background: #ffffff;';
  } else if (preview.active) {
    actionHtml = `<span class="model-active-pill" style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 750; color: var(--accent);">${setIcon('check')} Active</span>`;
    statusText = 'Currently Active';
    borderStyle = 'border-color: var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.06), var(--shadow-card); background: rgba(var(--accent-rgb), 0.01);';
  } else if (preview.downloaded) {
    actionHtml = `<button class="btn-soft" data-use-model="${preview.id}" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 8px;">Use this model</button>`;
    statusText = 'Ready to Use';
    borderStyle = 'border-color: var(--border); box-shadow: var(--shadow-card); background: #ffffff;';
  } else {
    actionHtml = `<button class="btn-soft model-dl" data-download-model="${preview.id}" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">${setIcon('download')} Download</button>`;
    statusText = 'Needs Download';
    borderStyle = 'border-color: var(--border); box-shadow: var(--shadow-card); background: #ffffff;';
  }

  return `
    <div style="display: flex; gap: 16px; align-items: stretch; flex-wrap: wrap; width: 100%;">
      <!-- Left: 4 selector items -->
      <div class="brain-selectors" style="display: flex; flex-direction: column; gap: 6px; flex: 1.1; min-width: 200px;">
        ${selectors}
      </div>
      <!-- Right: Explanation Card -->
      <div class="brain-detail-card" style="flex: 1.5; min-width: 280px; display: flex;">
        <div class="brain-box" style="flex: 1; border: 1.5px solid var(--border); border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; transition: all 0.25s ease; ${borderStyle}">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
              <span class="brain-box-title" style="font-weight: 850; font-size: 13.5px; color: var(--text);">${escapeHtml(preview.label)}</span>
              <span class="brain-box-size" style="font-size: 11px; color: var(--muted); font-weight: 600;">${formatBytes(preview.bytes)}</span>
              ${badgeHtml}
            </div>
            <p class="brain-box-desc" style="font-size: 11.5px; line-height: 1.45; color: var(--muted); margin: 0; font-weight: 500;">${escapeHtml(preview.desc)}</p>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; border-top: 1px solid var(--border); padding-top: 8px;">
            <span style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.02em;">${statusText}</span>
            <div class="brain-box-action" id="brain-action-${preview.id}">${actionHtml}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function brainActionHtml(m) {
  // Kept for backward compatibility, unused in direct card display
  if (m.active) return `<span class="model-active-pill">${setIcon('check')} Active</span>`;
  if (m.downloaded) return `<button class="btn-soft" data-use-model="${m.id}">Use this brain</button>`;
  return `<button class="btn-soft model-dl" data-download-model="${m.id}">${setIcon('download')} Download · ${formatBytes(m.bytes)}</button>`;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  return Math.round(bytes / (1024 * 1024)) + ' MB';
}

// Re-renders just the Brain Switch panel (not the whole settings view) and
// re-binds its controls.
function renderBrainSwitch() {
  const panel = document.getElementById('brain-panel');
  if (!panel) return;
  panel.innerHTML = renderBrainPanel(modelsCache);
  bindBrainControls();
}

function bindBrainControls() {
  // Clicking a pill previews that model in the detail box (doesn't switch yet).
  document.querySelectorAll('[data-preview-model]').forEach((btn) => {
    btn.onclick = () => { previewModelId = btn.dataset.previewModel; renderBrainSwitch(); };
  });
  document.querySelectorAll('[data-use-model]').forEach((btn) => {
    btn.onclick = async () => {
      if (!canUseModel(btn.dataset.useModel)) {
        lastPasteError = "This model requires an active paid plan.";
        render();
        openProfileModal();
        return;
      }
      modelsCache = await window.parayu.selectModel(btn.dataset.useModel);
      renderBrainSwitch();
    };
  });
  document.querySelectorAll('[data-download-model]').forEach((btn) => {
    btn.onclick = () => {
      if (!canUseModel(btn.dataset.downloadModel)) {
        lastPasteError = "This model requires an active paid plan.";
        render();
        openProfileModal();
        return;
      }
      startModelDownload(btn.dataset.downloadModel);
    };
  });
  document.querySelectorAll('[data-locked-model]').forEach((btn) => {
    btn.onclick = () => {
      lastPasteError = "This model requires an active paid plan.";
      render();
      openProfileModal();
    };
  });
}

async function startModelDownload(id) {
  previewModelId = id;
  const action = document.getElementById(`brain-action-${id}`);
  if (action) {
    action.innerHTML = `<div class="model-progress" style="width: 70px; height: 5px; border-radius: 3px; background: #eceae3; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 6px;"><i id="dl-bar" style="display: block; height: 100%; width: 0%; background: var(--accent-grad); transition: width 0.15s;"></i></div><span class="model-progress-pct" id="dl-pct" style="font-size: 11px; font-weight: 700; color: var(--muted); vertical-align: middle;">0%</span>`;
  }

  const result = await window.parayu.downloadModel(id);
  modelsCache = result.models;

  if (result.ok) {
    // Downloaded — make it the active brain so it works offline right away.
    modelsCache = await window.parayu.selectModel(id);
  } else {
    renderBrainSwitch();
    alert('Download failed: ' + (result.error || 'unknown error') + '\nCheck your connection and try again.');
    return;
  }
  renderBrainSwitch();
}

// Fetch the catalog (once) and render the live panel. Registers the download
// progress listener a single time.
async function wireBrainSwitch() {
  if (!brainProgressBound) {
    window.parayu.onModelDownloadProgress(({ pct }) => {
      const p = Math.round((pct || 0) * 100);
      const bar = document.getElementById('dl-bar');
      const lbl = document.getElementById('dl-pct');
      if (bar) bar.style.width = p + '%';
      if (lbl) lbl.textContent = p + '%';
    });
    brainProgressBound = true;
  }
  modelsCache = await window.parayu.listModels();
  if (!previewModelId) {
    const active = modelsCache.find((m) => m.active);
    previewModelId = active ? active.id : 'small-q5_1';
  }
  renderBrainSwitch();
}
let brainProgressBound = false;

function hotkeyPartLabel(p) {
  return {
    Command: '⌘ Command', Cmd: '⌘ Command', Meta: '⌘ Command',
    Control: '⌃ Control', Ctrl: '⌃ Control', Alt: '⌥ Option', Option: '⌥ Option',
    Shift: '⇧ Shift', Space: 'Space'
  }[p] || p;
}

function hotkeyChipsHtml(accel) {
  const parts = (accel || '').split('+').filter(Boolean);
  if (!parts.length) return '<span class="kbd-empty">Not set</span>';
  return parts.map((p) => `<span class="kbd">${escapeHtml(hotkeyPartLabel(p))}</span>`).join('<span class="kbd-plus">+</span>');
}

function meterBarsHtml(n = 16) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const h = 6 + Math.round(Math.abs(Math.sin((i / n) * Math.PI)) * 14);
    out += `<span style="height:${h}px"></span>`;
  }
  return out;
}

function setIcon(name) {
  const s = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const icons = {
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    keyboard: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/>',
    ai: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M19 17H6a2 2 0 0 0-2 2"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    record: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 2z"/>',
    brain: '<path d="M9.5 3A3 3 0 0 0 7 7.5a3 3 0 0 0-1 5.8V16a3 3 0 0 0 3.5 3 2.5 2.5 0 0 0 5 0A3 3 0 0 0 18 16v-2.7a3 3 0 0 0-1-5.8A3 3 0 0 0 14.5 3a2.5 2.5 0 0 0-5 0z"/><path d="M12 3v18"/>',
    download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
    check: '<polyline points="20 6 9 17 4 12"/>'
  };
  return s(icons[name] || '');
}

function micIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>`;
}

async function populateMicSelect() {
  const trigger = document.getElementById('mic-trigger');
  const current = document.getElementById('mic-current');
  const menu = document.getElementById('mic-menu');
  const status = document.getElementById('mic-status');
  if (!trigger || !menu) return;

  try {
    // List devices first — this resolves instantly and never blocks on a
    // permission prompt, so the UI can't get stuck on "Loading…".
    let devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');

    // Empty labels mean mic permission hasn't been granted yet. Show an
    // explicit "Enable" action (a user gesture reliably triggers the prompt)
    // instead of silently awaiting getUserMedia, which can hang.
    const hasLabels = devices.some((d) => d.label);
    if (!hasLabels) {
      current.textContent = 'Enable microphone access';
      if (status) status.innerHTML = '';
      const btn = document.createElement('button');
      btn.textContent = 'Grant microphone access';
      btn.style.marginTop = '6px';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Requesting…';
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach((t) => t.stop());
          await populateMicSelect();
        } catch (_e) {
          if (status) status.textContent = 'Microphone access was denied. Enable it in System Settings → Privacy & Security → Microphone.';
        }
      };
      if (status) status.appendChild(btn);
      return;
    }

    const options = [{ id: '', label: 'System default' }].concat(
      devices.map((d) => ({ id: d.deviceId, label: cleanMicLabel(d.label) }))
    );
    const activeId = devices.some((d) => d.deviceId === state.micDeviceId) ? state.micDeviceId : '';

    const renderLabel = (id) => {
      const opt = options.find((o) => o.id === (id || '')) || options[0];
      current.textContent = opt.label;
    };
    renderLabel(activeId);

    menu.innerHTML = options.map((o) => `
      <button class="dd-item ${o.id === (activeId || '') ? 'dd-item-active' : ''}" type="button" data-id="${escapeHtml(o.id)}">
        <span class="dd-item-icon">${micIconSvg()}</span>
        <span class="dd-item-label">${escapeHtml(o.label)}</span>
        <span class="dd-item-check">${o.id === (activeId || '') ? checkSvg() : ''}</span>
      </button>
    `).join('');

    const closeMenu = () => { menu.hidden = true; trigger.classList.remove('dd-open'); };
    const openMenu = () => {
      // Open upward if there isn't room below, so the menu never pushes the
      // window into scrolling — only the menu itself scrolls internally.
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      menu.classList.toggle('up', spaceBelow < 260);
      menu.hidden = false;
      trigger.classList.add('dd-open');
    };

    trigger.onclick = (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu(); else closeMenu();
    };
    // Re-using a single named handler (removed before re-adding) prevents the
    // listener from accumulating every time Settings is re-rendered.
    document.removeEventListener('click', micOutsideClick);
    micOutsideClick = closeMenu;
    document.addEventListener('click', micOutsideClick);

    menu.querySelectorAll('.dd-item').forEach((item) => {
      item.onclick = async (e) => {
        e.stopPropagation();
        const id = item.dataset.id || null;
        await window.parayu.setMicDevice(id);
        state.micDeviceId = id;
        renderLabel(id || '');
        menu.querySelectorAll('.dd-item').forEach((el) => {
          const on = (el.dataset.id || '') === (id || '');
          el.classList.toggle('dd-item-active', on);
          el.querySelector('.dd-item-check').innerHTML = on ? checkSvg() : '';
        });
        if (status) status.textContent = 'Saved.';
        closeMenu();
      };
    });
  } catch (e) {
    current.textContent = 'Microphone access denied';
    if (status) status.textContent = 'Grant microphone permission to choose an input device.';
  }
}

// Strips noisy "(Built-in)" / vendor hex ids macOS appends to device labels.
function cleanMicLabel(label) {
  if (!label) return 'Microphone';
  return label.replace(/\s*\([0-9a-fx:]+\)\s*$/i, '').trim() || 'Microphone';
}

function checkSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function wireView() {
  document.querySelectorAll('nav .item').forEach((el) => {
    el.onclick = () => setView(el.dataset.view);
  });

  document.querySelectorAll('[data-ins-tab]').forEach((btn) => {
    btn.onclick = () => { insightsTab = btn.dataset.insTab; render(); };
  });

  document.querySelectorAll('.history-card').forEach((el) => {
    el.ondblclick = async () => {
      try {
        await navigator.clipboard.writeText(el.dataset.copy);
        el.classList.add('show-copied');
        setTimeout(() => el.classList.remove('show-copied'), 1200);
      } catch (_e) { /* clipboard unavailable */ }
    };
  });

  document.querySelectorAll('[data-remove-dict]').forEach((el) => {
    el.onclick = async () => { await window.parayu.removeDictionaryEntry(Number(el.dataset.removeDict)); refresh(); };
  });
  document.querySelectorAll('[data-remove-snippet]').forEach((el) => {
    el.onclick = async () => { await window.parayu.removeSnippet(Number(el.dataset.removeSnippet)); refresh(); };
  });

  const addDict = document.getElementById('add-dict');
  if (addDict) addDict.onclick = async () => {
    const from = document.getElementById('dict-from').value.trim();
    const to = document.getElementById('dict-to').value.trim();
    if (!from || !to) return;
    await window.parayu.addDictionaryEntry({ from, to });
    refresh();
  };

  const addSnippet = document.getElementById('add-snippet');
  if (addSnippet) addSnippet.onclick = async () => {
    const trigger = document.getElementById('snippet-trigger').value.trim();
    const expansion = document.getElementById('snippet-expansion').value.trim();
    if (!trigger || !expansion) return;
    await window.parayu.addSnippet({ trigger, expansion });
    refresh();
  };

  const recordBtn = document.getElementById('record-hotkey');
  if (recordBtn) recordBtn.onclick = () => startHotkeyCapture();

  if (document.getElementById('mic-trigger')) populateMicSelect();

  const subscriptionRefreshBtn = document.getElementById('subscription-refresh-btn');
  if (subscriptionRefreshBtn) subscriptionRefreshBtn.onclick = async () => {
    const status = document.getElementById('subscription-refresh-status');
    const original = subscriptionRefreshBtn.innerHTML;
    subscriptionRefreshBtn.disabled = true;
    subscriptionRefreshBtn.innerHTML = `${setIcon('refresh')} Checking…`;
    if (status) status.textContent = 'Refreshing subscription…';
    const result = await window.parayu.refreshSubscription();
    if (result && result.state) state.subscription = result.state;
    if (status) {
      if (result.ok) status.textContent = result.deferred ? 'Refresh will run after dictation finishes.' : 'Subscription refreshed.';
      else status.textContent = result.offline ? 'No internet connection. Offline grace rules are being used.' : (result.error || 'Refresh failed. Free dictation remains available.');
    }
    subscriptionRefreshBtn.disabled = false;
    subscriptionRefreshBtn.innerHTML = original;
    await refresh();
  };

  const aiToggle = document.getElementById('ai-cleanup-toggle');
  if (aiToggle) aiToggle.onchange = async () => {
    state.aiCleanup = await window.parayu.setAiCleanup(aiToggle.checked);
  };

  const aiFormatterToggle = document.getElementById('ai-formatter-toggle');
  if (aiFormatterToggle) aiFormatterToggle.onchange = async () => {
    state.aiFormatterEnabled = await window.parayu.setAiFormatterEnabled(aiFormatterToggle.checked);
  };

  document.querySelectorAll('[data-cleanup-mode]').forEach((btn) => {
    btn.onclick = async () => {
      state.cleanupMode = await window.parayu.setCleanupMode(btn.dataset.cleanupMode);
      await refresh();
    };
  });

  const alwaysFormatToggle = document.getElementById('always-format-toggle');
  if (alwaysFormatToggle) alwaysFormatToggle.onchange = async () => {
    state.alwaysFormat = await window.parayu.setAlwaysFormat(alwaysFormatToggle.checked);
  };

  const formatterModel = document.getElementById('formatter-model');
  if (formatterModel) formatterModel.onchange = async () => {
    state.formatterModel = await window.parayu.setFormatterModel(formatterModel.value);
    state.offlineAIStatus = await window.parayu.offlineAIStatus();
    await refresh();
  };

  const formatterTone = document.getElementById('formatter-tone');
  if (formatterTone) formatterTone.onchange = async () => {
    state.formatterTone = await window.parayu.setFormatterTone(formatterTone.value);
  };

  const formatterOutputMode = document.getElementById('formatter-output-mode');
  if (formatterOutputMode) formatterOutputMode.onchange = async () => {
    state.formatterOutputMode = await window.parayu.setFormatterOutputMode(formatterOutputMode.value);
  };

  const formatterTimeout = document.getElementById('formatter-timeout');
  if (formatterTimeout) formatterTimeout.onchange = async () => {
    state.formatterTimeoutMs = await window.parayu.setFormatterTimeout(formatterTimeout.value);
    formatterTimeout.value = state.formatterTimeoutMs;
  };

  const skipShortToggle = document.getElementById('skip-short-toggle');
  if (skipShortToggle) skipShortToggle.onchange = async () => {
    state.skipLlmForShortDictations = await window.parayu.setSkipLlmForShortDictations(skipShortToggle.checked);
  };

  const formatterMinWords = document.getElementById('formatter-min-words');
  if (formatterMinWords) formatterMinWords.onchange = async () => {
    state.formatterMinWords = await window.parayu.setFormatterMinWords(formatterMinWords.value);
    formatterMinWords.value = state.formatterMinWords;
  };

  const downloadOfflineAI = document.getElementById('download-offline-ai');
  if (downloadOfflineAI) downloadOfflineAI.onclick = async () => {
    downloadOfflineAI.disabled = true;
    await window.parayu.downloadOfflineAIModel(downloadOfflineAI.dataset.model || state.formatterModel || 'fast_3b');
    state.offlineAIStatus = await window.parayu.offlineAIStatus();
    await refresh();
  };

  const globalDictToggle = document.getElementById('enable-global-dictionary-toggle');
  if (globalDictToggle) globalDictToggle.onchange = async () => {
    state.enableGlobalDictionary = await window.parayu.setEnableGlobalDictionary(globalDictToggle.checked);
  };

  const personalDictToggle = document.getElementById('enable-personal-dictionary-toggle');
  if (personalDictToggle) personalDictToggle.onchange = async () => {
    state.enablePersonalDictionary = await window.parayu.setEnablePersonalDictionary(personalDictToggle.checked);
  };

  const snippetsToggle = document.getElementById('enable-text-snippets-toggle');
  if (snippetsToggle) snippetsToggle.onchange = async () => {
    state.enableTextSnippets = await window.parayu.setEnableTextSnippets(snippetsToggle.checked);
  };

  const preserveClipboardToggle = document.getElementById('preserve-clipboard-toggle');
  if (preserveClipboardToggle) preserveClipboardToggle.onchange = async () => {
    state.preserveClipboard = await window.parayu.setPreserveClipboard(preserveClipboardToggle.checked);
  };

  const restoreDelayInput = document.getElementById('restore-clipboard-delay');
  if (restoreDelayInput) restoreDelayInput.onchange = async () => {
    state.restoreClipboardDelay = await window.parayu.setRestoreClipboardDelay(restoreDelayInput.value);
    restoreDelayInput.value = state.restoreClipboardDelay;
  };

  const translateToggle = document.getElementById('translate-malayalam-toggle');
  if (translateToggle) translateToggle.onchange = async () => {
    state.translateMalayalam = await window.parayu.setTranslateMalayalam(translateToggle.checked);
    await refresh();
  };

  const boostToggle = document.getElementById('boost-quiet-voices-toggle');
  if (boostToggle) boostToggle.onchange = async () => {
    state.boostQuietVoices = await window.parayu.setBoostQuietVoices(boostToggle.checked);
  };

  const nsToggle = document.getElementById('noise-suppression-toggle');
  if (nsToggle) nsToggle.onchange = async () => {
    state.noiseSuppression = await window.parayu.setNoiseSuppression(nsToggle.checked);
  };

  if (document.getElementById('brain-panel')) wireBrainSwitch();

  const restoreBtn = document.getElementById('restore-defaults');
  if (restoreBtn) restoreBtn.onclick = async () => {
    await window.parayu.setDictationMode('toggle');
    await window.parayu.setHotkey('Command+Shift+Space');
    await window.parayu.setAiCleanup(true);
    await window.parayu.setMicDevice(null);
    await window.parayu.setInputLanguage('en');
    await window.parayu.setAiFormatterEnabled(false);
    await window.parayu.setCleanupMode('smart');
    await window.parayu.setAlwaysFormat(false);
    await window.parayu.setFormatterProvider('private_offline');
    await window.parayu.setFormatterOutputMode('transcribe');
    await window.parayu.setFormatterTone('natural');
    await window.parayu.setFormatterTimeout(2500);
    await window.parayu.setFormatterModel('fast_3b');
    await window.parayu.setSkipLlmForShortDictations(true);
    await window.parayu.setFormatterMinWords(12);
    await window.parayu.setLocalOnlyMode(true);
    await window.parayu.setPreserveClipboard(true);
    await window.parayu.setRestoreClipboardDelay(600);
    await window.parayu.setEnablePersonalDictionary(true);
    await window.parayu.setEnableGlobalDictionary(true);
    await window.parayu.setEnableTextSnippets(true);
    await window.parayu.setTranslateMalayalam(true);
    await window.parayu.setBoostQuietVoices(true);
    await window.parayu.setNoiseSuppression(true);
    state.micDeviceId = null;
    await refresh();
  };

  const micTestBtn = document.getElementById('mic-test-btn');
  if (micTestBtn) micTestBtn.onclick = () => toggleMicTest(micTestBtn);

  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.onclick = async () => {
      state.dictationMode = await window.parayu.setDictationMode(btn.dataset.mode);
      await refresh();
    };
  });

  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.onclick = async () => {
      if (btn.dataset.lang === 'ml' && !featureEnabled('malayalam_to_english_premium')) {
        lastPasteError = proFeatureMessage('Malayalam dictation and translation');
        render();
        openProfileModal();
        return;
      }
      state.inputLanguage = await window.parayu.setInputLanguage(btn.dataset.lang);
      await refresh();
    };
  });

  document.querySelectorAll('[data-holdkey]').forEach((btn) => {
    btn.onclick = async () => {
      const result = await window.parayu.setHotkey(btn.dataset.holdkey);
      state.hotkey = result.hotkey;
      // Saved, but the global hook can't attach until the OS permission is
      // granted — tell the user instead of letting it silently not work.
      lastPasteError = result.pending
        ? 'Hold-to-talk is set, but needs Accessibility / Input-Monitoring permission to work. Enable Parayu in System Settings → Privacy & Security, then return here — it activates automatically.'
        : null;
      render();
    };
  });

  // Profile & Subscription Modal interactions
  const profileWidget = document.querySelector('.user-profile');
  if (profileWidget) {
    profileWidget.onclick = () => openProfileModal();
  }
  
  const closeBtn = document.getElementById('close-profile-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      const modal = document.getElementById('profile-modal');
      if (modal) modal.style.display = 'none';
    };
  }
  
  // Modal plan card click selectors
  document.querySelectorAll('.plan-card').forEach((card) => {
    card.onclick = () => selectPlanCard(card.dataset.plan);
  });

  // Tab buttons click triggers
  const tabSignup = document.getElementById('tab-signup-btn');
  const tabSignin = document.getElementById('tab-signin-btn');
  if (tabSignup) tabSignup.onclick = () => setAuthMode('signup');
  if (tabSignin) tabSignin.onclick = () => setAuthMode('signin');

  const demoFillBtn = document.getElementById('dev-demo-fill-btn');
  if (demoFillBtn) {
    demoFillBtn.onclick = () => {
      setAuthMode('signin');
      const emailInput = document.getElementById('auth-email-input');
      const passInput = document.getElementById('auth-password-input');
      if (emailInput) emailInput.value = DEV_DEMO_EMAIL;
      if (passInput) passInput.value = DEV_DEMO_PASSWORD;
    };
  }

  // Google sign in / sign up trigger
  const googleAuthBtn = document.getElementById('google-auth-trigger-btn');
  if (googleAuthBtn) {
    googleAuthBtn.onclick = async () => {
      googleAuthBtn.disabled = true;
      const origHtml = googleAuthBtn.innerHTML;
      googleAuthBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;animation:spin 1s linear infinite;margin-right:8px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        <span>Connecting with Google…</span>
      `;
      
      try {
        const updatedProfile = await window.parayu.googleLogin();
        state.userProfile = updatedProfile;
        
        // Show success and transition
        openProfileModal(); // This will automatically display the profile container since registered is now true!
      } catch (err) {
        console.error('Google Auth Error:', err);
        alert(`Google Authentication failed: ${err.message || err}`);
      } finally {
        googleAuthBtn.disabled = false;
        googleAuthBtn.innerHTML = origHtml;
        await refresh();
      }
    };
  }

  // Auth form manual submit (Sign Up / Sign In)
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email-input').value.trim();
      const pass = document.getElementById('auth-password-input').value.trim();
      let name = '';

      if (state.flavor === 'dev' && email.toLowerCase() === DEV_DEMO_EMAIL) {
        if (pass !== DEV_DEMO_PASSWORD) {
          alert('Invalid Dev demo credentials.');
          return;
        }
        const result = await activateDevDemoAccess();
        if (!result || !result.ok) {
          alert((result && result.error) || 'Dev demo login failed.');
          return;
        }
        openProfileModal();
        return;
      }
      
      if (authMode === 'signup') {
        name = document.getElementById('auth-name-input').value.trim();
      } else {
        name = email.split('@')[0];
        // capitalize name nicely
        name = name.charAt(0).toUpperCase() + name.slice(1);
      }
      
      const updatedProfile = await window.parayu.saveProfile({
        registered: true,
        name: name || 'User',
        email,
        plan: 'Base Plan' // manual register gets Base Plan by default
      });
      
      state.userProfile = updatedProfile;
      openProfileModal(); // Switch to profile view
      await refresh();
    };
  }

  // Subscription form submit
  const subscriptionForm = document.getElementById('subscription-form');
  if (subscriptionForm) {
    subscriptionForm.onsubmit = async (e) => {
      e.preventDefault();
      if (window.parayu.openPricingPage) await window.parayu.openPricingPage();
      await refresh();
    };
  }

  // Sign out handler
  const subSignoutBtn = document.getElementById('sub-signout-btn');
  if (subSignoutBtn) {
    subSignoutBtn.onclick = async () => {
      const updatedProfile = await window.parayu.googleLogout();
      state.userProfile = updatedProfile;
      openProfileModal(); // Switch back to auth view
      await refresh();
    };
  }

  if (currentView === 'screenwriting') wireScreenwriting();
}

function holdKeyLabel(mod) {
  return { Alt: '⌥ Option', Meta: '⌘ Command', Ctrl: '⌃ Control' }[mod] || mod;
}

// e.code (physical key) is used instead of e.key, because on macOS holding
// Option remaps e.key to special unicode characters (e.g. Option+S -> 'ß').
const CODE_TO_ACCELERATOR_KEY = {
  Space: 'Space', Escape: 'Esc', ArrowUp: 'Up', ArrowDown: 'Down',
  ArrowLeft: 'Left', ArrowRight: 'Right', Enter: 'Return', Tab: 'Tab',
  Backspace: 'Backspace', Delete: 'Delete'
};

function codeToKey(code) {
  if (CODE_TO_ACCELERATOR_KEY[code]) return CODE_TO_ACCELERATOR_KEY[code];
  const letterOrDigit = code.match(/^(?:Key|Digit)([A-Z0-9])$/);
  if (letterOrDigit) return letterOrDigit[1];
  const fKey = code.match(/^F([0-9]+)$/);
  if (fKey) return code;
  return null; // unsupported physical key (modifier itself, etc.)
}

function eventToAccelerator(e) {
  const parts = [];
  if (e.metaKey) parts.push('Command');
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  if (parts.length === 0) return null; // require at least one modifier

  const key = codeToKey(e.code);
  if (!key) return null; // only modifiers held so far — keep listening

  parts.push(key);
  return parts.join('+');
}

let hotkeyCaptureTimeout = null;
let hotkeyCaptureCleanup = null; // set while a capture is active so setView() can abort it

function startHotkeyCapture() {
  const disp = document.getElementById('hotkey-input');
  const status = document.getElementById('hotkey-status');
  disp.classList.add('capturing');
  disp.innerHTML = '<span class="kbd-empty">Press your key combo…</span>';
  status.innerHTML = `${setIcon('info')}<span>Listening… hold a modifier (⌘ / ⌃ / ⌥ / ⇧) and tap a key, e.g. Option + Command + Space.</span>`;

  clearTimeout(hotkeyCaptureTimeout);
  const cleanup = () => {
    document.removeEventListener('keydown', handler, true);
    clearTimeout(hotkeyCaptureTimeout);
    if (disp) disp.classList.remove('capturing');
    hotkeyCaptureCleanup = null;
  };
  hotkeyCaptureCleanup = cleanup;

  const handler = async (e) => {
    e.preventDefault();
    const accelerator = eventToAccelerator(e);
    if (!accelerator) return; // still just modifiers — keep listening
    cleanup();
    disp.innerHTML = hotkeyChipsHtml(accelerator);
    status.innerHTML = `${setIcon('info')}<span>Saving…</span>`;
    const result = await window.parayu.setHotkey(accelerator);
    if (!result.ok) {
      status.innerHTML = `${setIcon('info')}<span>Could not register "${escapeHtml(accelerator)}" (probably in use by another app). Reverted to ${escapeHtml(result.hotkey)}.</span>`;
    }
    await refresh();
  };
  document.addEventListener('keydown', handler, true);

  hotkeyCaptureTimeout = setTimeout(() => {
    cleanup();
    status.innerHTML = `${setIcon('info')}<span>Timed out — a modifier-only combo isn't enough, the OS requires a regular key too. Click "Record keys" and try again.</span>`;
    disp.innerHTML = hotkeyChipsHtml(state.hotkey);
  }, 8000);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Dev-only: push-to-talk for the Dataset Studio page. Main only emits this while
// the Studio page is the focused view, so dictation is never triggered here.
window.parayu.onTrainerToggleRecording((shouldRecord) => {
  if (window.__parayuTrainerPTT) window.__parayuTrainerPTT(shouldRecord);
});

if (window.parayu.onSubscriptionUpdated) {
  window.parayu.onSubscriptionUpdated(async (status) => {
    state.subscription = status;
    await refresh();
  });
}

window.parayu.onTranslationSetupProgress((message) => {
  if (screenwritingSetupStatus && screenwritingSetupStatus.state === 'installing') {
    screenwritingSetupStatus.message = message;
    if (currentView === 'screenwriting') render();
  }
});

if (window.parayu.onOfflineAIStatus) {
  window.parayu.onOfflineAIStatus((status) => {
    state.offlineAIStatus = status;
    if (currentView === 'settings') render();
  });
}

window.parayu.onToggleRecording(async (shouldRecord) => {
  const stats = state.stats || {};
  const total = stats.totalWords || 0;
  
  if (shouldRecord && subscription().plan === 'free' && total >= 1000) {
    recording = false;
    window.parayu.notifyRecordingStopped();
    lastPasteError = "Word limit reached (1,000 words). Upgrade your plan to continue using Parayu.";
    render();
    openProfileModal();
    return;
  }

  recording = shouldRecord;
  window.updateRecordingUI();
  if (shouldRecord) {
    if (micTest) stopMicTest(document.getElementById('mic-test-btn'));
    try {
      await recorder.start(state.micDeviceId, (level) => window.parayu.sendLevel(level), {
        noiseSuppression: state.noiseSuppression !== false,
        autoGainControl: state.boostQuietVoices !== false
      });
    } catch (_e) {
      // Mic permission denied, device unplugged, or device in use. Reset state
      // on both sides so the loop isn't left wedged in "listening", and tell the
      // user instead of failing silently.
      recording = false;
      recorder.cleanup();
      window.parayu.notifyRecordingStopped();
      lastPasteError = "Couldn't access the microphone. Check System Settings → Privacy & Security → Microphone, then try again.";
      render();
    }
  } else {
    const wav = recorder.stop();
    window.updateRecordingUI();
    // start() may have failed, in which case there's nothing to transcribe.
    if (!wav) { await refresh(); return; }
    try {
      const result = await window.parayu.transcribeAudio(wav);
      lastPasteError = result.pasteError || null;
      if (result.text && currentView === 'screenwriting' && isProOrEnterprise()) handleScreenwritingSegment(result.text);
    } catch (_e) {
      // Model load/download/inference failure — surface it instead of swallowing.
      lastPasteError = `Transcription failed: ${_e.message || _e}`;
    }
    await refresh();
  }
});

let selectedPlan = 'pro';
let pricingBilling = 'yearly';

function pricingIconSvg(kind) {
  const icons = {
    free: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    base: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 20h8M10 16l-1 4M14 16l1 4"/>',
    pro: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
    lifetime: '<path d="M3 8l4 12h10l4-12-5 4-4-7-4 7z"/><path d="M7 20h10"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;">${icons[kind] || icons.base}</svg>`;
}

function pricingPlansForBilling() {
  const baseFeatures = [
    '<strong>5,000 + 5,000 words</strong> English & Fluid Malayalam Vocal Support / mo',
    '<strong>3 speech brains (up to 0.24B parameters)</strong> excludes Medium & Large brains',
    '<strong>Custom dictionary</strong> abbreviation shortcuts',
    '<strong>System-wide paste</strong> ⌥ Space hotkey'
  ];
  const proFeatures = [
    '<strong>Unlimited dictation in English, Malayalam, & 90+ languages</strong>',
    '<strong>All speech brains (up to 1.55B parameters)</strong> includes Tiny, Base, Small, Medium, Large',
    '<strong>Fluid Malayalam Vocal Support</strong> built-in conversational intelligence',
    '<strong>Premium AI cleanup</strong> corrects grammar & pauses',
    '<strong>AI tone styling</strong> professional, casual, etc.'
  ];
  const lifetimeFeatures = [
    '<strong>Pay once</strong> own the product forever',
    '<strong>Lifetime updates</strong> included at no extra cost',
    '<strong>No recurring fees</strong> no subscriptions ever',
    '<strong>Everything in Pro Plan</strong> all premium features',
    '<strong>Priority Support</strong> first-in-line customer assistance'
  ];
  if (pricingBilling === 'monthly') {
    return [
      {
        id: 'free', kind: 'free', name: 'Free Plan',
        desc: 'Essential local dictation features to test performance.',
        price: '₹0', suffix: '/month', cta: 'Get Started',
        features: [
          '<strong>1,000 words</strong> English dictation / mo',
          '<strong>Tiny English Brain (0.04B parameters)</strong> runs locally',
          '<strong>System-wide paste</strong> ⌥ Space hotkey'
        ]
      },
      {
        id: 'pro', kind: 'pro', badge: '✣ Popular', recommended: true, name: 'Pro Plan',
        desc: 'Uncapped dictation, Fluid Malayalam Vocal Support, and advanced AI cleanup tools.',
        price: '₹299', suffix: '/month', cta: 'Subscribe Now', features: proFeatures
      },
      {
        id: 'base', kind: 'base', name: 'Base Plan',
        desc: 'Essential offline dictation with expanded word limits.',
        price: '₹99', suffix: '/month', cta: 'Subscribe Now', features: baseFeatures
      }
    ];
  }
  return [
    {
      id: 'base', kind: 'base', name: 'Base Plan',
      desc: 'Essential offline dictation with expanded word limits.',
      price: '₹83', suffix: '/month', cta: 'Subscribe Now', features: baseFeatures
    },
    {
      id: 'pro', kind: 'pro', badge: '✣ Popular', recommended: true, name: 'Pro Plan',
      desc: 'Uncapped dictation, Fluid Malayalam Vocal Support, and advanced AI cleanup tools.',
      price: '₹249', suffix: '/month', cta: 'Subscribe Now', features: proFeatures
    },
    {
      id: 'pro_lifetime', kind: 'lifetime', badge: '♛ Best Value', lifetime: true, name: 'Pro Lifetime',
      desc: 'One-time payment, own it forever. All Pro features + lifetime updates.',
      price: '₹4,999', suffix: '/one-time', cta: 'Get Lifetime License', features: lifetimeFeatures
    }
  ];
}

function renderPricingPlans() {
  const host = document.getElementById('pricing-plan-cards');
  if (!host) return;
  document.querySelectorAll('#pricing-switch [data-billing]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.billing === pricingBilling);
    btn.onclick = () => {
      pricingBilling = btn.dataset.billing;
      renderPricingPlans();
    };
  });
  host.innerHTML = pricingPlansForBilling().map((plan) => `
    <div class="plan-card ${plan.kind} ${plan.recommended ? 'recommended' : ''} ${plan.lifetime ? 'lifetime' : ''}" data-plan="${plan.id}">
      ${plan.badge ? `<div class="plan-badge">${plan.badge}</div>` : ''}
      <div class="pricing-icon">${pricingIconSvg(plan.kind)}</div>
      <div class="plan-name">${plan.name}</div>
      <div class="plan-desc">${plan.desc}</div>
      <div class="plan-price">${plan.price}<span> ${plan.suffix}</span></div>
      <button type="button" class="pricing-cta" data-pricing-cta="${plan.id}">${plan.cta}</button>
      <ul class="plan-features">${plan.features.map((feature) => `<li><span>${feature}</span></li>`).join('')}</ul>
    </div>
  `).join('');
  host.querySelectorAll('[data-pricing-cta]').forEach((btn) => {
    btn.onclick = async (event) => {
      event.stopPropagation();
      if (window.parayu.openPricingPage) await window.parayu.openPricingPage();
    };
  });
}

function selectPlanCard(plan) {
  selectedPlan = plan;
  document.querySelectorAll('.plan-card').forEach((card) => {
    const isSelected = card.dataset.plan === plan;
    card.classList.toggle('selected', isSelected);
  });
  const salesNote = document.getElementById('enterprise-sales-note');
  if (salesNote) {
    salesNote.style.display = 'flex';
  }
}

let authMode = 'signup';

function setAuthMode(mode) {
  authMode = mode;
  const tabSignup = document.getElementById('tab-signup-btn');
  const tabSignin = document.getElementById('tab-signin-btn');
  const nameField = document.getElementById('signup-name-field');
  const googleBtnText = document.getElementById('google-btn-text');
  const submitBtn = document.getElementById('auth-submit-btn');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  
  if (mode === 'signup') {
    if (tabSignup) {
      tabSignup.classList.add('active');
      tabSignup.style.color = 'var(--text)';
      tabSignup.style.borderBottomColor = 'var(--accent)';
    }
    if (tabSignin) {
      tabSignin.classList.remove('active');
      tabSignin.style.color = 'var(--muted)';
      tabSignin.style.borderBottomColor = 'transparent';
    }
    if (nameField) nameField.style.display = 'block';
    if (googleBtnText) googleBtnText.textContent = 'Sign Up with Google';
    if (submitBtn) submitBtn.textContent = 'Create Account';
    if (authTitle) authTitle.textContent = 'Create your account';
    if (authSubtitle) authSubtitle.textContent = 'Start transcribing with Parayu today.';
  } else {
    if (tabSignup) {
      tabSignup.classList.remove('active');
      tabSignup.style.color = 'var(--muted)';
      tabSignup.style.borderBottomColor = 'transparent';
    }
    if (tabSignin) {
      tabSignin.classList.add('active');
      tabSignin.style.color = 'var(--text)';
      tabSignin.style.borderBottomColor = 'var(--accent)';
    }
    if (nameField) nameField.style.display = 'none';
    if (googleBtnText) googleBtnText.textContent = 'Sign In with Google';
    if (submitBtn) submitBtn.textContent = 'Sign In';
    if (authTitle) authTitle.textContent = 'Welcome Back';
    if (authSubtitle) authSubtitle.textContent = 'Sign in to manage your Parayu subscription.';
  }
}

function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  
  const profile = state.userProfile || { registered: false, name: '', email: '', plan: 'Base Plan' };
  
  const authContainer = document.getElementById('modal-auth-container');
  const profileContainer = document.getElementById('modal-profile-container');
  const modalCard = modal.querySelector('.modal-card');
  
  if (profile.registered) {
    if (modalCard) modalCard.classList.add('pricing-modal-card');
    if (authContainer) authContainer.style.display = 'none';
    if (profileContainer) profileContainer.style.display = 'block';
    
    const avatarEl = document.getElementById('logged-avatar');
    const nameEl = document.getElementById('logged-name');
    const emailEl = document.getElementById('logged-email');
    
    if (avatarEl) {
      avatarEl.style.background = 'linear-gradient(135deg, var(--accent), #ff9b3d)';
      avatarEl.style.color = '#ffffff';
      if (profile.name) {
        const parts = profile.name.trim().split(/\s+/);
        avatarEl.textContent = parts.length >= 2 
          ? (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase() 
          : profile.name.charAt(0).toUpperCase();
      } else {
        avatarEl.textContent = 'U';
      }
    }
    if (nameEl) nameEl.textContent = profile.name || 'User';
    if (emailEl) emailEl.textContent = profile.email || '';
    
    pricingBilling = subscription().billingCycle === 'monthly' ? 'monthly' : 'yearly';
    renderPricingPlans();
  } else {
    if (modalCard) modalCard.classList.remove('pricing-modal-card');
    if (authContainer) authContainer.style.display = 'block';
    if (profileContainer) profileContainer.style.display = 'none';
    const devDemoBox = document.getElementById('dev-demo-credentials');
    if (devDemoBox) devDemoBox.style.display = state.flavor === 'dev' ? 'flex' : 'none';
    
    const nameInput = document.getElementById('auth-name-input');
    const emailInput = document.getElementById('auth-email-input');
    const passInput = document.getElementById('auth-password-input');
    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
    
    setAuthMode('signup');
  }
  modal.style.display = 'flex';
}

refresh();

// Close the language dropdown when clicking anywhere outside it (the pill and
// search input stopPropagation, so interacting with them won't close it).
document.addEventListener('click', () => {
  const dd = document.getElementById('lang-dropdown');
  if (dd && dd.classList.contains('open')) dd.classList.remove('open');
});

window.parayu.onStopMicTest(() => {
  if (micTest) stopMicTest(document.getElementById('mic-test-btn'));
});
