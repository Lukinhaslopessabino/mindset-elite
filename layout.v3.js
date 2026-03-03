/* ======================================================
   🔥 MINDSET ELITE ULTRA LAYOUT ENGINE v3 (SAFE DARK)
   Tema fixo escuro + partículas por clima
   ====================================================== */

const WEATHER_API_KEY = "5caa07139301db484fef22221d9243e4";
const CITY = "Porto Velho";
const COUNTRY = "BR";

document.addEventListener("DOMContentLoaded", async () => {

  /* ===============================
     🌦 CLIMA (apenas para partículas)
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
     🎨 COR APENAS DAS PARTÍCULAS
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
      particleColor = "#00f5ff"; // mantém ciano
      break;
    case "Thunderstorm":
      particleColor = "#a855f7";
      break;
  }

  /* ===============================
     ✨ PARTÍCULAS
  =============================== */

  const canvas = document.createElement("canvas");
  canvas.id = "particles";
  document.body.appendChild(canvas);

  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "-1";
  canvas.style.pointerEvents = "none";

  const ctx = canvas.getContext("2d");

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener("resize", resize);

  const particles = [];
  const COUNT = 80;

  for(let i=0;i<COUNT;i++){
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
