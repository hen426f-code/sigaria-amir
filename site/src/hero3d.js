import * as THREE from 'three';

function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.5)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeGradientBG() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0a0c14');
  g.addColorStop(0.4, '#11141f');
  g.addColorStop(0.7, '#161a28');
  g.addColorStop(1, '#0a0c14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  return new THREE.CanvasTexture(c);
}

function buildVapeDevice(accentColor) {
  const group = new THREE.Group();

  // Body — tall rounded box using BoxGeometry with many segments for smooth normals
  const bodyGeo = new THREE.BoxGeometry(1.0, 4.0, 0.6, 8, 24, 8);
  // Round the edges by pushing vertices toward rounded shape
  const pos = bodyGeo.attributes.position;
  const rounded = new Float32Array(pos.array.length);
  const radius = 0.28;
  const halfW = 0.5, halfH = 2.0, halfD = 0.3;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Compute rounded box SDF-like push
    const qx = Math.abs(x) - (halfW - radius);
    const qy = Math.abs(y) - (halfH - radius);
    const qz = Math.abs(z) - (halfD - radius);
    let nx = x, ny = y, nz = z;
    if (qx > 0 && qy > 0 && qz > 0) {
      const len = Math.sqrt(qx * qx + qy * qy + qz * qz);
      const sx = Math.sign(x), sy = Math.sign(y), sz = Math.sign(z);
      nx = sx * (halfW - radius + (qx / len) * radius);
      ny = sy * (halfH - radius + (qy / len) * radius);
      nz = sz * (halfD - radius + (qz / len) * radius);
    } else if (qx > 0 && qy > 0) {
      const len = Math.sqrt(qx * qx + qy * qy);
      nx = Math.sign(x) * (halfW - radius + (qx / len) * radius);
      ny = Math.sign(y) * (halfH - radius + (qy / len) * radius);
    } else if (qx > 0 && qz > 0) {
      const len = Math.sqrt(qx * qx + qz * qz);
      nx = Math.sign(x) * (halfW - radius + (qx / len) * radius);
      nz = Math.sign(z) * (halfD - radius + (qz / len) * radius);
    } else if (qy > 0 && qz > 0) {
      const len = Math.sqrt(qy * qy + qz * qz);
      ny = Math.sign(y) * (halfH - radius + (qy / len) * radius);
      nz = Math.sign(z) * (halfD - radius + (qz / len) * radius);
    }
    rounded[i * 3] = nx;
    rounded[i * 3 + 1] = ny;
    rounded[i * 3 + 2] = nz;
  }
  bodyGeo.setAttribute('position', new THREE.BufferAttribute(rounded, 3));
  bodyGeo.computeVertexNormals();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1d2e,
    metalness: 0.6,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    sheen: 0.3,
    sheenColor: 0x2a3045,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Accent color panel on front face
  const panelGeo = new THREE.PlaneGeometry(0.7, 3.2);
  const panelMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    metalness: 0.5,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    emissive: accentColor,
    emissiveIntensity: 0.25,
  });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.set(0, -0.1, 0.301);
  group.add(panel);

  // Brand text area (dark glossy strip)
  const stripGeo = new THREE.PlaneGeometry(0.6, 0.8);
  const stripMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0c14,
    metalness: 0.9,
    roughness: 0.08,
    clearcoat: 1.0,
  });
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.position.set(0, 0.8, 0.302);
  group.add(strip);

  // Mouthpiece — using LatheGeometry for smooth tapered shape
  const mouthPoints = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = t * 0.7;
    const r = 0.18 + (1 - t) * 0.08;
    mouthPoints.push(new THREE.Vector2(r, y));
  }
  const mouthGeo = new THREE.LatheGeometry(mouthPoints, 32);
  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0c14,
    metalness: 0.5,
    roughness: 0.3,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
  });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.y = 2.35;
  group.add(mouth);

  // Mouthpiece opening
  const holeGeo = new THREE.CircleGeometry(0.1, 24);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 1, side: THREE.DoubleSide });
  const hole = new THREE.Mesh(holeGeo, holeMat);
  hole.position.set(0, 3.05, 0);
  hole.rotation.x = Math.PI / 2;
  group.add(hole);

  // LED indicator
  const ledGeo = new THREE.CircleGeometry(0.08, 24);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 3,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, -1.6, 0.301);
  group.add(led);

  // LED glow halo
  const haloGeo = new THREE.CircleGeometry(0.2, 24);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.set(0, -1.6, 0.3);
  group.add(halo);

  // Bottom cap
  const capGeo = new THREE.BoxGeometry(1.05, 0.2, 0.62, 4, 2, 4);
  const capPos = capGeo.attributes.position;
  const capRounded = new Float32Array(capPos.array.length);
  const cR = 0.1;
  const cHW = 0.525, cHH = 0.1, cHD = 0.31;
  for (let i = 0; i < capPos.count; i++) {
    const x = capPos.getX(i), y = capPos.getY(i), z = capPos.getZ(i);
    const qx = Math.abs(x) - (cHW - cR);
    const qy = Math.abs(y) - (cHH - cR);
    const qz = Math.abs(z) - (cHD - cR);
    let nx = x, ny = y, nz = z;
    if (qx > 0 && qy > 0 && qz > 0) {
      const len = Math.sqrt(qx * qx + qy * qy + qz * qz);
      nx = Math.sign(x) * (cHW - cR + (qx / len) * cR);
      ny = Math.sign(y) * (cHH - cR + (qy / len) * cR);
      nz = Math.sign(z) * (cHD - cR + (qz / len) * cR);
    }
    capRounded[i * 3] = nx;
    capRounded[i * 3 + 1] = ny;
    capRounded[i * 3 + 2] = nz;
  }
  capGeo.setAttribute('position', new THREE.BufferAttribute(capRounded, 3));
  capGeo.computeVertexNormals();
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0c14, metalness: 0.9, roughness: 0.12, clearcoat: 1.0 });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = -2.1;
  group.add(cap);

  return group;
}

