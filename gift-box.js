const giftBox = document.querySelector("#gift");
const boxContainer = document.querySelector("#luckyBox");
// 三條緞帶，每條依 data-ribbon-segment 的順序一段一段撕開
const ribbonRoutes = { horizontal: [], vertical: [], connector: [] };
for (const band of document.querySelectorAll(".gift-ribbon-band[data-ribbon-route]")) {
  ribbonRoutes[band.dataset.ribbonRoute].push(band);
}
for (const segments of Object.values(ribbonRoutes)) {
  segments.sort((first, second) => Number(first.dataset.ribbonSegment) - Number(second.dataset.ribbonSegment));
}
const bow = document.querySelector(".gift-box__bow");
const lid = document.querySelector("#giftLid");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const progress = document.querySelector("#giftProgress");
const progressThumb = document.querySelector("#progressThumb");
const progressHint = document.querySelector("#progressHint");
const entryGuide = document.querySelector("#entryGuide");
const progressIconPath = document.querySelector("#progressIconPath");
const envelope = document.querySelector("#giftEnvelope");
const envelopeCard = document.querySelector("#envelopeCard");
const envelopeFlap = document.querySelector("#envelopeFlap");
const progressIconPaths = {
  lock: "M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM9 6a3 3 0 1 1 6 0v2H9Zm3 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z",
  "arrow-forward": "M12 4 10.59 5.41 16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  "arrow-back": "m12 20 1.41-1.41L7.83 13H20v-2H7.83l5.58-5.59L12 4 4 12z",
  touch: "M9 11.24V5a2 2 0 0 1 4 0v6.24l1.76.27 5.16.79a2 2 0 0 1 1.64 2.46l-1.61 6.44A3 3 0 0 1 17.04 23H9.7a3 3 0 0 1-2.34-1.12L2.7 16.3a2 2 0 0 1 3-2.63l3.3 2.9z",
  "arrow-up": "m12 4-8 8 1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12z"
};
const ribbonSteps = [
  { route: "horizontal", direction: 1 },  // 第 1 步：腰帶
  { route: "connector", direction: -1 },  // 第 2 步：左右環
  { route: "vertical", direction: 1 }     // 第 3 步：前後環
];

const transitions = {
  ready: ["bow-dropping"],
  "bow-dropping": ["tearing"],
  tearing: ["unwrapped"],
  unwrapped: ["unlocked"],
  unlocked: ["opening"],
  opening: ["opened"],
  opened: ["envelope-appearing"],
  "envelope-appearing": ["box-exiting"],
  "box-exiting": ["envelope-heart"],
  "envelope-heart": ["heart-dropping"],
  "heart-dropping": ["envelope-ready"],
  "envelope-ready": ["envelope-opening"],
  "envelope-opening": ["envelope-open"],
  "envelope-open": ["card-exiting"],
  "card-exiting": ["card-moving"],
  "card-moving": ["card-revealed"],
  "card-revealed": []
};
const state = {
  phase: "ready",
  progress: { horizontal: 0, vertical: 0, connector: 0 },
  ribbonStep: 0,
  growth: 0,
  sliderPosition: 0,
  landed: false,
  rotationX: -17,
  rotationY: -31
};
let gesture = null;
let boxDrag = null;
let envelopeDrag = null;
let cardDrag = null;
const envelopeRotation = { x: -12, y: -18 };
const cardRotation = { x: 0, y: 0 };
let vibrationTimer = 0;

document.body.classList.add("is-entry-guide");
document.addEventListener("pointerdown", () => {
  document.body.classList.remove("is-entry-guide");
  // 只隱藏、保留佔位，避免下方的小手往上跳
  entryGuide.style.visibility = "hidden";
}, { once: true, capture: true });

