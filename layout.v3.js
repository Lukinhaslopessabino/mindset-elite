document.addEventListener("DOMContentLoaded", () => {

/* =========================================================
   🌎 ULTRA ENVIRONMENT ENGINE + PREMIUM BACKGROUND
========================================================= */

/* =======================
   🌈 CSS VARIABLES INIT
======================= */

const root = document.documentElement;

if(!getComputedStyle(root).getPropertyValue("--accent")){
  root.style.setProperty("--accent","#00F5FF");
}
if(!getComputedStyle(root).getPropertyValue("--bg-primary")){
  root.style.setProperty("--bg-primary","#05070d");
}

/* =======================
   ⚙ CONFIG
======================= */

const WEATHER_API_KEY = "5caa07139301db484fef22221d9243e4";
const CITY = "Porto Velho";

const THEMES = {
  night: { bg:"#05070d", accent:"#00F5FF", particle:"#00F5FF" },
  day: { bg:"#f4f7fb", accent:"#0077ff", particle:"#0077ff" },
  rain: { bg:"#0b1a2b", accent:"#00cfff", particle:"#00cfff" },
  cloudy: { bg:"#1c1f2a", accent:"#aaaaaa", particle:"#aaaaaa" }
};

/* =======================
   🎯 APPLY THEME
======================= */

function applyTheme(name){
  const t = THEMES[name];
  if(!t) return;

  root.style.setProperty("--bg-primary", t.bg);
  root.style.setProperty("--accent", t.accent);

  currentParticleColor = t.particle;

  if(threeMaterial){
    threeMaterial.color.set(t.particle);
  }
}

/* =======================
   🕒 TIME
======================= */

function themeByTime(){
  const h = new Date().getHours();
  return (h >= 6 && h <= 18) ? "day" : "night";
}

/* =======================
   🌦 WEATHER
======================= */

async function themeByWeather(){
  try{
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${WEATHER_API_KEY}`
    );
    const data = await res.json();
    const main = data.weather[0].main.toLowerCase();

    if(main.includes("rain")) return "rain";
    if(main.includes("cloud")) return "cloudy";
    return themeByTime();
  }catch{
    return themeByTime();
  }
}

/* INIT THEME */
themeByWeather().then(applyTheme);

/* =========================================================
   🌌 PREMIUM BACKGROUND
========================================================= */

const bg = document.createElement("div");
bg.id="premiumBg";
document.body.appendChild(bg);

/* =========================================================
   ✨ PARTICLES 2D (color dynamic)
========================================================= */

const canvas = document.createElement("canvas");
canvas.id="premiumParticles";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

let w,h;
function resize(){
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize",resize);

let currentParticleColor = "#00F5FF";

const particles = [];
for(let i=0;i<60;i++){
  particles.push({
    x:Math.random()*w,
    y:Math.random()*h,
    vx:(Math.random()-0.5)*0.4,
    vy:(Math.random()-0.5)*0.4,
    r:Math.random()*2+1
  });
}

function animate2D(){
  ctx.clearRect(0,0,w,h);

  ctx.fillStyle=currentParticleColor;

  particles.forEach(p=>{
    p.x+=p.vx;
    p.y+=p.vy;

    if(p.x<0||p.x>w)p.vx*=-1;
    if(p.y<0||p.y>h)p.vy*=-1;

    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
  });

  requestAnimationFrame(animate2D);
}
animate2D();

/* =========================================================
   🌠 THREE.JS 3D (color dynamic real)
========================================================= */

let threeMaterial = null;

if(window.THREE && window.innerWidth > 768){

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,1,2000);
  camera.position.z = 700;

  const renderer = new THREE.WebGLRenderer({alpha:true});
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.domElement.id="premiumThree";
  document.body.appendChild(renderer.domElement);

  const geometry = new THREE.BufferGeometry();
  const vertices = [];

  for(let i=0;i<1200;i++){
    vertices.push(
      THREE.MathUtils.randFloatSpread(2000),
      THREE.MathUtils.randFloatSpread(2000),
      THREE.MathUtils.randFloatSpread(2000)
    );
  }

  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));

  threeMaterial = new THREE.PointsMaterial({
    color:0x00f5ff,
    size:1.7
  });

  const points = new THREE.Points(geometry,threeMaterial);
  scene.add(points);

  function animate3D(){
    points.rotation.x+=0.0004;
    points.rotation.y+=0.0004;
    renderer.render(scene,camera);
    requestAnimationFrame(animate3D);
  }
  animate3D();

  window.addEventListener("resize",()=>{
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
  });
}

/* =========================================================
   🔥 NEON CURSOR
========================================================= */

const cursor=document.createElement("div");
cursor.id="neonCursor";
document.body.appendChild(cursor);

document.addEventListener("mousemove",e=>{
  cursor.style.left=e.clientX+"px";
  cursor.style.top=e.clientY+"px";
});

/* =========================================================
   🔄 TRANSITION
========================================================= */

const transition=document.createElement("div");
transition.id="globalTransition";
document.body.appendChild(transition);

document.addEventListener("click",e=>{
  const a=e.target.closest("a");
  if(!a) return;
  if(a.target==="_blank") return;
  if(a.href.includes("#")) return;
  if(new URL(a.href).origin!==location.origin) return;

  e.preventDefault();
  transition.classList.add("show");
  setTimeout(()=>location.href=a.href,180);
});

});
