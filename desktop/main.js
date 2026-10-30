'use strict';
// Rain Keys 데스크톱(Windows): 웹의 index.html을 그대로 띄우고,
// '기기 소리'를 공유 창·마이크 권한 없이 시스템 소리(WASAPI 루프백)로 넘겨 줌
const { app, BrowserWindow, session, desktopCapturer, screen, ipcMain } = require('electron');
const path = require('path');
const { execFile } = require('child_process');

// 우리 인자(--saver, --settings)와 Windows 화면보호기 인자(/s, /c, /p)를 모두 받음
function parseMode(argv) {
  for (const a of argv.slice(1)) {
    const s = a.toLowerCase();
    if (s === '--saver' || s.startsWith('/s')) return 'saver';
    if (s.startsWith('/p')) return 'preview';
    if (s === '--settings' || s.startsWith('/c')) return 'app';
  }
  return 'app';
}
const mode = parseMode(process.argv);

const WEB = app.isPackaged ? path.join(process.resourcesPath, 'web', 'index.html') : path.join(__dirname, '..', 'index.html');
const SCR = app.isPackaged ? path.join(process.resourcesPath, 'RainKeys.scr') : path.join(__dirname, 'native', 'win-scr', 'bin', 'RainKeys.scr');

const webPreferences = {
  preload: path.join(__dirname, 'preload.js'),
  autoplayPolicy: 'no-user-gesture-required',   // 화면보호기에는 클릭이 없으므로 오디오 분석을 바로 시작
  backgroundThrottling: false
};

// 화면 공유 요청이 오면 창을 띄우지 않고 첫 화면 + 시스템 소리를 바로 넘김
function allowLoopback() {
  session.defaultSession.setDisplayMediaRequestHandler((req, callback) => {
    desktopCapturer.getSources({ types: ['screen'] })
      .then(src => callback({ video: src[0], audio: 'loopback' }))
      .catch(() => callback({}));
  });
}

function startAudio(w) {
  w.webContents.on('did-finish-load', () => {
    w.webContents.executeJavaScript('window.rainKeysAutoStart && window.rainKeysAutoStart()', true).catch(() => {});
  });
}

function openApp() {
  const w = new BrowserWindow({ width: 1280, height: 800, title: 'Rain Keys', backgroundColor: '#070a18', autoHideMenuBar: true, webPreferences });
  w.loadFile(WEB);
  startAudio(w);
}

// 모니터마다 전체화면 창: 주 모니터에 바다, 나머지는 검은 화면(GPU를 아낌)
const BLACK = '<!doctype html><body style="margin:0;background:#000;cursor:none"><script>'
  + "['pointerdown','wheel'].forEach(e=>addEventListener(e,()=>rainKeysHost.quit()))</script>";
function openSaver() {
  const primary = screen.getPrimaryDisplay().id;
  for (const d of screen.getAllDisplays()) {
    const w = new BrowserWindow({ ...d.bounds, frame: false, fullscreen: true, skipTaskbar: true, backgroundColor: '#000000', show: false, webPreferences });
    w.setAlwaysOnTop(true, 'screen-saver');
    w.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown') app.quit(); });
    w.once('ready-to-show', () => { w.show(); w.focus(); });
    if (d.id === primary) { w.loadFile(WEB); startAudio(w); }
    else w.loadURL('data:text/html,' + encodeURIComponent(BLACK));
  }
  // 마우스가 조금이라도 움직이면 종료(시작 직후의 흔들림은 무시)
  let p0 = null;
  setTimeout(() => {
    p0 = screen.getCursorScreenPoint();
    setInterval(() => {
      const p = screen.getCursorScreenPoint();
      if (Math.abs(p.x - p0.x) + Math.abs(p.y - p0.y) > 10) app.quit();
    }, 100);
  }, 800);
}

// 현재 화면보호기로 등록(.scr /install)하고 Windows 화면보호기 설정 창을 열어 대기 시간을 고르게 함
function installSaver() {
  return new Promise(res => execFile(SCR, ['/install'], err => {
    if (!err) execFile('control.exe', ['desk.cpl,,@screensaver'], () => {});
    res(!err);
  }));
}

ipcMain.on('rk:info', e => { e.returnValue = { mode, canInstallSaver: process.platform === 'win32' && mode === 'app' }; });
ipcMain.on('rk:quit', () => { if (mode === 'saver') app.quit(); });
ipcMain.handle('rk:install-saver', installSaver);

if (mode === 'preview') {
  app.exit(0);   // 설정 창의 작은 미리보기는 아직 그리지 않음
} else if (mode === 'saver') {
  // 앱 창이 열려 있어도 화면보호기가 따로 뜰 수 있게 프로필 폴더를 분리
  app.setPath('userData', path.join(app.getPath('userData'), 'saver'));
  app.whenReady().then(() => { allowLoopback(); openSaver(); });
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => { allowLoopback(); openApp(); });
}
app.on('window-all-closed', () => app.quit());

// 자동 점검용: RK_SMOKE=초 를 주면 그 시간 뒤 분석 상태를 출력하고 종료
if (process.env.RK_SMOKE) {
  app.whenReady().then(() => setTimeout(async () => {
    const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().startsWith('file:'));
    const s = w ? await w.webContents.executeJavaScript('({ started: RK.started, hits: RK.hits, gl: RK.gl, fps: Math.round(RK.fps) })') : null;
    console.log('RK_SMOKE ' + JSON.stringify({ mode, ...s }));
    app.exit(0);
  }, +process.env.RK_SMOKE * 1000));
}