// 3D 旋轉後的外框會讓長寬比走樣，改用「面積等比」換算出視覺大小，維持原本比例
function getUndistortedRect(element) {
  const rect = element.getBoundingClientRect();
  const naturalWidth = element.offsetWidth;
  const naturalHeight = element.offsetHeight;
  const scale = Math.sqrt((rect.width * rect.height) / (naturalWidth * naturalHeight)) || 1;
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return { width, height, centerX, centerY, left: centerX - width / 2, top: centerY - height / 2 };
}

function layoutOpenCard() {
  const aspectRatio = 1080 / 1920;
  const openWidth = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9 * aspectRatio);
  const openHeight = openWidth / aspectRatio;
  envelopeCard.style.left = `${(window.innerWidth - openWidth) / 2}px`;
  envelopeCard.style.top = `${(window.innerHeight - openHeight) / 2}px`;
  envelopeCard.style.width = `${openWidth}px`;
  envelopeCard.style.height = `${openHeight}px`;
}

function clampBoxAngle(angle) {
  return Math.max(-45, Math.min(45, angle));
}

function startSurfaceRotation(event, surface, rotation) {
  if (event.pointerType === "mouse" && event.button !== 0) return null;
  event.preventDefault();
  surface.setPointerCapture(event.pointerId);
  return {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    rotationX: rotation.x,
    rotationY: rotation.y
  };
}

function updateSurfaceRotation(event, drag, surface, prefix, rotation) {
  if (!drag || drag.id !== event.pointerId) return false;
  rotation.x = clampBoxAngle(drag.rotationX - (event.clientY - drag.startY) * 0.5);
  rotation.y = clampBoxAngle(drag.rotationY + (event.clientX - drag.startX) * 0.5);
  surface.style.setProperty(`--${prefix}-rotate-x`, `${rotation.x}deg`);
  surface.style.setProperty(`--${prefix}-rotate-y`, `${rotation.y}deg`);
  return true;
}

function setBoxRotation(rotationX, rotationY) {
  state.rotationX = clampBoxAngle(rotationX);
  state.rotationY = clampBoxAngle(rotationY);
  giftBox.style.setProperty("--gift-rotate-x", `${state.rotationX}deg`);
  giftBox.style.setProperty("--gift-rotate-y", `${state.rotationY}deg`);
}

function vibrate(duration = 18) {
  if (typeof navigator.vibrate === "function") navigator.vibrate(duration);
}

function startContinuousVibration() {
  if (vibrationTimer || typeof navigator.vibrate !== "function") return;
  vibrate(12);
  vibrationTimer = window.setInterval(() => vibrate(12), 90);
}

function stopContinuousVibration() {
  if (!vibrationTimer) return;
  window.clearInterval(vibrationTimer);
  vibrationTimer = 0;
  if (typeof navigator.vibrate === "function") navigator.vibrate(0);
}

function setThumbPosition(position) {
  state.sliderPosition = Math.max(0, Math.min(1, position));
  const travel = Math.max(0, progress.clientWidth - progressThumb.offsetWidth);
  progress.style.setProperty("--progress-position", `${progressThumb.offsetWidth / 2 + travel * state.sliderPosition}px`);
}

