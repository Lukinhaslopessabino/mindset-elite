/* ============================================================
   🔥 MINDSET ELITE - ULTRA VISUAL ENGINE v3.5
   Partículas Inteligentes & Integração Meteorológica
   ============================================================ */

const WEATHER_CONFIG = {
    key: "5caa07139301db484fef22221d9243e4",
    city: "Porto Velho",
    country: "BR",
    defaultColor: "#00e0ff"
};

document.addEventListener("DOMContentLoaded", async () => {
    
    // --- 1. GESTÃO DE CLIMA & CORES ---
    let weatherStatus = "Clear";
    let accentColor = WEATHER_CONFIG.defaultColor;

    async function updateWeatherTheme() {
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${WEATHER_CONFIG.city},${WEATHER_CONFIG.country}&appid=${WEATHER_CONFIG.key}`
            );
            const data = await response.json();
            if (data.weather && data.weather[0]) {
                weatherStatus = data.weather[0].main;
            }
        } catch (err) {
            console.warn("Mindset Engine: Usando tema padrão (Offline/API Limit).");
        }

        const themes = {
            'Rain': '#3b82f6',
            'Drizzle': '#60a5fa',
            'Clouds': '#94a3b8',
            'Clear': '#00e0ff',
            'Thunderstorm': '#a855f7',
            'Snow': '#ffffff'
        };
        accentColor = themes[weatherStatus] || WEATHER_CONFIG.defaultColor;
    }

    await updateWeatherTheme();

    // --- 2. SISTEMA DE PARTÍCULAS NEON ---
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    document.body.appendChild(canvas);

    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.zIndex = "-1";
    canvas.style.pointerEvents = "none";
    canvas.style.opacity = "0.5"; // Suavidade para não atrapalhar a leitura

    let particles = [];
    const particleCount = window.innerWidth < 768 ? 40 : 80;

    function initCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            if (this.y < 0) this.y = canvas.height;
        }

        draw() {
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Função para desenhar linhas conectando partículas próximas (Efeito Tech)
    function connectParticles() {
        const maxDistance = 150;
        for (let a = 0; a < particles.length; a++) {
            for (let b = a; b < particles.length; b++) {
                const dx = particles[a].x - particles[b].x;
                const dy = particles[a].y - particles[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    const opacity = 1 - (distance / maxDistance);
                    ctx.strokeStyle = accentColor;
                    ctx.globalAlpha = opacity * 0.2;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        connectParticles();
        requestAnimationFrame(animate);
    }

    window.addEventListener("resize", () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(initCanvas, 200);
    });

    initCanvas();
    animate();

    console.log(`%c Mindset Elite Engine v3.5 Ativo | Clima: ${weatherStatus}`, `color: ${accentColor}; font-weight: bold;`);
});
