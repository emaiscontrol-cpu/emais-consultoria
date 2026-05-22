const { app, BrowserWindow, session } = require('electron')
const path = require('path')
const https = require('https')

const SERVER_URL = 'https://earlobe-feeble-aground.ngrok-free.dev'
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutos

let currentVersion = null
let mainWindow = null

function checkVersion() {
  const req = https.get(`${SERVER_URL}/api/version`, {
    headers: { 'ngrok-skip-browser-warning': '1' }
  }, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      try {
        const { version } = JSON.parse(data)
        if (currentVersion === null) {
          currentVersion = version
        } else if (version !== currentVersion) {
          currentVersion = version
          if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`
              (function() {
                if (document.getElementById('emais-update-banner')) return;
                const banner = document.createElement('div');
                banner.id = 'emais-update-banner';
                banner.innerHTML = \`
                  <div style="position:fixed;top:0;left:0;right:0;z-index:99999;
                    background:#0096CF;color:#fff;padding:10px 20px;
                    display:flex;align-items:center;justify-content:space-between;
                    font-family:sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
                    <span>Nova versão disponível. Clique para atualizar.</span>
                    <button onclick="location.reload()"
                      style="background:#fff;color:#0096CF;border:none;padding:6px 16px;
                      border-radius:4px;cursor:pointer;font-weight:bold">
                      Atualizar agora
                    </button>
                  </div>\`;
                document.body.prepend(banner);
              })()
            `)
          }
        }
      } catch (_) {}
    })
  })
  req.on('error', () => {})
}

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
    backgroundColor: '#0A1C4E',
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
    checkVersion()
    setInterval(checkVersion, VERSION_CHECK_INTERVAL)
  })

  // Página de erro se servidor estiver offline
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
        <body style="font-family:sans-serif;display:flex;flex-direction:column;
          align-items:center;justify-content:center;height:100vh;
          margin:0;background:#0A1C4E;color:#fff">
          <h2 style="color:#0096CF">E Mais Consultoria</h2>
          <p>Não foi possível conectar ao servidor.</p>
          <p style="font-size:13px;color:#9CA3AF">Verifique sua conexão com a internet.</p>
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
