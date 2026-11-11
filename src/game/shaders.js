import * as THREE from 'three';

export function createAuroraSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSkyTop: { value: new THREE.Color(0x050819) },
      uSkyHorizon: { value: new THREE.Color(0x101c48) },
      uAuroraA: { value: new THREE.Color(0x00f0ff) },
      uAuroraB: { value: new THREE.Color(0x9b4dff) },
      uActiveColor: { value: new THREE.Color(0x00f0ff) },
      uNova: { value: 0 },
      uBrightness: { value: 0.8 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSkyTop;
      uniform vec3 uSkyHorizon;
      uniform vec3 uAuroraA;
      uniform vec3 uAuroraB;
      uniform vec3 uActiveColor;
      uniform float uNova;
      uniform float uBrightness;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          val += amp * noise(p);
          p = p * 2.05 + vec2(1.7, 9.2);
          amp *= 0.5;
        }
        return val;
      }

      vec3 hsl2rgb(float h, float s, float l) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
      }

      void main() {
        vec3 dir = normalize(vDir);
        float elev = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        float horizonMask = exp(-abs(dir.y) * 5.2);

        // Rich twilight cosmos base
        vec3 col = mix(uSkyHorizon, uSkyTop, smoothstep(0.42, 0.92, elev));
        col += uActiveColor * horizonMask * 0.22;

        // Flowing Aurora Borealis ribbons across upper hemisphere
        float skyFade = smoothstep(0.02, 0.55, dir.y);
        vec2 uv = dir.xz / (abs(dir.y) + 0.32);
        float wave1 = fbm(uv * 1.35 + vec2(uTime * 0.045, -uTime * 0.06));
        float wave2 = fbm(uv * 2.15 - vec2(uTime * 0.03, uTime * 0.05) + wave1 * 1.4);
        float curtain = smoothstep(0.36, 0.78, wave2) * skyFade;

        vec3 auroraMix = mix(uAuroraA, uAuroraB, smoothstep(0.25, 0.75, wave1));
        auroraMix = mix(auroraMix, uActiveColor, 0.28);
        if (uNova > 0.01) {
          vec3 rainbow = hsl2rgb(fract(wave1 * 0.9 + uTime * 0.22), 0.92, 0.58);
          auroraMix = mix(auroraMix, rainbow * 1.35, uNova * 0.75);
        }
        col += auroraMix * curtain * 0.92;

        // Crisp multi-hue starfield
        vec2 starGrid = floor(dir.xy * 180.0 + dir.zy * 140.0);
        float starRnd = hash21(starGrid);
        if (starRnd > 0.992 && dir.y > -0.05) {
          float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + starRnd * 80.0);
          vec3 starCol = mix(vec3(0.75, 0.9, 1.0), uAuroraA, fract(starRnd * 37.0));
          col += starCol * twinkle * 1.45 * smoothstep(-0.05, 0.2, dir.y);
        }

        // Distant glowing horizon sun/prism halo directly ahead (-Z)
        float forwardDot = max(dot(dir, normalize(vec3(0.0, 0.14, -1.0))), 0.0);
        float sunGlow = pow(forwardDot, 18.0);
        float sunDisc = smoothstep(0.994, 0.9965, forwardDot);
        col += mix(uAuroraB, uActiveColor, 0.5) * sunGlow * 0.28;
        col += mix(uAuroraA, uActiveColor, 0.5) * sunDisc * 0.65;

        col *= mix(0.45, 1.15, clamp(uBrightness, 0.25, 1.5));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createPrismTrackMaterial() {
  return new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uDistance: { value: 0 },
      uSpeedRatio: { value: 0.3 },
      uActiveColor: { value: new THREE.Color(0x00f0ff) },
      uTrackAccent: { value: new THREE.Color(0x00d9ff) },
      uFogColor: { value: new THREE.Color(0x0b1230) },
      uNova: { value: 0 },
      uPulse: { value: 0 },
      uBrightness: { value: 0.8 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uDistance;
      uniform float uSpeedRatio;
      uniform vec3 uActiveColor;
      uniform vec3 uTrackAccent;
      uniform vec3 uFogColor;
      uniform float uNova;
      uniform float uPulse;
      uniform float uBrightness;

      varying vec2 vUv;
      varying vec3 vWorldPos;

      float aaLine(float coord, float width) {
        float fw = max(fwidth(coord), 0.0005);
        return 1.0 - smoothstep(width - fw, width + fw, abs(coord));
      }

      vec3 hsl2rgb(float h, float s, float l) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
      }

      void main() {
        // Track spans X in [-9.6, 9.6], Z from +20 to -320
        float x = vWorldPos.x;
        float z = vWorldPos.z - uDistance;

        // Sleek dark obsidian-glass base with subtle lateral sheen
        float centerSheen = exp(-abs(x) * 0.14);
        vec3 baseCol = vec3(0.015, 0.022, 0.05) + uActiveColor * centerSheen * 0.045;

        // Anti-aliased scrolling grid lines
        float gx = abs(fract(x / 3.2 - 0.5) - 0.5);
        float gz = abs(fract(z / 8.0 - 0.5) - 0.5);
        float gridX = aaLine(gx, 0.016);
        float gridZ = aaLine(gz, 0.02);
        float grid = max(gridX, gridZ);

        // Lane divider lines at x = -2.7 and +2.7
        float laneA = aaLine(x + 2.7, 0.055);
        float laneB = aaLine(x - 2.7, 0.055);
        float lanes = max(laneA, laneB);

        // Outer neon plasma guard edges at |x| = 9.0
        float edgeDist = abs(abs(x) - 9.1);
        float edgeCore = smoothstep(0.28, 0.03, edgeDist);
        float edgeGlow = exp(-edgeDist * 1.4) * 0.7;

        // Animated forward energy chevrons along the center lane
        float chevronCoord = fract((z + abs(x) * 1.35) / 16.0);
        float chevron = smoothstep(0.14, 0.03, abs(chevronCoord - 0.5)) * smoothstep(5.5, 0.6, abs(x));

        // Phase shift radial pulse along Z
        float pulseWave = exp(-abs(mod(-vWorldPos.z + uTime * 45.0, 90.0) - 45.0) * 0.12) * uPulse;

        vec3 accent = mix(uTrackAccent, uActiveColor, 0.6);
        if (uNova > 0.01) {
          vec3 rainbow = hsl2rgb(fract(z * 0.02 + uTime * 0.6), 0.95, 0.56);
          accent = mix(accent, rainbow * 1.25, uNova * 0.85);
        }

        vec3 col = baseCol;
        float glowScale = clamp(uBrightness, 0.25, 1.5);
        col += accent * grid * (0.24 + uSpeedRatio * 0.22) * glowScale;
        col += mix(accent, vec3(1.0), 0.1) * lanes * 0.36 * glowScale;
        col += accent * chevron * (0.24 + uSpeedRatio * 0.38) * glowScale;
        col += mix(accent, vec3(1.0), 0.12) * (edgeCore * 0.92 + edgeGlow * 0.42) * glowScale;
        col += uActiveColor * pulseWave * 0.55 * glowScale;

        // Smooth distance horizon fog blend
        float dist = max(0.0, -vWorldPos.z + 10.0);
        float fogFactor = smoothstep(65.0, 290.0, dist);
        col = mix(col, uFogColor, fogFactor);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createEnergyShieldMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00f0ff) },
      uOpacity: { value: 0.35 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;

      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.5);
        float scan = 0.72 + 0.28 * sin(vUv.y * 42.0 - uTime * 8.0);
        float alpha = clamp(fresnel * scan * uOpacity, 0.0, 0.95);
        gl_FragColor = vec4(uColor * (1.2 + fresnel * 0.9), alpha);
      }
    `,
  });
}
