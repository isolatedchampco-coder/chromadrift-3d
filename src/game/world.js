import * as THREE from 'three';
import { FREQUENCIES, LANE_WIDTH, TRACK_HALF_WIDTH } from './constants.js';

export class WorldManager {
  constructor(scene, themeColors) {
    this.scene = scene;
    this.theme = { ...themeColors };
    this.biomeColor = new THREE.Color(0x1e4dff);
    this.brightness = 0.8;

    this.entities = [];
    this.bolts = [];
    this.particles = [];
    this.shockwaves = [];
    this.pillars = [];
    this.arches = [];

    this.spawnTimer = 0.8;
    this.patternIndex = 0;

    this._initSharedGeometries();
    this._initScenery();
  }

  _initSharedGeometries() {
    this.geo = {
      cyanEmblem: new THREE.OctahedronGeometry(0.9, 0),
      magentaEmblem: new THREE.TetrahedronGeometry(1.05, 0),
      goldEmblem: new THREE.TorusGeometry(0.75, 0.2, 10, 24),

      shardCyan: new THREE.OctahedronGeometry(0.55, 0),
      shardMagenta: new THREE.TetrahedronGeometry(0.65, 0),
      shardGold: new THREE.TorusGeometry(0.45, 0.14, 8, 18),
      shardRainbow: new THREE.IcosahedronGeometry(0.64, 0),

      droneCore: new THREE.OctahedronGeometry(0.85, 1),
      droneRing: new THREE.TorusGeometry(1.2, 0.08, 8, 28),

      bolt: new THREE.CapsuleGeometry(0.11, 1.15, 4, 8),
      spark: new THREE.OctahedronGeometry(0.18, 0),
      shockwave: new THREE.TorusGeometry(1.0, 0.08, 10, 42),

      pillar: new THREE.CylinderGeometry(0.55, 1.35, 1, 6),
      arch: new THREE.TorusGeometry(13.5, 0.14, 8, 42, Math.PI),
    };
    this.geo.bolt.rotateX(Math.PI / 2);
    this.geo.shockwave.rotateX(Math.PI / 2);

    this.pillarMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b122b,
      emissive: 0x1e4dff,
      emissiveIntensity: 0.34 * this.brightness,
      metalness: 0.72,
      roughness: 0.24,
      clearcoat: 0.9,
      flatShading: true,
    });
    this.pillarMat.userData.baseEmissive = 0.34;

    this.archMat = new THREE.MeshStandardMaterial({
      color: 0x0d1a33,
      emissive: 0x00d9ff,
      emissiveIntensity: 0.72 * this.brightness,
      roughness: 0.25,
    });
    this.archMat.userData.baseEmissive = 0.72;
  }

  _makeGlowMat(baseColor, emissiveColor, baseEmissive, extra = {}) {
    const { keepDarkBase = false, ...matProps } = extra;
    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: emissiveColor,
      emissiveIntensity: baseEmissive * this.brightness,
      roughness: 0.18,
      metalness: 0.35,
      ...matProps,
    });
    mat.userData.baseEmissive = baseEmissive;
    if (keepDarkBase) mat.userData.keepDarkBase = true;
    return mat;
  }

  _initScenery() {
    // Flanking crystal canyon spires along [-320, +24]
    for (let i = 0; i < 48; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const height = 10 + ((i * 7) % 24);
      const mesh = new THREE.Mesh(this.geo.pillar, this.pillarMat);
      const x = side * (13.5 + ((i * 13) % 18));
      const z = -i * 7.2 + 20;
      mesh.scale.set(1.2 + ((i * 3) % 3) * 0.6, height, 1.2 + ((i * 5) % 3) * 0.6);
      mesh.position.set(x, height * 0.5 - 3.5, z);
      mesh.rotation.y = i * 0.6;
      mesh.rotation.z = side * -0.08;
      this.scene.add(mesh);
      this.pillars.push(mesh);
    }

    // Overhead glowing prism arches
    for (let i = 0; i < 10; i++) {
      const arch = new THREE.Mesh(this.geo.arch, this.archMat);
      arch.position.set(0, -1.2, -i * 36 - 10);
      this.scene.add(arch);
      this.arches.push(arch);
    }
  }

  setTheme(themeColors) {
    this.theme = { ...themeColors };
    // Live-recolor active entities to match new palette theme
    for (const ent of this.entities) {
      if (ent.freq && this.theme[ent.freq]) {
        const c = this.theme[ent.freq];
        ent.materials?.forEach((m) => {
          if (m.color && !m.userData.keepDarkBase) m.color.setHex(c);
          if (m.emissive) m.emissive.setHex(c);
        });
      }
    }
  }

  setBrightness(level) {
    this.brightness = level;
    this.pillarMat.emissiveIntensity = this.pillarMat.userData.baseEmissive * level;
    this.archMat.emissiveIntensity = this.archMat.userData.baseEmissive * level;
    for (const ent of this.entities) {
      ent.materials?.forEach((m) => {
        if (m.userData.baseEmissive !== undefined) {
          m.emissiveIntensity = m.userData.baseEmissive * level;
        }
        if (m.userData.baseOpacity !== undefined) {
          m.opacity = m.userData.baseOpacity * Math.min(1.2, 0.35 + level * 0.65);
        }
      });
    }
  }

  setBiomeColors(crystalHex, accentHex) {
    this.pillarMat.emissive.setHex(crystalHex);
    this.archMat.emissive.setHex(accentHex);
  }

  clearGameplay() {
    for (const ent of this.entities) this.scene.remove(ent.mesh);
    for (const b of this.bolts) this.scene.remove(b.mesh);
    for (const p of this.particles) this.scene.remove(p.mesh);
    for (const s of this.shockwaves) this.scene.remove(s.mesh);
    this.entities.length = 0;
    this.bolts.length = 0;
    this.particles.length = 0;
    this.shockwaves.length = 0;
    this.spawnTimer = 0.65;
    this.patternIndex = 0;
  }

  _pickFreq(offset = 0) {
    const idx = (Math.floor(Math.random() * 3) + offset) % 3;
    return FREQUENCIES[idx];
  }

  _emblemGeoForFreq(freq) {
    if (freq === 'cyan') return this.geo.cyanEmblem;
    if (freq === 'magenta') return this.geo.magentaEmblem;
    return this.geo.goldEmblem;
  }

  _shardGeoForFreq(freq) {
    if (freq === 'cyan') return this.geo.shardCyan;
    if (freq === 'magenta') return this.geo.shardMagenta;
    return this.geo.shardGold;
  }

  spawnPattern(distance) {
    const difficulty = Math.min(1, distance / 4200);
    const zStart = -255;
    const roll = this.patternIndex % 6;
    this.patternIndex++;

    if (roll === 0) {
      // Full-width Chromatic Phase Gate + leading shard line guiding color!
      const freq = this._pickFreq();
      this._spawnShardLine(freq, (Math.floor(Math.random() * 3) - 1) * LANE_WIDTH, 1.15, zStart + 46, 4, 8);
      this._spawnGate(freq, zStart, 0, 17.6);
    } else if (roll === 1) {
      // Sentinel Drone Squadron + Side Shards
      const lanes = [-LANE_WIDTH, 0, LANE_WIDTH];
      const count = difficulty > 0.35 ? 2 : 1;
      const shuffled = lanes.sort(() => Math.random() - 0.5);
      for (let i = 0; i < count; i++) {
        this._spawnDrone(this._pickFreq(i), shuffled[i], 1.35 + (i % 2) * 0.9, zStart - i * 16);
      }
      this._spawnShardLine(this._pickFreq(2), shuffled[2], 1.15, zStart + 10, 3, 7);
    } else if (roll === 2) {
      // Low Sweeper Laser (Jump with Space or Blast Core) + High Aerial Bonus Arc
      const freq = this._pickFreq();
      this._spawnSweeper(freq, zStart - 10);
      this._spawnHighShardArc(freq, (Math.floor(Math.random() * 3) - 1) * LANE_WIDTH, zStart - 10);
      if (difficulty > 0.2) {
        this._spawnAerialBeam(this._pickFreq(1), zStart - 44);
      }
    } else if (roll === 3) {
      // Dual Split-Lane Gates (choose your lane & shift color!)
      const f1 = this._pickFreq(0);
      const f2 = this._pickFreq(1);
      this._spawnGate(f1, zStart, -LANE_WIDTH * 0.6, 8.2);
      this._spawnGate(f2, zStart, LANE_WIDTH * 0.6, 8.2);
      if (Math.random() < 0.45) {
        this._spawnRainbowCore((Math.random() - 0.5) * 8, 2.9, zStart - 22);
      }
    } else if (roll === 4) {
      // High Aerial Beam (stay low or Dive Slam C!) + Low Ground Shards + Drone
      const freq = this._pickFreq();
      this._spawnAerialBeam(freq, zStart);
      this._spawnShardLine(freq, 0, 1.05, zStart + 14, 4, 7);
      this._spawnDrone(this._pickFreq(1), (Math.random() > 0.5 ? 1 : -1) * LANE_WIDTH, 1.4, zStart - 28);
    } else {
      // Slalom Shards + Rapid Gate + Sentinel
      const fA = this._pickFreq();
      const fB = this._pickFreq(1);
      this._spawnShardLine(fA, -LANE_WIDTH, 1.15, zStart + 32, 3, 7);
      this._spawnDrone(fB, LANE_WIDTH, 1.4, zStart + 12);
      this._spawnGate(fB, zStart - 24, 0, 17.6);
    }
  }

  _spawnGate(freq, z, centerX, width) {
    const colorHex = this.theme[freq];
    const group = new THREE.Group();
    group.position.set(centerX, 0, z);

    const frameMat = this._makeGlowMat(colorHex, colorHex, 1.3, {
      roughness: 0.18,
      metalness: 0.6,
    });

    const curtainMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.18 * (0.35 + this.brightness * 0.65),
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    curtainMat.userData.baseOpacity = 0.18;

    const pillarGeo = new THREE.BoxGeometry(0.45, 7.2, 0.65);
    const leftP = new THREE.Mesh(pillarGeo, frameMat);
    leftP.position.set(-width * 0.5, 3.6, 0);
    const rightP = new THREE.Mesh(pillarGeo, frameMat);
    rightP.position.set(width * 0.5, 3.6, 0);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.45, 0.65), frameMat);
    topBar.position.set(0, 7.2, 0);

    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.5, 6.9), curtainMat);
    curtain.position.set(0, 3.5, 0);

    const emblem = new THREE.Mesh(this._emblemGeoForFreq(freq), frameMat);
    emblem.position.set(0, 3.8, 0);

    group.add(leftP, rightP, topBar, curtain, emblem);
    this.scene.add(group);

    this.entities.push({
      type: 'gate',
      freq,
      mesh: group,
      emblem,
      centerX,
      halfW: width * 0.5,
      materials: [frameMat, curtainMat],
      resolved: false,
    });
  }

  _spawnSweeper(freq, z) {
    const colorHex = this.theme[freq];
    const group = new THREE.Group();
    group.position.set(0, 1.05, z);

    const mat = this._makeGlowMat(colorHex, colorHex, 1.45, { roughness: 0.18 });

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, TRACK_HALF_WIDTH * 1.92, 12), mat);
    bar.rotation.z = Math.PI / 2;

    const core = new THREE.Mesh(this._emblemGeoForFreq(freq), mat);
    core.scale.setScalar(0.85);

    group.add(bar, core);
    this.scene.add(group);

    this.entities.push({
      type: 'sweeper',
      freq,
      mesh: group,
      core,
      hp: 2,
      materials: [mat],
      resolved: false,
    });
  }

  _spawnAerialBeam(freq, z) {
    const colorHex = this.theme[freq];
    const group = new THREE.Group();
    group.position.set(0, 3.6, z);

    const mat = this._makeGlowMat(colorHex, colorHex, 1.38, { roughness: 0.18 });

    const bar = new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF_WIDTH * 1.92, 1.35, 0.8), mat);
    const core = new THREE.Mesh(this._emblemGeoForFreq(freq), mat);
    core.position.set(0, 0, 0.55);
    core.scale.setScalar(0.8);
    group.add(bar, core);
    this.scene.add(group);

    this.entities.push({
      type: 'aerial',
      freq,
      mesh: group,
      core,
      materials: [mat],
      resolved: false,
    });
  }

  _spawnDrone(freq, x, y, z) {
    const colorHex = this.theme[freq];
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const mat = this._makeGlowMat(0x1c2742, colorHex, 1.5, {
      metalness: 0.45,
      roughness: 0.16,
      keepDarkBase: true,
    });
    mat.userData.keepDarkBase = true;

    const body = new THREE.Mesh(this.geo.droneCore, mat);
    const ring = new THREE.Mesh(this.geo.droneRing, mat);
    const emblem = new THREE.Mesh(this._emblemGeoForFreq(freq), mat);
    emblem.scale.setScalar(0.55);
    emblem.position.set(0, 1.35, 0);

    group.add(body, ring, emblem);
    this.scene.add(group);

    this.entities.push({
      type: 'drone',
      freq,
      mesh: group,
      body,
      ring,
      baseX: x,
      baseY: y,
      phase: Math.random() * Math.PI * 2,
      hp: 2,
      materials: [mat],
      resolved: false,
    });
  }

  _spawnShardLine(freq, x, y, zStart, count, spacing) {
    for (let i = 0; i < count; i++) {
      this._spawnShard(freq, x, y, zStart - i * spacing);
    }
  }

  _spawnHighShardArc(freq, x, zCenter) {
    for (let i = -2; i <= 2; i++) {
      const arcY = 3.2 - Math.abs(i) * 0.42;
      this._spawnShard(freq, x, arcY, zCenter + i * 4.5);
    }
  }

  _spawnShard(freq, x, y, z) {
    const colorHex = this.theme[freq];
    const mat = this._makeGlowMat(0x1f2b46, colorHex, 1.55, { roughness: 0.12 });
    mat.userData.keepDarkBase = true;
    const mesh = new THREE.Mesh(this._shardGeoForFreq(freq), mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.entities.push({
      type: 'shard',
      freq,
      mesh,
      baseY: y,
      materials: [mat],
      resolved: false,
    });
  }

  _spawnRainbowCore(x, y, z) {
    const mat = this._makeGlowMat(0x28304a, 0xffffff, 1.6, { roughness: 0.12 });
    mat.userData.keepDarkBase = true;
    const mesh = new THREE.Mesh(this.geo.shardRainbow, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.entities.push({
      type: 'rainbow',
      freq: null,
      mesh,
      baseY: y,
      materials: [mat],
      resolved: false,
    });
  }

  spawnBolt(x, y, z, freq) {
    const colorHex = this.theme[freq];
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      toneMapped: false,
    });
    for (const side of [-1.45, 1.45]) {
      const mesh = new THREE.Mesh(this.geo.bolt, mat);
      mesh.position.set(x + side, y, z - 0.8);
      this.scene.add(mesh);
      this.bolts.push({
        mesh,
        freq,
        colorHex,
        life: 1.6,
      });
    }
  }

  spawnBurst(x, y, z, colorHex, count = 18, speedScale = 1.0) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geo.spark, mat);
      mesh.position.set(x, y, z);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI - Math.PI * 0.3;
      const spd = (7 + Math.random() * 14) * speedScale;
      const vel = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi) * spd,
        Math.sin(phi) * spd + 3,
        Math.sin(theta) * Math.cos(phi) * spd
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.48 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }
  }

  spawnShockwave(x, y, z, colorHex, maxScale = 24) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.geo.shockwave, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.shockwaves.push({
      mesh,
      maxScale,
      age: 0,
      duration: 0.65,
    });
  }

  updateScenery(dt, speed, time) {
    for (const pillar of this.pillars) {
      pillar.position.z += speed * dt;
      if (pillar.position.z > 28) {
        pillar.position.z -= 48 * 7.2;
      }
    }

    for (const arch of this.arches) {
      arch.position.z += speed * dt;
      if (arch.position.z > 32) {
        arch.position.z -= 10 * 36;
      }
      arch.rotation.z = Math.sin(time * 0.5 + arch.position.z * 0.02) * 0.04;
    }
  }

  updateGameplay(dt, time, speed, distance, playerPos, activeFreq, isNova) {
    const spawnRate = Math.max(0.55, 1.32 - distance / 5200);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnRate;
      this.spawnPattern(distance);
    }

    // Update Bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.mesh.position.z -= 135 * dt;
      b.life -= dt;
      if (b.life <= 0 || b.mesh.position.z < -280) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.bolts.splice(i, 1);
      }
    }

    // Update Entities
    const activeColor = this.theme[activeFreq];
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      ent.mesh.position.z += speed * dt;

      if (ent.type === 'gate') {
        ent.emblem.rotation.y += dt * 2.2;
        ent.emblem.rotation.x += dt * 1.1;
      } else if (ent.type === 'drone') {
        ent.mesh.position.x = ent.baseX + Math.sin(time * 2.4 + ent.phase) * 1.9;
        ent.mesh.position.y = ent.baseY + Math.cos(time * 3.1 + ent.phase) * 0.35;
        ent.body.rotation.y += dt * 3.0;
        ent.ring.rotation.x += dt * 2.6;
        ent.ring.rotation.y += dt * 1.8;
      } else if (ent.type === 'sweeper' || ent.type === 'aerial') {
        ent.core.rotation.y += dt * 2.8;
        ent.core.rotation.z += dt * 1.8;
      } else if (ent.type === 'shard') {
        ent.mesh.rotation.y += dt * 3.4;
        ent.mesh.rotation.x += dt * 1.6;
        ent.mesh.position.y = ent.baseY + Math.sin(time * 4.0 + ent.mesh.position.z * 0.2) * 0.16;

        // Magnetic attraction when player frequency matches shard or during Nova!
        if (!ent.resolved && (ent.freq === activeFreq || isNova)) {
          const dx = playerPos.x - ent.mesh.position.x;
          const dy = playerPos.y - ent.mesh.position.y;
          const dz = playerPos.z - ent.mesh.position.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < (isNova ? 190 : 75)) {
            const pull = Math.min(1, dt * (isNova ? 12 : 7.5));
            ent.mesh.position.x += dx * pull;
            ent.mesh.position.y += dy * pull;
            ent.mesh.position.z += dz * pull;
          }
        }
      } else if (ent.type === 'rainbow') {
        ent.mesh.rotation.y += dt * 4.0;
        ent.mesh.rotation.z += dt * 2.5;
        const hue = (time * 0.9) % 1;
        ent.materials[0].emissive.setHSL(hue, 0.95, 0.58);
      }

      if (ent.mesh.position.z > 24 || ent.resolved) {
        if (ent.resolved && ent.type === 'gate' && ent.mesh.position.z < 18) {
          // Keep gate visible until it passes camera
          continue;
        }
        this.disposeEntity(ent);
        this.entities.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.position.z += speed * 0.35 * dt;
      p.vel.y -= 18 * dt;
      const t = Math.max(0, p.life / p.maxLife);
      p.mesh.scale.setScalar(0.4 + t * 1.1);
      p.mesh.material.opacity = t;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Update Shockwave Rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.age += dt;
      const progress = Math.min(1, s.age / s.duration);
      const scale = 1 + progress * s.maxScale;
      s.mesh.scale.setScalar(scale);
      s.mesh.material.opacity = (1 - progress) * 0.9;
      if (progress >= 1) {
        this.scene.remove(s.mesh);
        s.mesh.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    void activeColor;
  }

  disposeEntity(ent) {
    this.scene.remove(ent.mesh);
    ent.materials?.forEach((m) => m.dispose());
  }
}