export function initHero3D(container) {
  if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
  try {
    const testCanvas = document.createElement('canvas');
    const testGl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!testGl) return;
  } catch (e) { return; }

  const scene = new THREE.Scene();

  // Gradient background sphere
  const bgTex = makeGradientBG();
  const bgGeo = new THREE.SphereGeometry(50, 32, 16);
  const bgMat = new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.BackSide, fog: false });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  scene.add(bg);

  // Subtle fog for depth
  scene.fog = new THREE.Fog(0x0a0c14, 16, 42);

  const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0.5, 11);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Studio lighting setup
  const ambient = new THREE.AmbientLight(0x4a5680, 0.5);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(5, 8, 10);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x6090e0, 0.7);
  fillLight.position.set(-8, 3, 6);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x14b8a6, 0.6);
  rimLight.position.set(-2, -2, -8);
  scene.add(rimLight);

  const accentLight = new THREE.PointLight(0xf59e0b, 0.6, 15);
  accentLight.position.set(4, -2, 3);
  scene.add(accentLight);

  const topLight = new THREE.PointLight(0xffffff, 0.6, 20);
  topLight.position.set(0, 8, 4);
  scene.add(topLight);

  // Main vape device
  const vape = buildVapeDevice(0x2563eb);
  vape.position.set(1.8, 0, 0);
  vape.rotation.z = 0.06;
  scene.add(vape);

  // Second device — teal accent
  const vape2 = buildVapeDevice(0x0d9488);
  vape2.position.set(-3.8, -1.2, -2.5);
  vape2.scale.setScalar(0.55);
  vape2.rotation.z = -0.1;
  vape2.rotation.y = 0.35;
  scene.add(vape2);

  // Third device — amber accent, far background
  const vape3 = buildVapeDevice(0xf59e0b);
  vape3.position.set(3.5, 2, -5);
  vape3.scale.setScalar(0.4);
  vape3.rotation.z = 0.15;
  vape3.rotation.y = -0.2;
  scene.add(vape3);

  // === Smoke particle system ===
  const smokeTex = makeSmokeTexture();
  const smokeCount = 250;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(smokeCount * 3);
  const smokeVel = new Float32Array(smokeCount * 3);
  const smokeLife = new Float32Array(smokeCount);
  const smokeSize = new Float32Array(smokeCount);
  const smokeAlpha = new Float32Array(smokeCount);
  const smokeSeed = new Float32Array(smokeCount);

  function resetParticle(i) {
    smokePos[i * 3] = 1.8 + (Math.random() - 0.5) * 0.15;
    smokePos[i * 3 + 1] = 3.1 + Math.random() * 0.2;
    smokePos[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    smokeVel[i * 3] = (Math.random() - 0.5) * 0.004;
    smokeVel[i * 3 + 1] = 0.01 + Math.random() * 0.012;
    smokeVel[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
    smokeLife[i] = 0;
    smokeSize[i] = 0.4 + Math.random() * 0.3;
    smokeSeed[i] = Math.random() * 1000;
  }

  for (let i = 0; i < smokeCount; i++) {
    resetParticle(i);
    smokeLife[i] = Math.random() * 4;
    smokeAlpha[i] = 0;
  }

  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeSize, 1));
  smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(smokeAlpha, 1));

  const smokeMat = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: smokeTex },
    },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * 320.0 / -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        vec3 smokeColor = vec3(0.7, 0.75, 0.85);
        gl_FragColor = vec4(smokeColor, tex.a * vAlpha * 0.4);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const smoke = new THREE.Points(smokeGeo, smokeMat);
  scene.add(smoke);

  // Mouse parallax
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  function onMouseMove(e) {
    const rect = container.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  window.addEventListener('mousemove', onMouseMove);

  function onTouch(e) {
    if (e.touches.length > 0) {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
    }
  }
  window.addEventListener('touchmove', onTouch, { passive: true });

  function onResize() {
    if (container.clientWidth === 0 || container.clientHeight === 0) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  let frameId;

  function animate() {
    frameId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Camera parallax
    targetX += (mouseX * 0.4 - targetX) * 0.03;
    targetY += (mouseY * 0.25 - targetY) * 0.03;
    camera.position.x = targetX * 1.2;
    camera.position.y = 0.5 + targetY * 0.8;
    camera.lookAt(0, 0, 0);

    // Float and rotate main device
    vape.position.y = Math.sin(t * 0.4) * 0.15;
    vape.rotation.y = Math.sin(t * 0.25) * 0.12;
    vape.rotation.z = 0.06 + Math.sin(t * 0.35) * 0.02;

    // Float second device
    vape2.position.y = -1.2 + Math.sin(t * 0.35 + 1) * 0.12;
    vape2.rotation.y = 0.35 + Math.sin(t * 0.2) * 0.08;

    // Float third device
    vape3.position.y = 2 + Math.sin(t * 0.3 + 2) * 0.1;
    vape3.rotation.y = -0.2 + Math.sin(t * 0.22) * 0.06;

    // Update smoke particles
    const posAttr = smokeGeo.getAttribute('position');
    const alphaAttr = smokeGeo.getAttribute('alpha');
    const sizeAttr = smokeGeo.getAttribute('size');
    for (let i = 0; i < smokeCount; i++) {
      smokeLife[i] += 0.012;
      if (smokeLife[i] > 4.5) {
        resetParticle(i);
      }
      // Turbulent motion
      const seed = smokeSeed[i];
      const turb = Math.sin(t * 0.8 + seed) * 0.003;
      smokeVel[i * 3] += turb;
      smokeVel[i * 3 + 2] += Math.cos(t * 0.6 + seed) * 0.003;
      // Damping
      smokeVel[i * 3] *= 0.992;
      smokeVel[i * 3 + 2] *= 0.992;
      // Apply velocity
      smokePos[i * 3] += smokeVel[i * 3];
      smokePos[i * 3 + 1] += smokeVel[i * 3 + 1];
      smokePos[i * 3 + 2] += smokeVel[i * 3 + 2];
      // Expand upward
      smokeVel[i * 3 + 1] *= 0.998;
      // Fade in then out
      const life = smokeLife[i];
      const a = life < 0.8 ? life / 0.8 : Math.max(0, 1 - (life - 0.8) / 3.7);
      smokeAlpha[i] = a;
      smokeSize[i] = 0.4 + life * 0.2;
    }
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onTouch);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  };
}
