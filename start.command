#!/bin/bash
# ============================================================
#  Учебно-симуляционный комплекс «Цифровая клиника МК РАМН»
#  Автоматический запуск локального сервера и браузера Chrome.
#
#  Использование: дважды щёлкните файл start.command в Finder.
#  Сервер работает на http://localhost:8080, при закрытии окна
#  Терминала он останавливается.
# ============================================================

set -u

PORT=8080
HOST="127.0.0.1"
URL="http://localhost:${PORT}"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="${APP_DIR}/.server.log"
PID_FILE="${APP_DIR}/.server.pid"
SERVER_PID=""

cd "${APP_DIR}" || {
  echo "Не удалось перейти в каталог приложения: ${APP_DIR}"
  exit 1
}

echo "============================================================"
echo "  МИС «Цифровая клиника МК РАМН» — запуск"
echo "============================================================"
echo "Каталог: ${APP_DIR}"
echo "Адрес:   ${URL}"
echo ""

# --- 1. Проверка структуры приложения -----------------------
for required in index.html css/style.css js/app.js forms/001u.html; do
  if [ ! -e "${APP_DIR}/${required}" ]; then
    echo "ОШИБКА: не найден обязательный файл ${required}."
    echo "Распакуйте архив с приложением полностью и запустите start.command заново."
    echo ""
    read -r -p "Нажмите Enter, чтобы закрыть окно…" _
    exit 1
  fi
done

# --- 2. Поиск Python 3 --------------------------------------
find_python() {
  local candidate
  for candidate in python3 /usr/bin/python3 /usr/local/bin/python3 /opt/homebrew/bin/python3 python; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      if "${candidate}" -c 'import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
        printf '%s' "${candidate}"
        return 0
      fi
    fi
  done
  return 1
}

PYTHON_BIN="$(find_python || true)"
if [ -z "${PYTHON_BIN}" ]; then
  echo "ОШИБКА: Python 3 не найден."
  echo "Установите Python 3 с сайта https://www.python.org/downloads/macos/"
  echo "или выполните в Терминале: xcode-select --install"
  echo ""
  read -r -p "Нажмите Enter, чтобы закрыть окно…" _
  exit 1
fi

PYTHON_VERSION="$("${PYTHON_BIN}" -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])' 2>/dev/null || echo "3")"
echo "Python:  ${PYTHON_BIN} (${PYTHON_VERSION})"

# --- 3. Проверка занятости порта ----------------------------
port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  "${PYTHON_BIN}" - "${PORT}" <<'PY' >/dev/null 2>&1
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(0.4)
try:
    rc = s.connect_ex(("127.0.0.1", int(sys.argv[1])))
finally:
    s.close()
sys.exit(0 if rc == 0 else 1)
PY
}

open_browser() {
  if [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args --new-window "${URL}" >/dev/null 2>&1 && return 0
  fi
  if command -v open >/dev/null 2>&1; then
    open "${URL}" >/dev/null 2>&1 && return 0
  fi
  return 1
}

if port_busy; then
  echo ""
  echo "Порт ${PORT} уже занят."
  echo "Возможно, комплекс уже запущен. Открываю ${URL} в браузере."
  echo "Если страница не открывается, закройте другое приложение на порту ${PORT}:"
  echo "  lsof -nP -iTCP:${PORT} -sTCP:LISTEN"
  open_browser || echo "Откройте вручную: ${URL}"
  echo ""
  read -r -p "Нажмите Enter, чтобы закрыть окно…" _
  exit 0
fi

# --- 4. Очистка прошлых запусков ----------------------------
if [ -f "${PID_FILE}" ]; then
  OLD_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [ -n "${OLD_PID}" ] && kill -0 "${OLD_PID}" 2>/dev/null; then
    kill "${OLD_PID}" 2>/dev/null || true
    sleep 0.3
  fi
  rm -f "${PID_FILE}"
fi

cleanup() {
  local code=$?
  echo ""
  echo "Остановка сервера…"
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  rm -f "${PID_FILE}"
  trap - EXIT INT TERM
  exit ${code}
}
trap cleanup EXIT INT TERM

# --- 5. Запуск HTTP-сервера ---------------------------------
echo ""
echo "Запуск локального сервера…"
"${PYTHON_BIN}" -u -m http.server "${PORT}" --bind "${HOST}" --directory "${APP_DIR}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" >"${PID_FILE}"

READY=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    break
  fi
  if port_busy; then
    READY=1
    break
  fi
  sleep 0.3
done

if [ "${READY}" -ne 1 ]; then
  echo "ОШИБКА: сервер не запустился."
  echo "Журнал: ${LOG_FILE}"
  if [ -f "${LOG_FILE}" ]; then
    echo "--- последние строки журнала ---"
    tail -n 20 "${LOG_FILE}"
    echo "-------------------------------"
  fi
  echo ""
  read -r -p "Нажмите Enter, чтобы закрыть окно…" _
  exit 1
fi

echo "Сервер запущен (PID ${SERVER_PID})."
echo "Открываю Google Chrome: ${URL}"
echo ""

if ! open_browser; then
  echo "Не удалось открыть браузер автоматически."
  echo "Откройте вручную: ${URL}"
fi

echo "============================================================"
echo "  Комплекс работает. Не закрывайте это окно Терминала."
echo "  Для остановки нажмите Control + C или закройте окно."
echo "============================================================"
echo ""

# --- 6. Ожидание сервера и вывод журнала --------------------
tail -n 0 -f "${LOG_FILE}" 2>/dev/null &
TAIL_PID=$!

wait "${SERVER_PID}"
SERVER_STATUS=$?
kill "${TAIL_PID}" 2>/dev/null || true
wait "${TAIL_PID}" 2>/dev/null || true

echo ""
echo "Сервер остановлен (код ${SERVER_STATUS})."
read -r -p "Нажмите Enter, чтобы закрыть окно…" _
exit "${SERVER_STATUS}"
