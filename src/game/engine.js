import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  BIOMES,
  CAMERA_MODES,
  FREQUENCIES,
  FREQUENCY_META,
  GAME_CONFIG,
  PALETTE_THEMES,
  PLAYER_BASE_Y,
  TRACK_HALF_WIDTH,
} from './constants.js';
import { createAuroraSkyMaterial, createPrismTrackMaterial } from './shaders.js';
import { PrismCraft } from './craft.js';
import { WorldManager } from './world.js';
import { SoundEngine } from './audio.js';

export class ChromaDriftEngine {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.sound = new SoundEngine();

    this.state = 'title'; // 'title' | 'playing' | 'paused' | 'gameover'
    this.renderSuspended = false;

    // Settings
    this.resolutionScale = 2.0;
    this.paletteKey = 'prism';
    this.bloomStrength = 0.45;
    this.objectBrightness = 0.8;
    this.cameraIndex = 0;

    // Gameplay telemetry
    this.freq = 'cyan';
    this.score = 0;
    this.distance = 0;
    this.combo = 1.0;
    this.peakCombo = 1.0;
    this.shields = GAME_CONFIG.maxShields;
    this.novaCharge = 0;
    this.novaTimer = 0;
    this.gatesPhased = 0;
    this.dronesShattered = 0;

    // Physics state
    this.playerPos = new THREE.Vector3(0, PLAYER_BASE_Y, 0);
    this.playerVelY = 0;
    this.grounded = true;
    this.airJumpsLeft = 1;
    this.slamming = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = 0;
    this.invulnTimer = 0;
    this.fireCooldown = 0;
    this.pulseTimer = 0;
    this.shakeTimer = 0;
    this.currentSpeed = GAME_CONFIG.baseSpeed;
    this.biomeIndex = 0;
    this.time = 0;

    // Active Input state
    this.keys = new Set();
    this.pointerFiring = false;

    this.highScore = Number(localStorage.getItem('chromadrift_best_score') || 0);
    this.bestDistance = Number(localStorage.getItem('chromadrift_best_dist') || 0);

    this._initRendererAndScene();
    this._initSpeedParticles();
    this._bindEvents();
    this._applyBiome(0, 1);
    this.setObjectBrightness(this.objectBrightness);

