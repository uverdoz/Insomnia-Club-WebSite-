# ← добавил session
import locale
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
import json
import io
import pandas as pd
import os
from openpyxl import Workbook
from datetime import datetime

app = Flask(__name__)
app.secret_key = "super_admin_secret_2025"      # ← добавил секрет для сессий
ADMIN_PASSWORD = "insomnia2025"                 # ← САМ ЗАДАЙ любой пароль

DATA_FILE = os.path.join(app.root_path, "reservations.json")


def load_reservations():
    if not os.path.exists(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}


def save_reservations(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def time_to_minutes(time_str: str):
    try:
        parts = time_str.split(":")
        if len(parts) != 2:
            return None
        hh = int(parts[0])
        mm = int(parts[1])
        if not (0 <= hh <= 23 and 0 <= mm <= 59):
            return None
        return hh * 60 + mm
    except Exception:
        return None


# ------------------------
#   СТРАНИЦЫ
# ------------------------

@app.route("/")
def home():
    return render_template("home.html", title="Insomnia Club")


@app.route("/booking")
def booking_page():
    reservations = load_reservations()
    return render_template("booking.html", reservations=reservations, title="Бронирование")


# ------------------------
#   АФИША
# ------------------------

@app.route("/admin/stats")
def admin_stats():
    reservations = load_reservations()

    # Группируем по дате создания
    stats_by_date = {}
    for table_id, info in reservations.items():
        date_str = info.get("created_date", "не указано")
        if date_str not in stats_by_date:
            stats_by_date[date_str] = {
                "count": 0,
                "tables": []
            }
        stats_by_date[date_str]["count"] += 1
        stats_by_date[date_str]["tables"].append({
            "table_id": table_id,
            "time": info.get("time", ""),
            "name": info.get("name", ""),
            "phone": info.get("phone", "")
        })

    # сортируем даты по возрастанию
    sorted_dates = sorted(stats_by_date.items(), key=lambda x: x[0])

    return render_template(
        "admin_stats.html",
        title="Статистика по броням",
        stats=sorted_dates
    )


try:
    locale.setlocale(locale.LC_TIME, "ru_RU.UTF-8")
except:
    pass  # если система не поддерживает, оставим английские


def admin_stats():
    reservations = load_reservations()

    # словарь вида {"Понедельник": 3, "Вторник": 5}
    stats = {}

    for t_id, info in reservations.items():
        r_time = info.get("time")
        if not r_time:
            continue

        # сегодня
        today = datetime.now()
        # день недели (Понедельник, Вторник, ...)
        day_name = today.strftime("%A")

        stats[day_name] = stats.get(day_name, 0) + 1

    return render_template("statistics.html", stats=stats, title="Статистика броней")


@app.route("/afisha")
def afisha():
    return render_template("afisha.html", title="Афиша")


# =======================================================
#                А Д М И Н – В Х О Д
# =======================================================

@app.route("/admin", methods=["GET", "POST"])
def admin_login():

    # Если уже вошёл — сразу на панель
    if session.get("admin"):
        return redirect("/admin/panel")

    error = None

    if request.method == "POST":
        pwd = request.form.get("password", "")
        if pwd == ADMIN_PASSWORD:
            session["admin"] = True
            return redirect("/admin/panel")
        else:
            error = "Неверный пароль"

    return render_template("admin_login.html", error=error)


# =======================================================
#            А Д М И Н – П А Н Е Л Ь
# =======================================================

@app.route("/admin/panel")
def admin_panel():
    if not session.get("admin"):
        return redirect("/admin")

    reservations = load_reservations()

    return render_template("admin_panel.html", reservations=reservations)


# =======================================================
#         А Д М И Н – О Т М Е Н И Т Ь   Б Р О Н Ь
# =======================================================

@app.route("/admin/cancel", methods=["POST"])
def admin_cancel():
    if not session.get("admin"):
        return redirect("/admin")

    table_id = request.form.get("table_id")

    reservations = load_reservations()

    if table_id in reservations:
        reservations.pop(table_id)
        save_reservations(reservations)

    return redirect("/admin/panel")


# ------------------------
#   API: БРОНИРОВАНИЕ
# ------------------------

@app.route("/api/reserve", methods=["POST"])
def api_reserve():
    data = request.get_json() or {}

    table_id = str(data.get("table_id"))
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    note = (data.get("note") or "").strip()
    secret = str(data.get("secret") or "")
    time_str = (data.get("time") or "").strip()

    if not table_id or not name or not phone or not time_str:
        return jsonify({"ok": False, "msg": "Нужно указать стол, имя, телефон и время"}), 400

    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 10 or len(digits) > 12:
        return jsonify({"ok": False, "msg": "Введите корректный телефон"}), 400

    if not (digits.startswith("7") or digits.startswith("8")):
        return jsonify({"ok": False, "msg": "Телефон должен начинаться с 7 или 8"}), 400

    minutes = time_to_minutes(time_str)
    if minutes is None:
        return jsonify({"ok": False, "msg": "Введите время в формате ЧЧ:ММ"}), 400

    valid_time = (1200 <= minutes <= 23 * 60 + 59) or (0 <= minutes <= 3 * 60)
    if not valid_time:
        return jsonify({"ok": False, "msg": "Время доступно с 20:00 до 03:00"}), 400

    reservations = load_reservations()

    for t, info in reservations.items():
        if info.get("phone") == phone:
            return jsonify({"ok": False, "msg": "Вы уже забронировали стол. Сначала отмените предыдущую бронь."})

    if table_id in reservations:
        return jsonify({"ok": False, "msg": "Стол уже забронирован"}), 400

    # Добавляем бронь

    created_at = datetime.now()
    reservations[table_id] = {
        "name": name,
        "phone": phone,
        "note": note,
        "time": time_str,                      # во сколько придут
        "secret": secret,                      # для отмены
        "created_at": created_at.isoformat(),  # когда бронь создана (полное время)
        # только дата, удобно для статистики
        "created_date": created_at.date().isoformat()
    }
    save_reservations(reservations)
    return jsonify({"ok": True, "msg": "Забронировано"})


# ------------------------
#   API: ОТМЕНА БРОНИ
# ------------------------

@app.route("/api/cancel", methods=["POST"])
def api_cancel():
    data = request.get_json() or {}

    table_id = str(data.get("table_id"))
    secret = str(data.get("secret"))

    reservations = load_reservations()

    if table_id not in reservations:
        return jsonify({"ok": False, "msg": "Бронь не найдена"})

    if str(reservations[table_id].get("secret")) != secret:
        return jsonify({"ok": False, "msg": "Неверный секретный код"})

    reservations.pop(table_id)
    save_reservations(reservations)

    return jsonify({"ok": True})


@app.route("/admin/download")
def admin_download():
    if not session.get("admin"):
        return "Unauthorized", 403

    reservations = load_reservations()

    # Создаём Excel
    wb = Workbook()
    ws = wb.active
    ws.title = "Брони"

    # Заголовки таблицы
    ws.append(["Стол", "Имя", "Телефон", "Время", "Примечание"])

    # Данные
    for table_id, info in reservations.items():
        ws.append([
            table_id,
            info.get("name", ""),
            info.get("phone", ""),
            info.get("time", ""),
            info.get("note", "")
        ])

    # Сохраняем в память
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="insomnia_reservations.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.route("/free_tables")
def free_tables():
    import json
    import datetime

    # Полный список столов (любые названия, как в booking.json)
    all_tables = [
        "VIP1", "VIP2", "VIP3",
        "1", "2", "3", "4", "5", "6",
        "21", "22", "23", "24", "25", "26", "27", "28"
    ]

    # today's date
    today = datetime.date.today().isoformat()

    with open("bookings.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    # собираем занятые столы за сегодня
    booked = []
    for item in data:
        if item.get("date") == today:
            booked.append(str(item.get("table")))

    # считаем свободные
    free = len(all_tables) - len(set(booked))

    return {"free": free}


if __name__ == "__main__":
    app.run(debug=True)
