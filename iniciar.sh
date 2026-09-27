#!/bin/sh
# =====================================================
#  INICIAR O SITE EM DESENVOLVIMENTO  (macOS / Linux)
# =====================================================
#  Arranca o PHP a servir a pasta do projeto. Com isto o painel funciona
#  como em produção: conta, sessão, publicar. O Live Server do VS Code
#  serve ficheiros mas não executa PHP, e por isso o painel não abre por
#  inteiro a partir dele.
#
#  Não muda nada da produção: em produção quem serve é o Apache.
# =====================================================
set -e
raiz=$(cd "$(dirname "$0")" && pwd)

if ! command -v php >/dev/null 2>&1; then
  echo
  echo "  Não encontrei o PHP."
  echo "  macOS:  brew install php"
  echo "  Debian/Ubuntu:  sudo apt install php-cli"
  echo
  exit 1
fi

echo
echo "  SITE    http://localhost:8000/"
echo "  ADMIN   http://localhost:8000/admin/"
echo
echo "  Para parar: Ctrl+C."
echo

exec php -S localhost:8000 -t "$raiz" "$raiz/tools/servidor-local.php"