function updateProgressUI() {
  let icon = "touch";
  let label = "點擊小手，讓蝴蝶結落下";
  let hint = "";
  let disabled = !state.landed;
  let position = 0.5;

  if (state.phase === "ready") {
    if (state.landed) hint = "點擊！";
  } else if (state.phase === "bow-dropping") {
    icon = "arrow-forward";
    label = "蝴蝶結落下後，向右滑動拆開緞帶";
    disabled = true;
  } else if (state.phase === "tearing") {
    const step = ribbonSteps[state.ribbonStep];
    icon = step.direction > 0 ? "arrow-forward" : "arrow-back";
    label = step.direction > 0 ? "向右滑動，拆開緞帶" : "向左滑動，拆開緞帶";
    hint = step.direction > 0 ? "往右滑！" : "往左滑！";
    position = step.direction > 0 ? 0 : 1;
    disabled = false;
  } else if (state.phase === "unwrapped") {
    icon = "touch";
    label = "點擊放大禮物盒";
    hint = "點擊！";
    position = 0.5;
    disabled = false;
  } else if (state.phase === "unlocked") {
    icon = "arrow-up";
    label = "向上滑動，開啟禮物盒";
    hint = "往上滑！";
    position = 0.5;
    disabled = false;
  } else if (state.phase === "opening") {
    icon = "arrow-up";
    label = "正在開啟禮物盒";
    position = 0.5;
    disabled = true;
  } else if (state.phase === "opened" || state.phase === "envelope-appearing" || state.phase === "box-exiting") {
    label = "信封正在出現";
    position = 0.5;
    disabled = true;
  } else if (state.phase === "envelope-heart") {
    label = "點擊小手，讓愛心掉下來";
    hint = "點擊！";
    position = 0.5;
    disabled = false;
  } else if (state.phase === "heart-dropping" || state.phase === "envelope-opening" ||
    state.phase === "card-exiting" || state.phase === "card-moving") {
    icon = "arrow-up";
    label = state.phase === "heart-dropping" ? "愛心正在掉落" :
      state.phase === "envelope-opening" ? "正在打開信封" : "正在取出卡片";
    position = 0.5;
    disabled = true;
  } else if (state.phase === "envelope-ready") {
    icon = "arrow-up";
    label = "向上滑動，打開信封";
    hint = "往上滑！";
    position = 0.5;
    disabled = false;
  } else if (state.phase === "envelope-open") {
    icon = "arrow-up";
    label = "再次向上滑動，取出卡片";
    hint = "往上滑！";
    position = 0.5;
    disabled = false;
  } else if (state.phase === "card-revealed") {
    label = "卡片已展開";
    position = 0.5;
    disabled = true;
  }

  progressIconPath.setAttribute("d", progressIconPaths[icon]);
  progressThumb.dataset.icon = icon;
  progressThumb.setAttribute("aria-label", label);
  progressThumb.disabled = disabled;
  progressHint.textContent = hint;
  setThumbPosition(position);
}

function bounceBox() {
  if (reducedMotion.matches) return;
  boxContainer.classList.remove("is-tear-bumping");
  void boxContainer.offsetWidth;
  boxContainer.classList.add("is-tear-bumping");
}

