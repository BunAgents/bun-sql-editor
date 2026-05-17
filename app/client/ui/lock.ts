import { el } from "./dom";
import { hashPin, hasPin, LOCK_PIN_KEY, LOCK_STATE_KEY } from "../core/lock-core";
export { hashPin, hasPin } from "../core/lock-core";

export async function lockScreen(): Promise<void> {
  el.lockScreen.hidden = false;
  el.lockPinInput.value = "";
  el.lockError.hidden = true;

  if (hasPin()) {
    el.lockSub.textContent = "Enter your PIN to unlock";
    el.lockSetupHint.hidden = true;
    el.lockPinInput.type = "password";
    el.lockPinInput.placeholder = "PIN";
    el.lockPinInput.disabled = false;
    el.lockUnlockBtn.disabled = false;
  } else {
    el.lockSub.textContent = "Screen is locked";
    el.lockSetupHint.hidden = false;
    el.lockPinInput.disabled = true;
    el.lockUnlockBtn.disabled = true;
  }

  sessionStorage.setItem(LOCK_STATE_KEY, "1");
  requestAnimationFrame(() => {
    if (!el.lockPinInput.disabled) el.lockPinInput.focus();
  });
}

export async function tryUnlock(): Promise<void> {
  const pin = el.lockPinInput.value.trim();
  if (!pin) return;

  const storedHash = localStorage.getItem(LOCK_PIN_KEY);
  if (!storedHash) { el.lockScreen.hidden = true; sessionStorage.removeItem(LOCK_STATE_KEY); return; }

  const inputHash = await hashPin(pin);
  if (inputHash === storedHash) {
    el.lockScreen.hidden = true;
    sessionStorage.removeItem(LOCK_STATE_KEY);
    el.lockError.hidden = true;
    el.lockPinInput.value = "";
  } else {
    el.lockError.hidden = false;
    el.lockPinInput.value = "";
    el.lockPinInput.focus();
  }
}

export function openSetPinModal(): void {
  el.setPinModal.hidden = false;
  el.newPinInput.value = "";
  el.confirmPinInput.value = "";
  el.setPinError.hidden = true;
  el.clearPinBtn.style.display = hasPin() ? "" : "none";
  requestAnimationFrame(() => el.newPinInput.focus());
}

export function closeSetPinModal(): void {
  el.setPinModal.hidden = true;
}

export async function savePin(): Promise<void> {
  const pin = el.newPinInput.value.trim();
  const confirm = el.confirmPinInput.value.trim();

  if (pin.length < 4) {
    el.setPinError.textContent = "PIN must be at least 4 digits.";
    el.setPinError.hidden = false;
    return;
  }
  if (pin !== confirm) {
    el.setPinError.textContent = "PINs do not match.";
    el.setPinError.hidden = false;
    return;
  }

  const hash = await hashPin(pin);
  localStorage.setItem(LOCK_PIN_KEY, hash);
  closeSetPinModal();
  lockScreen();
}

export function clearPin(): void {
  localStorage.removeItem(LOCK_PIN_KEY);
  closeSetPinModal();
}

export function initLock(): void {
  el.lockBtn.addEventListener("click", lockScreen);
  el.lockUnlockBtn.addEventListener("click", tryUnlock);
  el.lockPinInput.addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });
  el.lockSetPinBtn.addEventListener("click", () => { el.lockScreen.hidden = true; openSetPinModal(); });
  el.setPinClose.addEventListener("click", closeSetPinModal);
  el.setPinCancelBtn.addEventListener("click", closeSetPinModal);
  el.setPinSaveBtn.addEventListener("click", savePin);
  el.clearPinBtn.addEventListener("click", clearPin);

  if (sessionStorage.getItem(LOCK_STATE_KEY)) lockScreen();
}
