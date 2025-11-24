// booking.js — версия с ручным вводом времени и проверкой диапазона

document.addEventListener("DOMContentLoaded", () => {


    // ----------------------------
    // АВТО-СБРОС LOCALSTORAGE если бронь удалена админом
    // ----------------------------
    (function syncLocalReservation() {
        let lsTable = localStorage.getItem("reservation_table");
        let lsSecret = localStorage.getItem("reservation_secret");

        // если браузер думает, что у нас есть бронь  
        if (lsTable && lsSecret) {
            // но сервер говорит — стола нет!
            if (!serverReservations[lsTable]) {
                console.log("Сервер: стола нет → очищаем localStorage");
                localStorage.removeItem("reservation_table");
            }
        }
    })();
    // ----------------------------
    // 1) SECRET ДЛЯ УСТРОЙСТВА
    // ----------------------------
    let deviceSecret = localStorage.getItem("reservation_secret");
    if (!deviceSecret) {
        deviceSecret = Math.floor(100000 + Math.random() * 900000);
        localStorage.setItem("reservation_secret", String(deviceSecret));
        console.log("Создан новый SECRET:", deviceSecret);
    } else {
        console.log("SECRET уже есть:", deviceSecret);
    }

    // ----------------------------
    // 2) ЭЛЕМЕНТЫ ЭТАЖЕЙ
    // ----------------------------
    const floor1Btn = document.getElementById("floor1Btn");
    const floor2Btn = document.getElementById("floor2Btn");
    const floor1 = document.getElementById("floor1");
    const floor2 = document.getElementById("floor2");

    // ----------------------------
    // 3) МОДАЛКА
    // ----------------------------
    const modalBg = document.createElement("div");
    modalBg.className = "modal-bg";
    modalBg.style.display = "none";

    modalBg.innerHTML = `
        <div class="modal">
            <h3 id="modalTitle">Бронь</h3>

            <input id="cname" placeholder="Ваше имя">

            <input id="cphone" placeholder="+7 777 123 45 67" inputmode="tel" maxlength="18">
            <div style="font-size:12px; opacity:0.7; margin-top:-6px; margin-bottom:4px;">
                Телефон должен начинаться с 7 или 8, минимум 10 цифр
            </div>

            <input id="ctime" placeholder="Во сколько? (например: 22:30)" maxlength="5">

            <input id="cnote" placeholder="(Цель визита)">

            <div style="display:flex; gap:8px;">
                <button id="confirmBtn">Жмяк для брони!</button>
                <button id="closeBtn">Закрыть</button>
            </div>

            <div id="modalMsg" style="color:#fff; margin-top:6px;"></div>
        </div>`;
    document.body.appendChild(modalBg);

    const modalTitle = modalBg.querySelector("#modalTitle");
    const cname = modalBg.querySelector("#cname");
    const cphone = modalBg.querySelector("#cphone");
    const ctime = modalBg.querySelector("#ctime");
    const cnote = modalBg.querySelector("#cnote");
    const confirmBtn = modalBg.querySelector("#confirmBtn");
    const closeBtn = modalBg.querySelector("#closeBtn");
    const modalMsg = modalBg.querySelector("#modalMsg");

    let selectedTable = null;

    // Закрытие окна
    closeBtn.addEventListener("click", () => {
        modalBg.style.display = "none";
    });

    // ----------------------------
    // 4) АВТОФОРМАТ ТЕЛЕФОНА
    // ----------------------------
    cphone.addEventListener("input", () => {
        let digits = cphone.value.replace(/\D/g, "");

        // 8 → 7
        if (digits.startsWith("8")) {
            digits = "7" + digits.slice(1);
        }

        if (digits.length > 11) digits = digits.slice(0, 11);

        if (digits.length === 0) {
            cphone.value = "";
        } else if (digits.length <= 1) {
            cphone.value = `+${digits}`;
        } else if (digits.length <= 4) {
            cphone.value = `+${digits[0]} ${digits.slice(1)}`;
        } else if (digits.length <= 7) {
            cphone.value = `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4)}`;
        } else if (digits.length <= 9) {
            cphone.value = `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
        } else {
            cphone.value = `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
        }
    });

    // ----------------------------
    // 5) БЛОКИРОВКА СИМВОЛОВ ВО ВРЕМЕНИ (ТОЛЬКО ЦИФРЫ И :)
    // ----------------------------
    ctime.addEventListener("input", () => {
        // Разрешаем только цифры и двоеточие
        let v = ctime.value.replace(/[^\d:]/g, "");

        // Если ввёл 4 цифры без двоеточия → 2230 -> 22:30
        if (/^\d{4}$/.test(v)) {
            v = v.slice(0, 2) + ":" + v.slice(2);
        }

        // Если больше одного двоеточия → оставляем только первое
        const parts = v.split(":");
        if (parts.length > 2) {
            v = parts[0] + ":" + parts[1];
        }

        // Обрезаем до формата ЧЧ:ММ (макс. 5 символов)
        if (v.length > 5) v = v.slice(0, 5);

        ctime.value = v;
    });

    // ----------------------------
    // 6) ПЕРЕКЛЮЧЕНИЕ ЭТАЖЕЙ
    // ----------------------------
    function showFloor1() {
        floor1.classList.add("active-floor-block");
        floor2.classList.remove("active-floor-block");
        floor1.classList.remove("dimmed");
        floor2.classList.add("dimmed");
        floor1Btn.classList.add("active-floor");
        floor2Btn.classList.remove("active-floor");
    }

    function showFloor2() {
        floor2.classList.add("active-floor-block");
        floor1.classList.remove("active-floor-block");
        floor2.classList.remove("dimmed");
        floor1.classList.add("dimmed");
        floor2Btn.classList.add("active-floor");
        floor1Btn.classList.remove("active-floor");
    }

    floor1Btn.addEventListener("click", showFloor1);
    floor2Btn.addEventListener("click", showFloor2);
    showFloor1(); // по умолчанию 1-й этаж

    // ----------------------------
    // 7) НАЖАТИЕ НА СТОЛ
    // ----------------------------
    document.querySelectorAll(".table").forEach(el => {
        el.addEventListener("click", () => {
            const tableId = el.dataset.table;

            // Стол занят
            if (el.classList.contains("booked")) {
                const myTable = localStorage.getItem("reservation_table");
                if (myTable === tableId) {
                    // Отмена своей брони
                    fetch("/api/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ table_id: tableId, secret: deviceSecret })
                    })
                        .then(r => r.json())
                        .then(data => {
                            if (data.ok) {
                                localStorage.removeItem("reservation_table");
                                alert("Бронь отменена!");
                                location.reload();
                            } else {
                                alert(data.msg || "Ошибка");
                            }
                        });
                } else {
                    alert("Этот стол забронирован другим пользователем.");
                }
                return;
            }

            // Этаж затемнён
            if (el.closest(".floor").classList.contains("dimmed")) return;

            // Уже есть бронь на другой стол
            const myExisting = localStorage.getItem("reservation_table");
            if (myExisting && myExisting !== tableId) {
                alert("У вас уже есть бронь. Сначала отмените её.");
                return;
            }

            // Открываем модалку (очищаем поля)
            selectedTable = tableId;
            modalTitle.textContent = `Бронь стола ${tableId}`;
            cname.value = "";
            cphone.value = "";
            ctime.value = "";
            cnote.value = "";
            modalMsg.textContent = "";

            modalBg.style.display = "flex";
        });
    });

    // ----------------------------
    // ПОМОЩНИК: парсим время в минуты
    // ----------------------------
    function parseTime(str) {
        if (!str) return null;
        const parts = str.split(":");
        if (parts.length !== 2) return null;
        const hh = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10);
        if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
        if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
        return hh * 60 + mm;
    }

    // ----------------------------
    // 8) ПОДТВЕРЖДЕНИЕ БРОНИ
    // ----------------------------
    confirmBtn.addEventListener("click", async () => {

        const name = cname.value.trim();
        const phone = cphone.value.trim();
        const note = cnote.value.trim();
        const timeStr = ctime.value.trim();

        if (!name || !phone || !timeStr) {
            modalMsg.style.color = "red";
            modalMsg.textContent = "Введите имя, телефон и время!";
            return;
        }

        // Телефон
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 12) {
            modalMsg.style.color = "red";
            modalMsg.textContent = "Введите корректный телефон";
            return;
        }
        if (!(digits.startsWith("7") || digits.startsWith("8"))) {
            modalMsg.style.color = "red";
            modalMsg.textContent = "Телефон должен начинаться с 7 или 8";
            return;
        }

        // Время
        const parsed = parseTime(timeStr);
        if (parsed === null) {
            modalMsg.style.color = "red";
            modalMsg.textContent = "Введите время в формате ЧЧ:ММ (например 22:30)";
            return;
        }

        // 20:00–23:59 → 1200–1439
        // 00:00–03:00 → 0–180
        const isValid =
            (parsed >= 20 * 60 && parsed <= 23 * 60 + 59) ||
            (parsed >= 0 && parsed <= 3 * 60);

        if (!isValid) {
            modalMsg.style.color = "red";
            modalMsg.textContent = "Время доступно с 20:00 до 03:00";
            return;
        }

        modalMsg.style.color = "#fff";
        modalMsg.textContent = "Отправляем...";

        try {
            const r = await fetch("/api/reserve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    table_id: selectedTable,
                    name,
                    phone,
                    time: timeStr,
                    note,
                    secret: deviceSecret
                })
            });

            const data = await r.json();

            if (r.ok && data.ok) {
                localStorage.setItem("reservation_table", selectedTable);
                modalMsg.style.color = "#3cff7f";
                modalMsg.textContent = "Забронировано!";
                setTimeout(() => location.reload(), 600);
            } else {
                modalMsg.style.color = "red";
                modalMsg.textContent = data.msg || "Ошибка";
            }

        } catch (err) {
            modalMsg.style.color = "red";
            modalMsg.textContent = "Ошибка соединения";
        }

    });

});