function setPhase(next) {
  if (!transitions[state.phase].includes(next)) return false;
  state.phase = next;

  if (next === "bow-dropping") {
    boxContainer.classList.add("is-bow-dropping");
  } else if (next === "tearing") {
    boxContainer.classList.remove("is-bow-dropping");
    boxContainer.classList.add("is-bow-dropped");
    boxContainer.classList.add("is-tearing");
  } else if (next === "unwrapped") {
    boxContainer.classList.remove("is-tearing");
    boxContainer.classList.add("is-unwrapped");
    boxContainer.style.setProperty("--gift-scale", "0.75");
    bounceBox();
  } else if (next === "unlocked") {
    boxContainer.classList.add("is-unlocked");
  } else if (next === "opening") {
    boxContainer.classList.add("is-opening");
    if (reducedMotion.matches) {
      lid.style.animationDuration = "1ms";
      boxContainer.querySelector(".gift-box__glow").style.animationDuration = "1ms";
    }
    window.setTimeout(() => setPhase("opened"), reducedMotion.matches ? 60 : 950);
  } else if (next === "opened") {
    boxContainer.classList.remove("is-opening");
    boxContainer.classList.add("is-opened");
    setPhase("envelope-appearing");
  } else if (next === "envelope-appearing") {
    envelope.classList.add("is-emerging");
    window.setTimeout(() => {
      const riseBounds = getUndistortedRect(envelope);
      envelope.classList.add("is-lifted");
      envelope.classList.add("is-rotatable");
      envelope.style.transform = "translate(-50%, -50%)";
      envelope.style.left = `${riseBounds.centerX}px`;
      envelope.style.top = `${riseBounds.centerY}px`;
      envelope.style.width = `${riseBounds.width}px`;
      envelope.style.height = `${riseBounds.height}px`;
      document.querySelector(".experience").append(envelope);
      const bounds = envelope.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      envelope.classList.remove("is-emerging");
      envelope.style.setProperty("--flight-x", `${window.innerWidth / 2 - centerX}px`);
      envelope.style.setProperty("--flight-y", `${window.innerHeight / 2 - centerY}px`);
      requestAnimationFrame(() => envelope.classList.add("is-flying-center"));
    }, reducedMotion.matches ? 60 : 520);
    window.setTimeout(() => setPhase("box-exiting"), reducedMotion.matches ? 120 : 1100);
  } else if (next === "box-exiting") {
    boxContainer.classList.add("is-box-exiting");
    window.setTimeout(() => {
      boxContainer.classList.add("is-box-gone");
      setPhase("envelope-heart");
    }, reducedMotion.matches ? 60 : 680);
  } else if (next === "heart-dropping") {
    envelope.classList.add("is-heart-dropping");
    window.setTimeout(() => setPhase("envelope-ready"), reducedMotion.matches ? 60 : 650);
  } else if (next === "envelope-opening") {
    envelope.classList.add("is-opening");
    if (reducedMotion.matches) envelopeFlap.style.transitionDuration = "1ms";
    window.setTimeout(() => setPhase("envelope-open"), reducedMotion.matches ? 60 : 700);
  } else if (next === "envelope-open") {
    envelope.classList.remove("is-opening");
    envelope.classList.add("is-open");
  } else if (next === "card-exiting") {
    envelope.classList.add("is-card-extracting");
    envelope.classList.remove("is-rotatable");
    window.setTimeout(() => {
      const cardBounds = getUndistortedRect(envelopeCard);
      envelopeCard.style.left = `${cardBounds.left}px`;
      envelopeCard.style.top = `${cardBounds.top}px`;
      envelopeCard.style.width = `${cardBounds.width}px`;
      envelopeCard.style.height = `${cardBounds.height}px`;
      envelopeCard.style.removeProperty("transform");
      envelopeCard.classList.add("is-card-flight");
      document.querySelector(".experience").append(envelopeCard);
      setPhase("card-moving");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        envelopeCard.style.left = `${(window.innerWidth - cardBounds.width) / 2}px`;
        envelopeCard.style.top = `${(window.innerHeight - cardBounds.height) / 2}px`;
      }));
      window.setTimeout(() => setPhase("card-revealed"), reducedMotion.matches ? 60 : 850);
    }, reducedMotion.matches ? 60 : 780);
  } else if (next === "card-revealed") {
    const image = document.createElement("img");
    image.className = "gift-envelope__card-image";
    image.src = "assets/card.png";
    image.alt = "給你的卡片";
    envelopeCard.append(image);

    const revealCardImage = event => {
      if (event.target !== envelopeCard || event.propertyName !== "height") return;
      envelopeCard.classList.add("is-card-image-visible");
      envelopeCard.classList.add("is-card-rotatable");
      envelopeCard.removeEventListener("transitionend", revealCardImage);
    };
    envelopeCard.addEventListener("transitionend", revealCardImage);

    envelopeCard.classList.add("is-card-opening");
    void envelopeCard.offsetWidth;
    requestAnimationFrame(layoutOpenCard);
  }
  updateProgressUI();
  return true;
}

