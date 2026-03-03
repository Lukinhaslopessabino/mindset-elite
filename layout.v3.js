document.addEventListener("DOMContentLoaded", () => {

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
      z-index:5000; /* MENOR que loader */
      transition: opacity .25s ease;
    }

    #globalTransition.show{
      opacity:1;
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

  const go = (href) => {
    t.classList.add("show");
    setTimeout(() => {
      window.location.href = href;
    }, 180);
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    if (shouldSkip(a)) return;

    e.preventDefault();
    go(a.href);
  });

  // GARANTE que overlay nunca fica preso
  window.addEventListener("pageshow", () => {
    t.classList.remove("show");
  });

});
