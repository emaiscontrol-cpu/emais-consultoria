"""Geração genérica de PDF para demonstrativos (Fluxo de Caixa, DRE, Orçamento, Balancete, ...).

Usa reportlab (puro Python, sem dependências nativas) — weasyprint foi avaliado mas exige
bibliotecas GTK/Pango que não estão disponíveis nem no Windows de dev, nem no servidor de
produção, nem no runner do CI.
"""
import io
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

LOGO_PATH_PADRAO = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "assets" / "icon.png"

COR_TITULO_BG   = colors.HexColor("#EBEBEB")
COR_TOTAL_BG    = colors.HexColor("#F0F0EE")
COR_HEADER_BG   = colors.HexColor("#F5F4F0")
COR_ZEBRA       = colors.HexColor("#FAFAF8")
COR_NEGATIVO    = colors.HexColor("#A32D2D")
COR_TEXTO_MUTED = colors.HexColor("#5F5E5A")
COR_BORDA       = colors.HexColor("#DDDCD6")
COR_BORDA_FORTE = colors.HexColor("#B8B7B0")


def _fmt_valor(valor, coluna_label):
    if valor is None or valor == "":
        return "—"
    if isinstance(valor, str):
        return valor
    is_pct = "%" in (coluna_label or "")
    if is_pct:
        texto = f"{valor:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return f"{texto}%"
    texto = f"{valor:,.0f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return texto


class _NumberedCanvas(pdfcanvas.Canvas):
    """Canvas com cabeçalho/rodapé fixos e 'Página X de Y' (precisa de duas passadas)."""

    def __init__(self, *args, titulo="", cliente_nome="", periodo="", logo_path=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self._titulo = titulo
        self._cliente_nome = cliente_nome
        self._periodo = periodo
        self._logo_path = logo_path

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_header()
            self._draw_footer(total_pages)
            super().showPage()
        super().save()

    def _draw_header(self):
        largura, altura = self._pagesize
        y = altura - 15 * mm

        if self._logo_path and Path(self._logo_path).exists():
            try:
                self.drawImage(
                    str(self._logo_path), 15 * mm, y - 3 * mm,
                    width=10 * mm, height=10 * mm,
                    preserveAspectRatio=True, mask="auto",
                )
            except Exception:
                pass

        self.setFont("Helvetica-Bold", 10)
        self.setFillColor(colors.HexColor("#1A1A18"))
        self.drawString(28 * mm, y + 1 * mm, "E Mais Consultoria")

        self.setFont("Helvetica-Bold", 13)
        self.drawCentredString(largura / 2, y + 1 * mm, self._titulo or "")

        self.setFont("Helvetica", 9)
        self.setFillColor(COR_TEXTO_MUTED)
        subtitulo = f"{self._cliente_nome} — {self._periodo}" if self._cliente_nome else (self._periodo or "")
        self.drawCentredString(largura / 2, y - 5 * mm, subtitulo)

        self.setStrokeColor(COR_BORDA)
        self.setLineWidth(0.5)
        self.line(15 * mm, y - 9 * mm, largura - 15 * mm, y - 9 * mm)

    def _draw_footer(self, total_pages):
        largura, _ = self._pagesize
        y = 12 * mm
        self.setFont("Helvetica", 7)
        self.setFillColor(COR_TEXTO_MUTED)
        gerado = datetime.now().strftime("%d/%m/%Y %H:%M")
        self.drawString(15 * mm, y, f"Gerado em {gerado}")
        self.drawCentredString(largura / 2, y, "E Mais Consultoria — Sistema de Gestão")
        self.drawRightString(largura - 15 * mm, y, f"Página {self.getPageNumber()} de {total_pages}")


def gerar_pdf_demonstrativo(
    titulo: str,
    cliente_nome: str,
    periodo: str,
    linhas: list[dict],
    colunas: list[str],
    logo_path: str | None = None,
) -> bytes:
    """Gera um PDF paisagem A4 de um demonstrativo tabular genérico.

    linhas: [{ "rotulo": str, "tipo": "titulo"|"agrupamento"|"totalizador", "valores": [num|str|None, ...] }]
    """
    buf = io.BytesIO()
    pagesize = landscape(A4)
    doc = SimpleDocTemplate(
        buf, pagesize=pagesize,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=30 * mm, bottomMargin=18 * mm,
    )

    largura_disponivel = pagesize[0] - 30 * mm
    n_cols = max(len(colunas), 1)
    col_rotulo_w = largura_disponivel * 0.30
    col_valor_w = (largura_disponivel - col_rotulo_w) / n_cols
    col_widths = [col_rotulo_w] + [col_valor_w] * n_cols

    data = [[""] + [str(c).upper() for c in colunas]]
    linhas_meta = []  # (tipo, row_index, valores)

    for i, linha in enumerate(linhas, start=1):
        tipo = linha.get("tipo", "agrupamento")
        rotulo = linha.get("rotulo", "") or ""
        valores = linha.get("valores") or []
        if tipo == "titulo":
            row = [rotulo.upper()] + [""] * n_cols
        else:
            row = [rotulo] + [
                _fmt_valor(valores[j] if j < len(valores) else None, colunas[j] if j < len(colunas) else "")
                for j in range(n_cols)
            ]
        data.append(row)
        linhas_meta.append((tipo, i, valores))

    tabela = Table(data, colWidths=col_widths, repeatRows=1)

    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), COR_HEADER_BG),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), COR_TEXTO_MUTED),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, COR_BORDA),
    ]

    for tipo, i, valores in linhas_meta:
        if tipo == "titulo":
            ts += [
                ("SPAN", (0, i), (-1, i)),
                ("BACKGROUND", (0, i), (-1, i), COR_TITULO_BG),
                ("FONTNAME", (0, i), (-1, i), "Helvetica-Bold"),
                ("FONTSIZE", (0, i), (-1, i), 7.5),
            ]
        elif tipo == "totalizador":
            ts += [
                ("BACKGROUND", (0, i), (-1, i), COR_TOTAL_BG),
                ("FONTNAME", (0, i), (-1, i), "Helvetica-Bold"),
                ("FONTSIZE", (0, i), (-1, i), 8),
                ("LINEABOVE", (0, i), (-1, i), 0.75, COR_BORDA_FORTE),
            ]
        else:
            ts += [
                ("FONTNAME", (0, i), (-1, i), "Helvetica"),
                ("FONTSIZE", (0, i), (-1, i), 8),
            ]
            if i % 2 == 0:
                ts.append(("BACKGROUND", (0, i), (-1, i), COR_ZEBRA))

        for j, v in enumerate(valores):
            if isinstance(v, (int, float)) and v < 0:
                ts.append(("TEXTCOLOR", (j + 1, i), (j + 1, i), COR_NEGATIVO))

    tabela.setStyle(TableStyle(ts))

    caminho_logo = logo_path or LOGO_PATH_PADRAO

    def _make_canvas(*args, **kwargs):
        return _NumberedCanvas(
            *args, titulo=titulo, cliente_nome=cliente_nome, periodo=periodo,
            logo_path=caminho_logo, **kwargs,
        )

    doc.build([tabela], canvasmaker=_make_canvas)
    return buf.getvalue()
