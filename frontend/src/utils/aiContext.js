// Armazena a função de contexto da tela atual.
// Cada página chama setAIContext(() => ({ tela, dados })) em um useEffect.
let _fn = null

export const setAIContext = (fn) => { _fn = fn }
export const clearAIContext = ()  => { _fn = null }
export const getAIContext   = ()  => {
  try { return _fn ? _fn() : null } catch { return null }
}
