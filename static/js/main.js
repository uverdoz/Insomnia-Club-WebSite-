// переключение слайдов на домашней странице
document.addEventListener("DOMContentLoaded", () => {
    const slides = document.querySelectorAll(".slide");
    let idx = 0;
    if (!slides.length) return;
    setInterval(() => {
        slides[idx].classList.remove("active");
        idx = (idx + 1) % slides.length;
        slides[idx].classList.add("active");
    }, 4000);
});

async function loadFreeTables() {
    try {
        const res = await fetch("/free_tables");
        const data = await res.json();

        document.getElementById("free-counter").textContent =
            "Свободных столов: " + data.free;
    } catch (err) {
        console.error("Ошибка загрузки счётчика:", err);
    }
}

loadFreeTables();                     // грузим сразу
setInterval(loadFreeTables, 15000);   // и обновляем каждые 15 сек