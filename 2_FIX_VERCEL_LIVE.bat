@echo off
echo =========================================
echo UPDATING LIVE VERCEL WEBSITE (GITHUB PUSH)
echo =========================================
echo.
echo Adding new code changes...
git add .
echo.
echo Committing changes...
git commit -m "Update schema to fix fitting category error"
echo.
echo Pushing to GitHub...
git push
echo.
echo =========================================
echo DONE! 
echo Vercel is now deploying your new code.
echo Please wait 1-2 minutes, then refresh your live website and try again!
echo =========================================
pause
