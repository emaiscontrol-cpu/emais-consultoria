import pytest
from xlsx_parser import _limpar_val

def test_limpar_val():
    assert _limpar_val("1234,56") == 1234.56
    assert _limpar_val("1.234,56") == 1234.56
    assert _limpar_val("R$ 1.234,56") == 1234.56
    assert _limpar_val("-1.234,56") == -1234.56
    assert _limpar_val("12.345.678,90") == 12345678.90
    assert _limpar_val(None) == 0.0
    assert _limpar_val("") == 0.0
