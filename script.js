(() => {
  "use strict";
  const canvas = document.getElementById("grove");
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;

  let W = 0, H = 0, DPR = 1;
  let skyGradient;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Dynamic Bamboo Object ---------- */
  class Bamboo {
    constructor(layer, x, w) {
      this.layer = layer;
      this.x = x;
      this.w = w;
      if (layer === 0) { this.topCol = "#1b4332"; this.botCol = "#0c2117"; this.alpha = 0.55; }
      else if (layer === 1) { this.topCol = "#2d6a4f"; this.botCol = "#143325"; this.alpha = 0.8; }
      else { this.topCol = "#40916c"; this.botCol = "#173828"; this.alpha = 0.95; }
      
      this.baseSway = rand(-15, 15);
      this.nodeOffsetY = rand(-20, 40);
      this.phase = rand(0, Math.PI * 2);
      this.freq = rand(0.005, 0.015);
      
      this.grains = [];
      for (let i = 1; i < w; i += rand(2, 4)) {
         this.grains.push(i);
      }
    }
    
    draw(g, t, wind) {
      const h = H;
      const x = this.x;
      const w = this.w;
      
      const sway = this.baseSway + Math.sin(t * this.freq + this.phase) * (w * 0.3) + wind * (1 - this.layer * 0.15);
      
      g.save();
      g.globalAlpha = this.alpha;
      
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, this.botCol);
      grad.addColorStop(0.25, this.topCol);
      grad.addColorStop(0.7, this.topCol);
      grad.addColorStop(1, this.botCol);
      g.fillStyle = grad;
      
      g.beginPath();
      g.moveTo(x, h);
      g.quadraticCurveTo(x + sway * 0.5, h * 0.5, x + sway, -40);
      g.lineTo(x + sway + w, -40);
      g.quadraticCurveTo(x + sway * 0.5 + w, h * 0.5, x + w, h);
      g.closePath();
      g.fill();

      g.globalAlpha = this.alpha * 0.15;
      g.strokeStyle = this.botCol;
      g.lineWidth = 0.5;
      for (const i of this.grains) {
        g.beginPath();
        g.moveTo(x + i, h);
        g.quadraticCurveTo(x + sway * 0.5 + i, h * 0.5, x + sway + i, -40);
        g.stroke();
      }

      g.globalAlpha = this.alpha * 0.75;
      g.strokeStyle = this.botCol;
      g.lineWidth = Math.max(1.5, w * 0.15);
      const step = w * 5.5;
      
      for (let y = this.nodeOffsetY; y < h; y += step) {
        const yt = 1 - (y + 40) / (h + 40); 
        const off = sway * yt;
        
        g.beginPath();
        g.moveTo(x + off - w * 0.05, y);
        g.quadraticCurveTo(x + off + w * 0.5, y + w * 0.35, x + off + w * 1.05, y + w * 0.1);
        g.stroke();
        
        g.strokeStyle = "rgba(255,255,255,0.15)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + off, y - 2);
        g.quadraticCurveTo(x + off + w * 0.5, y + w * 0.35 - 2, x + off + w, y + w * 0.1 - 2);
        g.stroke();
        g.strokeStyle = this.botCol; 
        g.lineWidth = Math.max(1.5, w * 0.15);
      }
      
      g.restore();
    }
  }

  /* ---------- 3D Stylized Ground ---------- */
  function drawGround(g) {
    g.save();
    const grad = g.createLinearGradient(0, H * 0.70, 0, H);
    grad.addColorStop(0, "#0a1e14");
    grad.addColorStop(1, "#040e09");
    
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, H * 0.76);
    g.quadraticCurveTo(W / 2, H * 0.65, W, H * 0.76);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();

    g.globalAlpha = 0.35;
    g.fillStyle = "#123021";
    g.beginPath();
    g.ellipse(W / 2, H * 0.82, W * 0.55, H * 0.12, 0, 0, Math.PI * 2);
    g.fill();

    g.globalAlpha = 0.25;
    g.fillStyle = "#1b4332";
    g.beginPath();
    g.ellipse(W / 2, H * 0.86, W * 0.35, H * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    
    g.restore();
  }

  /* ---------- Audio Setup & Volume ---------- */
  const bgAudio = document.getElementById("bg-audio");
  const pandaAudio = document.getElementById("panda-audio");
  bgAudio.volume = 0.4;
  
  let isAmbientMuted = true;
  let isPandaMuted = false; 
  let audioUnlocked = false;

  document.body.addEventListener('click', () => {
    if (!audioUnlocked) {
      pandaAudio.load(); 
      audioUnlocked = true;
    }
  }, { once: true });

  /* ---------- Ring Volume Control ---------- */
  const ambientWrapper = document.getElementById("ambient-wrapper");
  const volRingProg = document.getElementById("vol-ring-prog");
  const circumference = 2 * Math.PI * 18; // r=18
  volRingProg.style.strokeDasharray = circumference;

  let currentVol = 0.4;
  function updateVolumeUI(vol) {
    currentVol = clamp(vol, 0, 1);
    bgAudio.volume = currentVol;
    const offset = circumference - (currentVol * circumference);
    volRingProg.style.strokeDashoffset = offset;
  }
  updateVolumeUI(currentVol);

  ambientWrapper.addEventListener("wheel", (e) => {
    e.preventDefault(); 
    let step = e.deltaY > 0 ? -0.05 : 0.05;
    let newVol = currentVol + step;
    
    // Auto unmute if user scrolls up volume
    if (isAmbientMuted && newVol > 0 && step > 0) {
      document.getElementById("ambient-toggle").click();
    }
    updateVolumeUI(newVol);
  });

  document.getElementById("ambient-toggle").addEventListener("click", () => {
    isAmbientMuted = !isAmbientMuted;
    const iconOn = document.getElementById("ambient-on");
    const iconOff = document.getElementById("ambient-off");
    
    if (!isAmbientMuted) {
      if (currentVol === 0) updateVolumeUI(0.3); // fallback volume if unmuted at 0
      bgAudio.play().catch(() => {});
      iconOn.style.display = "block";
      iconOff.style.display = "none";
      volRingProg.classList.remove("muted");
    } else {
      bgAudio.pause();
      iconOn.style.display = "none";
      iconOff.style.display = "block";
      volRingProg.classList.add("muted");
    }
  });

  document.getElementById("panda-toggle").addEventListener("click", () => {
    isPandaMuted = !isPandaMuted;
    const iconOn = document.getElementById("panda-audio-on");
    const iconOff = document.getElementById("panda-audio-off");
    if (!isPandaMuted) {
      iconOn.style.display = "block";
      iconOff.style.display = "none";
    } else {
      iconOn.style.display = "none";
      iconOff.style.display = "block";
      stopAllPandaSounds(); // force stop if muted
    }
  });

  // Track active panda sounds for fast-fade on password focus
  let activePandaAudios = [];

  function playMP3PandaSound() {
    if (isPandaMuted || !audioUnlocked || shyMode) return;
    try {
      const playClone = pandaAudio.cloneNode();
      playClone.volume = 0.8;
      activePandaAudios.push(playClone);
      
      const playPromise = playClone.play();
      if (playPromise !== undefined) {
        playPromise.then(_ => {
          // Normal 3s playback then fade out
          let fadeOutTimer = setTimeout(() => {
            let fadeOutInterval = setInterval(() => {
              if (playClone.volume > 0.1) {
                playClone.volume -= 0.1;
              } else {
                clearInterval(fadeOutInterval);
                playClone.pause();
                playClone.currentTime = 0;
                activePandaAudios = activePandaAudios.filter(a => a !== playClone);
              }
            }, 100);
            playClone.dataset.fadeInterval = fadeOutInterval;
          }, 2000); 
          playClone.dataset.fadeTimer = fadeOutTimer;
        }).catch(e => {});
      }
    } catch(e) {}
  }

  // Quickly fade out and stop eating when clicking password
  function stopAllPandaSounds() {
    activePandaAudios.forEach(audio => {
      clearTimeout(audio.dataset.fadeTimer);
      clearInterval(audio.dataset.fadeInterval);
      
      let quickFade = setInterval(() => {
        if (audio.volume > 0.1) {
          audio.volume -= 0.1;
        } else {
          clearInterval(quickFade);
          audio.pause();
          audio.currentTime = 0;
        }
      }, 30);
    });
    activePandaAudios = [];
  }

  /* ---------- Pandas ---------- */
  const BLACK = "#0d1712", FUR = "#f5faf6", FUR_SHADE = "#c9dcd0";

  class Panda {
    constructor(i, n) {
      const side = i % 2 === 0 ? rand(40, W * 0.24) : rand(W * 0.76, W - 40);
      this.home = { x: side, y: rand(H * 0.74, H * 0.88) };
      this.x = this.home.x; this.y = this.home.y;
      this.tx = this.x; this.ty = this.y;
      this.face = this.x < W / 2 ? 1 : -1;
      this.state = "idle";
      this.timer = rand(80, 300);
      this.eat = 0; this.cool = 0;
      this.shy = 0; 
      this.blink = 0;
      this.bob = rand(0, 6.3);
      this.walkPhase = 0;
      this.crumbs = [];
      this.rescale();
    }
    rescale() {
      this.s = clamp(W / 1000, 0.8, 1.25);
    }
    nudgeHome() {
      const side = this.home.x < W / 2 ? rand(40, W * 0.24) : rand(W * 0.76, W - 40);
      this.home.x = side;
      this.home.y = clamp(this.home.y, H * .74, H * .9);
    }
    update(t, mx, my, shyMode, wind) {
      this.shy = lerp(this.shy, shyMode ? 1 : 0, .18);
      this.bob += .035;
      if (this.cool > 0) this.cool--;
      if (this.blink > 0) this.blink--;
      else if (Math.random() < .005) this.blink = 7;

      const near = Math.hypot(mx - this.x, my - (this.y - 35 * this.s));

      if (shyMode > 0.0 && this.shy > .5) {
        this.state = "shy";
      } else if (this.eat > 0) {
        this.eat--;
        this.state = "eat";
        if (this.eat % 12 === 0 && this.crumbs.length < 18) {
          this.crumbs.push({ x: this.x + this.face * 16 * this.s, y: this.y - 30 * this.s, vx: rand(-.4, .4), vy: rand(-.9, -.2), life: 30 });
        }
        if (this.eat === 0) { this.cool = 200; this.state = "idle"; this.timer = rand(100, 250); }
      } else if (mx !== null && near < 260 && this.cool === 0 && shyMode === false) {
        this.state = "walk";
        this.tx = clamp(mx - this.face * 25, 60, W - 60);
        this.ty = clamp(my + 35, H * .72, H * .92);
        if (near < 75) { 
          if (this.eat === 0) playMP3PandaSound(); 
          this.eat = 180; 
          this.state = "eat"; 
        }
      } else {
        if (--this.timer <= 0) {
          this.timer = rand(200, 450);
          if (Math.random() < .6 && shyMode === false) {
            this.state = "walk";
            this.tx = clamp(this.home.x + rand(-80, 80), 60, W - 60);
            this.ty = clamp(this.home.y + rand(-25, 25), H * .74, H * .9);
          } else this.state = "idle";
        }
      }

      if (this.state === "walk" && shyMode === false) {
        const dx = this.tx - this.x, dy = this.ty - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 5) { this.state = "idle"; this.walkPhase = 0; }
        else {
          const sp = clamp(d * 0.015, 0.5, 1.8);
          this.x += dx / d * sp;
          this.y += dy / d * sp * 0.5;
          if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
          this.walkPhase += 0.18;
        }
      } else {
        this.walkPhase = lerp(this.walkPhase % 6.3, 0, 0.1);
      }

      for (let i = this.crumbs.length - 1; i >= 0; i--) {
        const c = this.crumbs[i];
        c.x += c.vx + wind * 0.03; 
        c.y += c.vy; c.vy += .04; c.life--;
        if (c.life <= 0) this.crumbs.splice(i, 1);
      }
    }
    draw(g, t) {
      const s = this.s;
      const walking = this.state === "walk";
      const breathe = Math.sin(this.bob) * 1.3;
      const step = walking ? Math.sin(this.walkPhase) * 4 : 0;
      const eating = this.state === "eat";
      const chew = eating ? Math.sin(t * .25) * 1.8 : 0;

      g.save();
      g.translate(this.x, this.y);
      g.scale(s * this.face, s);

      g.globalAlpha = 0.45;
      g.fillStyle = "#010804";
      g.beginPath(); g.ellipse(0, 32, 46, 11, 0, 0, 6.3); g.fill();
      g.globalAlpha = 1;

      g.fillStyle = BLACK;
      ell(g, -24 + step, 22, 15, 11);
      ell(g, 24 - step, 22, 15, 11);

      g.fillStyle = FUR;
      ell(g, 0, 5 + breathe * .4, 34, 30);
      g.fillStyle = FUR_SHADE;
      g.globalAlpha = 0.5;
      ell(g, 10, 14, 22, 18);
      g.globalAlpha = 1;

      g.save();
      g.translate(0, -28 + breathe + chew * .3);

      g.fillStyle = BLACK;
      circ(g, -18, -18, 9.5); circ(g, 18, -18, 9.5);
      g.fillStyle = "#263c30";
      circ(g, -18, -18, 4.5); circ(g, 18, -18, 4.5);

      g.fillStyle = FUR;
      circ(g, 0, 0, 26);

      const covered = this.shy;
      g.fillStyle = BLACK;
      patch(g, -10, -2.5, -0.4);
      patch(g, 10, -2.5, 0.4);

      if (covered < .55) {
        g.globalAlpha = 1 - covered / .55;
        const squint = this.blink > 0 ? .25 : 1;
        g.fillStyle = FUR;
        g.beginPath(); g.ellipse(-9, -3.5, 3.2, 3.2 * squint, 0, 0, 6.3); g.fill();
        g.beginPath(); g.ellipse(9, -3.5, 3.2, 3.2 * squint, 0, 0, 6.3); g.fill();
        g.fillStyle = "#050b08";
        g.beginPath(); g.ellipse(-8.5, -3.5, 1.6, 1.6 * squint, 0, 0, 6.3); g.fill();
        g.beginPath(); g.ellipse(9.5, -3.5, 1.6, 1.6 * squint, 0, 0, 6.3); g.fill();
        g.globalAlpha = 1;
      }

      g.fillStyle = BLACK;
      ell(g, 0, 9 + chew * .5, 5, 3.4);
      g.strokeStyle = BLACK; g.lineWidth = 1.5; g.lineCap = "round";
      g.beginPath();
      g.moveTo(0, 12.5 + chew * .5); g.lineTo(0, 15 + chew * .5);
      g.moveTo(-5, 17 + chew); g.quadraticCurveTo(0, 19.5 + chew, 5, 17 + chew);
      g.stroke();
      g.restore();

      const normalArmY = 3;
      const shyArmY = -14;
      const currentArmY = lerp(normalArmY, shyArmY, covered);
      const currentArmX = lerp(30, 12, covered);

      g.fillStyle = BLACK;
      ell(g, -currentArmX, currentArmY, 10, 13);
      ell(g, currentArmX, currentArmY, 10, 13);

      if (covered > 0.05) {
        g.globalAlpha = covered * 0.6;
        g.fillStyle = "#ff826c";
        circ(g, -13, -24, 3.5); circ(g, 13, -24, 3.5);
        g.globalAlpha = 1;
      }

      if (eating && covered < 0.1) {
        g.save();
        g.translate(22, -28);
        g.rotate(-0.45);
        g.fillStyle = "#40916c";
        g.beginPath(); g.roundRect(-3.5, -5, 7, 38, 3.5); g.fill();
        g.strokeStyle = "#1b4332"; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-3.5, 8); g.lineTo(3.5, 8); g.moveTo(-3.5, 22); g.lineTo(3.5, 22); g.stroke();
        g.fillStyle = "#95d5b2";
        g.beginPath();
        g.moveTo(0, 28); g.quadraticCurveTo(15, 28, 22, 36); g.quadraticCurveTo(10, 38, 0, 32);
        g.fill();
        g.restore();
      }
      g.restore();
    }
  }

  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.3); g.fill(); }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
  function patch(g, x, y, rot) { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, 8, 10.5, 0, 0, 6.3); g.fill(); g.restore(); }

  /* ---------------- Scene Setup ---------------- */
  let bgs0 = [], bgs1 = [], bgs2 = [];
  let leaves = [], pandas = [];
  let mouse = { x: null, y: null };
  let shyMode = false;

  class Leaf {
    constructor(seed) { this.reset(seed); }
    reset(seed) {
      this.x = rand(-60, W + 60);
      this.y = seed ? rand(-H, H) : rand(-140, -20);
      this.s = rand(.6, 1.6);
      this.rot = rand(0, Math.PI * 2);
      this.spin = rand(-.02, .02);
      this.vy = rand(.3, .9) * this.s;
      this.amp = rand(15, 50);
      this.freq = rand(.006, .016);
      this.phase = rand(0, Math.PI * 2);
      this.a = rand(.4, .85);
      this.tint = Math.random() < .3 ? "#b7e4c7" : (Math.random() < .5 ? "#74c69d" : "#52b788");
    }
    step(t, wind) {
      this.y += this.vy;
      this.x += Math.sin(t * this.freq + this.phase) * .6 + (wind * 0.05 * this.s);
      this.rot += this.spin + (wind * 0.0005);
      if (this.y > H + 80) this.reset(false);
    }
    draw(g, t) {
      const x = this.x + Math.sin(t * this.freq + this.phase) * this.amp;
      g.save();
      g.translate(x, this.y);
      g.rotate(this.rot);
      g.scale(this.s, this.s * (.6 + .4 * Math.abs(Math.cos(this.rot))));
      g.globalAlpha = this.a;
      g.fillStyle = this.tint;
      g.beginPath();
      g.moveTo(-12, 0);
      g.quadraticCurveTo(0, -6, 12, 0);
      g.quadraticCurveTo(0, 6, -12, 0);
      g.fill();
      g.restore();
    }
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    
    skyGradient = ctx.createLinearGradient(0, 0, W * .3, H);
    skyGradient.addColorStop(0, "#124030");
    skyGradient.addColorStop(.42, "#0f3626");
    skyGradient.addColorStop(1, "#071f15");

    bgs0 = []; bgs1 = []; bgs2 = [];
    const density = clamp(Math.round(W / 46), 14, 40);
    for (let i = 0; i < density; i++) bgs0.push(new Bamboo(0, rand(-40, W + 40), rand(8, 14)));
    for (let i = 0; i < density * 0.6; i++) bgs1.push(new Bamboo(1, rand(-60, W + 60), rand(16, 28)));
    for (let i = 0; i < density * 0.3; i++) bgs2.push(new Bamboo(2, rand(-80, W + 80), rand(30, 50)));

    const leafCount = clamp(Math.round(W / 28), 16, 45);
    if (leaves.length !== leafCount) {
      leaves = Array.from({ length: leafCount }, () => new Leaf(true));
    }
    const pandaCount = W < 700 ? 2 : 4;
    if (pandas.length !== pandaCount) {
      pandas = Array.from({ length: pandaCount }, (_, i) => new Panda(i, pandaCount));
    } else pandas.forEach(p => p.nudgeHome());
  }

  let t = 0;
  let windTimer = 0;
  let windTarget = 0;
  let globalWind = 0;

  function frame() {
    t++;
    windTimer--;
    if (windTimer <= 0) {
      if (Math.random() < 0.35) {
        windTarget = rand(20, 55) * (Math.random() < 0.5 ? 1 : -1);
        windTimer = rand(150, 300); 
      } else {
        windTarget = 0;
        windTimer = rand(150, 400);
      }
    }
    globalWind = lerp(globalWind, windTarget, 0.015);

    ctx.clearRect(0, 0, W, H);
    
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, H);

    bgs0.forEach(b => b.draw(ctx, t, globalWind));
    ctx.fillStyle = "rgba(11,43,30,.35)"; ctx.fillRect(0, 0, W, H);
    
    bgs1.forEach(b => b.draw(ctx, t, globalWind));
    ctx.fillStyle = "rgba(9,34,23,.25)"; ctx.fillRect(0, 0, W, H);
    
    drawGround(ctx);
    
    bgs2.forEach(b => b.draw(ctx, t, globalWind));

    pandas.sort((a, b) => a.y - b.y);
    for (const p of pandas) { p.update(t, mouse.x, mouse.y, shyMode, globalWind); p.draw(ctx, t); }
    for (const l of leaves) { l.step(t, globalWind); l.draw(ctx, t); }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  if (!reduce) requestAnimationFrame(frame);
  else { ctx.fillRect(0, 0, W, H); pandas.forEach(p => p.draw(ctx, 0)); }

  /* ---------------- Mouse & Cursor ---------------- */
  const cursorEl = document.getElementById("cursor");
  let cx = W / 2, cy = H / 2, px = cx, py = cy, tilt = 0;

  window.addEventListener("pointermove", e => {
    cx = e.clientX; cy = e.clientY;
    mouse.x = e.clientX; mouse.y = e.clientY;
    cursorEl.classList.add("ready");
  }, { passive: true });

  document.addEventListener("mouseleave", () => { mouse.x = null; mouse.y = null; cursorEl.classList.remove("ready"); });

  if (fine && !reduce) {
    (function follow() {
      px = lerp(px, cx, .25); py = lerp(py, cy, .25);
      tilt = lerp(tilt, clamp((cx - px) * 1.5, -15, 15), .12);
      cursorEl.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${tilt}deg)`;
      requestAnimationFrame(follow);
    })();
  }

  /* ---------------- UI Interactions & Password Focus ---------------- */
  const secrets = document.querySelectorAll("[data-secret]");
  
  function refreshShy() {
    const newShy = Array.from(secrets).some(i => i === document.activeElement);
    
    // If shy mode just activated, force pandas to stop eating & fade out sound
    if (newShy && !shyMode) {
      stopAllPandaSounds();
      pandas.forEach(p => {
        if (p.eat > 0) p.eat = 0; // Drop the bamboo immediately
      });
    }
    
    shyMode = newShy;
  }
  
  secrets.forEach(i => {
    i.addEventListener("focus", refreshShy);
    i.addEventListener("blur", () => setTimeout(refreshShy, 0));
  });

  const tabs = document.getElementById("tabs");
  const tabLogin = document.getElementById("tab-login");
  const tabReg = document.getElementById("tab-register");
  const panelLogin = document.getElementById("panel-login");
  const panelReg = document.getElementById("panel-register");

  function show(which) {
    const reg = which === "register";
    tabs.classList.toggle("is-register", reg);
    tabLogin.setAttribute("aria-selected", String(!reg));
    tabReg.setAttribute("aria-selected", String(reg));
    panelLogin.classList.toggle("active", !reg);
    panelReg.classList.toggle("active", reg);
    panelLogin.hidden = reg;
    panelReg.hidden = !reg;
    refreshShy();
  }
  tabLogin.addEventListener("click", () => show("login"));
  tabReg.addEventListener("click", () => show("register"));
  document.querySelectorAll("[data-goto]").forEach(a =>
    a.addEventListener("click", () => show(a.dataset.goto)));

  document.querySelectorAll(".peek").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.peek);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      input.focus();
    });
  });

  const regPass = document.getElementById("reg-pass");
  const bar = document.getElementById("strength");
  const note = document.getElementById("strength-note");
  const notes = [
    "A longer phrase grows a taller stalk.",
    "A seedling. Add a few more characters.",
    "Growing. Mix in numbers or symbols.",
    "Strong stalk. One more twist would help.",
    "This one can hold up a panda."
  ];
  regPass.addEventListener("input", () => {
    const v = regPass.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[0-9]/.test(v) && /[a-zA-Z]/.test(v)) score++;
    if (/[^\w\s]/.test(v)) score++;
    if (!v) score = 0;
    bar.dataset.level = score;
    note.textContent = notes[score];
  });
})();