const giftBox = document.querySelector("#gift");
const boxContainer = document.querySelector("#luckyBox");
const ribbonBands = [...document.querySelectorAll("[data-ribbon]")];
for (const band of ribbonBands) band.dataset.ribbonPath = band.dataset.ribbonRoute ?? band.dataset.ribbon;
const verticalSegments = [...document.querySelectorAll('[data-ribbon-route="vertical"][data-ribbon-segment]')]
  .sort((first, second) => Number(first.dataset.ribbonSegment) - Number(second.dataset.ribbonSegment));
const connectorSegments = [...document.querySelectorAll('[data-ribbon-route="connector"][data-ribbon-segment]')]
  .sort((first, second) => Number(first.dataset.ribbonSegment) - Number(second.dataset.ribbonSegment));
const horizontalSegments = ribbonBands.filter(band => band.dataset.ribbon === "horizontal"
  && band.dataset.ribbonRoute !== "connector");
horizontalSegments.forEach((band, index) => {
  band.dataset.horizontalSegment = String(index);
});
const verticalOtherBands = ribbonBands.filter(band => band.dataset.ribbon === "vertical"
  && !band.hasAttribute("data-ribbon-segment")
  && band.dataset.ribbonRoute !== "connector");
const bow = document.querySelector(".gift-box__bow");
const lid = document.querySelector("#giftLid");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const progress = document.querySelector("#giftProgress");
const progressThumb = document.querySelector("#progressThumb");
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
  { route: "horizontal", edge: "start", direction: 1 },
  { route: "vertical", edge: "end", direction: -1 },
  { route: "connector", edge: "start", direction: 1 }
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
  progress: {
    horizontal: { start: 0, end: 0 },
    vertical: { start: 0, end: 0 },
    connector: { start: 0, end: 0 }
  },
  ribbonStep: 0,
  growth: 0,
  sliderPosition: 0,
  landed: false
};
let gesture = null;
let suppressClick = false;
let vibrationTimer = 0;

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
  let disabled = !state.landed;
  let position = 0.5;

  if (state.phase === "bow-dropping") {
    icon = "arrow-forward";
    label = "蝴蝶結落下後，向右滑動拆開緞帶";
    disabled = true;
  } else if (state.phase === "tearing") {
    const step = ribbonSteps[state.ribbonStep];
    icon = step.direction > 0 ? "arrow-forward" : "arrow-back";
    label = step.direction > 0 ? "向右滑動，拆開緞帶" : "向左滑動，拆開緞帶";
    position = step.direction > 0 ? 0 : 1;
    disabled = false;
  } else if (state.phase === "unwrapped") {
    icon = "touch";
    label = "點擊放大禮物盒";
    position = 0.5;
    disabled = false;
  } else if (state.phase === "unlocked") {
    icon = "arrow-up";
    label = "向上滑動，開啟禮物盒";
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
    position = 0.5;
    disabled = false;
  } else if (state.phase === "envelope-open") {
    icon = "arrow-up";
    label = "再次向上滑動，取出卡片";
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
      const riseBounds = envelope.getBoundingClientRect();
      envelope.classList.add("is-lifted");
      envelope.style.transform = "translate(-50%, -50%)";
      envelope.style.left = `${riseBounds.left + riseBounds.width / 2}px`;
      envelope.style.top = `${riseBounds.top + riseBounds.height / 2}px`;
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
    window.setTimeout(() => {
      const cardBounds = envelopeCard.getBoundingClientRect();
      envelopeCard.style.left = `${cardBounds.left}px`;
      envelopeCard.style.top = `${cardBounds.top}px`;
      envelopeCard.style.width = `${cardBounds.width}px`;
      envelopeCard.style.height = `${cardBounds.height}px`;
      envelopeCard.style.transform = "none";
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
    image.alt = "生日卡片";
    envelopeCard.append(image);

    const aspectRatio = 1080 / 1920;
    const openWidth = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9 * aspectRatio);
    const openHeight = openWidth / aspectRatio;
    envelopeCard.classList.add("is-card-opening");
    void envelopeCard.offsetWidth;
    requestAnimationFrame(() => {
      envelopeCard.style.left = `${(window.innerWidth - openWidth) / 2}px`;
      envelopeCard.style.top = `${(window.innerHeight - openHeight) / 2}px`;
      envelopeCard.style.width = `${openWidth}px`;
      envelopeCard.style.height = `${openHeight}px`;
    });
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

function renderSegmentedRibbon(route, segments, handPoint, edge) {
  const segmentCount = segments.length;
  const totalProgress = state.progress[route][edge] * segmentCount;
  for (const segment of segments) {
    const segmentIndex = Number(route === "horizontal"
      ? segment.dataset.horizontalSegment
      : segment.dataset.ribbonSegment);
    const pathIndex = route === "horizontal"
      ? segmentIndex
      : edge === "start" ? segmentIndex : segmentCount - segmentIndex - 1;
    const segmentProgress = Math.max(0, Math.min(1, totalProgress - pathIndex));
    const segmentState = edge === "start"
      ? { start: segmentProgress, end: 0 }
      : { start: 0, end: segmentProgress };
    const axis = segment.dataset.ribbon;
    const handPosition = axis === "horizontal" ? handPoint.y : handPoint.x;
    const clip = buildTearClip(axis, segmentState, handPosition, edge);
    segment.style.clipPath = clip;
    segment.style.webkitClipPath = clip;
  }
}

function renderRibbon(route, handPoint, edge) {
  if (route === "vertical") {
    renderSegmentedRibbon(route, verticalSegments, handPoint, edge);
    const clip = buildTearClip("vertical", state.progress.vertical, handPoint.x, edge);
    for (const band of verticalOtherBands) {
      band.style.clipPath = clip;
      band.style.webkitClipPath = clip;
    }
    return;
  }
  if (route === "connector") {
    renderSegmentedRibbon(route, connectorSegments, handPoint, edge);
    return;
  }

  renderSegmentedRibbon(route, horizontalSegments, handPoint, edge);
}

function setProgress(route, edge, nextProgress, handPosition) {
  const oppositeEdge = edge === "start" ? "end" : "start";
  const remaining = 1 - state.progress[route][oppositeEdge];
  const requested = Math.max(state.progress[route][edge], Math.min(remaining, Math.max(0, nextProgress)));
  state.progress[route][edge] = requested >= remaining * 0.985 ? remaining : requested;
  renderRibbon(route, handPosition, edge);
}

function localPoint(event) {
  const rect = giftBox.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function onHoverMove(event) {
  if (event.pointerType !== "mouse" || state.phase !== "ready" || gesture) return;
  const rect = boxContainer.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  giftBox.style.transform = `scale(var(--gift-scale, .75)) translateY(-5px) rotateX(${-17 - y * 8}deg) rotateY(${-31 + x * 16}deg)`;
}

function resetHover(event) {
  if (event.pointerType !== "mouse" || state.phase !== "ready" || gesture) return;
  giftBox.style.removeProperty("transform");
}

function completeRibbonStep(handPosition, expectedStep = state.ribbonStep) {
  if (state.phase !== "tearing" || state.ribbonStep !== expectedStep) return;
  vibrate();
  const step = ribbonSteps[state.ribbonStep];
  setProgress(step.route, step.edge, 1, handPosition);
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
    gesture.startProgress = state.progress[step.route][step.edge];
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
    }
    return;
  }

  if (state.phase !== "tearing" || state.ribbonStep !== gesture.stepIndex) return;
  const step = gesture.step;
  const travel = Math.max(1, progress.clientWidth - progressThumb.offsetWidth);
  const requested = gesture.startProgress + (deltaX * step.direction) / travel;
  const nextProgress = Math.max(gesture.startProgress, Math.min(1, requested));
  const handPoint = localPoint(event);
  setProgress(step.route, step.edge, nextProgress, handPoint);
  setThumbPosition(step.direction > 0 ? nextProgress : 1 - nextProgress);
  if (nextProgress >= 0.94) completeRibbonStep(handPoint, gesture.stepIndex);
}

function onProgressPointerUp(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  stopContinuousVibration();
  if (gesture.moved) {
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 0);
  }
  gesture = null;
  progressThumb.classList.remove("is-pressed");
}

progressThumb.addEventListener("click", () => {
  if (suppressClick || !state.landed) return;
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
});
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
window.addEventListener("resize", () => setThumbPosition(state.sliderPosition));

bow.addEventListener("animationend", event => {
  if (event.target === bow && state.phase === "bow-dropping") setPhase("tearing");
});
boxContainer.addEventListener("pointermove", onHoverMove);
boxContainer.addEventListener("pointerleave", resetHover);
boxContainer.addEventListener("animationend", event => {
  if (event.target !== boxContainer) return;
  if (event.animationName === "gift-box-tap-bump") boxContainer.classList.remove("is-tap-bumping");
  if (event.animationName === "gift-box-tear-bump") boxContainer.classList.remove("is-tear-bumping");
});

renderRibbon("horizontal", { x: 0.5, y: 0.5 }, "start");
renderRibbon("vertical", { x: 0.5, y: 0.5 }, "start");
renderRibbon("connector", { x: 0.5, y: 0.5 }, "start");

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