function buildTearClip(axis, progress, handPosition, edge) {
  if (progress.start <= 0 && progress.end <= 0) return "none";
  const startPoints = [];
  const endPoints = [];
  const steps = 14;
  for (let index = 0; index <= steps; index += 1) {
    const crossAxis = index / steps;
    const handPull = Math.max(0, 1 - Math.abs(crossAxis - handPosition) / 0.16) * 3.2;
    const roughness = Math.sin(index * 1.7 + (progress.start + progress.end) * 18) * 0.65;
    if (axis === "horizontal") {
      const y = (crossAxis * 100).toFixed(1);
      const startX = progress.start * 100 + (edge === "start" ? handPull + roughness : 0);
      const endX = 100 - progress.end * 100 - (edge === "end" ? handPull + roughness : 0);
      startPoints.push(`${Math.min(100, Math.max(0, startX)).toFixed(2)}% ${y}%`);
      endPoints.push(`${Math.min(100, Math.max(0, endX)).toFixed(2)}% ${y}%`);
    } else {
      const x = (crossAxis * 100).toFixed(1);
      const startY = progress.start * 100 + (edge === "start" ? handPull + roughness : 0);
      const endY = 100 - progress.end * 100 - (edge === "end" ? handPull + roughness : 0);
      startPoints.push(`${x}% ${Math.min(100, Math.max(0, startY)).toFixed(2)}%`);
      endPoints.push(`${x}% ${Math.min(100, Math.max(0, endY)).toFixed(2)}%`);
    }
  }
  return `polygon(${startPoints.join(", ")}, ${endPoints.reverse().join(", ")})`;
}

function renderRibbon(route, handPoint) {
  const segments = ribbonRoutes[route];
  const totalProgress = state.progress[route] * segments.length;
  segments.forEach((segment, pathIndex) => {
    const amount = Math.max(0, Math.min(1, totalProgress - pathIndex));
    const edge = segment.dataset.ribbonFrom === "end" ? "end" : "start";
    const segmentState = edge === "start" ? { start: amount, end: 0 } : { start: 0, end: amount };
    const axis = segment.dataset.ribbon;
    const clip = buildTearClip(axis, segmentState, axis === "horizontal" ? handPoint.y : handPoint.x, edge);
    segment.style.clipPath = clip;
    segment.style.webkitClipPath = clip;
  });
}

function setProgress(route, nextProgress, handPoint) {
  const value = Math.max(state.progress[route], Math.min(1, Math.max(0, nextProgress)));
  state.progress[route] = value >= 0.985 ? 1 : value;
  renderRibbon(route, handPoint);
}

