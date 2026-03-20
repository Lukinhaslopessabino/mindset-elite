/* ============================================================
    🔥 MINDSET ELITE - ULTRA VISUAL ENGINE v3.9 (OTIMIZADO)
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
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${WEATHER_CONFIG.city},${WEATHER_CONFIG.country}&appid=${WEATHER_CONFIG.key}`,
                { signal: controller.signal }
            );
            
            const data = await response.json();
            clearTimeout(timeoutId);

            if (data.weather && data.weather[0]) {
                weatherStatus = data.weather[0].main;
            }
        } catch (err) {
            console.warn("Mindset Engine: Usando tema padrão.");
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

        document.documentElement.style.setProperty('--primary', accentColor);
        document.documentElement.style.setProperty('--primary-glow', `${accentColor}66`);
    }

    await updateWeatherTheme();

    // --- 2. SISTEMA DE PARTÍCULAS NEON ---
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: true });
    document.body.appendChild(canvas);

    Object.assign(canvas.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        zIndex: "-1",
        pointerEvents: "none",
        opacity: "0.4"
    });

    let particles = [];
    let particleCount = window.innerWidth < 768 ? 15 : 45;

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
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
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

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }

    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    initCanvas();
    animate();

    // --- 3. REGISTRO DO SERVICE WORKER (CORREÇÃO DE DOMÍNIO) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Usando caminho absoluto "/" para evitar ERR_FAILED em subpáginas
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(reg => {
                    console.log('%c Mindset Elite PWA: Ativo ✅', 'color: #00ffaa; font-weight: bold;');
                    // Força atualização se houver mudança de domínio
                    reg.update();
                })
                .catch(err => console.error('Erro ao registrar Service Worker:', err));
        });
    }
});
