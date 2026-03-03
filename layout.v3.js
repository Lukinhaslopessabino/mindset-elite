/* ======================================================
   🔥 MINDSET ELITE ULTRA LAYOUT ENGINE v3 (FIXED)
   Clima real + Partículas dinâmicas + Tema automático
   Compatível com global.css
   ====================================================== */

const WEATHER_API_KEY = "5caa07139301db484fef22221d9243e4";
const CITY = "Porto Velho";
const COUNTRY = "BR";

document.addEventListener("DOMContentLoaded", async () => {

  /* ===============================
     🎬 TRANSIÇÃO GLOBAL
  =============================== */

  const transition = document.createElement("div");
  transition.id = "globalTransition";
  document.body.appendChild(transition);

  const style = document.createElement("style");
  style.textContent = `
    #globalTransition{
      position:fixed; inset:0;
      background: radial-gradient(900px 600px at 50% 20%, rgba(0,245,255,.18), transparent 55%),
                  linear-gradient(135deg, rgba(0,0,0,.92), rgba(0,0,0,.92));
      backdrop-filter: blur(14px);
      opacity:0;
      transform: translateY(10px);
      pointer-events:none;
      z-index:99999;
      transition: opacity .28s ease, transform .28s ease;
    }

    #globalTransition.show{
      opacity:1;
      transform: translateY(0);
    }

    canvas#particles{
      position:fixed;
      inset:0;
      z-index:-1;
      pointer-events:none;
    }
  `;
  document.head.appendChild(style);

  const go = (href) => {
    transition.classList.add("show");
    setTimeout(() => window.location.href = href, 220);
  };

  document.querySelectorAll("a").forEach(a=>{
    a.addEventListener("click",(e)=>{
      if(a.origin !== location.origin) return;
      if(a.target === "_blank") return;
      e.preventDefault();
      go(a.href);
    });
  });

  requestAnimationFrame(()=> transition.classList.remove("show"));

  /* ===============================
     🌦 CLIMA REAL
  =============================== */

  let weatherMain = "Clear";

  try{
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${CITY},${COUNTRY}&appid=${WEATHER_API_KEY}`
    );
    const data = await res.json();
    if(data.weather && data.weather.length){
      weatherMain = data.weather[0].main;
    }
  }catch(e){
    console.log("Clima não carregado.");
  }

  /* ===============================
     🕒 TEMA BASEADO NA HORA
     (Integrado ao global.css)
  =============================== */

  const hour = new Date().getHours();

  if(hour >= 6 && hour < 18){
    document.documentElement.style.setProperty("--bg0","#000814");
    document.documentElement.style.setProperty("--bg1","#0f172a");
  }else{
    document.documentElement.style.setProperty("--bg0","#000000");
    document.documentElement.style.setProperty("--bg1","#050505");
  }

  /* ===============================
     🌈 CORES BASEADAS NO CLIMA
  =============================== */

  let particleColor = "#00f5ff";

  switch(weatherMain){
    case "Rain":
    case "Drizzle":
      particleColor = "#3b82f6";
      break;
    case "Clouds":
      particleColor = "#94a3b8";
      break;
    case "Clear":
      particleColor = "#facc15";
      break;
    case "Thunderstorm":
      particleColor = "#a855f7";
      break;
    default:
      particleColor = "#00f5ff";
  }

  document.documentElement.style.setProperty("--accent", particleColor);
  document.documentElement.style.setProperty("--cyan", particleColor);

  /* ===============================
     ✨ PARTÍCULAS DINÂMICAS
  =============================== */

  const canvas = document.createElement("canvas");
  canvas.id = "particles";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener("resize", resize);

  const particles = [];
  const PARTICLE_COUNT = 80;

  for(let i=0;i<PARTICLE_COUNT;i++){
    particles.push({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      size: Math.random()*2+1,
      speedX: (Math.random()-0.5)*0.5,
      speedY: (Math.random()-0.5)*0.5
    });
  }

  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = particleColor;

    particles.forEach(p=>{
      p.x += p.speedX;
      p.y += p.speedY;

      if(p.x < 0 || p.x > canvas.width) p.speedX *= -1;
      if(p.y < 0 || p.y > canvas.height) p.speedY *= -1;

      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }

  animate();

});
