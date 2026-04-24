const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const phaseLabel = document.getElementById("phaseLabel");
const scoreLabel = document.getElementById("scoreLabel");
const livesLabel = document.getElementById("livesLabel");
const checkpointLabel = document.getElementById("checkpointLabel");
const hpLabel = document.getElementById("hpLabel");
const msgLabel = document.getElementById("msg");
const characterLabel = document.getElementById("characterLabel");
const abilityLabel = document.getElementById("abilityLabel");
const rankingBody = document.getElementById("rankingBody");
const characterButtons = document.getElementById("characterButtons");
const gameStateLabel = document.getElementById("gameStateLabel");
const startMenu = document.getElementById("startMenu");
const menuCards = document.getElementById("menuCards");
const menuPlayerName = document.getElementById("menuPlayerName");

const WORLD_W = 1920;
const WORLD_H = 1080;
const GRAVITY = 0.80;
const MAX_FALL_SPEED = 24;
const RANKING_KEY = "mini_stumble_ranking_v5";
const PLAYER_NAME_KEY = "mini_stumble_player_name_v5";
const GAME_TITLE = "SkyRush Legends";

const characters = [
  { id:"runner", name:"Runner", color:"#ef4444", accent:"#fee2e2", speed:7.6, jump:16.6, hp:100, lives:3, ability:"Sprint", sprintMultiplier:1.85, jumpBoost:0, extraHp:0, desc:"Maratonista veloz com aceleração explosiva." },
  { id:"ninja", name:"Ninja", color:"#3b82f6", accent:"#dbeafe", speed:7.1, jump:19.3, hp:90, lives:3, ability:"Super Pulo", sprintMultiplier:1.2, jumpBoost:2.9, extraHp:0, desc:"Ágil e letal, salta mais alto que todos." },
  { id:"tank", name:"Tank", color:"#8b5cf6", accent:"#ede9fe", speed:6.2, jump:16.2, hp:150, lives:3, ability:"Vida Extra", sprintMultiplier:1.12, jumpBoost:0, extraHp:40, desc:"Blindado e resistente, aguenta mais dano." },
  { id:"forest", name:"Forest", color:"#22c55e", accent:"#dcfce7", speed:8.1, jump:18.7, hp:100, lives:2, ability:"Agilidade Total", sprintMultiplier:1.4, jumpBoost:1.6, extraHp:0, desc:"Camuflado e rápido, mistura corrida e salto." }
];

const input = {
  left:false,
  right:false,
  jumpHeld:false,
  jumpPressed:false,
  abilityHeld:false
};

const game = {
  phase:1,
  score:0,
  lives:3,
  baseLives:3,
  gameOver:false,
  win:false,
  transitioning:false,
  paused:false,
  stopped:false,
  started:false,
  invulnerableTimer:0,
  playerName: localStorage.getItem(PLAYER_NAME_KEY) || "Jogador",
  checkpointsTaken:new Set()
};

const audioState = {
  enabled:true,
  ctx:null,
  master:null,
  musicGain:null,
  sfxGain:null,
  started:false,
  musicTimer:null
};

const player = {
  x:80,
  y:0,
  w:48,
  h:60,
  vx:0,
  vy:0,
  color:characters[0].color,
  accent:characters[0].accent,
  characterId:characters[0].id,
  characterName:characters[0].name,
  speed:characters[0].speed,
  baseSpeed:characters[0].speed,
  jumpForce:characters[0].jump,
  baseJumpForce:characters[0].jump,
  maxHP:characters[0].hp,
  hp:characters[0].hp,
  onGround:false,
  currentPlatform:null,
  coyoteTimer:0,
  jumpBuffer:0,
  checkpointName:"Início",
  ability:"Sprint",
  sprintMultiplier:1.8,
  jumpBoost:0,
  extraHp:0
};

let platforms = [];
let hazards = [];
let checkpoints = [];
let goal = null;
let enemies = [];
let spawn = { x:80, y:860 };

function ensureAudio(){
  if(audioState.started) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if(!AudioCtx) return;
  audioState.ctx = new AudioCtx();
  audioState.master = audioState.ctx.createGain();
  audioState.musicGain = audioState.ctx.createGain();
  audioState.sfxGain = audioState.ctx.createGain();

  audioState.master.gain.value = 9.0;
  audioState.musicGain.gain.value = 0.18;
  audioState.sfxGain.gain.value = 0.35;

  audioState.musicGain.connect(audioState.master);
  audioState.sfxGain.connect(audioState.master);
  audioState.master.connect(audioState.ctx.destination);

  audioState.started = true;
  startMusicLoop();
}

