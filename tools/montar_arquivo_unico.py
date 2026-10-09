"""Gera paintball-com-os-amigos.html: o jogo inteiro em um arquivo só (amigos secretos, Three.js e MQTT embutidos).

Uso (na raiz do repositório):  python3 jogo/tools/montar_arquivo_unico.py
Precisa de npm (baixa three e mqtt com `npm pack`). O arquivo gerado fica na raiz e não vai para o git.
"""
import pathlib
import subprocess
import tarfile
import tempfile

RAIZ = pathlib.Path(__file__).resolve().parents[2]
JOGO = RAIZ / 'jogo'
LIBS = {
    'three@0.160.0': ('package/build/three.min.js', '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>'),
    'mqtt@5.10.1': ('package/dist/mqtt.min.js', '<script src="https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js"></script>'),
}

html = (JOGO / 'index.html').read_text(encoding='utf-8')
# amigos secretos (continuam criptografados dentro do arquivo)
tag = '<script src="amigos.secreto.js"></script>'
assert tag in html
html = html.replace(tag, '<script>' + (JOGO / 'amigos.secreto.js').read_text(encoding='utf-8') + '</script>')

# ícone embutido; o manifesto (instalar o app) só funciona pelo site
import base64
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
html = html.replace('href="icone-180.png"', 'href="data:image/png;base64,' + base64.b64encode((JOGO / 'icone-180.png').read_bytes()).decode() + '"')

with tempfile.TemporaryDirectory() as tmp:
    for pacote, (caminho, tag) in LIBS.items():
        assert tag in html, f'tag do {pacote} não encontrada no index.html'
        nome = subprocess.run(['npm', 'pack', pacote, '--silent'], cwd=tmp, check=True, capture_output=True, text=True).stdout.strip().splitlines()[-1]
        with tarfile.open(pathlib.Path(tmp) / nome) as tar:
            codigo = tar.extractfile(caminho).read().decode('utf-8')
        assert '</script' not in codigo
        html = html.replace(tag, f'<script>{codigo}</script>')

saida = RAIZ / 'paintball-com-os-amigos.html'
saida.write_text(html, encoding='utf-8')
print(f'{saida} ({saida.stat().st_size // 1024} KB)')
