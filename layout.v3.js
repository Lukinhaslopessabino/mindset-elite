document.addEventListener("DOMContentLoaded", () => {

  /* =====================================================
     TRANSIÇÃO GLOBAL
  ===================================================== */

  const t = document.createElement("div");
  t.id = "globalTransition";
  document.body.appendChild(t);

  const style = document.createElement("style");
  style.textContent = `
    #globalTransition{
      position:fixed;
      inset:0;
      background: radial-gradient(900px 600px at 50% 20%, rgba(0,245,255,.15), transparent 55%),
                  rgba(0,0,0,.92);
      backdrop-filter: blur(10px);
      opacity:0;
      pointer-events:none;
      z-index:5000;
      transition: opacity .25s ease;
    }
    #globalTransition.show{ opacity:1; }

    #globalParticles{
      position:fixed;
      inset:0;
      z-index:-1;
    }
  `;
  document.head.appendChild(style);

  const isInternal = (a) => {
    try { return a.origin === window.location.origin; }
    catch { return false; }
  };

  const shouldSkip = (a) => {
    if (a.target === "_blank") return true;
    if (a.hasAttribute("download")) return true;
    if (!isInternal(a)) return true;

    const url = new URL(a.href);
    if (url.pathname === window.location.pathname && url.hash) return true;

    return false;
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    if (shouldSkip(a)) return;

    e.preventDefault();
    t.classList.add("show");
    setTimeout(() => window.location.href = a.href, 180);
  });

  window.addEventListener("pageshow", () => {
    t.classList.remove("show");
  });

  /* =====================================================
     PARTÍCULAS GLOBAL (LEVE)
  ===================================================== */

  const particlesDiv = document.createElement("div");
  particlesDiv.id = "globalParticles";
  document.body.appendChild(particlesDiv);

  if(window.innerWidth > 600){

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js";
    script.onload = () => {

      particlesJS("globalParticles", {
        particles: {
          number: { value: 40 },
          color: { value: "#00F5FF" },
          line_linked: {
            enable: true,
            color: "#00F5FF",
            opacity: 0.3
          },
          move: { speed: 0.6 }
        },
        interactivity: {
          events: {
            onhover: { enable: false },
            onclick: { enable: false }
          }
        },
        retina_detect: true
      });

    };

    document.body.appendChild(script);
  }

});
