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
const instruction = document.querySelector("#giftInstruction");
const progressIcons = [...progressThumb.querySelectorAll("[data-progress-icon]")];
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
  opened: []
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

function setThumbPosition(position) {
  state.sliderPosition = Math.max(0, Math.min(1, position));
  const travel = Math.max(0, progress.clientWidth - progressThumb.offsetWidth);
  progress.style.setProperty("--progress-position", `${progressThumb.offsetWidth / 2 + travel * state.sliderPosition}px`);
}

function updateProgressUI() {
  let icon = "lock";
  let label = "解除蝴蝶結";
  let message = "點擊鎖頭，讓蝴蝶結落下";
  let disabled = !state.landed;
  let position = 0;

  if (state.phase === "bow-dropping") {
    message = "蝴蝶結正在落下…";
    disabled = true;
  } else if (state.phase === "tearing") {
    const step = ribbonSteps[state.ribbonStep];
    icon = step.direction > 0 ? "arrow-forward" : "arrow-back";
    label = step.direction > 0 ? "向右滑動，拆開緞帶" : "向左滑動，拆開緞帶";
    message = `往${step.direction > 0 ? "右" : "左"}滑，拆開第 ${state.ribbonStep + 1} 條緞帶`;
    position = step.direction > 0 ? 0 : 1;
    disabled = false;
  } else if (state.phase === "unwrapped") {
    icon = "touch";
    label = "點擊放大禮物盒";
    message = `點擊圓形，放大禮物盒（${state.growth}/3）`;
    position = 0.5;
    disabled = false;
  } else if (state.phase === "unlocked") {
    icon = "arrow-up";
    label = "向上滑動，開啟禮物盒";
    message = "往上滑，打開禮物盒";
    position = 0.5;
    disabled = false;
  } else if (state.phase === "opening") {
    icon = "arrow-up";
    label = "正在開啟禮物盒";
    message = "驚喜即將揭曉…";
    position = 0.5;
    disabled = true;
  } else if (state.phase === "opened") {
    icon = "arrow-up";
    label = "禮物盒已開啟";
    message = "驚喜已開啟，生日快樂！";
    position = 0.5;
    disabled = true;
  }

  for (const progressIcon of progressIcons) {
    progressIcon.hidden = progressIcon.dataset.progressIcon !== icon;
  }
  progressThumb.setAttribute("aria-label", label);
  progressThumb.disabled = disabled;
  instruction.textContent = message;
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
  if (state.phase !== "tearing" && state.phase !== "unlocked") return;
  event.preventDefault();
  progressThumb.classList.add("is-pressed");
  gesture = {
    id: event.pointerId,
    mode: state.phase === "tearing" ? "ribbon" : "open",
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

function onProgressPointerMove(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  if (Math.hypot(deltaX, deltaY) > 4) gesture.moved = true;

  if (gesture.mode === "open") {
    const upwardDistance = -deltaY;
    if (upwardDistance > 54 && upwardDistance > Math.abs(deltaX) * 1.15) {
      setPhase("opening");
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
    setPhase("bow-dropping");
  } else if (state.phase === "unwrapped") {
    state.growth += 1;
    boxContainer.style.setProperty("--gift-scale", `${0.75 + state.growth * 0.06}`);
    if (state.growth === 3) {
      setPhase("unlocked");
    } else {
      updateProgressUI();
    }
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
