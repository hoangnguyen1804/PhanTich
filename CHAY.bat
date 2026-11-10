@echo off
chcp 65001 >nul
title VO DAI LIVE - BOXING ARENA
cd /d "%~dp0"
set "ARENA_NODE=node"
if exist "%~dp0node.exe" set "ARENA_NODE=%~dp0node.exe"
"%ARENA_NODE%" -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(2)" >nul 2>&1
if errorlevel 1 (
 echo Can Node.js 22 tro len. Cai Node.js 24 LTS hoac dung ban portable co node.exe.
 pause
 exit /b 1
)
if not exist "node_modules\ws\package.json" (
 echo Dang cai thu vien tu package-lock.json...
 call npm ci --omit=dev --ignore-scripts
 if errorlevel 1 (
  echo Khong cai duoc. Kiem tra Internet va Node.js/npm.
  pause
  exit /b 1
 )
)
start "" /b "%ARENA_NODE%" scripts\open-control.mjs
"%ARENA_NODE%" server.mjs
if errorlevel 1 pause
