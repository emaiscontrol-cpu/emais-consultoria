// Célula padrão de valor + % de participação para tabelas de demonstrativos
// (Fluxo de Caixa, Orçamento e futuros DRE/Balancete/Demonstrativo Ref.)
//
// Sempre que showPct=true, reserva um slot de largura fixa (minWidth: 42) à direita
// do valor — com o texto da % quando `pct` vier preenchido, ou vazio quando a linha
// não tiver % a exibir (ex.: totalizador). Isso mantém os números alinhados em
// colunas verticais independente do tipo de linha. Ver DESIGN_SYSTEM.md § Padrão de
// tabelas de demonstrativos.
export default function CelulaValorPct({
  value,
  pct = null,
  showPct = false,
  pctColor = '#534AB7',
  color,
  fontWeight,
  underline = false,
  underlineColor = 'var(--text-muted)',
  style = {},
  containerStyle = {},
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline',
      gap: 6, width: '100%', whiteSpace: 'nowrap', ...containerStyle,
    }}>
      <span style={{
        color, fontWeight,
        textDecoration: underline ? 'underline dotted' : 'none',
        textDecorationColor: underlineColor,
        textUnderlineOffset: '3px',
        ...style,
      }}>
        {value}
      </span>
      {showPct && (
        pct != null
          ? <span style={{ color: pctColor, fontSize: 9, fontWeight: 800, minWidth: 42, textAlign: 'right' }}>
              {pct.toFixed(1)}%
            </span>
          : <span style={{ minWidth: 42 }} />
      )}
    </div>
  )
}
