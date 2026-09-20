import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const SIZE = 2048;
const canvas = document.getElementById('render');
const status = document.getElementById('status');
const save = document.getElementById('save');
const palette = document.getElementById('palette');
const layout = document.getElementById('layout');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE, false);
renderer.setPixelRatio(1);
renderer.setClearColor(0xffffff, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1.82, 1.82, 1.82, -1.82, 0.01, 20);
camera.position.set(0, 0, 7);
camera.lookAt(0, 0, 0);
const room = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(room, 0.035).texture;
scene.environmentIntensity = 0.65;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xe5f3ff, 0xd4d6e8, 1.0));
const key = new THREE.DirectionalLight(0xfff9f2, 2.2);
key.position.set(-3, 4, 6);
scene.add(key);
const fill = new THREE.DirectionalLight(0xc4eaff, .65);
fill.position.set(4, 1, 4);
scene.add(fill);
const bottom = new THREE.DirectionalLight(0xe5cfff, 0.35);
bottom.position.set(0, -4, 3);
scene.add(bottom);

function squircle(radius, power = 4.5) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 256; i++) {
    const a = i / 256 * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const x = radius * Math.sign(c) * Math.abs(c) ** (2 / power);
    const y = radius * Math.sign(s) * Math.abs(s) ** (2 / power);
    i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  shape.closePath();
  return shape;
}

const tileGeometry = new THREE.ExtrudeGeometry(squircle(1.42), {
  depth: 0.11, bevelEnabled: true, bevelSegments: 12, steps: 1,
  bevelSize: 0.09, bevelThickness: 0.09, curveSegments: 64,
});
tileGeometry.translate(0, 0, -0.15);
const tile = new THREE.Mesh(tileGeometry, new THREE.MeshPhysicalMaterial({
  color: 0xf4f6fa, roughness: 0.33, metalness: 0,
  clearcoat: 0.4, clearcoatRoughness: 0.32, specularIntensity: 0.4,
}));
scene.add(tile);

function makeRibbon() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.14, -.55);
  shape.bezierCurveTo(-1.08, -.28, -.96, .23, -.86, .49);
  shape.bezierCurveTo(-.80, .66, -.71, .75, -.56, .75);
  shape.bezierCurveTo(-.40, .75, -.29, .64, -.23, .47);
  shape.lineTo(-.075, .015);
  shape.bezierCurveTo(-.045, -.075, .045, -.075, .075, .015);
  shape.lineTo(.23, .47);
  shape.bezierCurveTo(.29, .64, .40, .75, .56, .75);
  shape.bezierCurveTo(.71, .75, .80, .66, .86, .49);
  shape.bezierCurveTo(.96, .23, 1.08, -.28, 1.14, -.55);
  shape.bezierCurveTo(1.21, -.84, .83, -.94, .75, -.64);
  shape.lineTo(.56, .075);
  shape.bezierCurveTo(.55, .125, .51, .14, .49, .075);
  shape.lineTo(.29, -.43);
  shape.bezierCurveTo(.235, -.595, .13, -.67, 0, -.67);
  shape.bezierCurveTo(-.13, -.67, -.235, -.595, -.29, -.43);
  shape.lineTo(-.49, .075);
  shape.bezierCurveTo(-.51, .14, -.55, .125, -.56, .075);
  shape.lineTo(-.75, -.64);
  shape.bezierCurveTo(-.83, -.94, -1.21, -.84, -1.14, -.55);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .10, steps: 1, bevelEnabled: true,
    bevelSize: .042, bevelThickness: .067, bevelSegments: 14,
    curveSegments: 64,
  });
  geometry.translate(0, .04, .22);
  const positions = geometry.attributes.position;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.count * 3).fill(1), 3));
  return geometry;
}

const material = new THREE.MeshPhysicalMaterial({
  vertexColors: true, roughness: .24, metalness: .0,
  transmission: .20, thickness: .28, ior: 1.37,
  attenuationColor: 0xeaf5ff, attenuationDistance: 2.4,
  clearcoat: .65, clearcoatRoughness: .19,
  iridescence: .1, iridescenceIOR: 1.3,
  iridescenceThicknessRange: [180, 310],
  envMapIntensity: .85, side: THREE.FrontSide,
});
const ribbon = new THREE.Mesh(makeRibbon(), material);
ribbon.layers.enable(1);
scene.add(ribbon);

