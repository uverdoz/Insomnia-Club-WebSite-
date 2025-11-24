document.querySelectorAll(".afisha-card").forEach(card => {
    card.addEventListener("mousemove", e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        const rotateX = (+y / 20);
        const rotateY = (-x / 20);

        card.style.transform =
            `translateY(-8px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener("mouseleave", () => {
        card.style.transform =
            "translateY(0) rotateX(0) rotateY(0)";
    });
});