import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-hide scrollbars: add `is-scrolling` on <html> while the user scrolls
// (capture catches scroll events on any nested scroll container too).
if (typeof window !== "undefined") {
  let timer: number | undefined;
  const onScroll = () => {
    document.documentElement.classList.add("is-scrolling");
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      document.documentElement.classList.remove("is-scrolling");
    }, 800);
  };
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("wheel", onScroll, { capture: true, passive: true });
  window.addEventListener("touchmove", onScroll, { capture: true, passive: true });
}

createRoot(document.getElementById("root")!).render(<App />);
