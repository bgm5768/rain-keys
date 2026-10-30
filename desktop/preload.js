'use strict';
// 페이지(index.html)에 window.rainKeysHost 를 넣어 줌. 페이지는 이것으로 앱 안에서 열렸는지 알아챔
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('rk:info');
contextBridge.exposeInMainWorld('rainKeysHost', {
  mode: info.mode,                       // 'app' | 'saver'
  canInstallSaver: info.canInstallSaver,
  quit: () => ipcRenderer.send('rk:quit'),
  installSaver: () => ipcRenderer.invoke('rk:install-saver')
});
