import { el } from "./dom";
import { apiServerStop, apiServerRestart } from "../data/api";

function setDot(state: "on" | "off" | "busy"): void {
  el.serverDot.className = "server-dot" + (state !== "on" ? ` ${state}` : "");
}

function setStatus(msg: string): void {
  el.serverPopStatus.textContent = msg;
}

function openPopover(): void {
  el.serverPopover.hidden = false;
}

function closePopover(): void {
  el.serverPopover.hidden = true;
  setStatus("");
}

export function initServerMenu(): void {
  // Toggle popover on button click
  el.serverPowerBtn.addEventListener("click", e => {
    e.stopPropagation();
    el.serverPopover.hidden ? openPopover() : closePopover();
  });

  // Close on outside click
  document.addEventListener("click", e => {
    if (!el.serverPopover.hidden && !el.serverPopover.contains(e.target as Node)) {
      closePopover();
    }
  });

  // Restart
  el.popRestartBtn.addEventListener("click", async () => {
    el.popRestartBtn.disabled = true;
    el.popStopBtn.disabled = true;
    setDot("busy");
    setStatus("Restarting…");
    await apiServerRestart();

    // Poll until back up (max 8s)
    const t0 = Date.now();
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/", { cache: "no-store" });
        if (res.ok) {
          clearInterval(poll);
          setDot("on");
          setStatus("Restarted ✓");
          el.popRestartBtn.disabled = false;
          el.popStopBtn.disabled = false;
          setTimeout(closePopover, 1200);
        }
      } catch {
        if (Date.now() - t0 > 8000) {
          clearInterval(poll);
          setDot("off");
          setStatus("Timed out");
          el.popRestartBtn.disabled = false;
          el.popStopBtn.disabled = false;
        }
      }
    }, 400);
  });

  // Stop
  el.popStopBtn.addEventListener("click", async () => {
    if (!confirm("Stop the server? The app will be unavailable until restarted.")) return;
    el.popRestartBtn.disabled = true;
    el.popStopBtn.disabled = true;
    setDot("busy");
    setStatus("Stopping…");
    await apiServerStop();
    setDot("off");
    setStatus("Server stopped");
  });
}
