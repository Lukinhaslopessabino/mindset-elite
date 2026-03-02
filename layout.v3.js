document.addEventListener("DOMContentLoaded", () => {
  // Overlay de transição (CSS puro, não depende de GSAP)
  const t = document.createElement("div");
  t.id = "globalTransition";
  document.body.appendChild(t);

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
  `;
  document.head.appendChild(style);

  const isInternal = (a) => {
    try { return a.origin === window.location.origin; } catch { return false; }
  };

  const shouldSkip = (a) => {
    // abre em nova aba, download, âncora ou links externos
    if (a.target === "_blank") return true;
    if (a.hasAttribute("download")) return true;
    if (!isInternal(a)) return true;
    const url = new URL(a.href);
    if (url.pathname === window.location.pathname && url.hash) return true;
    return false;
  };

  const go = (href) => {
    t.classList.add("show");
    // tempo curto pra sentir "app"
    setTimeout(() => { window.location.href = href; }, 220);
  };

  document.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (shouldSkip(a)) return;
      e.preventDefault();
      go(a.href);
    });
  });

  // Ao carregar a página, garante que o overlay some (caso cache)
  requestAnimationFrame(() => t.classList.remove("show"));
});
