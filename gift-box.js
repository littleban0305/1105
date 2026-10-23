const giftBox = document.querySelector("#gift");
const boxContainer = document.querySelector("#luckyBox");
const ribbonBands = [...document.querySelectorAll("[data-ribbon]")];
for (const band of ribbonBands) {
  band.dataset.ribbonPath = band.dataset.ribbonRoute ?? band.dataset.ribbon;
  const lift = document.createElement("span");
  lift.className = "gift-ribbon-lift";
  band.append(lift);
}
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
const lock = document.querySelector("#giftLock");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
  horizontalStartSegment: 0,
  lockTaps: 0,
  landed: false
};
let gesture = null;
const peelHoldDuration = 220;

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
    bounceBox();
  } else if (next === "unlocked") {
    boxContainer.classList.add("is-unlocked");
    lock.setAttribute("aria-label", "已解鎖的鎖頭");
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
  return true;
}

function beginTearing() {
  return state.phase === "tearing";
}

function clearGesture() {
  if (!gesture) return;
  window.clearTimeout(gesture.holdTimer);
  for (const band of ribbonBands) {
    if (band.dataset.ribbonPath === gesture.route) band.classList.remove("is-held");
  }
  gesture = null;
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

function setPeelEdge(band, axis, edge, progress) {
  band.style.setProperty("--peel-position", `${Math.min(100, progress * 100)}%`);
  band.classList.toggle("is-peeling-from-end", edge === "end");
  band.dataset.ribbonAxis = axis;
  band.dataset.peelEdge = edge;
}

function renderSegmentedRibbon(route, segments, handPoint, edge) {
  const segmentCount = segments.length;
  const totalProgress = state.progress[route][edge] * segmentCount;
  const activePathIndex = Math.min(segmentCount - 1, Math.floor(totalProgress));
  for (const segment of segments) {
    const segmentIndex = Number(route === "horizontal"
      ? segment.dataset.horizontalSegment
      : segment.dataset.ribbonSegment);
    const pathIndex = route === "horizontal"
      ? (segmentIndex - state.horizontalStartSegment + segmentCount) % segmentCount
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
    setPeelEdge(segment, axis, edge, segmentProgress);
    const isCurrentSegment = pathIndex === activePathIndex && segmentProgress < 1;
    const horizontalHasStarted = state.progress.horizontal.start + state.progress.horizontal.end > 0;
    const canGrab = route !== "horizontal" || !horizontalHasStarted || isCurrentSegment;
    segment.classList.toggle("is-peel-ready", canGrab);
    const isHeldSegment = gesture?.band === segment;
    segment.classList.toggle("is-held", Boolean(gesture?.held && gesture.route === route && isHeldSegment));
    if (route === "horizontal" && gesture?.held && gesture.route === route && isCurrentSegment) {
      gesture.band = segment;
    }
  }
}

function renderRibbon(route, handPoint, edge) {
  if (route === "vertical") {
    renderSegmentedRibbon(route, verticalSegments, handPoint, edge);
    const clip = buildTearClip("vertical", state.progress.vertical, handPoint.x, edge);
    for (const band of verticalOtherBands) {
      band.style.clipPath = clip;
      band.style.webkitClipPath = clip;
      setPeelEdge(band, "vertical", edge, state.progress.vertical[edge]);
    }
    return;
  }
  if (route === "connector") {
    renderSegmentedRibbon(route, connectorSegments, handPoint, edge);
    return;
  }

  renderSegmentedRibbon(route, horizontalSegments, handPoint, edge);
}

function routeIsComplete(route) {
  return state.progress[route].start + state.progress[route].end >= 1;
}

function setProgress(route, edge, nextProgress, handPosition) {
  if (!beginTearing()) return;
  const oppositeEdge = edge === "start" ? "end" : "start";
  const remaining = 1 - state.progress[route][oppositeEdge];
  const requested = Math.max(state.progress[route][edge], Math.min(remaining, Math.max(0, nextProgress)));
  state.progress[route][edge] = requested >= remaining * 0.985 ? remaining : requested;
  renderRibbon(route, handPosition, edge);
  if (routeIsComplete("horizontal") && routeIsComplete("vertical") && routeIsComplete("connector")) {
    setPhase("unwrapped");
  }
}

function localPoint(event) {
  const rect = giftBox.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function onPointerDown(event) {
  if (!state.landed) return;
  const target = event.target;
  const onBow = target.closest(".gift-box__bow");
  const onRibbonLift = target.closest(".gift-ribbon-lift");
  const onLock = target.closest(".gift-box__lock");
  if (onLock) return;
  if (state.phase === "ready" && onBow) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    setPhase("bow-dropping");
    return;
  }
  if (state.phase === "unlocked") {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    gesture = {
      id: event.pointerId,
      mode: "open",
      startX: event.clientX,
      startY: event.clientY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    return;
  }
  if (state.phase !== "tearing") return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const lift = event.target.closest(".gift-ribbon-lift");
  const ribbonBand = lift?.closest("[data-ribbon-path]");
  if (!lift || !ribbonBand || !ribbonBand.classList.contains("is-peel-ready")) return;
  event.preventDefault();
  beginTearing();
  if (ribbonBand.dataset.ribbonPath === "horizontal"
    && state.progress.horizontal.start + state.progress.horizontal.end === 0) {
    state.horizontalStartSegment = Number(ribbonBand.dataset.horizontalSegment);
  }
  gesture = {
    id: event.pointerId,
    mode: "tear",
    held: false,
    holdTimer: 0,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastClientY: event.clientY,
    edge: null,
    route: ribbonBand.dataset.ribbonPath,
    band: ribbonBand,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  const activeGesture = gesture;
  activeGesture.holdTimer = window.setTimeout(() => {
    if (gesture !== activeGesture || state.phase !== "tearing") return;
    activeGesture.held = true;
    activeGesture.edge = ribbonBand.dataset.peelEdge;
    ribbonBand.classList.add("is-held");
  }, peelHoldDuration);
}

function onPointerMove(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  if (gesture.mode === "open") {
    const dragX = event.clientX - gesture.startX;
    const dragY = gesture.startY - event.clientY;
    if (dragY > 54 && dragY > Math.abs(dragX) * 1.15) {
      gesture = null;
      setPhase("opening");
    }
    return;
  }

  const point = localPoint(event);
  const deltaX = event.clientX - gesture.lastX;
  const deltaY = event.clientY - (gesture.lastClientY ?? event.clientY);
  gesture.lastX = event.clientX;
  gesture.lastClientY = event.clientY;
  const distance = Math.hypot(deltaX, deltaY);
  if (!gesture.held) {
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 48) clearGesture();
    return;
  }
  if (distance > 0) {
    const axis = gesture.band.dataset.ribbonAxis;
    const directedDelta = axis === "horizontal" ? deltaX : deltaY;
    if (gesture.route === "horizontal" && directedDelta <= 0) return;
    const edge = gesture.route === "horizontal" ? "start" : gesture.edge ?? (directedDelta < 0 ? "end" : "start");
    gesture.edge = edge;
    const bandRect = gesture.band.getBoundingClientRect();
    const referenceLength = Math.max(24, axis === "horizontal" ? bandRect.width : bandRect.height);
    const segmentCount = gesture.route === "horizontal" ? horizontalSegments.length
      : gesture.route === "vertical" ? verticalSegments.length
      : gesture.route === "connector" ? connectorSegments.length : 1;
    const movementDistance = gesture.route === "horizontal" ? Math.max(0, deltaX) : distance;
    const movement = movementDistance / referenceLength / segmentCount;
    setProgress(gesture.route, edge, state.progress[gesture.route][edge] + movement * 1.8, point);
  }
}

function onPointerUp(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  clearGesture();
}

function onPointerCancel(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  clearGesture();
}

function onHoverMove(event) {
  if (event.pointerType !== "mouse" || state.phase !== "ready" || gesture) return;
  const rect = boxContainer.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  giftBox.style.transform = `translateY(-5px) rotateX(${-17 - y * 8}deg) rotateY(${-31 + x * 16}deg)`;
}

function resetHover(event) {
  if (event.pointerType !== "mouse" || state.phase !== "ready" || gesture) return;
  giftBox.style.removeProperty("transform");
}

giftBox.addEventListener("keydown", event => {
  if (!state.landed) return;
  if (state.phase === "ready" && event.target.closest(".gift-box__bow") && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    setPhase("bow-dropping");
    return;
  }
  if (state.phase === "unlocked" && event.key === "ArrowUp") {
    event.preventDefault();
    setPhase("opening");
  }
});
lock.addEventListener("click", () => {
  if (state.phase !== "unwrapped") return;
  state.lockTaps += 1;
  lock.dataset.taps = String(Math.min(state.lockTaps, 2));
  if (state.lockTaps >= 3) setPhase("unlocked");
});
bow.addEventListener("animationend", event => {
  if (event.target === bow && state.phase === "bow-dropping") setPhase("tearing");
});
giftBox.addEventListener("pointerdown", onPointerDown);
giftBox.addEventListener("pointermove", onPointerMove);
giftBox.addEventListener("pointerup", onPointerUp);
giftBox.addEventListener("pointercancel", onPointerCancel);
giftBox.addEventListener("lostpointercapture", onPointerCancel);
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
        return;
      }
    }

    boxContainer.style.setProperty("--fall-y", `${position}px`);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

dropGift();
