export const THEME_KEY = "aangan-theme";

/** Runs in <head> before the page paints, so a saved dark choice doesn't flash light first. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;
