const { execFileSync } = require('child_process');
const fs = require('fs');

function commandExists(command) {
  try {
    execFileSync('zsh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function run(command, args = []) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return (error.stderr || error.stdout || error.message || '').toString().trim();
  }
}

function hasUsableJava() {
  const output = run('java', ['-version']);
  return !/Unable to locate a Java Runtime/i.test(output) && /version/i.test(output);
}

const checks = [
  {
    name: 'Node/npm',
    ok: commandExists('node') && commandExists('npm'),
    detail: commandExists('node') ? run('node', ['--version']) : 'node missing',
  },
  {
    name: 'Windows smoke packaging',
    ok: fs.existsSync('node_modules/electron-builder') && fs.existsSync('build/icon.ico'),
    detail: 'Run: npm run test:win',
  },
  {
    name: 'Full Xcode for iOS',
    ok: fs.existsSync('/Applications/Xcode.app') && commandExists('xcodebuild'),
    detail: fs.existsSync('/Applications/Xcode.app')
      ? run('xcodebuild', ['-version']).split('\n')[0]
      : 'Install Xcode from the App Store, then run sudo xcode-select -s /Applications/Xcode.app',
  },
  {
    name: 'Java 17 for Android',
    ok: commandExists('java') && hasUsableJava(),
    detail: commandExists('java') && hasUsableJava() ? run('java', ['-version']).split('\n')[0] : 'Install Java 17',
  },
  {
    name: 'Android SDK',
    ok: Boolean(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT),
    detail: process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || 'Install Android Studio or Android command line tools',
  },
  {
    name: 'Gradle for Android',
    ok: commandExists('gradle'),
    detail: commandExists('gradle') ? run('gradle', ['-v']).split('\n').find(Boolean) : 'Install Gradle or use CI',
  },
];

let failed = 0;
for (const check of checks) {
  const marker = check.ok ? 'OK ' : 'NO ';
  console.log(`${marker} ${check.name}`);
  console.log(`   ${check.detail}`);
  if (!check.ok) failed += 1;
}

if (failed > 0) {
  console.log(`\n${failed} platform check(s) need attention for local builds. CI can still build targets with the workflow tools.`);
  process.exitCode = 1;
}
