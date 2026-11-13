import * as THREE from 'three';

export interface AtmosphericSkyboxHandle {
  mesh: THREE.Mesh;
  uniforms: {
    uTime: { value: number };
    uHorizonColor: { value: THREE.Color };
    uMidSkyColor: { value: THREE.Color };
    uZenithColor: { value: THREE.Color };
    uMistGlowColor: { value: THREE.Color };
    uMoonDir: { value: THREE.Vector3 };
  };
  dispose: () => void;
}

/**
 * Crea un domo atmosférico procedural (Skybox) en GLSL coherente con la paleta
 * fría, nublada y nocturna de Aula 404 (#0c1315 horizonte / #0f2133 cielo / #050a14 cenit),
 * con nubes en movimiento lento, neblina baja en el horizonte y luna velada sutil.
 */
export function createAtmosphericSkybox(radius = 95): AtmosphericSkyboxHandle {
  const uniforms = {
    uTime: { value: 0 },
    uHorizonColor: { value: new THREE.Color('#0c1315') },
    uMidSkyColor: { value: new THREE.Color('#0e2030') },
    uZenithColor: { value: new THREE.Color('#050a14') },
    uMistGlowColor: { value: new THREE.Color('#1d384a') },
    uMoonDir: { value: new THREE.Vector3(-0.34, 0.44, -0.83).normalize() },
  };

  const vertexShader = /* glsl */ `
    varying vec3 vLocalDir;

    void main() {
      vLocalDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uHorizonColor;
    uniform vec3 uMidSkyColor;
    uniform vec3 uZenithColor;
    uniform vec3 uMistGlowColor;
    uniform vec3 uMoonDir;

    varying vec3 vLocalDir;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float valueNoise(vec2 p) {
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
      float sum = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 4; i++) {
        sum += amp * valueNoise(p);
        p = p * 2.07 + vec2(17.1, 31.7);
        amp *= 0.5;
      }
      return sum;
    }

    void main() {
      vec3 dir = normalize(vLocalDir);
      float h = clamp(dir.y, -0.25, 1.0);

      // Gradiente vertical frío integrado exactamente al color de niebla en el horizonte
      float skyLow = smoothstep(-0.02, 0.28, h);
      float skyHigh = smoothstep(0.24, 0.85, h);
      vec3 skyColor = mix(uHorizonColor, uMidSkyColor, skyLow);
      skyColor = mix(skyColor, uZenithColor, skyHigh);

      // Franja sutil de bruma fría sobre las copas de los árboles
      float mistBand = exp(-abs(max(h, 0.0) - 0.045) * 14.0) * smoothstep(-0.04, 0.04, h);
      skyColor += uMistGlowColor * (mistBand * 0.28);

      // Nubes tenues y bruma alta proyectadas sobre la cúpula celeste
      if (h > -0.02) {
        vec2 cloudUv = dir.xz / (max(h, 0.08) + 0.22);
        vec2 drift = vec2(uTime * 0.007, uTime * 0.003);
        float c1 = fbm(cloudUv * 1.35 + drift);
        float c2 = fbm(cloudUv * 2.8 - drift * 1.4);
        float clouds = smoothstep(0.42, 0.78, c1 * 0.72 + c2 * 0.28);
        float cloudFade = smoothstep(-0.01, 0.16, h);

        vec3 cloudCol = mix(vec3(0.09, 0.15, 0.20), vec3(0.16, 0.25, 0.32), c2);
        skyColor = mix(skyColor, cloudCol, clouds * cloudFade * 0.55);

        // Luna fría velada entre la neblina (luminosidad controlada para no quemar el Bloom)
        float moonDot = max(dot(dir, uMoonDir), 0.0);
        float moonCorona = pow(moonDot, 12.0) * 0.15 + pow(moonDot, 48.0) * 0.16;
        float moonDisc = smoothstep(0.9968, 0.9985, moonDot) * 0.34 * (1.0 - clouds * 0.62);
        vec3 moonTint = vec3(0.66, 0.82, 0.92);
        skyColor += moonTint * (moonCorona + moonDisc) * smoothstep(0.0, 0.12, h);

        // Estrellas muy tenues y dispersas en claros altos del cielo
        float starCell = hash21(floor(cloudUv * 42.0));
        float starMask = step(0.9945, starCell) * (1.0 - clouds) * smoothstep(0.22, 0.62, h);
        skyColor += vec3(0.48, 0.62, 0.72) * (starMask * 0.22);
      }

      // Mezcla inferior exacta hacia el color de la niebla para evitar costuras por debajo del horizonte
      skyColor = mix(uHorizonColor, skyColor, smoothstep(-0.06, 0.04, h));

      gl_FragColor = vec4(skyColor, 1.0);
    }
  `;

  const geometry = new THREE.SphereGeometry(radius, 36, 22);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;

  return {
    mesh,
    uniforms,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
