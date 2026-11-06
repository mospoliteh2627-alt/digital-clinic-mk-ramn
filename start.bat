@echo off
chcp 65001 >nul
setlocal

set "PORT=8080"
set "URL=http://localhost:%PORT%"
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

echo ============================================================
echo   МИС «Цифровая клиника МК РАМН» — запуск (Windows)
echo ============================================================
echo Каталог: %APP_DIR%
echo Адрес:   %URL%
echo.

rem --- 1. Проверка структуры приложения -----------------------
if not exist "index.html" (
  echo ОШИБКА: не найден обязательный файл index.html.
  goto :fail
)
if not exist "css\style.css" (
  echo ОШИБКА: не найден css\style.css.
  goto :fail
)
if not exist "js\app.js" (
  echo ОШИБКА: не найден js\app.js.
  goto :fail
)

rem --- 2. Поиск Python 3 --------------------------------------
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
  where py >nul 2>nul && set "PY=py"
)
if not defined PY (
  echo ОШИБКА: Python 3 не найден.
  echo Установите Python с сайта https://www.python.org/downloads/windows/
  echo При установке отметьте галочку «Add Python to PATH».
  goto :fail
)
echo Python: %PY%

rem --- 3. Проверка занятости порта ----------------------------
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo Порт %PORT% уже занят — возможно, комплекс уже запущен.
  echo Открываю %URL% в браузере.
  start "" "%URL%"
  goto :done
)

rem --- 4. Запуск HTTP-сервера ---------------------------------
echo.
echo Запуск локального сервера…
start "Цифровая клиника — сервер" /min cmd /c "%PY% -m http.server %PORT% --bind 127.0.0.1"
timeout /t 2 /nobreak >nul

echo Открываю браузер: %URL%
start "" "%URL%"

echo.
echo ============================================================
echo   Комплекс работает.
echo   Сервер держит отдельное окно «Цифровая клиника — сервер».
echo   Не закрывайте его, пока идёт занятие. Для остановки —
echo   закройте это окно сервера.
echo ============================================================
echo.
goto :done

:fail
echo.
echo Распакуйте архив с приложением полностью и запустите start.bat заново.

:done
echo.
pause
exit /b
