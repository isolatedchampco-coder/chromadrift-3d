import * as THREE from 'three';
import { createEnergyShieldMaterial } from './shaders.js';

export class PrismCraft {
  constructor() {
    this.root = new THREE.Group();
    this.rollGroup = new THREE.Group();
    this.root.add(this.rollGroup);

    this.activeColor = new THREE.Color(0x00f0ff);
    this.thrusterLevel = 1.0;
    this.brightness = 0.8;

    this._buildHull();
    this._buildOrbitPods();
    this._buildShield();
    this._buildTrails();
  }

  _buildHull() {
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d1324,
      metalness: 0.88,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      iridescence: 0.85,
      iridescenceIOR: 1.45,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.35 * this.brightness,
      roughness: 0.2,
      metalness: 0.4,
    });
    this.accentMat = accentMat;

    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a2c4f,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.36 * this.brightness,
      metalness: 0.2,
      roughness: 0.05,
      clearcoat: 1.0,
      iridescence: 1.0,
    });
    this.canopyMat = canopyMat;

    // Central sharp fuselage nose (pointing -Z)
    const noseGeo = new THREE.ConeGeometry(0.48, 2.9, 6);
    noseGeo.rotateX(-Math.PI / 2);
    noseGeo.scale(1.15, 0.52, 1.0);
    const nose = new THREE.Mesh(noseGeo, hullMat);
    nose.position.set(0, 0, -0.55);
    this.rollGroup.add(nose);

    // Rear fuselage core
    const bodyGeo = new THREE.BoxGeometry(0.95, 0.36, 1.5);
    const body = new THREE.Mesh(bodyGeo, hullMat);
    body.position.set(0, -0.02, 0.65);
    this.rollGroup.add(body);

    // Glass prism cockpit canopy
    const canopyGeo = new THREE.OctahedronGeometry(0.36, 1);
    canopyGeo.scale(0.82, 0.56, 2.0);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 0.2, -0.1);
    this.rollGroup.add(canopy);

    // Swept delta wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.28, 0.3);
    wingShape.lineTo(1.82, -0.92);
    wingShape.lineTo(1.62, -1.24);
    wingShape.lineTo(0.35, -0.95);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    wingGeo.rotateX(Math.PI / 2);

    const rightWing = new THREE.Mesh(wingGeo, hullMat);
    rightWing.position.set(0, 0.02, 0.15);
    this.rollGroup.add(rightWing);

    const leftWing = rightWing.clone();
    leftWing.scale.x = -1;
    this.rollGroup.add(leftWing);

    // Vertical tail stabilizer fins (angled outward)
    const finGeo = new THREE.BoxGeometry(0.06, 0.56, 0.85);
    const finR = new THREE.Mesh(finGeo, hullMat);
    finR.position.set(0.56, 0.28, 0.82);
    finR.rotation.z = -0.35;
    finR.rotation.x = 0.2;
    this.rollGroup.add(finR);

    const finL = finR.clone();
    finL.position.x = -0.56;
    finL.rotation.z = 0.35;
    this.rollGroup.add(finL);

    // Glowing chromatic energy strips along fuselage & wings
    const spineGeo = new THREE.BoxGeometry(0.11, 0.09, 2.05);
    const spine = new THREE.Mesh(spineGeo, accentMat);
    spine.position.set(0, 0.12, -0.32);
    this.rollGroup.add(spine);

    const stripGeo = new THREE.BoxGeometry(0.06, 0.06, 1.58);
    const stripR = new THREE.Mesh(stripGeo, accentMat);
    stripR.position.set(1.06, 0.04, 0.55);
    stripR.rotation.y = -0.66;
    this.rollGroup.add(stripR);

    const stripL = stripR.clone();
    stripL.position.x = -1.06;
    stripL.rotation.y = 0.66;
    this.rollGroup.add(stripL);

    // Wingtip laser emitter barrels
    const cannonGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.8, 8);
    cannonGeo.rotateX(Math.PI / 2);
    const cannonR = new THREE.Mesh(cannonGeo, accentMat);
    cannonR.position.set(1.66, 0.0, 0.65);
    this.rollGroup.add(cannonR);

    const cannonL = cannonR.clone();
    cannonL.position.x = -1.66;
    this.rollGroup.add(cannonL);

    // Thruster flame cones (main + side nozzles)
    this.thrusterMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const flameGeo = new THREE.ConeGeometry(0.24, 1.65, 12);
    flameGeo.rotateX(Math.PI / 2);
    flameGeo.translate(0, 0, 0.82);

    this.mainFlame = new THREE.Mesh(flameGeo, this.thrusterMat);
    this.mainFlame.position.set(0, 0, 1.32);
    this.rollGroup.add(this.mainFlame);

    const sideFlameGeo = new THREE.ConeGeometry(0.12, 1.0, 10);
    sideFlameGeo.rotateX(Math.PI / 2);
    sideFlameGeo.translate(0, 0, 0.5);

    this.sideFlameL = new THREE.Mesh(sideFlameGeo, this.thrusterMat);
    this.sideFlameL.position.set(-0.44, -0.02, 1.34);
    this.rollGroup.add(this.sideFlameL);

    this.sideFlameR = new THREE.Mesh(sideFlameGeo, this.thrusterMat);
    this.sideFlameR.position.set(0.44, -0.02, 1.34);
    this.rollGroup.add(this.sideFlameR);

    // Dynamic PointLight attached to craft illuminating nearby track/barriers
    this.craftLight = new THREE.PointLight(0x00f0ff, 3.2 * this.brightness, 22, 1.4);
    this.craftLight.position.set(0, 0.8, -0.5);
    this.root.add(this.craftLight);
  }

  _buildOrbitPods() {
    this.podGroup = new THREE.Group();
    this.rollGroup.add(this.podGroup);

    const podGeo = new THREE.OctahedronGeometry(0.16, 0);
    const ringGeo = new THREE.TorusGeometry(0.26, 0.025, 8, 24);

    this.podMat = new THREE.MeshStandardMaterial({
      color: 0x1e2b48,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.4 * this.brightness,
      roughness: 0.14,
      metalness: 0.45,
    });

    this.pods = [];
    for (const side of [-1, 1]) {
      const holder = new THREE.Group();
      holder.position.set(side * 2.15, 0.18, 0.45);
      const gem = new THREE.Mesh(podGeo, this.podMat);
      const ring = new THREE.Mesh(ringGeo, this.podMat);
      ring.rotation.x = Math.PI / 2;
      holder.add(gem, ring);
      this.podGroup.add(holder);
      this.pods.push({ holder, gem, ring, side });
    }
  }

  _buildShield() {
    this.shieldMat = createEnergyShieldMaterial();
    const shieldGeo = new THREE.SphereGeometry(2.15, 28, 20);
    shieldGeo.scale(1.06, 0.55, 1.15);
    this.shieldMesh = new THREE.Mesh(shieldGeo, this.shieldMat);
    this.shieldMesh.position.set(0, 0.05, 0.1);
    this.rollGroup.add(this.shieldMesh);
  }

  _buildTrails() {
    this.trailCount = 26;
    this.trailPointsL = [];
    this.trailPointsR = [];
    for (let i = 0; i < this.trailCount; i++) {
      this.trailPointsL.push(new THREE.Vector3(-1.66, 0.95, i * 0.6));
      this.trailPointsR.push(new THREE.Vector3(1.66, 0.95, i * 0.6));
    }

    const createTrailMesh = () => {
      const positions = new Float32Array(this.trailCount * 2 * 3);
      const colors = new Float32Array(this.trailCount * 2 * 3);
      const indices = [];
      for (let i = 0; i < this.trailCount - 1; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.setIndex(indices);

      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      return mesh;
    };

    this.trailMeshL = createTrailMesh();
    this.trailMeshR = createTrailMesh();
    this.trailGroup = new THREE.Group();
    this.trailGroup.add(this.trailMeshL, this.trailMeshR);
  }

  setBrightness(level) {
    this.brightness = level;
    this.accentMat.emissiveIntensity = 1.35 * level;
    this.canopyMat.emissiveIntensity = 0.36 * level;
    this.podMat.emissiveIntensity = 1.4 * level;
    this.craftLight.intensity = 3.2 * level;
    this.thrusterMat.opacity = Math.min(0.95, 0.72 * level + 0.15);
    this.trailMeshL.material.opacity = Math.min(0.85, 0.58 * level + 0.12);
    this.trailMeshR.material.opacity = Math.min(0.85, 0.58 * level + 0.12);
  }

  setColor(hexOrColor, isNova = false, time = 0) {
    if (isNova) {
      this.activeColor.setHSL((time * 0.85) % 1, 0.95, 0.58);
    } else {
      this.activeColor.set(hexOrColor);
    }
    this.accentMat.color.copy(this.activeColor);
    this.accentMat.emissive.copy(this.activeColor);
    this.canopyMat.emissive.copy(this.activeColor);
    this.podMat.emissive.copy(this.activeColor);
    this.thrusterMat.color.copy(this.activeColor).lerp(new THREE.Color(0xffffff), 0.35);
    this.craftLight.color.copy(this.activeColor);
    this.shieldMat.uniforms.uColor.value.copy(this.activeColor);
  }

  resetTrails() {
    const pos = this.root.position;
    for (let i = 0; i < this.trailCount; i++) {
      this.trailPointsL[i].set(pos.x - 1.66, pos.y, pos.z + 0.8 + i * 0.55);
      this.trailPointsR[i].set(pos.x + 1.66, pos.y, pos.z + 0.8 + i * 0.55);
    }
  }

  update(dt, time, { speed, baseSpeed, combo, shieldBoost, isNova }) {
    // Animate thruster cones
    const speedFactor = Math.max(0.55, speed / baseSpeed);
    const flicker = 0.88 + Math.sin(time * 48) * 0.12;
    const zScale = speedFactor * flicker;
    this.mainFlame.scale.set(0.9 + (speedFactor - 1) * 0.25, 0.9 + (speedFactor - 1) * 0.25, zScale);
    this.sideFlameL.scale.set(1, 1, zScale * 0.85);
    this.sideFlameR.scale.set(1, 1, zScale * 0.85);

    // Animate orbiting prism pods
    const spinSpeed = 2.4 + Math.min(combo, 12) * 0.35;
    for (const pod of this.pods) {
      pod.gem.rotation.y += dt * spinSpeed;
      pod.gem.rotation.x += dt * spinSpeed * 0.6;
      pod.ring.rotation.z -= dt * spinSpeed * 1.1;
      pod.holder.position.y = 0.16 + Math.sin(time * 4.5 + pod.side) * 0.08;
    }

    // Shield shader update
    this.shieldMat.uniforms.uTime.value = time;
    const baseShieldOp = isNova ? 0.68 : shieldBoost > 0 ? 0.58 : 0.18;
    this.shieldMat.uniforms.uOpacity.value = baseShieldOp * Math.max(0.4, this.brightness);

    // Update 3D ribbon trails in world space (moving older points back by speed * dt)
    this.rollGroup.updateWorldMatrix(true, false);
    const tipL = new THREE.Vector3(-1.66, 0.0, 0.92).applyMatrix4(this.rollGroup.matrixWorld);
    const tipR = new THREE.Vector3(1.66, 0.0, 0.92).applyMatrix4(this.rollGroup.matrixWorld);

    for (let i = this.trailCount - 1; i > 0; i--) {
      this.trailPointsL[i].copy(this.trailPointsL[i - 1]);
      this.trailPointsL[i].z += speed * dt;
      this.trailPointsR[i].copy(this.trailPointsR[i - 1]);
      this.trailPointsR[i].z += speed * dt;
    }
    this.trailPointsL[0].copy(tipL);
    this.trailPointsR[0].copy(tipR);

    this._writeTrailGeometry(this.trailMeshL, this.trailPointsL, isNova, time);
    this._writeTrailGeometry(this.trailMeshR, this.trailPointsR, isNova, time);
  }

  _writeTrailGeometry(mesh, points, isNova, time) {
    const posAttr = mesh.geometry.getAttribute('position');
    const colAttr = mesh.geometry.getAttribute('color');
    const tempCol = new THREE.Color();

    for (let i = 0; i < this.trailCount; i++) {
      const t = 1 - i / (this.trailCount - 1);
      const halfW = 0.08 * t;
      const p = points[i];

      posAttr.setXYZ(i * 2, p.x - halfW, p.y, p.z);
      posAttr.setXYZ(i * 2 + 1, p.x + halfW, p.y, p.z);

      if (isNova) {
        tempCol.setHSL((time * 1.1 + i * 0.05) % 1, 0.95, 0.58 * t);
      } else {
        tempCol.copy(this.activeColor).multiplyScalar(t * t);
      }
      colAttr.setXYZ(i * 2, tempCol.r, tempCol.g, tempCol.b);
      colAttr.setXYZ(i * 2 + 1, tempCol.r, tempCol.g, tempCol.b);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