    this.lastFrame = performance.now();
    this.rafId = 0;
    this._startLoop();
  }

  _initRendererAndScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b1230, 0.0042);

    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 520);
    this.camera.position.set(0, 4.2, 9.2);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85 * this.objectBrightness;

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.bloomStrength,
      0.46,
      0.86
    );
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    this._resize();

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0x8bb8ff, 0x120926, 0.95 * this.objectBrightness);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.55 * this.objectBrightness);
    this.dirLight.position.set(12, 24, 18);
    this.scene.add(this.dirLight);

    // Aurora Sky Dome
    this.skyMat = createAuroraSkyMaterial();
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(380, 40, 24), this.skyMat);
    this.scene.add(skyDome);

    // Prismatic Glass Highway
    this.trackMat = createPrismTrackMaterial();
    const trackGeo = new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 2.12, 360, 1, 1);
    trackGeo.rotateX(-Math.PI / 2);
    const track = new THREE.Mesh(trackGeo, this.trackMat);
    track.position.set(0, 0, -148);
    this.scene.add(track);

    // Player Prism Interceptor Craft
    this.craft = new PrismCraft();
    this.craft.root.position.copy(this.playerPos);
    this.scene.add(this.craft.root);
    this.scene.add(this.craft.trailGroup);

    // World Manager
    this.world = new WorldManager(this.scene, PALETTE_THEMES[this.paletteKey]);
  }

  _initSpeedParticles() {
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = 0.6 + Math.random() * 14;
      positions[i * 3 + 2] = -Math.random() * 220;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.speedStarMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.22,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedStars = new THREE.Points(geo, this.speedStarMat);
    this.scene.add(this.speedStars);
  }

  _resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dpr = Math.min(2.75, Math.max(1, this.resolutionScale));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  _bindEvents() {
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);

    this._onKeyDown = (e) => {
      this.sound.init();

      if (this.callbacks.isModalOpen?.()) {
        if (e.code === 'KeyP') {
          e.preventDefault();
          this.callbacks.onRequestTogglePause?.();
        }
        return;
      }

      this.callbacks.onKeyVisual?.(e.code, true);

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing' || this.state === 'paused') {
          e.preventDefault();
          this.callbacks.onRequestTogglePause?.();
        }
        return;
      }

      const activeTag = document.activeElement?.tagName;
      const onInteractiveControl = activeTag === 'BUTTON' || activeTag === 'SELECT' || activeTag === 'INPUT';

      if (this.state === 'title') {
        if ((e.code === 'Enter' || e.code === 'Space') && !onInteractiveControl) {
          e.preventDefault();
          this.startGame();
        }
        return;
      }

      if (this.state === 'gameover') {
        if ((e.code === 'Enter' || e.code === 'KeyR') && !onInteractiveControl) {
          e.preventDefault();
          this.startGame();
        }
        return;
      }

      if (this.state !== 'playing') return;

      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) {
        e.preventDefault();
      }

      const alreadyHeld = this.keys.has(e.code);
      this.keys.add(e.code);

      if (!alreadyHeld) {
        if (e.code === 'KeyQ' || e.code === 'Digit1') this.setFrequency('cyan');
        else if (e.code === 'KeyE' || e.code === 'Digit2') this.setFrequency('magenta');
        else if (e.code === 'KeyR' || e.code === 'Digit3') this.setFrequency('gold');
        else if (e.code === 'Space') this._triggerJump();
        else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this._triggerDash();
        else if (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') this._triggerDiveSlam();
        else if (e.code === 'KeyX' || e.code === 'KeyG') this._triggerNova();
        else if (e.code === 'KeyV' || e.code === 'Tab') this.cycleCamera();
        else if (e.code === 'KeyM') this.callbacks.onToggleAudio?.();
      }
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      this.callbacks.onKeyVisual?.(e.code, false);
    };

    this._onBlur = () => {
      this.keys.clear();
      this.pointerFiring = false;
      this.callbacks.onClearKeys?.();
    };

    this._onPointerDown = (e) => {
      if (e.button === 0 && this.state === 'playing') {
        this.sound.init();
        this.pointerFiring = true;
      }
    };
    this._onPointerUp = () => {
      this.pointerFiring = false;
    };

    this._onVisibility = () => {
      if (document.hidden) {
        this.setRenderSuspended(true);
      } else {
        this.setRenderSuspended(false);
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  setRenderSuspended(suspended) {
    this.renderSuspended = suspended;
    if (!suspended) {
      this.lastFrame = performance.now();
    }
  }

  setResolutionScale(scale) {
    this.resolutionScale = Number(scale) || 2.0;
    this._resize();
  }

  setBloomStrength(strength) {
    this.bloomStrength = Number(strength) || 0.45;
    this.bloomPass.strength = this.bloomStrength;
  }

  setObjectBrightness(level) {
    const clamped = Math.min(1.5, Math.max(0.25, Number(level) || 0.8));
    this.objectBrightness = clamped;
    this.renderer.toneMappingExposure = 0.85 * clamped;
    this.hemiLight.intensity = 0.95 * clamped;
    this.dirLight.intensity = 1.55 * clamped;
    this.skyMat.uniforms.uBrightness.value = clamped;
    this.trackMat.uniforms.uBrightness.value = clamped;
    if (this.speedStarMat) {
      this.speedStarMat.opacity = Math.min(0.85, 0.25 + clamped * 0.48);
    }
    this.craft.setBrightness(clamped);
    this.world.setBrightness(clamped);
  }

  setPalette(paletteKey) {
    if (!PALETTE_THEMES[paletteKey]) return;
    this.paletteKey = paletteKey;
    this.world.setTheme(PALETTE_THEMES[paletteKey]);
    this.callbacks.onPaletteUpdated?.(PALETTE_THEMES[paletteKey]);
  }

  setCameraMode(index) {
    this.cameraIndex = ((index % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
    this.callbacks.onCameraChanged?.(this.cameraIndex, CAMERA_MODES[this.cameraIndex].name);
  }

  cycleCamera() {
    this.setCameraMode(this.cameraIndex + 1);
    this.callbacks.onCallout?.(`CAMERA · ${CAMERA_MODES[this.cameraIndex].name}`);
  }

  setFrequency(freq) {
    if (!FREQUENCY_META[freq] || this.freq === freq) return;
    this.freq = freq;
    this.pulseTimer = 1.0;
    this.sound.playShift(freq);
    this.world.spawnShockwave(this.playerPos.x, this.playerPos.y, this.playerPos.z, this._getActiveHex(), 7.5);
    this.callbacks.onFrequencyChanged?.(freq);
  }

  _getActiveHex() {
    return PALETTE_THEMES[this.paletteKey][this.freq];
  }

  startGame() {
    this.sound.init();
    this.world.clearGameplay();
    this.state = 'playing';
    this.score = 0;
    this.distance = 0;
    this.combo = 1.0;
    this.peakCombo = 1.0;
    this.shields = GAME_CONFIG.maxShields;
    this.novaCharge = 25;
    this.novaTimer = 0;
    this.gatesPhased = 0;
    this.dronesShattered = 0;
    this.biomeIndex = 0;

    this.playerPos.set(0, PLAYER_BASE_Y, 0);
    this.playerVelY = 0;
    this.grounded = true;
    this.airJumpsLeft = 1;
    this.slamming = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.invulnTimer = 0;
    this.fireCooldown = 0;
    this.currentSpeed = GAME_CONFIG.baseSpeed;
    this.craft.root.position.copy(this.playerPos);
    this.craft.rollGroup.rotation.set(0, 0, 0);
    this.craft.resetTrails();

    this.setFrequency('cyan');
    this._applyBiome(0, 1);
    this.callbacks.onStateChange?.('playing');
    this.callbacks.onCallout?.('PRISM DRIVE ENGAGED');
  }

  returnToTitle() {
    this.world.clearGameplay();
    this.state = 'title';
    this.playerPos.set(0, PLAYER_BASE_Y + 0.3, 0);
    this.craft.root.position.copy(this.playerPos);
    this.craft.rollGroup.rotation.set(0, 0, 0);
    this.craft.resetTrails();
    this.callbacks.onStateChange?.('title');
  }

  setPaused(paused) {
    if (paused && this.state === 'playing') {
      this.state = 'paused';
      this.keys.clear();
      this.pointerFiring = false;
      this.callbacks.onClearKeys?.();
    } else if (!paused && this.state === 'paused') {
      this.state = 'playing';
      this.lastFrame = performance.now();
    }
  }

  _triggerJump() {
    if (this.grounded) {
      this.grounded = false;
      this.slamming = false;
      this.playerVelY = GAME_CONFIG.jumpVelocity;
      this.airJumpsLeft = 1;
      this.sound.playJump(false);
      this.world.spawnBurst(this.playerPos.x, 0.3, this.playerPos.z, this._getActiveHex(), 10, 0.65);
    } else if (this.airJumpsLeft > 0) {
      this.airJumpsLeft--;
      this.slamming = false;
      this.playerVelY = GAME_CONFIG.doubleJumpVelocity;
      this.sound.playJump(true);
      this.world.spawnShockwave(this.playerPos.x, this.playerPos.y, this.playerPos.z, this._getActiveHex(), 5.5);
    }
  }

  _triggerDash() {
    if (this.dashCooldown > 0) return;
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    this.dashDir = left && !right ? -1 : right && !left ? 1 : 0;
    this.dashTimer = GAME_CONFIG.dashDuration;
    this.dashCooldown = GAME_CONFIG.dashCooldown;
    this.invulnTimer = Math.max(this.invulnTimer, GAME_CONFIG.dashDuration + 0.1);
    this.sound.playDash();
    this.world.spawnBurst(this.playerPos.x, this.playerPos.y, this.playerPos.z, this._getActiveHex(), 16, 0.9);
  }

  _triggerDiveSlam() {
    if (this.grounded) return;
    this.slamming = true;
    this.playerVelY = GAME_CONFIG.diveVelocity;
    this.sound.playSlam();
  }

  _triggerNova() {
    if (this.novaCharge < 100 || this.novaTimer > 0) return;
    this.novaCharge = 0;
    this.novaTimer = GAME_CONFIG.novaDuration;
    this.invulnTimer = Math.max(this.invulnTimer, GAME_CONFIG.novaDuration);
    this.sound.playNova();
    this.world.spawnShockwave(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xffffff, 34);
    this.world.spawnBurst(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xffffff, 38, 1.5);
    this.callbacks.onCallout?.('PRISMATIC NOVA OVERDRIVE!');
    this.callbacks.onNovaChange?.(true);

    // Immediately shatter everything within 65m ahead
    for (const ent of this.world.entities) {
      if (!ent.resolved && ent.mesh.position.z > -70 && (ent.type === 'drone' || ent.type === 'sweeper' || ent.type === 'aerial')) {
        ent.resolved = true;
        this.dronesShattered++;
        this.score += Math.round(350 * this.combo);
        this.world.spawnBurst(ent.mesh.position.x, ent.mesh.position.y, ent.mesh.position.z, this.world.theme[ent.freq] || 0xffffff, 22, 1.2);
      }
    }
  }

  _firePlasma() {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = GAME_CONFIG.fireCooldown;
    this.world.spawnBolt(this.playerPos.x, this.playerPos.y, this.playerPos.z, this.freq);
    this.sound.playLaser(this.freq);
  }

  _applyBiome(index, blendAlpha = 1) {
    const b = BIOMES[index % BIOMES.length];
    this.skyMat.uniforms.uSkyTop.value.lerp(new THREE.Color(b.skyTop), blendAlpha);
    this.skyMat.uniforms.uSkyHorizon.value.lerp(new THREE.Color(b.skyHorizon), blendAlpha);
    this.skyMat.uniforms.uAuroraA.value.lerp(new THREE.Color(b.auroraA), blendAlpha);
    this.skyMat.uniforms.uAuroraB.value.lerp(new THREE.Color(b.auroraB), blendAlpha);
    this.trackMat.uniforms.uTrackAccent.value.lerp(new THREE.Color(b.trackAccent), blendAlpha);
    this.trackMat.uniforms.uFogColor.value.lerp(new THREE.Color(b.fogColor), blendAlpha);
    this.scene.fog.color.lerp(new THREE.Color(b.fogColor), blendAlpha);
    if (blendAlpha > 0.5) {
      this.world.setBiomeColors(b.crystalTint, b.trackAccent);
    }
  }

  _startLoop() {
    const tick = (now) => {
      this.rafId = requestAnimationFrame(tick);
      if (this.renderSuspended) return;

      const rawDt = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      if (this.state !== 'paused') {
        this._update(dt);
      }
      this.composer.render();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  _update(dt) {
    this.time += dt;
    const isNova = this.novaTimer > 0;
    const activeHex = this._getActiveHex();
    const activeColorObj = new THREE.Color(activeHex);

    if (this.state === 'title' || this.state === 'gameover') {
      // Showcase orbit over glowing highway
      const demoSpeed = 24;
      this.distance += demoSpeed * dt;
      this.world.updateScenery(dt, demoSpeed, this.time);

      // Gentle cycle of craft frequency glow on title screen
      const previewFreq = FREQUENCIES[Math.floor(this.time * 0.25) % 3];
      this.craft.setColor(PALETTE_THEMES[this.paletteKey][previewFreq], false, this.time);
      this.craft.root.position.set(Math.sin(this.time * 0.8) * 1.4, PLAYER_BASE_Y + 0.4 + Math.sin(this.time * 2.1) * 0.22, 0);
      this.craft.rollGroup.rotation.set(Math.sin(this.time * 1.4) * 0.06, 0, -Math.cos(this.time * 0.8) * 0.16);
      this.craft.update(dt, this.time, {
        speed: demoSpeed,
        baseSpeed: GAME_CONFIG.baseSpeed,
        combo: 3,
        shieldBoost: 0.2,
        isNova: false,
      });

      const orbitAngle = this.time * 0.28;
      this.camera.position.set(Math.sin(orbitAngle) * 7.8, 3.2 + Math.sin(this.time * 0.5) * 0.5, Math.cos(orbitAngle) * 7.8);
      this.camera.lookAt(0, 1.2, -2.5);
      this._updateShadersAndStars(dt, demoSpeed, new THREE.Color(PALETTE_THEMES[this.paletteKey][previewFreq]), false);
      return;
    }

    // Active Gameplay State
    if (this.novaTimer > 0) {
      this.novaTimer -= dt;
      if (this.novaTimer <= 0) {
        this.novaTimer = 0;
        this.callbacks.onNovaChange?.(false);
      }
    }
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.pulseTimer = Math.max(0, this.pulseTimer - dt * 2.4);
    this.shakeTimer = Math.max(0, this.shakeTimer - dt);

    // Speed progression + W/S throttle
    const progressionSpeed = Math.min(GAME_CONFIG.maxBaseSpeed, GAME_CONFIG.baseSpeed + this.distance * 0.0045);
    const boostHeld = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const brakeHeld = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    let targetSpeed = progressionSpeed;
    if (boostHeld) targetSpeed *= GAME_CONFIG.boostMult;
    else if (brakeHeld) targetSpeed *= GAME_CONFIG.brakeMult;
    if (this.dashTimer > 0 && this.dashDir === 0) targetSpeed *= 1.55;
    if (isNova) targetSpeed *= 1.28;

    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, Math.min(1, dt * 6));
    this.distance += this.currentSpeed * dt;
    this.score += (this.currentSpeed * dt * 1.4) * this.combo * (isNova ? 2 : 1) * (boostHeld ? 1.25 : 1);

    // Zone Biome transitions every 1100m
    const nextBiome = Math.floor(this.distance / 1100) % BIOMES.length;
    if (nextBiome !== this.biomeIndex) {
      this.biomeIndex = nextBiome;
      this.callbacks.onCallout?.(BIOMES[nextBiome].name);
    }
    this._applyBiome(this.biomeIndex, dt * 1.1);

    // Lateral Steering (A/D or Left/Right + Dash)
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const moveDir = (right ? 1 : 0) - (left ? 1 : 0);
    let lateralVel = moveDir * GAME_CONFIG.strafeSpeed;
    if (this.dashTimer > 0 && this.dashDir !== 0) {
      lateralVel = this.dashDir * GAME_CONFIG.dashDistanceSpeed;
    }

    this.playerPos.x = THREE.MathUtils.clamp(
      this.playerPos.x + lateralVel * dt,
      -TRACK_HALF_WIDTH + 1.4,
      TRACK_HALF_WIDTH - 1.4
    );

    // Vertical Jump / Hover / Dive Slam
    const hoverHeld = this.keys.has('Space') && this.playerVelY < 0 && !this.slamming;
    const gravScale = hoverHeld ? GAME_CONFIG.hoverGravityScale : 1.0;
    if (!this.grounded) {
      this.playerVelY -= GAME_CONFIG.gravity * gravScale * dt;
      this.playerPos.y += this.playerVelY * dt;
      if (this.playerPos.y <= PLAYER_BASE_Y) {
        this.playerPos.y = PLAYER_BASE_Y;
        this.playerVelY = 0;
        this.grounded = true;
        this.airJumpsLeft = 1;

        if (this.slamming) {
          this.slamming = false;
          this.world.spawnShockwave(this.playerPos.x, 0.4, this.playerPos.z, activeHex, 10.5);
          this.world.spawnBurst(this.playerPos.x, 0.5, this.playerPos.z, activeHex, 18, 0.9);
          this._shatterRadius(7.5);
        }
      }
    }

    // Firing Plasma Cannons (F, J, Enter, or Left Mouse)
    if (this.keys.has('KeyF') || this.keys.has('KeyJ') || this.keys.has('Enter') || this.pointerFiring) {
      this._firePlasma();
    }

    // Craft Attitude (Banking, Pitch, Barrel Roll)
    this.craft.root.position.copy(this.playerPos);
    let targetRoll = -moveDir * 0.42;
    if (this.dashTimer > 0) {
      const p = 1 - this.dashTimer / GAME_CONFIG.dashDuration;
      const rollDir = this.dashDir !== 0 ? -this.dashDir : 1;
      targetRoll = rollDir * p * Math.PI * 2;
    }
    const targetPitch = this.grounded ? (boostHeld ? -0.06 : brakeHeld ? 0.08 : 0) : THREE.MathUtils.clamp(this.playerVelY * 0.018, -0.35, 0.35);

    if (this.dashTimer > 0) {
      this.craft.rollGroup.rotation.z = targetRoll;
    } else {
      this.craft.rollGroup.rotation.z = THREE.MathUtils.lerp(this.craft.rollGroup.rotation.z, targetRoll, Math.min(1, dt * 11));
    }
    this.craft.rollGroup.rotation.x = THREE.MathUtils.lerp(this.craft.rollGroup.rotation.x, targetPitch, Math.min(1, dt * 10));

    this.craft.setColor(activeHex, isNova, this.time);
    this.craft.update(dt, this.time, {
      speed: this.currentSpeed,
      baseSpeed: GAME_CONFIG.baseSpeed,
      combo: this.combo,
      shieldBoost: this.invulnTimer,
      isNova,
    });

    // Update World & Collisions
    this.world.updateScenery(dt, this.currentSpeed, this.time);
    this.world.updateGameplay(dt, this.time, this.currentSpeed, this.distance, this.playerPos, this.freq, isNova);
    this._checkCollisions(isNova);

    // Update Camera Rig
    const camCfg = CAMERA_MODES[this.cameraIndex];
    const desiredPos = new THREE.Vector3(
      this.playerPos.x * (this.cameraIndex === 2 ? 1.0 : 0.72) + camCfg.offset[0],
      this.playerPos.y * 0.65 + camCfg.offset[1],
      this.playerPos.z + camCfg.offset[2]
    );
    if (this.shakeTimer > 0) {
      desiredPos.x += (Math.random() - 0.5) * 0.45 * this.shakeTimer;
      desiredPos.y += (Math.random() - 0.5) * 0.45 * this.shakeTimer;
    }
    this.camera.position.lerp(desiredPos, Math.min(1, dt * (this.cameraIndex === 2 ? 22 : 9)));
    const lookTarget = new THREE.Vector3(
      this.playerPos.x * 0.45 + camCfg.lookAhead[0],
      this.playerPos.y * 0.4 + camCfg.lookAhead[1],
      this.playerPos.z + camCfg.lookAhead[2]
    );
    this.camera.lookAt(lookTarget);

    const speedRatio = THREE.MathUtils.clamp((this.currentSpeed - 35) / 85, 0, 1);
    const targetFov = camCfg.fovBase + speedRatio * 15 + (isNova ? 6 : 0);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 6));
    this.camera.updateProjectionMatrix();

    // Music + Shaders + HUD callbacks
    this.sound.updateMusic(dt, true, speedRatio, this.freq, isNova);
    this._updateShadersAndStars(dt, this.currentSpeed, activeColorObj, isNova);

    this.callbacks.onTelemetry?.({
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      combo: this.combo,
      shields: this.shields,
      speedKmh: Math.round(this.currentSpeed * 5.2),
      novaPct: isNova ? Math.round((this.novaTimer / GAME_CONFIG.novaDuration) * 100) : Math.min(100, Math.round(this.novaCharge)),
      isNova,
      zoneName: BIOMES[this.biomeIndex].name,
    });
  }

  _updateShadersAndStars(dt, speed, activeColorObj, isNova) {
    const novaMix = isNova ? 1.0 : 0.0;
    const speedRatio = THREE.MathUtils.clamp(speed / 95, 0, 1);

    this.skyMat.uniforms.uTime.value = this.time;
    this.skyMat.uniforms.uActiveColor.value.lerp(activeColorObj, dt * 6);
    this.skyMat.uniforms.uNova.value = THREE.MathUtils.lerp(this.skyMat.uniforms.uNova.value, novaMix, dt * 5);

    this.trackMat.uniforms.uTime.value = this.time;
    this.trackMat.uniforms.uDistance.value = this.distance;
    this.trackMat.uniforms.uSpeedRatio.value = speedRatio;
    this.trackMat.uniforms.uActiveColor.value.lerp(activeColorObj, dt * 8);
    this.trackMat.uniforms.uNova.value = THREE.MathUtils.lerp(this.trackMat.uniforms.uNova.value, novaMix, dt * 5);
    this.trackMat.uniforms.uPulse.value = this.pulseTimer;

    this.speedStarMat.color.copy(activeColorObj);
    const posAttr = this.speedStars.geometry.getAttribute('position');
    const arr = posAttr.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 2] += speed * 1.35 * dt;
      if (arr[i + 2] > 16) {
        arr[i] = (Math.random() - 0.5) * 44;
        arr[i + 1] = 0.6 + Math.random() * 14;
        arr[i + 2] = -210 - Math.random() * 40;
      }
    }
    posAttr.needsUpdate = true;
  }

  _shatterRadius(radius) {
    for (const ent of this.world.entities) {
      if (ent.resolved) continue;
      if (ent.type === 'drone' || ent.type === 'sweeper') {
        const dz = Math.abs(ent.mesh.position.z - this.playerPos.z);
        if (dz <= radius) {
          ent.resolved = true;
          this.dronesShattered++;
          this.score += Math.round(300 * this.combo);
          this.novaCharge = Math.min(100, this.novaCharge + 8);
          this.sound.playKill();
          this.world.spawnBurst(ent.mesh.position.x, ent.mesh.position.y, ent.mesh.position.z, this.world.theme[ent.freq], 20, 1.1);
        }
      }
    }
  }

  _checkCollisions(isNova) {
    // 1. Plasma Bolts vs Drones & Sweepers
    for (let bi = this.world.bolts.length - 1; bi >= 0; bi--) {
      const b = this.world.bolts[bi];
      const bp = b.mesh.position;
      let hit = false;

      for (const ent of this.world.entities) {
        if (ent.resolved) continue;
        if (ent.type === 'drone') {
          if (Math.abs(bp.z - ent.mesh.position.z) < 2.2 && Math.abs(bp.x - ent.mesh.position.x) < 1.65 && Math.abs(bp.y - ent.mesh.position.y) < 1.8) {
            const dmg = b.freq === ent.freq ? 2 : 1;
            ent.hp -= dmg;
            hit = true;
            if (ent.hp <= 0) {
              ent.resolved = true;
              this.dronesShattered++;
              this.combo = Math.min(12, +(this.combo + 0.25).toFixed(2));
              this.peakCombo = Math.max(this.peakCombo, this.combo);
              this.score += Math.round((b.freq === ent.freq ? 380 : 220) * this.combo);
              this.novaCharge = Math.min(100, this.novaCharge + (b.freq === ent.freq ? 10 : 5));
              this.sound.playKill();
              this.world.spawnBurst(ent.mesh.position.x, ent.mesh.position.y, ent.mesh.position.z, this.world.theme[ent.freq], 22, 1.15);
            } else {
              this.world.spawnBurst(bp.x, bp.y, bp.z, b.colorHex, 6, 0.6);
            }
            break;
          }
        } else if (ent.type === 'sweeper') {
          if (Math.abs(bp.z - ent.mesh.position.z) < 1.9 && Math.abs(bp.x) < 1.8 && bp.y < 2.4) {
            const dmg = b.freq === ent.freq ? 2 : 1;
            ent.hp -= dmg;
            hit = true;
            if (ent.hp <= 0) {
              ent.resolved = true;
              this.dronesShattered++;
              this.score += Math.round(250 * this.combo);
              this.novaCharge = Math.min(100, this.novaCharge + 8);
              this.sound.playKill();
              this.world.spawnBurst(0, 1.1, ent.mesh.position.z, this.world.theme[ent.freq], 20, 1.1);
            }
            break;
          }
        }
      }

      if (hit) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.world.bolts.splice(bi, 1);
      }
    }

    // 2. Player vs World Entities
    const px = this.playerPos.x;
    const py = this.playerPos.y;
    const pz = this.playerPos.z;

    for (const ent of this.world.entities) {
      if (ent.resolved) continue;
      const ez = ent.mesh.position.z;

      if (ent.type === 'shard') {
        if (Math.abs(ez - pz) < 2.0 && Math.abs(ent.mesh.position.x - px) < 2.0 && Math.abs(ent.mesh.position.y - py) < 2.0) {
          ent.resolved = true;
          const matched = ent.freq === this.freq || isNova;
          this.combo = Math.min(12, +(this.combo + (matched ? 0.2 : 0.08)).toFixed(2));
          this.peakCombo = Math.max(this.peakCombo, this.combo);
          this.score += Math.round((matched ? 150 : 75) * this.combo);
          this.novaCharge = Math.min(100, this.novaCharge + (matched ? 7 : 3));
          this.sound.playCollect(this.combo, matched);
          this.world.spawnBurst(ent.mesh.position.x, ent.mesh.position.y, ez, this.world.theme[ent.freq], 10, 0.75);
        }
      } else if (ent.type === 'rainbow') {
        if (Math.abs(ez - pz) < 2.2 && Math.abs(ent.mesh.position.x - px) < 2.2 && Math.abs(ent.mesh.position.y - py) < 2.2) {
          ent.resolved = true;
          this.novaCharge = Math.min(100, this.novaCharge + 28);
          this.shields = Math.min(GAME_CONFIG.maxShields, this.shields + 1);
          this.score += Math.round(500 * this.combo);
          this.sound.playGatePhase();
          this.world.spawnBurst(ent.mesh.position.x, ent.mesh.position.y, ez, 0xffffff, 24, 1.2);
          this.callbacks.onCallout?.('PRISM CORE +SHIELD & NOVA');
        }
      } else if (ent.type === 'gate') {
        if (Math.abs(ez - pz) < 1.35 && Math.abs(px - ent.centerX) < ent.halfW + 0.5) {
          ent.resolved = true;
          if (ent.freq === this.freq || isNova || this.dashTimer > 0) {
            this.gatesPhased++;
            this.combo = Math.min(12, +(this.combo + 0.45).toFixed(2));
            this.peakCombo = Math.max(this.peakCombo, this.combo);
            this.score += Math.round(300 * this.combo);
            this.novaCharge = Math.min(100, this.novaCharge + 15);
            this.sound.playGatePhase();
            this.world.spawnShockwave(px, py, ez, this._getActiveHex(), 12);
            this.world.spawnBurst(px, py, ez, this._getActiveHex(), 20, 1.0);
          } else {
            this._takeDamage('FREQUENCY MISMATCH');
          }
        }
      } else if (ent.type === 'sweeper') {
        if (Math.abs(ez - pz) < 1.2 && py < 2.0) {
          ent.resolved = true;
          if (isNova || this.dashTimer > 0) {
            this.dronesShattered++;
            this.score += Math.round(250 * this.combo);
            this.sound.playKill();
            this.world.spawnBurst(px, 1.2, ez, this.world.theme[ent.freq], 20, 1.1);
          } else {
            this._takeDamage('LOW LASER IMPACT');
          }
        }
      } else if (ent.type === 'aerial') {
        if (Math.abs(ez - pz) < 1.3 && py > 2.4 && py < 4.7) {
          ent.resolved = true;
          if (isNova || this.dashTimer > 0) {
            this.score += Math.round(250 * this.combo);
            this.world.spawnBurst(px, py, ez, this.world.theme[ent.freq], 18, 1.1);
          } else {
            this._takeDamage('AERIAL BEAM IMPACT');
          }
        }
      } else if (ent.type === 'drone') {
        if (Math.abs(ez - pz) < 1.8 && Math.abs(ent.mesh.position.x - px) < 2.0 && Math.abs(ent.mesh.position.y - py) < 1.7) {
          ent.resolved = true;
          if (isNova || this.dashTimer > 0) {
            this.dronesShattered++;
            this.score += Math.round(320 * this.combo);
            this.sound.playKill();
            this.world.spawnBurst(ent.mesh.position.x, ent.mesh.position.y, ez, this.world.theme[ent.freq], 24, 1.25);
          } else {
            this._takeDamage('SENTINEL COLLISION');
          }
        }
      }
    }
  }

  _takeDamage(reason) {
    if (this.invulnTimer > 0) return;
    this.shields -= 1;
    this.combo = 1.0;
    this.invulnTimer = 1.35;
    this.shakeTimer = 0.35;
    this.sound.playHit();
    this.world.spawnBurst(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xff3b5c, 22, 1.0);
    this.callbacks.onCallout?.(reason);

    if (this.shields <= 0) {
      this._finishRun();
    }
  }

  _finishRun() {
    this.state = 'gameover';
    this.keys.clear();
    this.pointerFiring = false;
    this.callbacks.onClearKeys?.();

    const finalScore = Math.floor(this.score);
    const finalDist = Math.floor(this.distance);
    if (finalScore > this.highScore) {
      this.highScore = finalScore;
      localStorage.setItem('chromadrift_best_score', String(finalScore));
    }
    if (finalDist > this.bestDistance) {
      this.bestDistance = finalDist;
      localStorage.setItem('chromadrift_best_dist', String(finalDist));
    }

    this.callbacks.onGameOver?.({
      score: finalScore,
      bestScore: this.highScore,
      distance: finalDist,
      bestDistance: this.bestDistance,
      peakCombo: this.peakCombo,
      gatesPhased: this.gatesPhased,
      dronesShattered: this.dronesShattered,
    });
  }
}
