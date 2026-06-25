const { clipboard } = require('electron');
const { execFile } = require('child_process');

// Promisified execFile that resolves with trimmed stdout (or null on failure),
// so focus capture never blocks the main process / hotkey latency.
function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, (err, stdout) => {
      resolve(err ? null : String(stdout).trim());
    });
  });
}

// Returns an identifier for whatever app currently has focus, so we can
// restore focus to it later even if our own window is frontmost by then.
// Async (non-blocking) — the result is only needed seconds later at paste time.
async function captureFocusedTarget() {
  if (process.platform === 'darwin') {
    const name = await run('osascript', [
      '-e',
      'tell application "System Events" to get name of first application process whose frontmost is true'
    ]);
    return name ? { platform: 'darwin', name } : null;
  }
  if (process.platform === 'win32') {
    const hwnd = await run('powershell.exe', [
      '-NoProfile', '-Command',
      `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name Win32 -Namespace Native; [Native.Win32]::GetForegroundWindow().ToInt64()`
    ]);
    return hwnd ? { platform: 'win32', hwnd } : null;
  }
  return null;
}

// Copies text to the clipboard, restores focus to the previously captured
// target app, and simulates a paste keystroke there. Resolves with
// { ok, error } so the caller can surface permission problems to the user —
// macOS silently no-ops the keystroke if Accessibility access isn't granted.
function pasteText(text, target, ownAppName) {
  const backup = {};
  const textBackup = clipboard.readText();
  const htmlBackup = clipboard.readHTML();
  const rtfBackup = clipboard.readRTF();
  const imageBackup = clipboard.readImage();

  if (textBackup) backup.text = textBackup;
  if (htmlBackup) backup.html = htmlBackup;
  if (rtfBackup) backup.rtf = rtfBackup;
  if (imageBackup && !imageBackup.isEmpty()) backup.image = imageBackup;

  clipboard.clear();
  clipboard.writeText(text);

  const restoreClipboard = () => {
    setTimeout(() => {
      // Only restore if the clipboard still holds our transcribed text.
      // If the user has copied something new in the meantime, preserve their new copy!
      if (clipboard.readText() === text) {
        if (Object.keys(backup).length > 0) {
          clipboard.write(backup);
        } else {
          clipboard.clear();
        }
      }
    }, 600);
  };

  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      const isOwnApp = target && target.platform === 'darwin' &&
        (target.name === ownAppName || target.name === 'Electron');

      if (target && target.platform === 'darwin' && target.name === 'Finder') {
        resolve({ ok: true });
        return;
      }

      // Escape backslashes first, then quotes, and strip newlines so a crafted
      // app name can't break out of the string literal / inject AppleScript.
      const safeName = target && target.name
        ? target.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')
        : '';
      const activate = target && target.platform === 'darwin' && !isOwnApp
        ? `tell application "${safeName}" to activate\ndelay 0.1\n`
        : '';
      execFile('osascript', ['-e', `${activate}tell application "System Events" to keystroke "v" using command down`], (error, _stdout, stderr) => {
        restoreClipboard();
        if (error) {
          const isPermissionErr = stderr && (
            stderr.includes('1719') || 
            stderr.includes('1002') || 
            stderr.includes('not allowed') || 
            stderr.includes('Access is not allowed')
          );
          const message = isPermissionErr
            ? 'Accessibility permission not granted — please enable Parayu (or Electron, in dev mode) in System Settings → Privacy & Security → Accessibility. (If it is already enabled, toggle it off and back on again to reset permissions.)'
            : (stderr || error.message);
          resolve({ ok: false, error: message });
        } else {
          resolve({ ok: true });
        }
      });
    } else if (process.platform === 'win32') {
      // Only interpolate the hwnd when it's strictly numeric, so nothing
      // unexpected can be injected into the PowerShell command.
      const validHwnd = target && target.platform === 'win32' && /^\d+$/.test(String(target.hwnd || ''));
      const restore = validHwnd
        ? `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);' -Name Win32 -Namespace Native; [Native.Win32]::SetForegroundWindow([IntPtr]${target.hwnd}); Start-Sleep -Milliseconds 50;`
        : '';
      const ps = `${restore} Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`;
      execFile('powershell.exe', ['-NoProfile', '-Command', ps], (error, _stdout, stderr) => {
        restoreClipboard();
        resolve(error ? { ok: false, error: stderr || error.message } : { ok: true });
      });
    } else {
      restoreClipboard();
      resolve({ ok: false, error: 'Unsupported platform' });
    }
  });
}

module.exports = { pasteText, captureFocusedTarget };
