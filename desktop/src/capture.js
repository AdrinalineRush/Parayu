const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', '..', 'website', 'parayu-Website', 'public', 'screenshots');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Read index.html, inject mock state, and strip out Pro Writing tab to match final release version
console.log("Preparing release index_release.html layout...");
let html = fs.readFileSync(path.join(__dirname, 'renderer', 'index.html'), 'utf8');

const mockScript = `
<script>
  window.parayu = {
    getState: () => Promise.resolve({
      flavor: 'release', // Strict production release flavor
      hotkey: 'Alt+Space',
      inputLanguage: 'ml',
      dictionary: [
        { from: 'ennale', to: 'yesterday' },
        { from: 'karyangal', to: 'things' },
        { from: 'lag', to: 'delay' }
      ],
      snippets: [
        { trigger: 'mysig', expansion: 'Kind regards, Adarsh' },
        { trigger: 'timeline', expansion: 'The project timeline will lag by 2 weeks.' }
      ],
      history: [
        { id: '1', text: "Hey, do you remember what I said in yesterday's sync? The project timeline will delay by 2 weeks.", timestamp: Date.now() - 600000, words: 18 },
        { id: '2', text: "We need to update the pricing matrix to changes to the free word limits and push.", timestamp: Date.now() - 3600000, words: 16 }
      ],
      subscription: {
        plan: 'pro',
        planLabel: 'Pro Plan',
        subscriptionStatus: 'active',
        allowedFeatures: ['basic_dictation', 'basic_offline_cleanup', 'clipboard_paste', 'whisper_base_model', 'malayalam_to_english_premium', 'whisper_small_model', 'personal_dictionary', 'text_snippets', 'local_llm_formatter', 'whisper_medium_model', 'whisper_large_v3_model', 'whisper_large_v3_unquantized_model', 'app_aware_formatting', 'developer_prompt_mode', 'email_mode', 'advanced_clipboard_restore', 'premium_model_packs', 'priority_updates'],
        allowedModels: ['small-q5_1', 'medium-q5_0', 'large-v3-q5_0', 'large-v3']
      },
      stats: {
        totalWords: 1648,
        lastActiveDate: new Date().toISOString(),
        streak: 2,
        longestStreak: 2,
        speakingSeconds: 950,
        wordsCorrected: 28,
        dictionaryFixes: 5
      },
      appUsage: {
        "Antigravity": { words: 592, count: 24 },
        "Claude": { words: 557, count: 18 },
        "Parayu Super Dev": { words: 241, count: 12 },
        "Finder": { words: 139, count: 8 }
      }
    }),
    devDemoLogin: () => Promise.resolve({ success: true }),
    checkAccessibility: () => Promise.resolve(true),
    openAccessibilitySettings: () => {},
    completeOnboarding: () => {},
    setDictationMode: () => Promise.resolve('global'),
    setHotkey: () => Promise.resolve({ success: true }),
    setInputLanguage: (code) => Promise.resolve(code),
    getHfTokenStatus: () => Promise.resolve({ hasToken: true }),
    translationStatus: () => Promise.resolve({ state: 'ready' })
  };
</script>
`;

// Inject mock script at the top of the head
html = html.replace('<head>', '<head>' + mockScript);

// Remove the Pro Writing list item
html = html.replace(/<div class="item" data-view="screenwriting">[\s\S]*?<\/div>/g, '');

// Save to index_release.html
const indexReleasePath = path.join(__dirname, 'renderer', 'index_release.html');
fs.writeFileSync(indexReleasePath, html, 'utf8');

app.whenReady().then(async () => {
  console.log("Starting Electron renderer screenshot captures...");

  const win = new BrowserWindow({
    width: 1180,
    height: 740,
    show: false, // Run headless/hidden
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  // Load the newly built index_release.html
  await win.loadFile(indexReleasePath);
  win.setSize(1180, 740);

  // Define tabs to capture (Excluding screenwriting!)
  const tabs = [
    { key: 'home', name: 'home.png' },
    { key: 'history', name: 'history.png' },
    { key: 'dictionary', name: 'dictionary.png' },
    { key: 'snippets', name: 'snippets.png' },
    { key: 'settings', name: 'settings.png' }
  ];

  for (const tab of tabs) {
    console.log(`Navigating to tab: ${tab.key}`);
    // Switch active tab in app layout
    await win.webContents.executeJavaScript(`window.changeSidebarTab('${tab.key}')`);
    // Wait briefly for layout render and transitions to settle
    await new Promise(r => setTimeout(r, 600));
    
    // Capture page
    const image = await win.webContents.capturePage();
    const pngBuffer = image.toPNG();
    
    // Save to Next.js project public folder
    const destPath = path.join(publicDir, tab.name);
    fs.writeFileSync(destPath, pngBuffer);
    console.log(`Successfully saved screenshot to: ${destPath}`);
  }

  console.log("All screenshots captured successfully! Exiting...");
  
  // Clean up temporary HTML file
  if (fs.existsSync(indexReleasePath)) {
    fs.unlinkSync(indexReleasePath);
  }
  
  app.quit();
});
