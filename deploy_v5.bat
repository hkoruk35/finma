@echo off
setlocal

echo [FinMA v5.0] Deployment Starting...
echo -----------------------------------

:: 1. Ask for commit message
set /p msg="Commit Message (or press Enter for default): "
if "%msg%"=="" set msg="Dashboard Enhancements: 1h Price Change & UI Updates"

:: 2. Git Backend Push (Railway automatically deploys on push)
echo.
echo [1/2] Pushing to Backend (Railway)...
git add .
git commit -m "%msg%"
git push origin main

if %errorlevel% neq 0 (
    echo [ERROR] Git push failed. Deployment aborted.
    pause
    exit /b %errorlevel%
)

:: 3. Frontend Deployment (Vercel)
echo.
echo [2/2] Deploying Frontend (Vercel)...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed. Deployment aborted.
    pause
    exit /b %errorlevel%
)

call npx vercel --prod --yes
if %errorlevel% neq 0 (
    echo [ERROR] Vercel deployment failed.
    pause
    exit /b %errorlevel%
)

cd ..

echo -----------------------------------
echo [SUCCESS] FinMA v5.0 Deployment Complete!
echo Backend: Railway (Processing push...)
echo Frontend: Vercel (Production Live)
echo.
pause
