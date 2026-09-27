@echo off
REM =====================================================
REM  INICIAR O SITE EM DESENVOLVIMENTO  (Windows)
REM =====================================================
REM  Arranca o PHP a servir a pasta do projeto. Com isto o painel funciona
REM  como em producao: conta, sessao, publicar. O Live Server do VS Code
REM  serve ficheiros mas nao executa PHP, e por isso o painel nao abre por
REM  inteiro a partir dele.
REM
REM  Nao muda nada da producao: em producao quem serve e o Apache.
REM =====================================================
setlocal
cd /d "%~dp0"

where php >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Nao encontrei o PHP.
  echo.
  echo   Instale o PHP e volte a correr este ficheiro:
  echo     1. descarregue em https://windows.php.net/download/  ^(Thread Safe, x64^)
  echo     2. extraia para C:\php
  echo     3. acrescente C:\php ao Path do Windows
  echo     4. feche e reabra o terminal do VS Code
  echo.
  pause
  exit /b 1
)

echo.
echo   SITE    http://localhost:8000/
echo   ADMIN   http://localhost:8000/admin/
echo.
echo   Para parar: Ctrl+C nesta janela.
echo.

php -S localhost:8000 -t "%~dp0." "%~dp0tools\servidor-local.php"
