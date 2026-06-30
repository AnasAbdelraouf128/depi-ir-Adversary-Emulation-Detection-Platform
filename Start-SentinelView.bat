@echo off
title SentinelView Server
color 0B

echo =======================================================
echo     Starting SentinelView SOC Dashboard...
echo =======================================================
echo.
echo Make sure your AWS EC2 instance is running!
echo.
echo Please wait a few seconds for the server to boot up...
echo Once you see "VITE ready", open your browser and go to:
echo http://localhost:8081
echo.

cd "C:\Users\hogar\OneDrive\Desktop\Sentinel View"
npm run dev -- --host

pause