function localPoint(event) {
  const rect = giftBox.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function onHoverMove(event) {
  if (event.pointerType !== "mouse" || state.phase !== "ready" || gesture || boxDrag) return;
  const rect = boxContainer.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  const rotationX = clampBoxAngle(state.rotationX - y * 8);
  const rotationY = clampBoxAngle(state.rotationY + x * 16);
  giftBox.style.transform = `scale(var(--gift-scale, .75)) translateY(-5px) rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
}

function resetHover(event) {
  if (event.pointerType !== "mouse" || state.phase !== "ready" || gesture || boxDrag) return;
  giftBox.style.removeProperty("transform");
}

function onBoxPointerDown(event) {
  if (!state.landed || !["ready", "tearing", "unwrapped", "unlocked"].includes(state.phase) ||
    (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  boxDrag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    rotationX: state.rotationX,
    rotationY: state.rotationY
  };
  giftBox.style.removeProperty("transform");
  boxContainer.classList.add("is-rotating");
  boxContainer.setPointerCapture(event.pointerId);
}

function onBoxPointerMove(event) {
  if (!boxDrag || boxDrag.id !== event.pointerId) return;
  setBoxRotation(
    boxDrag.rotationX - (event.clientY - boxDrag.startY) * 0.5,
    boxDrag.rotationY + (event.clientX - boxDrag.startX) * 0.5
  );
}

function onBoxPointerUp(event) {
  if (!boxDrag || boxDrag.id !== event.pointerId) return;
  boxDrag = null;
  boxContainer.classList.remove("is-rotating");
}

function onEnvelopePointerDown(event) {
  if (!envelope.classList.contains("is-rotatable")) return;
  envelopeDrag = startSurfaceRotation(event, envelope, envelopeRotation);
  if (envelopeDrag) {
    envelopeDrag.mode = null;
    envelope.classList.add("is-rotating");
  }
}

function onEnvelopePointerMove(event) {
  if (!envelopeDrag || envelopeDrag.id !== event.pointerId) return;
  if (!envelopeDrag.mode) {
    const deltaX = event.clientX - envelopeDrag.startX;
    const deltaY = event.clientY - envelopeDrag.startY;
    if (Math.hypot(deltaX, deltaY) < 8) return;
    envelopeDrag.mode = Math.abs(deltaY) > Math.abs(deltaX) * 1.15 ? "swipe" : "rotate";
    if (envelopeDrag.mode === "swipe") {
      envelope.style.setProperty("--envelope-rotate-x", `${envelopeDrag.rotationX}deg`);
      envelope.style.setProperty("--envelope-rotate-y", `${envelopeDrag.rotationY}deg`);
    }
  }

  if (envelopeDrag.mode === "swipe") {
    const upwardDistance = envelopeDrag.startY - event.clientY;
    if (upwardDistance > 54 && upwardDistance > Math.abs(event.clientX - envelopeDrag.startX) * 1.15) {
      if (state.phase === "envelope-ready") setPhase("envelope-opening");
      else if (state.phase === "envelope-open") setPhase("card-exiting");
      else return;
      envelopeDrag = null;
      envelope.classList.remove("is-rotating");
    }
    return;
  }

  updateSurfaceRotation(event, envelopeDrag, envelope, "envelope", envelopeRotation);
}

function onEnvelopePointerUp(event) {
  if (!envelopeDrag || envelopeDrag.id !== event.pointerId) return;
  envelopeDrag = null;
  envelope.classList.remove("is-rotating");
}

function onCardPointerDown(event) {
  if (!envelopeCard.classList.contains("is-card-rotatable")) return;
  cardDrag = startSurfaceRotation(event, envelopeCard, cardRotation);
  if (cardDrag) envelopeCard.classList.add("is-card-rotating");
}

function onCardPointerMove(event) {
  updateSurfaceRotation(event, cardDrag, envelopeCard, "card", cardRotation);
}

function onCardPointerUp(event) {
  if (!cardDrag || cardDrag.id !== event.pointerId) return;
  cardDrag = null;
  envelopeCard.classList.remove("is-card-rotating");
}

function completeRibbonStep(handPosition, expectedStep = state.ribbonStep) {
  if (state.phase !== "tearing" || state.ribbonStep !== expectedStep) return;
  vibrate();
  const step = ribbonSteps[state.ribbonStep];
  setProgress(step.route, 1, handPosition);
  state.ribbonStep += 1;
  if (state.ribbonStep === ribbonSteps.length) {
    setPhase("unwrapped");
  } else {
    updateProgressUI();
  }
}

function onProgressPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (state.phase === "ready") {
    event.preventDefault();
    startBowDrop();
    return;
  }
  if (state.phase === "unwrapped" || state.phase === "envelope-heart") {
    event.preventDefault();
    progressThumb.classList.add("is-pressed");
    gesture = { id: event.pointerId, mode: "tap", startX: event.clientX, startY: event.clientY, moved: false };
    progressThumb.setPointerCapture(event.pointerId);
    return;
  }
  const interactivePhase = ["tearing", "unlocked", "envelope-ready", "envelope-open"].includes(state.phase);
  if (!interactivePhase) return;
  event.preventDefault();
  if (state.phase !== "tearing") vibrate();
  progressThumb.classList.add("is-pressed");
  gesture = {
    id: event.pointerId,
    mode: state.phase === "tearing" ? "ribbon" :
      state.phase === "unlocked" ? "open-gift" :
        state.phase === "envelope-ready" ? "open-envelope" : "take-card",
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };
  if (gesture.mode === "ribbon") {
    const step = ribbonSteps[state.ribbonStep];
    gesture.step = step;
    gesture.stepIndex = state.ribbonStep;
    gesture.startProgress = state.progress[step.route];
  }
  progressThumb.setPointerCapture(event.pointerId);
}

function startBowDrop() {
  if (!state.landed || state.phase !== "ready") return;
  vibrate(30);
  setPhase("bow-dropping");
}

function onProgressPointerMove(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  if (gesture.mode === "tap") {
    // 手指滑太遠就不算點擊
    if (Math.hypot(deltaX, deltaY) > 12) gesture.moved = true;
    return;
  }
  if (Math.hypot(deltaX, deltaY) > 4) {
    gesture.moved = true;
    startContinuousVibration();
  }

  if (gesture.mode === "open-gift" || gesture.mode === "open-envelope" || gesture.mode === "take-card") {
    const upwardDistance = -deltaY;
    if (upwardDistance > 54 && upwardDistance > Math.abs(deltaX) * 1.15) {
      if (gesture.mode === "open-gift") setPhase("opening");
      else if (gesture.mode === "open-envelope") setPhase("envelope-opening");
      else setPhase("card-exiting");
      endGesture();
    }
    return;
  }

  if (state.phase !== "tearing" || state.ribbonStep !== gesture.stepIndex) return;
  const step = gesture.step;
  const travel = Math.max(1, progress.clientWidth - progressThumb.offsetWidth);
  const requested = gesture.startProgress + (deltaX * step.direction) / travel;
  const nextProgress = Math.max(gesture.startProgress, Math.min(1, requested));
  const handPoint = localPoint(event);
  setProgress(step.route, nextProgress, handPoint);
  setThumbPosition(step.direction > 0 ? nextProgress : 1 - nextProgress);
  if (nextProgress >= 0.94) {
    completeRibbonStep(handPoint, gesture.stepIndex);
    endGesture();
  }
}

// 手勢完成（或手指放開）時統一收尾：停震動、清狀態、釋放 pointer capture
function endGesture() {
  if (!gesture) return;
  const { id } = gesture;
  gesture = null;
  stopContinuousVibration();
  progressThumb.classList.remove("is-pressed");
  if (progressThumb.hasPointerCapture(id)) progressThumb.releasePointerCapture(id);
}

function onProgressPointerUp(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const isTap = gesture.mode === "tap" && !gesture.moved && event.type === "pointerup";
  endGesture();
  if (isTap) runTapAction();
}

// 觸控/滑鼠的點擊在 pointerup 判定（見 onProgressPointerUp）；
// click 只處理鍵盤或輔助工具觸發的（event.detail === 0），避免手機上點擊被吞掉或重複觸發
progressThumb.addEventListener("click", event => {
  if (event.detail !== 0) return;
  runTapAction();
});

function runTapAction() {
  if (!state.landed) return;
  if (state.phase === "ready") {
    startBowDrop();
  } else if (state.phase === "unwrapped") {
    vibrate();
    state.growth += 1;
    boxContainer.style.setProperty("--gift-scale", `${0.75 + state.growth * 0.06}`);
    if (state.growth === 3) {
      setPhase("unlocked");
    } else {
      updateProgressUI();
    }
  } else if (state.phase === "envelope-heart") {
    vibrate();
    setPhase("heart-dropping");
  }
}
progressThumb.addEventListener("keydown", event => {
  if (state.phase === "tearing" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    const step = ribbonSteps[state.ribbonStep];
    const expectedKey = step.direction > 0 ? "ArrowRight" : "ArrowLeft";
    if (event.key === expectedKey) {
      event.preventDefault();
      completeRibbonStep({ x: 0.5, y: 0.5 });
    }
  } else if (state.phase === "unlocked" && event.key === "ArrowUp") {
    event.preventDefault();
    setPhase("opening");
  } else if (state.phase === "envelope-ready" && event.key === "ArrowUp") {
    event.preventDefault();
    vibrate();
    setPhase("envelope-opening");
  } else if (state.phase === "envelope-open" && event.key === "ArrowUp") {
    event.preventDefault();
    vibrate();
    setPhase("card-exiting");
  }
});
progressThumb.addEventListener("pointerdown", onProgressPointerDown);
progressThumb.addEventListener("pointermove", onProgressPointerMove);
progressThumb.addEventListener("pointerup", onProgressPointerUp);
progressThumb.addEventListener("pointercancel", onProgressPointerUp);
progressThumb.addEventListener("lostpointercapture", onProgressPointerUp);
window.addEventListener("resize", () => {
  setThumbPosition(state.sliderPosition);
  // 網址列收起/展開會改變視窗高度，卡片要重新置中
  if (state.phase === "card-revealed") layoutOpenCard();
});

bow.addEventListener("animationend", event => {
  if (event.target === bow && state.phase === "bow-dropping") setPhase("tearing");
});
boxContainer.addEventListener("pointermove", onHoverMove);
boxContainer.addEventListener("pointerdown", onBoxPointerDown);
boxContainer.addEventListener("pointermove", onBoxPointerMove);
boxContainer.addEventListener("pointerup", onBoxPointerUp);
boxContainer.addEventListener("pointercancel", onBoxPointerUp);
boxContainer.addEventListener("lostpointercapture", onBoxPointerUp);
boxContainer.addEventListener("pointerleave", resetHover);
envelope.addEventListener("pointerdown", onEnvelopePointerDown);
envelope.addEventListener("pointermove", onEnvelopePointerMove);
envelope.addEventListener("pointerup", onEnvelopePointerUp);
envelope.addEventListener("pointercancel", onEnvelopePointerUp);
envelope.addEventListener("lostpointercapture", onEnvelopePointerUp);
envelopeCard.addEventListener("pointerdown", onCardPointerDown);
envelopeCard.addEventListener("pointermove", onCardPointerMove);
envelopeCard.addEventListener("pointerup", onCardPointerUp);
envelopeCard.addEventListener("pointercancel", onCardPointerUp);
envelopeCard.addEventListener("lostpointercapture", onCardPointerUp);
boxContainer.addEventListener("animationend", event => {
  if (event.target !== boxContainer) return;
  if (event.animationName === "gift-box-tap-bump") boxContainer.classList.remove("is-tap-bumping");
  if (event.animationName === "gift-box-tear-bump") boxContainer.classList.remove("is-tear-bumping");
});

renderRibbon("horizontal", { x: 0.5, y: 0.5 });
renderRibbon("vertical", { x: 0.5, y: 0.5 });
renderRibbon("connector", { x: 0.5, y: 0.5 });

function dropGift() {
  boxContainer.classList.add("is-falling");
  if (reducedMotion.matches) {
    boxContainer.style.setProperty("--fall-y", "0px");
    boxContainer.classList.remove("is-falling");
    boxContainer.classList.add("is-landed");
    state.landed = true;
    updateProgressUI();
    return;
  }

  let position = -Math.max(window.innerHeight * 0.78, 520);
  let velocity = 0;
  let previousTime = 0;
  const gravity = 2200;
  boxContainer.style.setProperty("--fall-y", `${position}px`);

  function frame(time) {
    const delta = Math.min((time - previousTime) / 1000 || 0, 0.032);
    previousTime = time;
    velocity += gravity * delta;
    position += velocity * delta;

    if (position >= 0) {
      position = 0;
      velocity = -velocity * 0.3;
      if (Math.abs(velocity) < 55) {
        boxContainer.style.setProperty("--fall-y", "0px");
        boxContainer.classList.remove("is-falling");
        boxContainer.classList.add("is-landed");
        state.landed = true;
        updateProgressUI();
        return;
      }
    }

    boxContainer.style.setProperty("--fall-y", `${position}px`);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

dropGift();
