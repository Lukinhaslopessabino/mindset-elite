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
            // timeout de 5s para não travar o carregamento se a API demorar
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${WEATHER_CONFIG.city},${WEATHER_CONFIG.country}&appid=${WEATHER_CONFIG.key}`,
                { signal: controller.signal }
            );
            const data = await response.json();
            if (data.weather && data.weather[0]) {
                weatherStatus = data.weather[0].main;
            }
        } catch (err) {
            console.warn("Mindset Engine: Usando tema padrão (Offline/API Limit).");
        }

        const themes = {
            'Rain': '#3b82f6',         // Azul Chuva
            'Drizzle': '#60a5fa',      // Azul Claro
            'Clouds': '#94a3b8',       // Cinza Azulado
            'Clear': '#00e0ff',        // Ciano Neon (Padrão)
            'Thunderstorm': '#a855f7', // Roxo Trovão
            'Snow': '#ffffff',         // Branco Neve
            'Mist': '#5eead4'          // Turquesa Neblina
        };

        accentColor = themes[weatherStatus] || WEATHER_CONFIG.defaultColor;

        // APLICAÇÃO DA COR NO CSS GLOBAL (Sobrescreve a variável :root)
        document.documentElement.style.setProperty('--primary', accentColor);
        document.documentElement.style.setProperty('--primary-glow', `${accentColor}66`); // 40% opacidade
    }

    await updateWeatherTheme();

    // --- 2. SISTEMA DE PARTÍCULAS NEON ---
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: true });
    document.body.appendChild(canvas);

    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "-1";
    canvas.style.pointerEvents = "none";
    canvas.style.opacity = "0.4"; 

    let particles = [];
    // Menos partículas no mobile para salvar bateria
    const particleCount = window.innerWidth < 768 ? 30 : 70;

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
            this.size = Math.random() * 1.2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x > canvas.width) this.x = 0;
            else if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            else if (this.y < 0) this.y = canvas.height;
        }

        draw() {
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function connectParticles() {
        const maxDistance = 120;
        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                const dx = particles[a].x - particles[b].x;
                const dy = particles[a].y - particles[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    const opacity = 1 - (distance / maxDistance);
                    ctx.strokeStyle = accentColor;
                    ctx.globalAlpha = opacity * 0.15; // Linhas bem sutis
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
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        connectParticles();
        requestAnimationFrame(animate);
    }

    // Debounce no resize para não travar o navegador
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(initCanvas, 250);
    });

    initCanvas();
    animate();

    console.log(`%c Mindset Elite Engine v3.5 | Clima: ${weatherStatus} | Cor: ${accentColor}`, `color: ${accentColor}; font-weight: bold; background: #000; padding: 4px; border-radius: 4px;`);
});
