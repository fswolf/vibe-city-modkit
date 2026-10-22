// =====================================================================
//  game.js : Bean Catcher, a micro game for a Vibe City building
//
//  Catch the falling coffee beans in your cup. Gold beans are worth five,
//  burnt ones knock three off. 45 seconds a round. At the end the round's
//  tips go into the city's funds, and your best score is saved with the city.
//
//  The shape every little game here follows:
//    1. a canvas that fills the window
//    2. one loop (requestAnimationFrame) that updates, then draws
//    3. three screens: title, playing, round over
//    4. keys and mouse, pause on P or when the player clicks away
//    5. CITY (city.js) for saving, paying, toasts, the player's volume
//  Change the rules in update(), the look in draw().
// =====================================================================

const cv = document.getElementById("c"), g = cv.getContext("2d");
let W = 0, H = 0;
const fit = () => { W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; };
addEventListener("resize", fit); fit();

// ---------------------------------------------------------------------
//  THE RULES. Tune the game here.
// ---------------------------------------------------------------------
const ROUND_SECS = 45;
const TIP_PER_POINT = 8;            // dollars into the city per point
const BEAN = { plain: 1, gold: 5, burnt: -3 };
const CHANCE = { gold: .08, burnt: .18 };   // the rest are plain

// ---------------------------------------------------------------------
//  STATE
// ---------------------------------------------------------------------
let screen = "title";               // "title" | "play" | "over"
let paused = false, volume = 1, open = true, cityName = "";
let save = { best: 0, rounds: 0 };  // what we keep with the city
let cup = { x: .5, w: .12 };        // x and width as fractions of the screen
let beans = [], pops = [], score = 0, timeLeft = 0, spawnIn = 0, shake = 0, lastTips = 0;
const keys = {};

// ---------------------------------------------------------------------
//  SOUND: tiny beeps from Web Audio, so there are no files to ship.
//  Always scale by the player's volume (CITY tells us what it is).
// ---------------------------------------------------------------------
let ac = null;
function beep(freq, secs = .08, type = "square", vol = .15) {
  if (!volume) return;
  ac = ac || new AudioContext();
  const o = ac.createOscillator(), v = ac.createGain();
  o.type = type; o.frequency.value = freq; v.gain.value = vol * volume;
  v.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + secs);
  o.connect(v).connect(ac.destination); o.start(); o.stop(ac.currentTime + secs);
}

// ---------------------------------------------------------------------
//  INPUT
// ---------------------------------------------------------------------
addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === "Escape") { e.preventDefault(); if (screen === "play" && !paused) paused = true; else CITY.close(); return; }
  if (e.key === "p" || e.key === "P") { if (screen === "play") paused = !paused; return; }
  if ((e.key === " " || e.key === "Enter") && screen !== "play") start();
});
addEventListener("keyup", e => { keys[e.key] = false; });
cv.addEventListener("mousemove", e => { cup.x = e.clientX / innerWidth; });
cv.addEventListener("mousedown", () => { if (screen !== "play") start(); else if (paused) paused = false; });
// The city takes the keyboard back when the player clicks into it: pause, so nothing is lost
addEventListener("blur", () => { if (screen === "play") paused = true; });

// ---------------------------------------------------------------------
//  ROUNDS
// ---------------------------------------------------------------------
function start() {
  if (!open) return;                                   // no power or water: closed
  screen = "play"; paused = false;
  beans = []; pops = []; score = 0; timeLeft = ROUND_SECS; spawnIn = 0;
  beep(660, .1); beep(880, .12);
}

function finish() {
  screen = "over";
  save.rounds++;
  const best = score > save.best;
  if (best) save.best = score;
  CITY.save(save);                                     // keep it with the city's save
  lastTips = Math.max(0, score) * TIP_PER_POINT;
  if (lastTips > 0) CITY.pay(lastTips);                // the game answers with "paid"
  if (best && score > 0) CITY.toast(`New Bean Catcher record: ${score}!`);
  beep(best ? 990 : 440, .25, "triangle");
}
CITY.onPaid((amount, left) => { lastTips = amount; });   // what really went in (it can be capped)

// ---------------------------------------------------------------------
//  UPDATE: everything that moves, dt seconds at a time
// ---------------------------------------------------------------------
function update(dt) {
  if (screen !== "play" || paused) return;
  timeLeft -= dt;
  if (timeLeft <= 0) return finish();

  // the cup follows the arrow keys (or A and D) as well as the mouse
  const dir = (keys.ArrowRight || keys.d || keys.D ? 1 : 0) - (keys.ArrowLeft || keys.a || keys.A ? 1 : 0);
  cup.x = Math.min(1 - cup.w / 2, Math.max(cup.w / 2, cup.x + dir * dt * .9));

  // new beans, faster as the round goes on
  spawnIn -= dt;
  if (spawnIn <= 0) {
    const r = Math.random(), kind = r < CHANCE.gold ? "gold" : r < CHANCE.gold + CHANCE.burnt ? "burnt" : "plain";
    const speed = .25 + (1 - timeLeft / ROUND_SECS) * .35 + Math.random() * .1;
    beans.push({ x: .05 + Math.random() * .9, y: -.05, vy: speed, spin: Math.random() * 6, kind });
    spawnIn = .55 - (1 - timeLeft / ROUND_SECS) * .3;
  }

  // fall, and land in the cup or on the floor
  const cupTop = .86;
  for (const b of beans) {
    b.y += b.vy * dt; b.spin += dt * 4;
    if (!b.done && b.y > cupTop && b.y < cupTop + .04 && Math.abs(b.x - cup.x) < cup.w / 2) {
      b.done = true; score += BEAN[b.kind];
      pops.push({ x: b.x, y: cupTop, t: 0, text: (BEAN[b.kind] > 0 ? "+" : "") + BEAN[b.kind], kind: b.kind });
      if (b.kind === "burnt") { shake = .3; beep(150, .18, "sawtooth"); } else beep(b.kind === "gold" ? 1180 : 760, .06);
    }
  }
  beans = beans.filter(b => !b.done && b.y < 1.1);
  for (const p of pops) p.t += dt;
  pops = pops.filter(p => p.t < .8);
  shake = Math.max(0, shake - dt);
}

