const { app, BrowserWindow, session, globalShortcut } = require('electron')
const path = require('path')

const SERVER_URL = 'https://earlobe-feeble-aground.ngrok-free.dev'

let mainWindow = null

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
