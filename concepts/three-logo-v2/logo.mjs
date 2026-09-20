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
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1.82, 1.82, 1.82, -1.82, 0.01, 20);
camera.position.set(0, 0, 7);
camera.lookAt(0, 0, 0);
const room = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(room, 0.035).texture;
scene.environmentIntensity = 0.55;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xe5f3ff, 0xd4d6e8, .65));
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
  const segments = 640, sides = 64;
  const positions = [], colors = [], indices = [], progresses = [];
  const point = t => {
    const a = -.35 + t * 5.42;
    const r = .70 * (1 + .10 * Math.cos(a - .8) - .10 * Math.sin(2 * a));
    const tail = Math.max(0, (t - .83) / .17);
    const x = r * Math.cos(a) * 1.1 + .15 * tail * tail;
    const y = r * Math.sin(a) * 1.03 - .07 * tail;
    const rotation = -.22;
    return new THREE.Vector3(x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation), .38 + .17 * Math.sin(a + .8) + .06 * Math.sin(2*a));
  };
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = point(t);
    const tangent = point(Math.min(1,t+.0001)).sub(point(Math.max(0,t-.0001))).normalize();
    const n = new THREE.Vector3(tangent.y,-tangent.x,0).normalize();
    const b = new THREE.Vector3().crossVectors(tangent,n).normalize();
    const twist = .75 * Math.sin(t * Math.PI * 2 - .65) + .22;
    const nr = n.clone().multiplyScalar(Math.cos(twist)).addScaledVector(b,Math.sin(twist));
    const br = b.clone().multiplyScalar(Math.cos(twist)).addScaledVector(n,-Math.sin(twist));
    const f = Math.min(1,t/.036,(1-t)/.036);
    const cap = Math.sqrt(Math.max(.000001,1-(1-f)**2));
    const width = (.24 + .052 * Math.sin(Math.PI*t) + .018 * Math.cos(t*Math.PI*4)) * cap;
    const depth = .086 * cap;
    for(let j=0;j<=sides;j++) {
      const angle = j/sides*Math.PI*2, c = Math.cos(angle), s = Math.sin(angle);
      const v = p.clone().addScaledVector(nr,Math.sign(c)*Math.abs(c)**.8*width).addScaledVector(br,Math.sign(s)*Math.abs(s)**.8*depth);
      positions.push(v.x,v.y,v.z);colors.push(1,1,1);progresses.push(t);
      if(i<segments && j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('progress',new THREE.Float32BufferAttribute(progresses,1));
  g.setIndex(indices);g.computeVertexNormals();
  const normals=g.attributes.normal;
  for(let i=0;i<=segments;i++) {
    const a=i*(sides+1),b=a+sides;
    const v=new THREE.Vector3().fromBufferAttribute(normals,a).add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();
    normals.setXYZ(a,v.x,v.y,v.z);normals.setXYZ(b,v.x,v.y,v.z);
  }
  return g;
}

const material = new THREE.MeshPhysicalMaterial({
  vertexColors: true, roughness: .22, metalness: .12,
  transmission: .07, thickness: .28, ior: 1.37,
  attenuationColor: 0xeaf5ff, attenuationDistance: 2.4,
  clearcoat: .65, clearcoatRoughness: .19,
  iridescence: .0, iridescenceIOR: 1.3,
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
  const dark = mode === 'opal';
  const colors = ribbon.geometry.attributes.color;
  const progress = ribbon.geometry.attributes.progress;
  const a = new THREE.Color(dark ? '#7beaff' : '#1649ff');
  const b = new THREE.Color(dark ? '#b6f9ff' : '#0532c9');
  const accent = new THREE.Color(dark ? '#f8ff75' : '#d6fa3d');
  const color = new THREE.Color();
  for (let i=0;i<colors.count;i++) {
    const t=progress.getX(i);
    color.copy(a).lerp(b,.5+.5*Math.sin(t*Math.PI*2));
    if(t>.90) color.lerp(accent,THREE.MathUtils.smoothstep(t,.90,.93));
    colors.setXYZ(i,color.r,color.g,color.b);
  }
  colors.needsUpdate=true;
  tile.material.color.set(dark ? '#111c2b' : '#f5f7fb');
  tile.material.roughness=dark ? .36 : .28;
  tile.material.emissive.set(dark ? '#04080d' : '#ffffff');
  tile.material.emissiveIntensity=dark ? .05 : .07;
  material.transmission=dark ? .24 : .07;
  material.roughness=dark ? .19 : .23;
  material.metalness=dark ? .08 : .12;
  shadow.material.opacity=dark ? .4 : .21;
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
    const name = `mahjoffg-${palette.value}-${layout.value}-v2.png`;
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