// The shadow is projected from the actual 3D mesh, then blurred in two passes.
const shadowSize = 1024;
const targetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
const mask = new THREE.WebGLRenderTarget(shadowSize, shadowSize, { ...targetOptions, depthBuffer: true });
const blurA = new THREE.WebGLRenderTarget(shadowSize, shadowSize, targetOptions);
const blurB = new THREE.WebGLRenderTarget(shadowSize, shadowSize, targetOptions);
const shadowCamera = new THREE.OrthographicCamera(-1.82, 1.82, 1.82, -1.82, .01, 20);
shadowCamera.position.set(0, 0, 7);
shadowCamera.layers.set(1);
const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
scene.overrideMaterial = maskMaterial;
renderer.setClearColor(0x000000, 0);
renderer.setRenderTarget(mask);
renderer.render(scene, shadowCamera);
scene.overrideMaterial = null;

const blurMaterial = new THREE.ShaderMaterial({
  uniforms: { inputTexture: { value: mask.texture }, direction: { value: new THREE.Vector2() } },
  vertexShader: 'varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `uniform sampler2D inputTexture; uniform vec2 direction; varying vec2 uv0;
    void main(){ vec4 c=vec4(0.); float total=0.;
      for(int i=-16;i<=16;i++){float f=float(i);float w=exp(-f*f/72.);c+=texture2D(inputTexture,uv0+direction*f)*w;total+=w;}
      gl_FragColor=c/total; }`,
  depthTest: false, depthWrite: false,
});
const blurScene = new THREE.Scene();
blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial));
const blurCamera = new THREE.Camera();
blurMaterial.uniforms.direction.value.set(1 / shadowSize, 0);
renderer.setRenderTarget(blurA);
renderer.render(blurScene, blurCamera);
blurMaterial.uniforms.inputTexture.value = blurA.texture;
blurMaterial.uniforms.direction.value.set(0, 1 / shadowSize);
renderer.setRenderTarget(blurB);
renderer.render(blurScene, blurCamera);
renderer.setRenderTarget(null);
renderer.setClearColor(0xffffff, 0);

const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.64, 3.64), new THREE.MeshBasicMaterial({
  map: blurB.texture, color: 0x6684a4, transparent: true, opacity: .23, depthWrite: false, toneMapped: false,
}));
shadow.position.set(.045, -.07, .058);
scene.add(shadow);

function paintRibbon(mode) {
  const stops = mode === 'opal'
    ? [[0, '#54cdeb'], [.35, '#7887ed'], [.66, '#b17bdf'], [1, '#f0a1b1']]
    : [[0, '#11abdc'], [.40, '#077fd9'], [.72, '#536ede'], [1, '#9565d6']];
  const positions = ribbon.geometry.attributes.position;
  const colors = ribbon.geometry.attributes.color;
  const color = new THREE.Color(), a = new THREE.Color(), b = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = THREE.MathUtils.clamp((positions.getX(i) + 1.18) / 2.36, 0, 1);
    const k = Math.min(stops.length - 2, stops.findIndex((s, j) => j < stops.length - 1 && x <= stops[j + 1][0]));
    const lo = stops[Math.max(0, k)], hi = stops[Math.max(0, k) + 1];
    color.copy(a.set(lo[1])).lerp(b.set(hi[1]), (x - lo[0]) / (hi[0] - lo[0]));
    colors.setXYZ(i, color.r, color.g, color.b);
  }
  colors.needsUpdate = true;
}

function draw() {
  paintRibbon(palette.value);
  tile.visible = layout.value === 'tile';
  shadow.visible = tile.visible;
  renderer.render(scene, camera);
  save.disabled = false;
  status.textContent = '2048 × 2048 · PNG';
}
palette.addEventListener('change', draw);
layout.addEventListener('change', draw);
save.addEventListener('click', async () => {
  save.disabled = true;
  status.textContent = '正在导出…';
  try {
    renderer.render(scene, camera);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG 编码失败');
    const name = `mahjoffg-${palette.value}-${layout.value}-v1.png`;
    const response = await fetch(`/export/${name}`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
    if (!response.ok) throw new Error(`导出失败 (${response.status})`);
    const result = await response.json();
    status.textContent = `已保存：${name}`;
    canvas.dataset.savedPath = result.saved;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    save.disabled = false;
  }
});
draw();
