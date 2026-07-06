const { app, BrowserWindow, session, globalShortcut, ipcMain, safeStorage } = require('electron')
const path = require('path')
const fs   = require('fs')

const SERVER_URL = 'https://earlobe-feeble-aground.ngrok-free.dev'

let mainWindow = null

// ── Credenciais salvas (arquivo JSON no userData) ──────────────────────────────
function getCredsPath() {
  return path.join(app.getPath('userData'), 'saved-credentials.json')
}

ipcMain.handle('credentials:load', () => {
  try {
    if (!fs.existsSync(getCredsPath())) return null
    const data = JSON.parse(fs.readFileSync(getCredsPath(), 'utf8'))
    const result = { ...data }
    result.senha = ''
    if (data.senha_encrypted && safeStorage && safeStorage.isEncryptionAvailable()) {
      const encryptedBuffer = Buffer.from(data.senha_encrypted, 'base64')
      result.senha = safeStorage.decryptString(encryptedBuffer)
    }
    delete result.senha_encrypted
    return result
  } catch (err) {
    console.error('Erro ao ler credenciais:', err)
    return null
  }
})

ipcMain.handle('credentials:save', (_, creds) => {
  try {
    const toSave = { ...creds }
    delete toSave.senha
    toSave.senha_encrypted = ''
    if (creds.senha && safeStorage && safeStorage.isEncryptionAvailable()) {
      const encryptedBuffer = safeStorage.encryptString(creds.senha)
      toSave.senha_encrypted = encryptedBuffer.toString('base64')
    }
    fs.writeFileSync(getCredsPath(), JSON.stringify(toSave), 'utf8')
  } catch (err) {
    console.error('Erro ao gravar credenciais:', err)
  }
})

ipcMain.handle('credentials:clear', () => {
  try { fs.unlinkSync(getCredsPath()) } catch {}
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 900,
    minHeight: 600,
    title: 'E Mais Consultoria',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#ffffff',
  })

  // Adiciona header para bypassar aviso do ngrok
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['ngrok-skip-browser-warning'] = '1'
    callback({ requestHeaders: details.requestHeaders })
  })

  mainWindow.loadURL(SERVER_URL)

  // Mostra janela só quando estiver pronta
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // F12 abre DevTools para depuração
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  // Página de erro se servidor estiver offline
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
        <body style="font-family:sans-serif;display:flex;flex-direction:column;
          align-items:center;justify-content:center;height:100vh;
          margin:0;background:#f8fafc;color:#1e293b">
          <h2 style="color:#0096CF">E Mais Consultoria</h2>
          <p>Não foi possível conectar ao servidor.</p>
          <p style="font-size:13px;color:#64748b">Verifique sua conexão com a internet.</p>
          <button onclick="location.href='${SERVER_URL}'"
            style="margin-top:20px;padding:10px 24px;background:#0096CF;
            color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">
            Tentar novamente
          </button>
        </body>
      </html>
    `)
  })

  // Remove menu padrão do Electron
  mainWindow.setMenuBarVisibility(false)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
