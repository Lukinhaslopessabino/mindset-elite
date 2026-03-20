/* ============================================================
    🔥 MINDSET ELITE - ULTRA VISUAL ENGINE v3.6 (RESPONSIVE)
    Partículas, Clima Real, PWA & Performance Mobile
   ============================================================ */

const WEATHER_CONFIG = {
    key: "5caa07139301db484fef22221d9243e4",
    city: "Porto Velho",
    country: "BR",
    defaultColor: "#00e0ff"
};

document.addEventListener("DOMContentLoaded", async () => {
    
    // --- 1. GESTÃO DE CLIMA & CORES DINÂMICAS ---
    let weatherStatus = "Clear";
    let accentColor = WEATHER_CONFIG.defaultColor;

    async function updateWeatherTheme() {
        try {
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
            'Rain': '#3b82f6',         
            'Drizzle': '#60a5fa',      
            'Clouds': '#94a3b8',       
            'Clear': '#00e0ff',        
            'Thunderstorm': '#a855f7', 
            'Snow': '#ffffff',         
            'Mist': '#5eead4'          
        };

        accentColor = themes[weatherStatus] || WEATHER_CONFIG.defaultColor;

        // Aplica a cor do clima nas variáveis do CSS Global
        document.documentElement.style.setProperty('--primary', accentColor);
        document.documentElement.style.setProperty('--primary-glow', `${accentColor}66`);
    }

    await updateWeatherTheme();

    // --- 2. SISTEMA DE PARTÍCULAS NEON (OTIMIZADO) ---
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: true });
    document.body.appendChild(canvas);

    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "-1"; // Atrás de tudo
    canvas.style.pointerEvents = "none";
    canvas.style.opacity = "0.4"; 

    let particles = [];
    // Reduz partículas no mobile para economizar bateria
    let particleCount = window.innerWidth < 768 ? 25 : 60;

    function initCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particleCount = window.innerWidth < 768 ? 25 : 60;
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
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
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
        const maxDistance = window.innerWidth < 768 ? 90 : 120;
        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                const dx = particles[a].x - particles[b].x;
                const dy = particles[a].y - particles[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    const opacity = 1 - (distance / maxDistance);
                    ctx.strokeStyle = accentColor;
                    ctx.globalAlpha = opacity * 0.12;
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

    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(initCanvas, 250);
    });

    initCanvas();
    animate();

    // --- 3. REGISTRO DO SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        try {
            // Caminho relativo para funcionar em qualquer subpasta
            await navigator.serviceWorker.register('sw.js');
            console.log('%c Mindset Elite PWA: Ativo ✅', 'color: #00ffaa; font-weight: bold;');
        } catch (err) {
            console.warn('PWA: Rodando em modo local ou erro de SW.');
        }
    }

    console.log(`%c Engine v3.6 Ativa | Clima: ${weatherStatus}`, `color: ${accentColor}; font-weight: bold;`);
});
