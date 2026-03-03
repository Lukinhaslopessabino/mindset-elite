document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     CONFIG (você pode mexer aqui)
  ========================================================= */
  const CFG = {
    // performance
    mobileMinWidth: 700, // abaixo disso usa versão mais leve
    maxFPS: 60,
    particles: {
      desktop: 70,
      mobile: 35,
      sizeMin: 0.8,
      sizeMax: 2.2,
      speed: 0.25, // movimento suave tipo Apple
      linkDist: 140, // distância para “linhas”
      linkAlpha: 0.18,
      repelRadius: 140, // raio da interação
      repelStrength: 0.90, // força do repel
      drift: 0.06 // leve “flutuação”
    },
    neon: {
      // fundo gradiente animado
      enable: true,
      // “hacker glow” suave
      glow: true
    },
    three: {
      enable: true,
      // só ativa 3D real se THREE existir (página carregou three.min.js)
      requireThreeGlobal: true,
      stars: 1200,
      size: 1.7,
      rotateSpeed: 0.00035
    }
  };

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isMobileLike = window.innerWidth < CFG.mobileMinWidth;
  const shouldAnimate = !prefersReduced;

  /* =========================================================
     1) TRANSIÇÃO GLOBAL ENTRE PÁGINAS
  ========================================================= */
  const transition = document.createElement("div");
  transition.id = "globalTransition";
  document.body.appendChild(transition);

  const style = document.createElement("style");
  style.textContent = `
    :root{
      --nav-safe: env(safe-area-inset-bottom);
    }

    /* Fundo premium global */
    #premiumBg{
      position:fixed; inset:0;
      z-index:-3;
      pointer-events:none;
      background:
        radial-gradient(900px 600px at 15% 10%, rgba(0,245,255,.14), transparent 60%),
        radial-gradient(900px 600px at 85% 20%, rgba(99,91,255,.12), transparent 55%),
        radial-gradient(900px 600px at 55% 95%, rgba(0,153,255,.12), transparent 60%),
        linear-gradient(135deg, #04050a, #060818, #04050a);
      background-size: 140% 140%;
      filter: saturate(1.05);
    }

    /* Gradiente animado premium */
    ${CFG.neon.enable ? `
    #premiumBg{
      animation: premiumShift 10s ease-in-out infinite;
    }
    @keyframes premiumShift{
      0%{ background-position: 0% 0%; }
      50%{ background-position: 100% 100%; }
      100%{ background-position: 0% 0%; }
    }` : ``}

    /* Glow “hacker” suave */
    ${CFG.neon.glow ? `
    #premiumGlow{
      position:fixed; inset:-20%;
      z-index:-2;
      pointer-events:none;
      background:
        radial-gradient(600px 420px at 30% 30%, rgba(0,245,255,.10), transparent 60%),
        radial-gradient(700px 500px at 70% 20%, rgba(99,91,255,.08), transparent 60%),
        radial-gradient(700px 520px at 50% 85%, rgba(0,153,255,.09), transparent 65%);
      mix-blend-mode: screen;
      filter: blur(14px);
      opacity:.9;
    }` : ``}

    /* Canvas particles */
    #premiumParticles{
      position:fixed;
      inset:0;
      z-index:-1;
      pointer-events:none;
    }

    /* Three.js canvas (fica por trás das particles 2D) */
    #premiumThree{
      position:fixed;
      inset:0;
      z-index:-2;
      pointer-events:none;
      opacity:.9;
    }

    /* Overlay transição */
    #globalTransition{
      position:fixed;
      inset:0;
      z-index:99999;
      pointer-events:none;
      opacity:0;
      transform: translateY(10px);
      transition: opacity .22s ease, transform .22s ease;
      background:
        radial-gradient(1000px 700px at 50% 20%, rgba(0,245,255,.18), transparent 55%),
        radial-gradient(900px 650px at 70% 30%, rgba(99,91,255,.14), transparent 60%),
        rgba(0,0,0,.90);
      backdrop-filter: blur(10px);
    }
    #globalTransition.show{
      opacity:1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  const isInternal = (a) => {
    try { return a.origin === window.location.origin; } catch { return false; }
  };

  const shouldSkip = (a) => {
    if (!a) return true;
    if (a.target === "_blank") return true;
    if (a.hasAttribute("download")) return true;
    if (!isInternal(a)) return true;

    // não bloqueia âncoras na mesma página
    const url = new URL(a.href);
    if (url.pathname === window.location.pathname && url.hash) return true;

    // não intercepta cliques dentro de coisas “interativas”
    const tag = (a.closest("button,input,textarea,select,label") ? "skip" : "");
    if (tag === "skip") return true;

    return false;
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    if (shouldSkip(a)) return;

    e.preventDefault();
    transition.classList.add("show");
    setTimeout(() => (window.location.href = a.href), 180);
  });

  window.addEventListener("pageshow", () => {
    transition.classList.remove("show");
  });

  /* =========================================================
     2) INJETA FUNDO PREMIUM + CANVAS
  ========================================================= */
  const bg = document.createElement("div");
  bg.id = "premiumBg";
  document.body.appendChild(bg);

  if (CFG.neon.glow) {
    const glow = document.createElement("div");
    glow.id = "premiumGlow";
    document.body.appendChild(glow);
  }

  const canvas = document.createElement("canvas");
  canvas.id = "premiumParticles";
  document.body.appendChild(canvas);

  /* =========================================================
     3) PARTÍCULAS PREMIUM (2D) – “Apple smooth”
  ========================================================= */
  const ctx = canvas.getContext("2d", { alpha: true });
  let w = 0, h = 0, dpr = 1;

  const pointer = {
    x: -9999, y: -9999,
    active: false
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  function onPointerMove(x, y) {
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
  }
  window.addEventListener("mousemove", (e) => onPointerMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (t) onPointerMove(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener("mouseleave", () => { pointer.active = false; pointer.x = -9999; pointer.y = -9999; }, { passive: true });
  window.addEventListener("touchend", () => { pointer.active = false; pointer.x = -9999; pointer.y = -9999; }, { passive: true });

  const count = isMobileLike ? CFG.particles.mobile : CFG.particles.desktop;
  const particles = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-CFG.particles.speed, CFG.particles.speed),
        vy: rand(-CFG.particles.speed, CFG.particles.speed),
        r: rand(CFG.particles.sizeMin, CFG.particles.sizeMax),
        phase: rand(0, Math.PI * 2)
      });
    }
  }
  initParticles();

  // Throttle FPS (evita consumo exagerado)
  let last = performance.now();
  const minFrame = 1000 / CFG.maxFPS;

  function step(now) {
    requestAnimationFrame(step);
    if (!shouldAnimate) return;

    const dt = now - last;
    if (dt < minFrame) return;
    last = now;

    ctx.clearRect(0, 0, w, h);

    // desenha links
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];

      // drift suave tipo Apple (seno)
      a.phase += 0.01;
      a.vx += Math.sin(a.phase) * CFG.particles.drift * 0.001;
      a.vy += Math.cos(a.phase) * CFG.particles.drift * 0.001;

      // interação (repulsão)
      if (pointer.active) {
        const dx = a.x - pointer.x;
        const dy = a.y - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CFG.particles.repelRadius) {
          const f = (1 - dist / CFG.particles.repelRadius) * CFG.particles.repelStrength;
          a.vx += (dx / (dist || 1)) * f * 0.08;
          a.vy += (dy / (dist || 1)) * f * 0.08;
        }
      }

      // move
      a.x += a.vx;
      a.y += a.vy;

      // amortecimento suave
      a.vx *= 0.985;
      a.vy *= 0.985;

      // wrap nas bordas
      if (a.x < -30) a.x = w + 30;
      if (a.x > w + 30) a.x = -30;
      if (a.y < -30) a.y = h + 30;
      if (a.y > h + 30) a.y = -30;

      // links
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        const max = CFG.particles.linkDist;
        if (d2 < max * max) {
          const d = Math.sqrt(d2);
          const alpha = (1 - d / max) * CFG.particles.linkAlpha;
          ctx.strokeStyle = `rgba(0,245,255,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // desenha partículas
    for (const p of particles) {
      ctx.beginPath();
      ctx.fillStyle = "rgba(0,245,255,.72)";
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  requestAnimationFrame(step);

  /* =========================================================
     4) THREE.JS (3D real) – estrela/space premium
     - Só ativa se THREE estiver disponível
  ========================================================= */
  function canUseThree() {
    if (!CFG.three.enable) return false;
    if (CFG.three.requireThreeGlobal && !window.THREE) return false;
    if (!shouldAnimate) return false;
    if (isMobileLike) return false; // 3D real só no desktop (mais bonito/leve)
    return true;
  }

  function initThree() {
    if (!canUseThree()) return;

    const threeCanvas = document.createElement("canvas");
    threeCanvas.id = "premiumThree";
    document.body.appendChild(threeCanvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2500);
    camera.position.z = 700;

    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // estrelas
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < CFG.three.stars; i++) {
      vertices.push(
        THREE.MathUtils.randFloatSpread(2000),
        THREE.MathUtils.randFloatSpread(2000),
        THREE.MathUtils.randFloatSpread(2000)
      );
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({ color: 0x00f5ff, size: CFG.three.size });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    function animate() {
      requestAnimationFrame(animate);

      // rotação suave
      points.rotation.x += CFG.three.rotateSpeed;
      points.rotation.y += CFG.three.rotateSpeed;

      // interação bem leve
      if (pointer.active) {
        const nx = (pointer.x / window.innerWidth) * 2 - 1;
        const ny = -((pointer.y / window.innerHeight) * 2 - 1);
        points.rotation.y += nx * 0.00015;
        points.rotation.x += ny * 0.00015;
      }

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });
  }

  initThree();

  /* =========================================================
     5) SEGURANÇA: não deixar travar loader de páginas antigas
     (se existir #loader em alguma página, remove em 3s no máximo)
  ========================================================= */
  const loader = document.getElementById("loader");
  if (loader) {
    // tenta remover quando terminar de carregar
    window.addEventListener("load", () => {
      loader.style.opacity = "0";
      setTimeout(() => { loader.style.display = "none"; }, 400);
    });

    // fallback: se algo deu ruim, remove sozinho
    setTimeout(() => {
      if (loader && getComputedStyle(loader).display !== "none") {
        loader.style.opacity = "0";
        setTimeout(() => { loader.style.display = "none"; }, 350);
      }
    }, 3000);
  }
});