function playTone(freq=440, duration=0.12, type="sine", gain=0.08, glideTo=null){
  if(!audioState.enabled) return;
  ensureAudio();
  if(!audioState.ctx) return;
  const t = audioState.ctx.currentTime;
  const osc = audioState.ctx.createOscillator();
  const g = audioState.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if(glideTo){
    osc.frequency.exponentialRampToValueAtTime(glideTo, t + duration);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g);
  g.connect(audioState.sfxGain);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function startMusicLoop(){
  if(!audioState.enabled || !audioState.ctx) return;
  if(audioState.musicTimer) clearInterval(audioState.musicTimer);

  const notes = [220, 277.18, 329.63, 392.00, 329.63, 277.18];
  let i = 0;
  audioState.musicTimer = setInterval(() => {
    if(!audioState.enabled || game.stopped) return;
    const t = audioState.ctx.currentTime;
    const base = notes[i % notes.length];
    playMusicNote(base, 0.34, "triangle", 0.04);
    if(i % 2 === 0) playMusicNote(base / 2, 0.36, "sine", 0.02);
    i++;
  }, 360);
}

function playMusicNote(freq, duration, type, gain){
  if(!audioState.enabled || !audioState.ctx) return;
  const t = audioState.ctx.currentTime;
  const osc = audioState.ctx.createOscillator();
  const g = audioState.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g);
  g.connect(audioState.musicGain);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

function sfxJump(){ playTone(520, 0.09, "square", 0.08, 760); }
function sfxDamage(){ playTone(180, 0.18, "sawtooth", 0.11, 90); }
function sfxCheckpoint(){ playTone(660, 0.10, "triangle", 0.09, 880); setTimeout(()=>playTone(880,0.12,"triangle",0.08,990),70); }
function sfxWin(){ playTone(523.25,0.12,"triangle",0.09,659.25); setTimeout(()=>playTone(659.25,0.14,"triangle",0.08,783.99),120); setTimeout(()=>playTone(783.99,0.18,"triangle",0.08,1046.5),240); }
function sfxSelect(){ playTone(460, 0.08, "sine", 0.06, 620); }

function toggleAudio(){
  audioState.enabled = !audioState.enabled;
  if(audioState.enabled){
    ensureAudio();
    setMessage("Música ativada");
  }else{
    setMessage("Música desativada");
  }
}

function setMessage(text){
  msgLabel.textContent = text;
}

function updateGameStateLabel(){
  if(!game.started){
    gameStateLabel.textContent = "Menu";
  }else if(game.stopped){
    gameStateLabel.textContent = "Parado";
  }else if(game.paused){
    gameStateLabel.textContent = "Pausado";
  }else if(game.gameOver){
    gameStateLabel.textContent = "Game Over";
  }else if(game.win){
    gameStateLabel.textContent = "Vitória";
  }else{
    gameStateLabel.textContent = "Rodando";
  }
}

function togglePause(){
  if(!game.started || game.stopped || game.gameOver || game.win) return;
  game.paused = !game.paused;
  setMessage(game.paused ? "Jogo pausado" : "Jogo retomado");
  updateGameStateLabel();
}

function stopGame(){
  game.stopped = true;
  game.paused = false;
  resetInput();
  setMessage("Jogo parado");
  updateGameStateLabel();
}

function openStartMenu(){
  startMenu.classList.remove("hidden");
  game.started = false;
  game.paused = false;
  updateGameStateLabel();
}

function closeStartMenu(){
  startMenu.classList.add("hidden");
}

function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

function overlap(a,b){
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function formatDateBR(){
  return new Date().toLocaleString("pt-BR");
}

function savePlayerName(name){
  game.playerName = name;
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

function saveMenuPlayerName(){
  const name = (menuPlayerName.value || "").trim().slice(0,18) || "Jogador";
  savePlayerName(name);

  const saveBtn = document.getElementById("saveNameBtn");
  const startBtn = document.getElementById("startGameBtn");

  saveBtn.innerText = "NOME SALVO";
  saveBtn.disabled = true;
  saveBtn.style.background = "#16a34a";
  saveBtn.style.background = "linear-gradient(180deg,#16a34a,#15803d)";
  saveBtn.style.boxShadow = "0 0 18px rgba(34,197,94,.55)";

  startBtn.style.display = "inline-block";
  startBtn.style.opacity = "1";
  startBtn.style.transform = "scale(1)";
  startBtn.style.animation = "pulseStart 1.2s infinite";

  setMessage("Nome salvo: " + name);
  sfxCheckpoint();
}

function showPlayerNamePrompt(){
  const current = game.playerName || "Jogador";
  const name = prompt("Digite o nome do jogador para o ranking:", current);
  if(name !== null){
    const cleaned = name.trim().slice(0, 18) || "Jogador";
    savePlayerName(cleaned);
    menuPlayerName.value = cleaned;
    setMessage("Nome definido: " + cleaned);
  }
}

function resetInput(){
  input.left = false;
  input.right = false;
  input.jumpHeld = false;
  input.jumpPressed = false;
  input.abilityHeld = false;
}

function updateHUD(){
  phaseLabel.textContent = String(game.phase);
  scoreLabel.textContent = String(game.score);
  livesLabel.textContent = String(game.lives);
  checkpointLabel.textContent = player.checkpointName;
  hpLabel.textContent = String(player.hp);
  characterLabel.textContent = player.characterName;
  abilityLabel.textContent = player.ability;
  updateGameStateLabel();
}

function addScore(value){
  game.score += value;
  updateHUD();
}

function awardCheckpointScore(id, value){
  if(!game.checkpointsTaken.has(id)){
    game.checkpointsTaken.add(id);
    addScore(value);
  }
}

function clearRanking(){
  localStorage.removeItem(RANKING_KEY);
  renderRanking();
}

function getRanking(){
  try{
    const raw = localStorage.getItem(RANKING_KEY);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }catch{
    return [];
  }
}

function saveRankingEntry(entry){
  const ranking = getRanking();
  ranking.push(entry);
  ranking.sort((a,b) => b.score - a.score || b.phase - a.phase);
  localStorage.setItem(RANKING_KEY, JSON.stringify(ranking.slice(0, 10)));
  renderRanking();
}

function renderRanking(){
  const ranking = getRanking();
  rankingBody.innerHTML = "";
  if(ranking.length === 0){
    rankingBody.innerHTML = `<tr><td colspan="5" style="opacity:.75">Nenhum vencedor registrado ainda.</td></tr>`;
    return;
  }

  ranking.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.score}</td>
      <td>${item.phase}</td>
      <td>${escapeHtml(item.date)}</td>
    `;
    rankingBody.appendChild(tr);
  });
}

function escapeHtml(text){
  return String(text)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function registerVictory(){
  saveRankingEntry({
    name: game.playerName || "Jogador",
    score: game.score,
    phase: game.phase,
    date: formatDateBR()
  });
}

function renderCharacterButtons(){
  characterButtons.innerHTML = "";
  characters.forEach(char => {
    const btn = document.createElement("button");
    btn.className = "char-btn" + (char.id === player.characterId ? " active" : "");
    btn.textContent = char.name;
    btn.style.borderColor = char.color;
    btn.onclick = () => {
      selectCharacter(char.id);
      restartGame();
    };
    characterButtons.appendChild(btn);
  });
}

function renderMenuCards(){
  menuCards.innerHTML = "";
  characters.forEach(char => {
    const card = document.createElement("div");
    card.className = "card" + (char.id === player.characterId ? " selected" : "");
    card.onclick = () => {
      selectCharacter(char.id);
      renderMenuCards();
      sfxSelect();
    };

    card.innerHTML = `
      <div class="card-top">
        <div class="avatar" style="border-color:${char.color}">
          ${renderAvatarHTML(char)}
        </div>
        <span class="tag">${char.ability}</span>
      </div>
      <h3>${char.name}</h3>
      <div style="color:#cbd5e1;font-size:14px;line-height:1.4;">${char.desc}</div>
      <div class="specs">
        <div class="spec"><strong>Velocidade</strong><br>${char.speed.toFixed(1)}</div>
        <div class="spec"><strong>Pulo</strong><br>${char.jump.toFixed(1)}</div>
        <div class="spec"><strong>HP</strong><br>${char.hp + char.extraHp}</div>
        <div class="spec"><strong>Vidas</strong><br>${char.lives}</div>
      </div>
    `;
    menuCards.appendChild(card);
  });
}

function renderAvatarHTML(char){
  if(char.id === "runner"){
    return `
      <div style="position:relative;width:46px;height:54px;background:${char.color};border-radius:10px;">
        <div style="position:absolute;left:9px;top:16px;width:28px;height:20px;background:#fff;border-radius:4px;"></div>
        <div style="position:absolute;left:20px;top:16px;width:6px;height:20px;background:#111827;"></div>
        <div style="position:absolute;left:9px;top:6px;width:10px;height:10px;background:#fde68a;border-radius:2px;"></div>
        <div style="position:absolute;left:27px;top:6px;width:10px;height:10px;background:#fde68a;border-radius:2px;"></div>
      </div>
    `;
  }
  if(char.id === "ninja"){
    return `
      <div style="position:relative;width:46px;height:54px;background:${char.color};border-radius:10px;">
        <div style="position:absolute;left:7px;top:8px;width:32px;height:12px;background:#111827;border-radius:3px;"></div>
        <div style="position:absolute;left:5px;top:20px;width:36px;height:9px;background:#f59e0b;border-radius:3px;"></div>
        <div style="position:absolute;left:10px;top:21px;width:6px;height:5px;background:#fff;border-radius:1px;"></div>
        <div style="position:absolute;left:30px;top:21px;width:6px;height:5px;background:#fff;border-radius:1px;"></div>
      </div>
    `;
  }
  if(char.id === "tank"){
    return `
      <div style="position:relative;width:46px;height:54px;background:#6b7280;border-radius:10px;">
        <div style="position:absolute;left:5px;top:6px;width:36px;height:14px;background:#111827;border-radius:4px;"></div>
        <div style="position:absolute;left:7px;top:22px;width:32px;height:18px;background:#111827;border-radius:4px;"></div>
        <div style="position:absolute;left:18px;top:22px;width:10px;height:18px;background:#9ca3af;border-radius:2px;"></div>
      </div>
    `;
  }
  return `
    <div style="position:relative;width:46px;height:54px;background:#3f6212;border-radius:10px;">
      <div style="position:absolute;left:4px;top:6px;width:12px;height:10px;background:#14532d;border-radius:2px;"></div>
      <div style="position:absolute;left:18px;top:8px;width:10px;height:10px;background:#4d7c0f;border-radius:2px;"></div>
      <div style="position:absolute;left:22px;top:20px;width:14px;height:12px;background:#14532d;border-radius:2px;"></div>
      <div style="position:absolute;left:8px;top:30px;width:12px;height:10px;background:#4d7c0f;border-radius:2px;"></div>
    </div>
  `;
}

function previewSelectedCharacter(){
  sfxSelect();
  setMessage("Prévia selecionada: " + player.characterName);
}

function selectCharacter(id){
  const char = characters.find(c => c.id === id);
  if(!char) return;

  player.characterId = char.id;
  player.characterName = char.name;
  player.color = char.color;
  player.accent = char.accent;
  player.speed = char.speed;
  player.baseSpeed = char.speed;
  player.jumpForce = char.jump;
  player.baseJumpForce = char.jump;
  player.maxHP = char.hp + char.extraHp;
  player.hp = player.maxHP;
  player.ability = char.ability;
  player.sprintMultiplier = char.sprintMultiplier;
  player.jumpBoost = char.jumpBoost;
  player.extraHp = char.extraHp;

  game.baseLives = char.lives;
  game.lives = char.lives;

  renderCharacterButtons();
  renderMenuCards();
  updateHUD();
  setMessage("Personagem: " + char.name);
}

function createPlatform(x, y, w, h, opts = {}){
  return {
    x, y, w, h,
    moving: !!opts.moving,
    dx: opts.dx || 0,
    dy: opts.dy || 0,
    minX: opts.minX ?? x,
    maxX: opts.maxX ?? x,
    minY: opts.minY ?? y,
    maxY: opts.maxY ?? y,
    prevX:x,
    prevY:y,
    color: opts.color || "#6d4322",
    topColor: opts.topColor || "#8b5e34"
  };
}

function createHazard(x, y, w, h, opts = {}){
  return {
    x, y, w, h,
    type: opts.type || "spikes",
    damage: opts.damage ?? 25,
    kill: !!opts.kill,
    moving: !!opts.moving,
    dx: opts.dx || 0,
    dy: opts.dy || 0,
    minX: opts.minX ?? x,
    maxX: opts.maxX ?? x,
    minY: opts.minY ?? y,
    maxY: opts.maxY ?? y,
    angle: opts.angle || 0,
    rotationSpeed: opts.rotationSpeed || 0.08,
    radius: opts.radius || Math.max(w, h) * 0.5,
    armLength: opts.armLength || 70,
    arms: opts.arms || 2
  };
}

function createCheckpoint(id, name, x, y){
  return { id, name, x, y, w:26, h:90, active:false };
}

function createEnemy(x, y, w, h, opts = {}){
  return {
    x, y, w, h,
    dx: opts.dx || 2,
    minX: opts.minX ?? x,
    maxX: opts.maxX ?? x,
    damage: opts.damage ?? 20
  };
}

function loadPhase(phase){
  game.phase = phase;
  game.transitioning = false;
  game.win = false;
  game.gameOver = false;
  game.paused = false;
  game.stopped = false;
  game.checkpointsTaken = new Set();

  platforms = [];
  hazards = [];
  checkpoints = [];
  enemies = [];

  if(phase === 1){
    spawn = { x:80, y:860 };
    platforms = [
      createPlatform(0, 940, 430, 140),
      createPlatform(460, 880, 190, 24),
      createPlatform(710, 820, 180, 24),
      createPlatform(950, 760, 190, 24, { moving:true, dx:1.4, minX:920, maxX:1080 }),
      createPlatform(1180, 700, 170, 24),
      createPlatform(1390, 640, 170, 24),
      createPlatform(1590, 585, 160, 24, { moving:true, dy:0.9, minY:540, maxY:650 }),
      createPlatform(1740, 520, 130, 24)
    ];
    hazards = [
      createHazard(430, 920, 28, 20, { type:"spikes", damage:30 }),
      createHazard(650, 920, 44, 20, { type:"spikes", damage:30 }),
      createHazard(1145, 920, 140, 24, { type:"lava", damage:40 }),
      createHazard(1565, 920, 80, 20, { type:"spikes", damage:35 })
    ];
    checkpoints = [ createCheckpoint("cp1", "CP 1", 1060, 670) ];
    enemies = [ createEnemy(1200, 672, 38, 28, { dx:1.6, minX:1188, maxX:1298, damage:20 }) ];
    goal = { x:1812, y:440, w:56, h:80 };
    setMessage("Fase 1");
  }

  if(phase === 2){
    spawn = { x:90, y:900 };
    platforms = [
      createPlatform(0, 960, 290, 120),
      createPlatform(340, 910, 150, 24),
      createPlatform(540, 860, 150, 24, { moving:true, dx:1.8, minX:520, maxX:670 }),
      createPlatform(735, 810, 145, 24),
      createPlatform(920, 760, 145, 24, { moving:true, dy:1.1, minY:710, maxY:820 }),
      createPlatform(1100, 705, 145, 24),
      createPlatform(1275, 650, 145, 24),
      createPlatform(1455, 595, 140, 24, { moving:true, dx:2.0, minX:1420, maxX:1595 }),
      createPlatform(1635, 535, 135, 24),
      createPlatform(1790, 470, 110, 24)
    ];
    hazards = [
      createHazard(296, 940, 36, 20, { type:"spikes", damage:35 }),
      createHazard(494, 940, 36, 20, { type:"spikes", damage:35 }),
      createHazard(885, 940, 85, 24, { type:"lava", damage:50 }),
      createHazard(1245, 940, 42, 20, { type:"spikes", damage:40 }),
      createHazard(1600, 940, 110, 24, { type:"lava", kill:true }),
      createHazard(1470, 560, 42, 42, { type:"saw", damage:50, moving:true, dx:2.2, minX:1460, maxX:1575, rotationSpeed:0.18 })
    ];
    checkpoints = [
      createCheckpoint("cp2a", "CP 2A", 980, 670),
      createCheckpoint("cp2b", "CP 2B", 1660, 445)
    ];
    enemies = [
      createEnemy(1130, 677, 40, 28, { dx:1.7, minX:1110, maxX:1210, damage:20 }),
      createEnemy(1650, 507, 40, 28, { dx:1.9, minX:1640, maxX:1730, damage:25 })
    ];
    goal = { x:1840, y:390, w:56, h:80 };
    setMessage("Fase 2");
  }

  if(phase === 3){
    spawn = { x:70, y:910 };
    platforms = [
      createPlatform(0, 960, 250, 120),
      createPlatform(310, 910, 140, 24),
      createPlatform(500, 860, 135, 24, { moving:true, dx:1.8, minX:480, maxX:620 }),
      createPlatform(690, 815, 135, 24),
      createPlatform(875, 770, 135, 24),
      createPlatform(1060, 720, 130, 24, { moving:true, dy:1.1, minY:680, maxY:790 }),
      createPlatform(1260, 665, 130, 24),
      createPlatform(1460, 610, 130, 24),
      createPlatform(1660, 555, 120, 24),
      createPlatform(1800, 500, 90, 24)
    ];
    hazards = [
      createHazard(240, 840, 46, 46, { type:"saw", damage:45, moving:true, dy:2, minY:790, maxY:900, rotationSpeed:0.22 }),
      createHazard(640, 780, 120, 24, { type:"rotor", damage:50, moving:false, arms:2, armLength:75, rotationSpeed:0.12, radius:14 }),
      createHazard(1185, 660, 120, 24, { type:"lava", damage:55 }),
      createHazard(1510, 560, 130, 24, { type:"rotor", damage:60, arms:3, armLength:70, rotationSpeed:0.14, radius:14 })
    ];
    checkpoints = [
      createCheckpoint("cp3a", "CP 3A", 910, 680),
      createCheckpoint("cp3b", "CP 3B", 1490, 520)
    ];
    enemies = [ createEnemy(1285, 637, 40, 28, { dx:2, minX:1270, maxX:1360, damage:25 }) ];
    goal = { x:1844, y:420, w:56, h:80 };
    setMessage("Fase 3");
  }

  if(phase === 4){
    spawn = { x:65, y:915 };
    platforms = [
      createPlatform(0, 970, 220, 110),
      createPlatform(270, 920, 120, 24),
      createPlatform(440, 875, 120, 24, { moving:true, dx:2.2, minX:420, maxX:570 }),
      createPlatform(620, 830, 120, 24),
      createPlatform(800, 790, 120, 24, { moving:true, dy:1.4, minY:740, maxY:840 }),
      createPlatform(980, 740, 120, 24),
      createPlatform(1160, 690, 120, 24),
      createPlatform(1340, 635, 110, 24, { moving:true, dx:2.3, minX:1320, maxX:1490 }),
      createPlatform(1525, 580, 110, 24),
      createPlatform(1700, 525, 110, 24),
      createPlatform(1835, 470, 70, 24)
    ];
    hazards = [
      createHazard(200, 835, 50, 50, { type:"saw", damage:45, moving:true, dy:2.4, minY:785, maxY:900, rotationSpeed:0.2 }),
      createHazard(545, 760, 100, 24, { type:"rotor", damage:35, arms:2, armLength:45, rotationSpeed:0.07, radius:12 }),
      createHazard(1110, 650, 130, 24, { type:"rotor", damage:65, arms:2, armLength:88, rotationSpeed:0.17, radius:16 }),
      createHazard(1460, 545, 46, 46, { type:"saw", damage:50, moving:true, dx:2.5, minX:1450, maxX:1620, rotationSpeed:0.24 }),
      createHazard(1755, 492, 110, 22, { type:"lava", kill:true })
    ];
    checkpoints = [
      createCheckpoint("cp4a", "CP 4A", 995, 650),
      createCheckpoint("cp4b", "CP 4B", 1720, 435)
    ];
    enemies = [
      createEnemy(1000, 712, 42, 28, { dx:2.2, minX:992, maxX:1070, damage:25 }),
      createEnemy(1540, 552, 42, 28, { dx:2.1, minX:1530, maxX:1600, damage:28 })
    ];
    goal = { x:1848, y:390, w:56, h:80 };
    setMessage("Fase 4");
  }

  if(phase === 5){
    spawn = { x:65, y:920 };
    platforms = [
      createPlatform(0, 975, 210, 105),
      createPlatform(255, 930, 105, 24),
      createPlatform(410, 885, 105, 24, { moving:true, dx:2.5, minX:390, maxX:520 }),
      createPlatform(570, 840, 105, 24),
      createPlatform(730, 795, 105, 24),
      createPlatform(890, 750, 105, 24, { moving:true, dy:1.6, minY:700, maxY:805 }),
      createPlatform(1050, 705, 105, 24),
      createPlatform(1210, 655, 105, 24),
      createPlatform(1370, 605, 100, 24),
      createPlatform(1525, 555, 100, 24, { moving:true, dx:2.7, minX:1505, maxX:1655 }),
      createPlatform(1690, 500, 100, 24),
      createPlatform(1830, 440, 70, 24)
    ];
   hazards = [
      createHazard(520, 805, 135, 24, { type:"rotor", damage:55, arms:3, armLength:62, rotationSpeed:0.09, radius:14 }),
      createHazard(1470, 515, 46, 46, { type:"saw", damage:45, moving:true, dx:1.7, minX:1455, maxX:1600, rotationSpeed:0.16 }),
      createHazard(1645, 940, 160, 28, { type:"lava", kill:true })
    ];
    checkpoints = [
      createCheckpoint("cp5a", "CP 5A", 1085, 615),
      createCheckpoint("cp5b", "CP 5B", 1715, 410)
    ];
    enemies = [
      createEnemy(1225, 627, 42, 28, { dx:2.4, minX:1215, maxX:1290, damage:28 }),
      createEnemy(1705, 472, 42, 28, { dx:2.5, minX:1695, maxX:1760, damage:30 })
    ];
    goal = { x:1852, y:360, w:56, h:80 };
    setMessage("Fase Final");
  }

  resetToSpawn(true);
  updateHUD();
}

function resetToSpawn(fullHP = false){
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.currentPlatform = null;
  player.coyoteTimer = 0;
  player.jumpBuffer = 0;
  player.checkpointName = player.checkpointName || "Início";
  if(fullHP) player.hp = player.maxHP;
  resetInput();
  updateHUD();
}

function setCheckpoint(cp){
  spawn.x = cp.x - 20;
  spawn.y = cp.y - 30;
  player.checkpointName = cp.name;
  cp.active = true;
  checkpoints.forEach(other => {
    if(other !== cp) other.active = false;
  });
  awardCheckpointScore(cp.id, 150);
  sfxCheckpoint();
  setMessage("Checkpoint ativado: " + cp.name);
  updateHUD();
}

function loseLife(){
  game.lives -= 1;
  updateHUD();

  if(game.lives <= 0){
    game.gameOver = true;
    setMessage("Game Over");
    updateGameStateLabel();
    return;
  }

  player.hp = player.maxHP;
  game.invulnerableTimer = 60;
  resetToSpawn(false);
  setMessage("Você perdeu uma vida");
}

function damagePlayer(amount, forceKill = false){
  if(game.invulnerableTimer > 0 || game.gameOver || game.win || game.paused || game.stopped || !game.started) return;

  sfxDamage();

  if(forceKill){
    loseLife();
    return;
  }

  player.hp -= amount;
  game.invulnerableTimer = 50;
  setMessage("Dano: -" + amount);

  if(player.hp <= 0){
    loseLife();
  }else{
    player.vy = -7;
  }

  updateHUD();
}

function restartGame(){
  game.score = 0;
  game.win = false;
  game.gameOver = false;
  game.paused = false;
  game.stopped = false;
  game.started = true;
  player.checkpointName = "Início";
  const currentId = player.characterId;
  selectCharacter(currentId);
  loadPhase(1);
  closeStartMenu();
  updateHUD();
}

function startGameFromMenu(){
  ensureAudio();

  playTone(220,0.10,"sawtooth",0.18,330);
  setTimeout(() => playTone(440,0.12,"triangle",0.18,660),90);
  setTimeout(() => playTone(880,0.18,"square",0.14,1320),190);

  setTimeout(() => {
    restartGame();
  }, 260);
}

document.addEventListener("keydown", (e) => {
  const key = e.key;

  if(key === "ArrowLeft"){
    input.left = true;
    e.preventDefault();
  }
  if(key === "ArrowRight"){
    input.right = true;
    e.preventDefault();
  }
  if(key === "ArrowUp" || key === " " || key === "Spacebar"){
    if(!input.jumpHeld){
      input.jumpPressed = true;
    }
    input.jumpHeld = true;
    e.preventDefault();
  }
  if(key === "Shift"){
    input.abilityHeld = true;
    e.preventDefault();
  }
  if(key === "p" || key === "P"){
    togglePause();
  }
  if(key === "o" || key === "O"){
    stopGame();
  }
  if(key === "r" || key === "R"){
    restartGame();
  }
  if(key === "Enter" && !game.started){
    startGameFromMenu();
  }
});

document.addEventListener("keyup", (e) => {
  const key = e.key;
  if(key === "ArrowLeft"){
    input.left = false;
    e.preventDefault();
  }
  if(key === "ArrowRight"){
    input.right = false;
    e.preventDefault();
  }
  if(key === "ArrowUp" || key === " " || key === "Spacebar"){
    input.jumpHeld = false;
    e.preventDefault();
  }
  if(key === "Shift"){
    input.abilityHeld = false;
    e.preventDefault();
  }
});

window.addEventListener("blur", resetInput);
document.addEventListener("visibilitychange", () => {
  if(document.hidden) resetInput();
});

function updatePlatforms(){
  for(const p of platforms){
    p.prevX = p.x;
    p.prevY = p.y;
    if(!p.moving) continue;
    p.x += p.dx;
    p.y += p.dy;
    if(p.x < p.minX){ p.x = p.minX; p.dx *= -1; }
    if(p.x > p.maxX){ p.x = p.maxX; p.dx *= -1; }
    if(p.y < p.minY){ p.y = p.minY; p.dy *= -1; }
    if(p.y > p.maxY){ p.y = p.maxY; p.dy *= -1; }
  }
}

function updateHazards(){
  for(const h of hazards){
    h.angle += h.rotationSpeed || 0;
    if(!h.moving) continue;
    h.x += h.dx;
    h.y += h.dy;
    if(h.x < h.minX){ h.x = h.minX; h.dx *= -1; }
    if(h.x > h.maxX){ h.x = h.maxX; h.dx *= -1; }
    if(h.y < h.minY){ h.y = h.minY; h.dy *= -1; }
    if(h.y > h.maxY){ h.y = h.maxY; h.dy *= -1; }
  }
}

function updateEnemies(){
  for(const en of enemies){
    en.x += en.dx;
    if(en.x < en.minX){ en.x = en.minX; en.dx *= -1; }
    if(en.x > en.maxX){ en.x = en.maxX; en.dx *= -1; }
  }
}

function carryPlayerWithPlatform(){
  if(player.currentPlatform){
    const p = player.currentPlatform;
    player.x += p.x - p.prevX;
    player.y += p.y - p.prevY;
  }
}

function currentMoveSpeed(){
  if(player.characterId === "runner" && input.abilityHeld) return player.baseSpeed * player.sprintMultiplier;
  if(player.characterId === "forest" && input.abilityHeld) return player.baseSpeed * player.sprintMultiplier;
  return player.baseSpeed;
}

function currentJumpForce(){
  if(player.characterId === "ninja" && input.abilityHeld) return player.baseJumpForce + player.jumpBoost;
  if(player.characterId === "forest" && input.abilityHeld) return player.baseJumpForce + player.jumpBoost;
  return player.baseJumpForce;
}

function updatePlayerMovement(){
  player.vx = 0;
  const moveSpeed = currentMoveSpeed();

  if(input.left && !input.right) player.vx = -moveSpeed;
  if(input.right && !input.left) player.vx = moveSpeed;

  player.jumpBuffer = input.jumpPressed ? 10 : Math.max(0, player.jumpBuffer - 1);
  input.jumpPressed = false;

  if(player.onGround){
    player.coyoteTimer = 8;
  }else{
    player.coyoteTimer = Math.max(0, player.coyoteTimer - 1);
  }

  const canJump = player.coyoteTimer > 0;
  if(player.jumpBuffer > 0 && canJump){
    player.vy = -currentJumpForce();
    player.onGround = false;
    player.currentPlatform = null;
    player.coyoteTimer = 0;
    player.jumpBuffer = 0;
    sfxJump();
  }

  player.x += player.vx;
  player.x = clamp(player.x, 0, WORLD_W - player.w);

  player.vy += GRAVITY;
  player.vy = Math.min(player.vy, MAX_FALL_SPEED);
  player.y += player.vy;
}

function resolveCollisions(){
  player.onGround = false;
  player.currentPlatform = null;

  for(const p of platforms){
    if(!overlap(player, p)) continue;

    const prevX = player.x - player.vx;
    const prevY = player.y - player.vy;
    const prevBottom = prevY + player.h;
    const prevTop = prevY;
    const prevRight = prevX + player.w;
    const prevLeft = prevX;

    const landTop = prevBottom <= p.y + 10 && player.vy >= 0;
    const hitBottom = prevTop >= p.y + p.h - 10 && player.vy < 0;
    const hitLeft = prevRight <= p.x + 10 && player.vx > 0;
    const hitRight = prevLeft >= p.x + p.w - 10 && player.vx < 0;

    if(landTop){
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.currentPlatform = p;
      continue;
    }
    if(hitBottom){
      player.y = p.y + p.h;
      player.vy = 1;
      continue;
    }
    if(hitLeft){
      player.x = p.x - player.w;
      continue;
    }
    if(hitRight){
      player.x = p.x + p.w;
      continue;
    }

    if(player.y + player.h / 2 < p.y + p.h / 2){
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.currentPlatform = p;
    }
  }
}

function checkCheckpoints(){
  for(const cp of checkpoints){
    if(overlap(player, cp) && !cp.active){
      setCheckpoint(cp);
    }
  }
}

function rotorHit(player, h){
  const centerX = h.x + h.w / 2;
  const centerY = h.y + h.h / 2;
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;

  const dx = px - centerX;
  const dy = py - centerY;
  const distCenter = Math.hypot(dx, dy);
  if(distCenter <= (h.radius || 14) + Math.min(player.w, player.h) * 0.35) return true;

  const arms = h.arms || 2;
  const len = h.armLength || 70;
  const hitThickness = 12;

  for(let i = 0; i < arms; i++){
    const ang = h.angle + (Math.PI * 2 / arms) * i;
    const ex = centerX + Math.cos(ang) * len;
    const ey = centerY + Math.sin(ang) * len;
    const vx = ex - centerX;
    const vy = ey - centerY;
    const wx = px - centerX;
    const wy = py - centerY;
    const c1 = vx * wx + vy * wy;
    const c2 = vx * vx + vy * vy;
    const t = clamp(c1 / c2, 0, 1);
    const closestX = centerX + vx * t;
    const closestY = centerY + vy * t;
    const dist = Math.hypot(px - closestX, py - closestY);
    if(dist <= hitThickness + Math.min(player.w, player.h) * 0.25) return true;
  }
  return false;
}

function checkHazards(){
  for(const h of hazards){
    if(h.type === "rotor"){
      if(rotorHit(player, h)){
        damagePlayer(h.damage, !!h.kill);
        return;
      }
    } else if(overlap(player, h)){
      damagePlayer(h.damage, !!h.kill);
      return;
    }
  }
}

function checkEnemies(){
  for(const en of enemies){
    if(overlap(player, en)){
      const stomp = player.vy > 0 && player.y + player.h - 10 < en.y + 10;
      if(stomp){
        player.vy = -10;
        addScore(120);
        en.x = -9999;
        en.y = -9999;
        setMessage("Inimigo derrotado");
        playTone(340,0.08,"square",0.07,520);
      }else{
        damagePlayer(en.damage, false);
      }
      return;
    }
  }
}

function checkFall(){
  if(player.y > WORLD_H + 120){
    loseLife();
  }
}

function goToNextPhase(){
  if(game.phase < 5){
    game.transitioning = true;
    const next = game.phase + 1;
    setMessage("Fase " + next);
    setTimeout(() => {
      player.checkpointName = "Início";
      loadPhase(next);
    }, 850);
  } else {
    game.win = true;
    setMessage("Você venceu");
    sfxWin();
    registerVictory();
    updateGameStateLabel();
  }
}

function checkGoal(){
  if(goal && overlap(player, goal)){
    addScore(500);
    goToNextPhase();
  }
}

function tickTimers(){
  if(game.invulnerableTimer > 0) game.invulnerableTimer--;
}

function update(){
  if(game.gameOver || game.win || game.transitioning || game.paused || game.stopped || !game.started) return;
  updatePlatforms();
  updateHazards();
  updateEnemies();
  carryPlayerWithPlatform();
  updatePlayerMovement();
  resolveCollisions();
  checkCheckpoints();
  checkHazards();
  checkEnemies();
  checkFall();
  checkGoal();
  tickTimers();
  updateHUD();
}

function drawSky(){
  const grd = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  if(game.phase <= 2){
    grd.addColorStop(0, "#87ceeb");
    grd.addColorStop(0.55, "#d7f0ff");
    grd.addColorStop(1, "#98e59e");
  } else if(game.phase === 3){
    grd.addColorStop(0, "#60a5fa");
    grd.addColorStop(0.55, "#bfdbfe");
    grd.addColorStop(1, "#6ee7b7");
  } else if(game.phase === 4){
    grd.addColorStop(0, "#4f46e5");
    grd.addColorStop(0.55, "#93c5fd");
    grd.addColorStop(1, "#34d399");
  } else {
    grd.addColorStop(0, "#1d4ed8");
    grd.addColorStop(0.55, "#60a5fa");
    grd.addColorStop(1, "#10b981");
  }
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,WORLD_W,WORLD_H);

  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.fillRect(170, 120, 180, 55);
  ctx.fillRect(480, 170, 220, 60);
  ctx.fillRect(1180, 110, 260, 70);
  ctx.fillRect(1600, 160, 170, 50);
}

function drawGroundStrip(){
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(0, 960, WORLD_W, 120);
}

function drawPlatforms(){
  for(const p of platforms){
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = p.topColor;
    ctx.fillRect(p.x, p.y, p.w, 6);
  }
}

function drawHazards(){
  for(const h of hazards){
    if(h.type === "spikes"){
      ctx.fillStyle = "#dc2626";
      const count = Math.max(1, Math.floor(h.w / 18));
      for(let i=0;i<count;i++){
        const sx = h.x + i * (h.w / count);
        const sw = h.w / count;
        ctx.beginPath();
        ctx.moveTo(sx, h.y + h.h);
        ctx.lineTo(sx + sw/2, h.y);
        ctx.lineTo(sx + sw, h.y + h.h);
        ctx.closePath();
        ctx.fill();
      }
    }

    if(h.type === "lava"){
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = "#f59e0b";
      for(let i=0;i<h.w;i+=22){
        ctx.beginPath();
        ctx.arc(h.x + i + 10, h.y + 10, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if(h.type === "saw"){
      ctx.save();
      ctx.translate(h.x + h.w/2, h.y + h.h/2);
      ctx.rotate(h.angle);
      ctx.fillStyle = "#e5e7eb";
      ctx.beginPath();
      for(let i=0;i<8;i++){
        const ang = (Math.PI * 2 / 8) * i;
        const ang2 = ang + Math.PI / 8;
        ctx.lineTo(Math.cos(ang) * (h.w/2), Math.sin(ang) * (h.h/2));
        ctx.lineTo(Math.cos(ang2) * (h.w/4), Math.sin(ang2) * (h.h/4));
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#6b7280";
      ctx.beginPath();
      ctx.arc(0,0,8,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    if(h.type === "rotor"){
      const cx = h.x + h.w/2;
      const cy = h.y + h.h/2;
      const arms = h.arms || 2;
      const len = h.armLength || 70;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(h.angle);
      for(let i=0;i<arms;i++){
        ctx.save();
        ctx.rotate((Math.PI * 2 / arms) * i);
        ctx.fillStyle = "#111827";
        ctx.fillRect(-8, -6, len, 12);
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(len - 18, -12, 18, 24);
        ctx.restore();
      }
      ctx.fillStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.arc(0,0,h.radius || 14,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "#6b7280";
      ctx.beginPath();
      ctx.arc(0,0,6,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawCheckpoints(){
  for(const cp of checkpoints){
    ctx.fillStyle = cp.active ? "#22c55e" : "#fbbf24";
    ctx.fillRect(cp.x, cp.y, 8, cp.h);
    ctx.fillStyle = cp.active ? "#bbf7d0" : "#fef3c7";
    ctx.beginPath();
    ctx.moveTo(cp.x + 8, cp.y);
    ctx.lineTo(cp.x + 40, cp.y + 16);
    ctx.lineTo(cp.x + 8, cp.y + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "bold 16px Arial";
    ctx.fillText(cp.name, cp.x - 10, cp.y - 10);
  }
}

function drawGoal(){
  if(!goal) return;
  ctx.fillStyle = "#fde047";
  ctx.fillRect(goal.x, goal.y, 10, goal.h);
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.moveTo(goal.x + 10, goal.y);
  ctx.lineTo(goal.x + goal.w, goal.y + 18);
  ctx.lineTo(goal.x + 10, goal.y + 36);
  ctx.closePath();
  ctx.fill();
}

function drawEnemies(){
  for(const en of enemies){
    if(en.x < -1000) continue;
    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(en.x, en.y, en.w, en.h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(en.x + 8, en.y + 8, 7, 7);
    ctx.fillRect(en.x + 23, en.y + 8, 7, 7);
    ctx.fillStyle = "#111";
    ctx.fillRect(en.x + 10, en.y + 10, 3, 3);
    ctx.fillRect(en.x + 25, en.y + 10, 3, 3);
  }
}

function drawRunnerSkin(){
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(player.x + 10, player.y + 20, 28, 24);
  ctx.fillStyle = "#111827";
  ctx.fillRect(player.x + 21, player.y + 20, 6, 24);
  ctx.fillStyle = "#111827";
  ctx.fillRect(player.x + 11, player.y + 47, 8, 10);
  ctx.fillRect(player.x + 29, player.y + 47, 8, 10);
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(player.x + 7, player.y + 8, 12, 12);
  ctx.fillRect(player.x + 29, player.y + 8, 12, 12);
  ctx.fillStyle = "#111827";
  ctx.fillRect(player.x + 11, player.y + 12, 4, 4);
  ctx.fillRect(player.x + 33, player.y + 12, 4, 4);
}

function drawNinjaSkin(){
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "#111827";
  ctx.fillRect(player.x + 8, player.y + 8, 32, 14);
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(player.x + 6, player.y + 22, 36, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(player.x + 11, player.y + 23, 7, 6);
  ctx.fillRect(player.x + 29, player.y + 23, 7, 6);
  ctx.fillStyle = "#111827";
  ctx.fillRect(player.x + 11, player.y + 41, 10, 12);
  ctx.fillRect(player.x + 27, player.y + 41, 10, 12);
}

function drawTankSkin(){
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "#111827";
  ctx.fillRect(player.x + 6, player.y + 6, 36, 16);
  ctx.fillRect(player.x + 8, player.y + 24, 32, 20);
  ctx.fillRect(player.x + 10, player.y + 46, 10, 10);
  ctx.fillRect(player.x + 28, player.y + 46, 10, 10);
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(player.x + 12, player.y + 10, 8, 8);
  ctx.fillRect(player.x + 28, player.y + 10, 8, 8);
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(player.x + 20, player.y + 24, 8, 20);
}

function drawForestSkin(){
  ctx.fillStyle = "#3f6212";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "#14532d";
  ctx.fillRect(player.x + 4, player.y + 6, 12, 10);
  ctx.fillRect(player.x + 22, player.y + 18, 14, 12);
  ctx.fillRect(player.x + 30, player.y + 38, 10, 10);
  ctx.fillStyle = "#4d7c0f";
  ctx.fillRect(player.x + 18, player.y + 8, 10, 10);
  ctx.fillRect(player.x + 8, player.y + 30, 12, 10);
  ctx.fillStyle = "#a3e635";
  ctx.fillRect(player.x + 10, player.y + 12, 6, 6);
  ctx.fillRect(player.x + 30, player.y + 12, 6, 6);
  ctx.fillStyle = "#111827";
  ctx.fillRect(player.x + 10, player.y + 46, 8, 10);
  ctx.fillRect(player.x + 29, player.y + 46, 8, 10);
}

function drawPlayer(){
  const blink = game.invulnerableTimer > 0 && Math.floor(game.invulnerableTimer / 4) % 2 === 0;
  if(blink) return;

  if(player.characterId === "runner") drawRunnerSkin();
  else if(player.characterId === "ninja") drawNinjaSkin();
  else if(player.characterId === "tank") drawTankSkin();
  else if(player.characterId === "forest") drawForestSkin();
  else {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  if(input.abilityHeld){
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 3;
    ctx.strokeRect(player.x - 4, player.y - 4, player.w + 8, player.h + 8);
  }
}

function drawHpBar(){
  const x = player.x - 6;
  const y = player.y - 16;
  const w = 60;
  const h = 8;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(x, y, w, h);
  const pct = clamp(player.hp / player.maxHP, 0, 1);
  ctx.fillStyle = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";
  ctx.fillRect(x, y, w * pct, h);
}

function drawOverlayTexts(){
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 28px Arial";
  ctx.fillText("FASE " + game.phase, 24, 42);

  if(!game.started){
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(0,0,WORLD_W,WORLD_H);
  }

  if(game.paused){
    ctx.fillStyle = "rgba(0,0,0,.32)";
    ctx.fillRect(0,0,WORLD_W,WORLD_H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 76px Arial";
    ctx.fillText("PAUSADO", WORLD_W/2, WORLD_H/2 - 20);
    ctx.font = "32px Arial";
    ctx.fillText("Pressione P para continuar", WORLD_W/2, WORLD_H/2 + 40);
    ctx.textAlign = "start";
  }

  if(game.stopped){
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(0,0,WORLD_W,WORLD_H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 76px Arial";
    ctx.fillText("JOGO PARADO", WORLD_W/2, WORLD_H/2 - 20);
    ctx.font = "32px Arial";
    ctx.fillText("Pressione R para reiniciar", WORLD_W/2, WORLD_H/2 + 40);
    ctx.textAlign = "start";
  }

  if(game.gameOver){
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(0,0,WORLD_W,WORLD_H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 76px Arial";
    ctx.fillText("GAME OVER", WORLD_W/2, WORLD_H/2 - 20);
    ctx.font = "32px Arial";
    ctx.fillText("Pressione R para reiniciar", WORLD_W/2, WORLD_H/2 + 40);
    ctx.textAlign = "start";
  }

  if(game.win){
    ctx.fillStyle = "rgba(0,0,0,.40)";
    ctx.fillRect(0,0,WORLD_W,WORLD_H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 74px Arial";
    ctx.fillText("VOCÊ VENCEU!", WORLD_W/2, WORLD_H/2 - 28);
    ctx.font = "32px Arial";
    ctx.fillText("Sua pontuação foi salva no ranking.", WORLD_W/2, WORLD_H/2 + 28);
    ctx.fillText("Pressione R para jogar novamente.", WORLD_W/2, WORLD_H/2 + 74);
    ctx.textAlign = "start";
  }

  if(game.transitioning){
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(0,0,WORLD_W,WORLD_H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 70px Arial";
    ctx.fillText("FASE " + (game.phase + 1), WORLD_W/2, WORLD_H/2);
    ctx.textAlign = "start";
  }
}

function draw(){
  drawSky();
  drawGroundStrip();
  drawPlatforms();
  drawHazards();
  drawCheckpoints();
  drawGoal();
  drawEnemies();
  drawPlayer();
  drawHpBar();
  drawOverlayTexts();
}

function goToNextPhase(){
  if(game.phase < 5){
    game.transitioning = true;
    const next = game.phase + 1;
    setMessage("Fase " + next);
    setTimeout(() => {
      player.checkpointName = "Início";
      loadPhase(next);
    }, 850);
  } else {
    game.win = true;
    setMessage("Você venceu");
    sfxWin();
    registerVictory();
    updateGameStateLabel();
  }
}

function checkGoal(){
  if(goal && overlap(player, goal)){
    addScore(500);
    goToNextPhase();
  }
}

function checkEnemies(){
  for(const en of enemies){
    if(overlap(player, en)){
      const stomp = player.vy > 0 && player.y + player.h - 10 < en.y + 10;

      if(stomp){
        player.vy = -10;
        addScore(120);

        en.x = -9999;
        en.y = -9999;

        if(game.lives < game.baseLives + 1){
          game.lives += 1;
          setMessage("Inimigo derrotado! Vida extra +1");
        }else{
          setMessage("Inimigo derrotado");
        }

        updateHUD();
        playTone(340,0.08,"square",0.07,520);
      }else{
        damagePlayer(en.damage, false);
      }
      return;
    }
  }
}

function checkHazards(){
  for(const h of hazards){
    if(h.type === "rotor"){
      if(rotorHit(player, h)){
        damagePlayer(h.damage, !!h.kill);
        return;
      }
    } else if(overlap(player, h)){
      damagePlayer(h.damage, !!h.kill);
      return;
    }
  }
}

function checkFall(){
  if(player.y > WORLD_H + 120){
    loseLife();
  }
}

function tickTimers(){
  if(game.invulnerableTimer > 0) game.invulnerableTimer--;
}

function update(){
  if(game.gameOver || game.win || game.transitioning || game.paused || game.stopped || !game.started) return;
  updatePlatforms();
  updateHazards();
  updateEnemies();
  carryPlayerWithPlatform();
  updatePlayerMovement();
  resolveCollisions();
  checkCheckpoints();
  checkHazards();
  checkEnemies();
  checkFall();
  checkGoal();
  tickTimers();
  updateHUD();
}

function currentMoveSpeed(){
  if(player.characterId === "runner" && input.abilityHeld) return player.baseSpeed * player.sprintMultiplier;
  if(player.characterId === "forest" && input.abilityHeld) return player.baseSpeed * player.sprintMultiplier;
  return player.baseSpeed;
}

function currentJumpForce(){
  if(player.characterId === "ninja" && input.abilityHeld) return player.baseJumpForce + player.jumpBoost;
  if(player.characterId === "forest" && input.abilityHeld) return player.baseJumpForce + player.jumpBoost;
  return player.baseJumpForce;
}

function updatePlayerMovement(){
  player.vx = 0;
  const moveSpeed = currentMoveSpeed();

  if(input.left && !input.right) player.vx = -moveSpeed;
  if(input.right && !input.left) player.vx = moveSpeed;

  player.jumpBuffer = input.jumpPressed ? 10 : Math.max(0, player.jumpBuffer - 1);
  input.jumpPressed = false;

  if(player.onGround) player.coyoteTimer = 8;
  else player.coyoteTimer = Math.max(0, player.coyoteTimer - 1);

  const canJump = player.coyoteTimer > 0;
  if(player.jumpBuffer > 0 && canJump){
    player.vy = -currentJumpForce();
    player.onGround = false;
    player.currentPlatform = null;
    player.coyoteTimer = 0;
    player.jumpBuffer = 0;
    sfxJump();
  }

  player.x += player.vx;
  player.x = clamp(player.x, 0, WORLD_W - player.w);

  player.vy += GRAVITY;
  player.vy = Math.min(player.vy, MAX_FALL_SPEED);
  player.y += player.vy;
}

function resolveCollisions(){
  player.onGround = false;
  player.currentPlatform = null;

  for(const p of platforms){
    if(!overlap(player, p)) continue;

    const prevX = player.x - player.vx;
    const prevY = player.y - player.vy;
    const prevBottom = prevY + player.h;
    const prevTop = prevY;
    const prevRight = prevX + player.w;
    const prevLeft = prevX;

    const landTop = prevBottom <= p.y + 10 && player.vy >= 0;
    const hitBottom = prevTop >= p.y + p.h - 10 && player.vy < 0;
    const hitLeft = prevRight <= p.x + 10 && player.vx > 0;
    const hitRight = prevLeft >= p.x + p.w - 10 && player.vx < 0;

    if(landTop){
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.currentPlatform = p;
      continue;
    }
    if(hitBottom){
      player.y = p.y + p.h;
      player.vy = 1;
      continue;
    }
    if(hitLeft){
      player.x = p.x - player.w;
      continue;
    }
    if(hitRight){
      player.x = p.x + p.w;
      continue;
    }

    if(player.y + player.h / 2 < p.y + p.h / 2){
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.currentPlatform = p;
    }
  }
}

function rotorHit(player, h){
  const centerX = h.x + h.w / 2;
  const centerY = h.y + h.h / 2;
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  const dx = px - centerX;
  const dy = py - centerY;
  const distCenter = Math.hypot(dx, dy);

  if(distCenter <= (h.radius || 14) + Math.min(player.w, player.h) * 0.35) return true;

  const arms = h.arms || 2;
  const len = h.armLength || 70;
  const hitThickness = 12;

  for(let i = 0; i < arms; i++){
    const ang = h.angle + (Math.PI * 2 / arms) * i;
    const ex = centerX + Math.cos(ang) * len;
    const ey = centerY + Math.sin(ang) * len;

    const vx = ex - centerX;
    const vy = ey - centerY;
    const wx = px - centerX;
    const wy = py - centerY;

    const c1 = vx * wx + vy * wy;
    const c2 = vx * vx + vy * vy;
    const t = clamp(c1 / c2, 0, 1);

    const closestX = centerX + vx * t;
    const closestY = centerY + vy * t;
    const dist = Math.hypot(px - closestX, py - closestY);

    if(dist <= hitThickness + Math.min(player.w, player.h) * 0.25) return true;
  }
  return false;
}

function checkCheckpoints(){
  for(const cp of checkpoints){
    if(overlap(player, cp) && !cp.active){
      setCheckpoint(cp);
    }
  }
}

function loseLife(){
  game.lives -= 1;
  updateHUD();

  if(game.lives <= 0){
    game.gameOver = true;
    setMessage("Game Over");
    updateGameStateLabel();
    return;
  }

  player.hp = player.maxHP;
  game.invulnerableTimer = 60;
  resetToSpawn(false);
  setMessage("Você perdeu uma vida");
}

function loop(){
  update();
  draw();
  requestAnimationFrame(loop);
}

menuPlayerName.value = game.playerName;
renderRanking();
renderCharacterButtons();
renderMenuCards();
selectCharacter("runner");
updateHUD();
loadPhase(1);
openStartMenu();
loop();