// ---------------------------------------------------------------------
//  DRAW: the screen from scratch, every frame
// ---------------------------------------------------------------------
const COL = { plain: "#7a4a2a", gold: "#f2c14e", burnt: "#2a1a14" };
function text(s, x, y, size, col = "#fff5e6", align = "center") {
  g.font = `bold ${size * H / 560}px system-ui, sans-serif`; g.textAlign = align; g.fillStyle = col; g.fillText(s, x, y);
}
function drawBean(x, y, r, spin, kind) {
  g.save(); g.translate(x, y); g.rotate(spin);
  g.fillStyle = COL[kind]; g.beginPath(); g.ellipse(0, 0, r, r * .7, 0, 0, 7); g.fill();
  g.strokeStyle = kind === "gold" ? "#a97a1a" : "#24130b"; g.lineWidth = r * .18;
  g.beginPath(); g.moveTo(-r * .7, 0); g.quadraticCurveTo(0, r * .35, r * .7, 0); g.stroke();
  g.restore();
}
function draw(t) {
  g.save();
  if (shake) g.translate((Math.random() - .5) * 14 * shake, (Math.random() - .5) * 14 * shake);
  // the roastery: a warm wall, a counter
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#3b2433"); sky.addColorStop(1, "#6b3f2e");
  g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
  g.fillStyle = "#4a2c1e"; g.fillRect(0, H * .9, W, H * .1);
  for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(255,210,140,.06)"; g.beginPath(); g.arc(W * (i + .5) / 6, H * .12, H * .08, 0, 7); g.fill(); }

  const r = H * .022;
  for (const b of beans) drawBean(b.x * W, b.y * H, r, b.spin, b.kind);

  // the cup
  const cx = cup.x * W, cw = cup.w * W, top = H * .86, ch = H * .07;
  g.fillStyle = "#f4ead8"; g.beginPath(); g.moveTo(cx - cw / 2, top); g.lineTo(cx + cw / 2, top); g.lineTo(cx + cw * .4, top + ch); g.lineTo(cx - cw * .4, top + ch); g.fill();
  g.strokeStyle = "#f4ead8"; g.lineWidth = H * .012; g.beginPath(); g.arc(cx + cw * .5, top + ch * .45, ch * .32, -1.3, 1.3); g.stroke();
  g.fillStyle = "#c0392b"; g.fillRect(cx - cw * .42, top + ch * .3, cw * .84, ch * .2);

  for (const p of pops) text(p.text, p.x * W, (p.y - p.t * .12) * H, 22, p.kind === "burnt" ? "#ff7a6a" : p.kind === "gold" ? "#f2c14e" : "#fff5e6");

  // the score bar
  if (screen === "play") {
    text(`Score ${score}`, W * .03, H * .07, 22, "#fff5e6", "left");
    text(`${Math.ceil(timeLeft)}s`, W * .97, H * .07, 22, timeLeft < 10 ? "#ff7a6a" : "#fff5e6", "right");
  }
  g.restore();

  // the screens over the top
  const dim = a => { g.fillStyle = `rgba(20,10,20,${a})`; g.fillRect(0, 0, W, H); };
  if (screen === "title") {
    dim(.55);
    text("Bean Catcher", W / 2, H * .36, 52, "#f2c14e");
    text(cityName ? `The ${cityName} Roastery` : "", W / 2, H * .44, 18, "#e8d6c0");
    text(open ? "Catch the beans. Gold is worth 5, burnt costs 3." : "Closed: this building has no power or water.", W / 2, H * .56, 18);
    if (open) text("Click or press Space to start.  Mouse or arrow keys to move.", W / 2, H * .63, 15, "#cdb9d6");
    text(save.best ? `Best: ${save.best}` : "", W / 2, H * .74, 18, "#f2c14e");
  } else if (screen === "over") {
    dim(.6);
    text("Round over", W / 2, H * .34, 44, "#f2c14e");
    text(`Score ${score}${score >= save.best && score > 0 ? "  (new best!)" : ""}`, W / 2, H * .45, 24);
    text(lastTips ? `$${lastTips} in tips went to the city` : "No tips this round", W / 2, H * .53, 18, "#a8e6a0");
    text("Click or press Space to play again.  Esc closes.", W / 2, H * .66, 15, "#cdb9d6");
  } else if (paused) {
    dim(.5);
    text("Paused", W / 2, H * .45, 44);
    text("Click or press P to carry on.  Esc closes.", W / 2, H * .54, 15, "#cdb9d6");
  }
}

// ---------------------------------------------------------------------
//  THE LOOP
// ---------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;   // capped, so a hiccup never teleports a bean
  update(dt); draw(now);
  requestAnimationFrame(loop);
}

// Wait for the city, then go
CITY.ready(info => {
  if (info.data) save = { ...save, ...info.data };
  volume = info.volume; open = info.city.open; cityName = info.city.name || "";
  requestAnimationFrame(loop);
});
