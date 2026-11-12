import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BookOpen, ChevronDown, ChevronUp, Coins, RotateCw, X } from 'lucide-react';
import {
  GACHA_CATALOG,
  GACHA_SPIN_COST,
  GachaCollectibleItem,
  GachaItemArtwork,
  rollGachaCollectible,
} from '../data/gachaCatalog';
import { soundEngine } from '../lib/soundEngine';

interface Gachapon3DModalProps {
  isOpen: boolean;
  initialTab?: 'machine' | 'zukan';
  coins: number;
  unlockedItemIds: string[];
  onSpinComplete: (result: {
    item: GachaCollectibleItem;
    isNew: boolean;
    nextCoins: number;
    nextUnlockedIds: string[];
  }) => void;
  onClose: () => void;
}

type SpinPhase = 'idle' | 'cranking' | 'dropping' | 'opening' | 'revealed';

// Module-scope reusable math helpers — zero per-frame allocations
const _dummy = new THREE.Object3D();
const _starColor = new THREE.Color();

const DOME_CAPSULE_PALETTE: Array<[number, number]> = [
  [0x5fa87a, 0xfffdf8],
  [0xe57a77, 0xfff8ec],
  [0xe8a838, 0xfffdf8],
  [0x76b5c5, 0xfffdf8],
  [0xd88b4b, 0xfdf2e4],
  [0x6f9ceb, 0xfaf5ec],
  [0xdf9a57, 0xffeab6],
];

function createWoodCanvasTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#DFB687';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 3) {
      const wave = Math.sin(y * 0.09) * 8;
      ctx.fillStyle = y % 6 === 0 ? 'rgba(164, 112, 62, 0.16)' : 'rgba(255, 245, 228, 0.14)';
      ctx.fillRect(0, y + wave * 0.15, 256, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 122);
    grad.addColorStop(0, 'rgba(66, 48, 32, 0.42)');
    grad.addColorStop(0.55, 'rgba(66, 48, 32, 0.16)');
    grad.addColorStop(1, 'rgba(66, 48, 32, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface InteriorBall {
  group: THREE.Group;
  basePos: THREE.Vector3;
  phaseOffset: number;
  rotSpeed: THREE.Vector3;
}

interface StarBurstParticle {
  dir: THREE.Vector3;
  speed: number;
  spin: number;
  colorHex: number;
}

export const Gachapon3DModal: React.FC<Gachapon3DModalProps> = ({
  isOpen,
  initialTab = 'machine',
  coins,
  unlockedItemIds,
  onSpinComplete,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'machine' | 'zukan'>(initialTab);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [spinPhase, setSpinPhase] = useState<SpinPhase>('idle');
  const [revealedResult, setRevealedResult] = useState<{
    item: GachaCollectibleItem;
    isNew: boolean;
  } | null>(null);
  const [selectedZukanItem, setSelectedZukanItem] = useState<GachaCollectibleItem | null>(null);
  const [webglFallback, setWebglFallback] = useState(false);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const trigger3DSpinRef = useRef<((item: GachaCollectibleItem, isNew: boolean) => void) | null>(
    null
  );
  const resetHeroCapsuleRef = useRef<(() => void) | null>(null);

  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;
  const coinsRef = useRef(coins);
  coinsRef.current = coins;
  const unlockedRef = useRef(unlockedItemIds);
  unlockedRef.current = unlockedItemIds;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'machine') return;
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL guard from GPU renderer string (never user agent)
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(res: T): T => {
      disposables.push(res);
      return res;
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaf5ec);
    scene.fog = new THREE.Fog(0xfaf5ec, 9.5, 24);

    // 2. Studio Environment Map (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    disposables.push(envTarget);
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 60);
    camera.position.set(0, 2.35, 6.35);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.55, 0.15);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.2;
    controls.maxDistance = 8.8;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minAzimuthAngle = -Math.PI * 0.38;
    controls.maxAzimuthAngle = Math.PI * 0.38;
    controls.update();

    // 3. Balanced 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xfff9ee, 0xd8eadc, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.55);
    keyLight.position.set(3.8, 6.4, 4.6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -3.2;
    keyLight.shadow.camera.right = 3.2;
    keyLight.shadow.camera.top = 4.2;
    keyLight.shadow.camera.bottom = -1.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd9f2e4, 0.72);
    rimLight.position.set(-4.2, 4.2, -3.5);
    scene.add(rimLight);

    // Ground meadow stage & radial contact shadow (offset >= 0.02 to prevent Z-fighting)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const woodTex = track(createWoodCanvasTexture(maxAniso));
    const shadowTex = track(createContactShadowTexture());

    const stageGeo = track(new THREE.CylinderGeometry(3.5, 3.7, 0.18, 48));
    const stageMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xf1e7d5,
        roughness: 0.88,
        metalness: 0.02,
      })
    );
    const stageMesh = new THREE.Mesh(stageGeo, stageMat);
    stageMesh.position.y = -0.09;
    stageMesh.receiveShadow = true;
    scene.add(stageMesh);

    const shadowGeo = track(new THREE.PlaneGeometry(3.4, 3.4));
    const shadowMat = track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      })
    );
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.006;
    scene.add(shadowPlane);

    // =========================================================================
    // 4. Composite 11-Part Procedural Gachapon Machine (`THREE.Group`)
    // =========================================================================
    const machineGroup = new THREE.Group();
    scene.add(machineGroup);

    const woodMat = track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.68,
        metalness: 0.05,
      })
    );
    const bodyApricotMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xe38149,
        roughness: 0.36,
        metalness: 0.08,
      })
    );
    const leafCollarMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x3b895f,
        roughness: 0.42,
        metalness: 0.08,
      })
    );
    const creamPanelMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfffaf0,
        roughness: 0.52,
        metalness: 0.04,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const brassMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xe6b655,
        roughness: 0.2,
        metalness: 0.9,
        clearcoat: 0.35,
      })
    );
    const chuteDarkMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x47392e,
        roughness: 0.75,
        metalness: 0.15,
      })
    );
    const chuteFlapMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xd8d2c7,
        roughness: 0.28,
        metalness: 0.72,
      })
    );

    // Part 1: Turned Wooden Base Plinth + Front Catch Tray
    const plinthGeo = track(new THREE.CylinderGeometry(1.16, 1.24, 0.22, 40));
    const plinth = new THREE.Mesh(plinthGeo, woodMat);
    plinth.position.y = 0.11;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    machineGroup.add(plinth);

    const trayGeo = track(new THREE.BoxGeometry(0.92, 0.12, 0.72));
    const catchTray = new THREE.Mesh(trayGeo, woodMat);
    catchTray.position.set(0, 0.08, 1.18);
    catchTray.castShadow = true;
    catchTray.receiveShadow = true;
    machineGroup.add(catchTray);

    const trayRimGeo = track(new THREE.BoxGeometry(0.98, 0.18, 0.1));
    const catchTrayRim = new THREE.Mesh(trayRimGeo, woodMat);
    catchTrayRim.position.set(0, 0.12, 1.5);
    catchTrayRim.castShadow = true;
    machineGroup.add(catchTrayRim);

    // Part 2: Chamfered Apricot Cabinet Body (`LatheGeometry`)
    const bodyPoints = [
      new THREE.Vector2(0.0, 0.22),
      new THREE.Vector2(1.04, 0.22),
      new THREE.Vector2(1.08, 0.3),
      new THREE.Vector2(0.98, 1.38),
      new THREE.Vector2(0.92, 1.48),
      new THREE.Vector2(0.0, 1.48),
    ];
    const bodyGeo = track(new THREE.LatheGeometry(bodyPoints, 40));
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyApricotMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    machineGroup.add(bodyMesh);

    // Part 3: Front Cream Mechanical Dial Plate
    const dialPlateGeo = track(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 32));
    const dialPlate = new THREE.Mesh(dialPlateGeo, creamPanelMat);
    dialPlate.rotation.x = Math.PI / 2;
    dialPlate.position.set(0, 0.96, 0.99);
    dialPlate.castShadow = true;
    machineGroup.add(dialPlate);

    // Part 4: Brushed Brass Coin Slot Bezel (top-right of dial)
    const coinSlotGeo = track(new THREE.BoxGeometry(0.16, 0.22, 0.08));
    const coinSlot = new THREE.Mesh(coinSlotGeo, brassMat);
    coinSlot.position.set(0.32, 1.18, 0.98);
    machineGroup.add(coinSlot);

    // Part 5: 360°-Rotatable Brushed Brass Crank Handle (`THREE.Group`)
    const crankPivot = new THREE.Group();
    crankPivot.position.set(0, 0.96, 1.05);
    machineGroup.add(crankPivot);

    const crankHubGeo = track(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 24));
    const crankHub = new THREE.Mesh(crankHubGeo, brassMat);
    crankHub.rotation.x = Math.PI / 2;
    crankHub.castShadow = true;
    crankPivot.add(crankHub);

    const crankBarGeo = track(new THREE.BoxGeometry(0.64, 0.11, 0.09));
    const crankBar = new THREE.Mesh(crankBarGeo, brassMat);
    crankBar.position.z = 0.07;
    crankBar.castShadow = true;
    crankPivot.add(crankBar);

    const crankWingGeo = track(new THREE.BoxGeometry(0.12, 0.22, 0.14));
    const leftWing = new THREE.Mesh(crankWingGeo, brassMat);
    leftWing.position.set(-0.26, 0, 0.09);
    const rightWing = new THREE.Mesh(crankWingGeo, brassMat);
    rightWing.position.set(0.26, 0, 0.09);
    crankPivot.add(leftWing, rightWing);

    // Part 6: Dispenser Chute Recess & Swinging Metal Flap
    const chuteHoleGeo = track(new THREE.BoxGeometry(0.52, 0.36, 0.18));
    const chuteHole = new THREE.Mesh(chuteHoleGeo, chuteDarkMat);
    chuteHole.position.set(0, 0.42, 0.98);
    machineGroup.add(chuteHole);

    const flapPivot = new THREE.Group();
    flapPivot.position.set(0, 0.58, 1.04);
    machineGroup.add(flapPivot);

    const flapGeo = track(new THREE.BoxGeometry(0.46, 0.3, 0.03));
    const flapMesh = new THREE.Mesh(flapGeo, chuteFlapMat);
    flapMesh.position.y = -0.15;
    flapPivot.add(flapMesh);

    // Part 7: Leaf-Green Upper Collar Ring
    const collarGeo = track(new THREE.CylinderGeometry(1.02, 0.96, 0.16, 40));
    const collarMesh = new THREE.Mesh(collarGeo, leafCollarMat);
    collarMesh.position.y = 1.54;
    collarMesh.castShadow = true;
    machineGroup.add(collarMesh);

    // Part 8: Interior Capsules Swirling Inside the Dome (14 two-tone spheres)
    const capsuleTopGeo = track(
      new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
    );
    const capsuleBotGeo = track(
      new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5)
    );
    const capsuleBandGeo = track(new THREE.TorusGeometry(0.22, 0.016, 8, 24));

    const interiorBalls: InteriorBall[] = [];
    const ballLayouts: Array<[number, number, number]> = [
      [-0.45, 1.88, 0.38],
      [0.44, 1.86, 0.4],
      [0.0, 1.82, 0.58],
      [-0.56, 1.92, -0.22],
      [0.54, 1.9, -0.24],
      [0.02, 1.86, -0.54],
      [-0.22, 1.85, 0.05],
      [0.24, 1.95, 0.02],
      [-0.36, 2.28, 0.22],
      [0.35, 2.26, 0.24],
      [0.0, 2.25, -0.34],
      [-0.32, 2.3, -0.22],
      [0.3, 2.34, -0.18],
      [0.02, 2.38, 0.16],
    ];

    ballLayouts.forEach((pos, idx) => {
      const [topHex, botHex] = DOME_CAPSULE_PALETTE[idx % DOME_CAPSULE_PALETTE.length];
      const topMat = track(
        new THREE.MeshPhysicalMaterial({
          color: topHex,
          roughness: 0.22,
          metalness: 0.05,
          clearcoat: 0.65,
        })
      );
      const botMat = track(
        new THREE.MeshStandardMaterial({
          color: botHex,
          roughness: 0.34,
          metalness: 0.02,
        })
      );
      const g = new THREE.Group();
      const topHalf = new THREE.Mesh(capsuleTopGeo, topMat);
      const botHalf = new THREE.Mesh(capsuleBotGeo, botMat);
      const seam = new THREE.Mesh(capsuleBandGeo, botMat);
      seam.rotation.x = Math.PI / 2;
      g.add(topHalf, botHalf, seam);

      // Slight ±10% organic scale variation
      const s = 0.94 + (idx % 3) * 0.05;
      g.scale.setScalar(s);
      g.position.set(pos[0], pos[1], pos[2]);
      g.rotation.set(idx * 0.7, idx * 1.1, idx * 0.4);
      machineGroup.add(g);

      interiorBalls.push({
        group: g,
        basePos: new THREE.Vector3(pos[0], pos[1], pos[2]),
        phaseOffset: idx * 0.85,
        rotSpeed: new THREE.Vector3(
          (idx % 2 === 0 ? 1 : -1) * 3.4,
          2.6 + (idx % 3),
          (idx % 2 === 1 ? 1 : -1) * 2.8
        ),
      });
    });

    // Part 9: Crystal Glass Globe (`depthWrite: false`, `renderOrder: 6`)
    const domeGeo = track(new THREE.SphereGeometry(1.06, 40, 28));
    const domeMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.06,
        metalness: 0.0,
        transmission: isSoftwareGl ? 0 : 0.92,
        transparent: true,
        opacity: isSoftwareGl ? 0.26 : 1.0,
        ior: 1.48,
        thickness: 0.55,
        clearcoat: 1.0,
        depthWrite: false,
      })
    );
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.y = 2.38;
    domeMesh.renderOrder = 6;
    machineGroup.add(domeMesh);

    // Part 10: Fluted Leaf-Green Top Lid (`LatheGeometry`) + Brass Rim
    const lidPoints = [
      new THREE.Vector2(0.0, 3.55),
      new THREE.Vector2(0.45, 3.52),
      new THREE.Vector2(0.76, 3.36),
      new THREE.Vector2(0.8, 3.26),
      new THREE.Vector2(0.0, 3.26),
    ];
    const lidGeo = track(new THREE.LatheGeometry(lidPoints, 36));
    const lidMesh = new THREE.Mesh(lidGeo, leafCollarMat);
    lidMesh.castShadow = true;
    machineGroup.add(lidMesh);

    const lidKnobGeo = track(new THREE.CylinderGeometry(0.11, 0.14, 0.14, 20));
    const lidKnob = new THREE.Mesh(lidKnobGeo, brassMat);
    lidKnob.position.y = 3.58;
    machineGroup.add(lidKnob);

    // Part 11: Twin Wakaba Sprout Finial (`ExtrudeGeometry` with bevels)
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.18, 0.14, 0.24, 0.34);
    leafShape.quadraticCurveTo(0.06, 0.32, 0, 0);

    const leafGeo = track(
      new THREE.ExtrudeGeometry(leafShape, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.012,
        bevelSegments: 3,
      })
    );
    const sproutMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x58b37c,
        roughness: 0.4,
        metalness: 0.04,
      })
    );
    const sproutLeft = new THREE.Mesh(leafGeo, sproutMat);
    sproutLeft.position.set(-0.02, 3.63, -0.02);
    sproutLeft.rotation.z = 0.35;
    const sproutRight = new THREE.Mesh(leafGeo, sproutMat);
    sproutRight.position.set(0.02, 3.63, 0.02);
    sproutRight.rotation.y = Math.PI;
    sproutRight.rotation.z = 0.35;
    machineGroup.add(sproutLeft, sproutRight);

    // =========================================================================
    // 5. Hero Dispensed 3D Capsule + `InstancedMesh` Starlight Burst
    // =========================================================================
    const heroGroup = new THREE.Group();
    heroGroup.visible = false;
    scene.add(heroGroup);

    const heroTopGeo = track(
      new THREE.SphereGeometry(0.3, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5)
    );
    const heroBotGeo = track(
      new THREE.SphereGeometry(0.3, 28, 16, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5)
    );
    const heroGlowGeo = track(new THREE.OctahedronGeometry(0.16, 1));

    const heroTopMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x5fa87a,
        roughness: 0.18,
        metalness: 0.06,
        clearcoat: 0.8,
      })
    );
    const heroBotMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfffdf8,
        roughness: 0.3,
        metalness: 0.04,
      })
    );
    const heroCoreMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffe07d,
        emissive: 0xf4b63f,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.3,
      })
    );

    const heroTopShell = new THREE.Mesh(heroTopGeo, heroTopMat);
    heroTopShell.castShadow = true;
    const heroBotShell = new THREE.Mesh(heroBotGeo, heroBotMat);
    heroBotShell.castShadow = true;
    const heroCoreGem = new THREE.Mesh(heroGlowGeo, heroCoreMat);
    heroCoreGem.visible = false;
    heroGroup.add(heroTopShell, heroBotShell, heroCoreGem);

    const STAR_COUNT = 28;
    const starGeo = track(new THREE.OctahedronGeometry(0.065, 0));
    const starMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.25,
        metalness: 0.2,
      })
    );
    const starInstanced = new THREE.InstancedMesh(starGeo, starMat, STAR_COUNT);
    starInstanced.frustumCulled = false;
    starInstanced.visible = false;
    scene.add(starInstanced);

    const starParticles: StarBurstParticle[] = [];
    const starPalette = [0xf5c445, 0x5fa87a, 0xe57a77, 0x76b5c5];
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = (i / STAR_COUNT) * Math.PI * 2 + (i % 3) * 0.2;
      const up = 0.35 + (i % 5) * 0.18;
      const dir = new THREE.Vector3(Math.cos(theta), up, Math.sin(theta)).normalize();
      const colorHex = starPalette[i % starPalette.length];
      _starColor.setHex(colorHex);
      starInstanced.setColorAt(i, _starColor);
      _dummy.position.set(0, -10, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      starInstanced.setMatrixAt(i, _dummy.matrix);
      starParticles.push({
        dir,
        speed: 1.3 + (i % 4) * 0.42,
        spin: 3.0 + (i % 3) * 1.5,
        colorHex,
      });
    }
    if (starInstanced.instanceColor) starInstanced.instanceColor.needsUpdate = true;
    starInstanced.instanceMatrix.needsUpdate = true;
    starInstanced.computeBoundingSphere();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // =========================================================================
    // 6. Paced Animation & On-Demand Render Scheduler (`requestRender` + `afterDraw`)
    // =========================================================================
    let disposed = false;
    let frameId = 0;
    let loopRunning = false;
    let renderBusy = false;
    let renderDirty = false;

    interface SpinAnimState {
      active: boolean;
      elapsed: number;
      droppedSoundPlayed: boolean;
      openedSoundPlayed: boolean;
      pendingItem: GachaCollectibleItem | null;
      pendingIsNew: boolean;
    }

    const anim: SpinAnimState = {
      active: false,
      elapsed: 0,
      droppedSoundPlayed: false,
      openedSoundPlayed: false,
      pendingItem: null,
      pendingIsNew: false,
    };

    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed || loopRunning) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const stillDamping = controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty || stillDamping) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    function stepSpinAnimation(dt: number) {
      anim.elapsed += dt;
      const t = anim.elapsed;

      // Phase 1 (0.00s -> 1.15s): Crank rotates 360°, machine jiggles, interior capsules swirl!
      if (t <= 1.15) {
        const p = THREE.MathUtils.smoothstep(t / 1.15, 0, 1);
        crankPivot.rotation.z = -p * Math.PI * 2;
        machineGroup.rotation.z = Math.sin(t * 28) * 0.022 * (1 - p * 0.5);
        machineGroup.position.y = Math.abs(Math.sin(t * 24)) * 0.03;

        interiorBalls.forEach((b) => {
          const swirl = t * 9.5 + b.phaseOffset;
          b.group.position.x = b.basePos.x + Math.sin(swirl) * 0.14;
          b.group.position.y = b.basePos.y + Math.abs(Math.cos(swirl * 1.3)) * 0.18;
          b.group.position.z = b.basePos.z + Math.cos(swirl * 0.9) * 0.12;
          b.group.rotation.x += b.rotSpeed.x * dt;
          b.group.rotation.y += b.rotSpeed.y * dt;
        });
      } else {
        crankPivot.rotation.z = 0;
        machineGroup.rotation.z = THREE.MathUtils.damp(machineGroup.rotation.z, 0, 10, dt);
        machineGroup.position.y = THREE.MathUtils.damp(machineGroup.position.y, 0, 10, dt);
        interiorBalls.forEach((b) => {
          b.group.position.lerp(b.basePos, Math.min(1, dt * 8));
        });
      }

      // Phase 2 (1.15s -> 1.95s): Chute flap swings open, hero capsule rolls out & bounces!
      if (t >= 1.15 && t < 1.95) {
        if (!anim.droppedSoundPlayed) {
          anim.droppedSoundPlayed = true;
          setSpinPhase('dropping');
          soundEngine.playCapsuleDrop();
        }
        const dp = (t - 1.15) / 0.8;
        flapPivot.rotation.x = -Math.sin(Math.min(1, dp * 1.8) * Math.PI) * 0.85;

        heroGroup.visible = true;
        heroCoreGem.visible = false;
        const zPos = THREE.MathUtils.lerp(0.95, 1.95, THREE.MathUtils.smoothstep(dp, 0, 1));
        const bounce = Math.abs(Math.sin(dp * Math.PI * 2.5)) * (1 - dp) * 0.42;
        const baseHeight = THREE.MathUtils.lerp(0.42, 0.34, Math.min(1, dp * 1.5));
        heroGroup.position.set(0, baseHeight + bounce, zPos);
        heroGroup.rotation.x = dp * Math.PI * 2.2;
        heroTopShell.position.set(0, 0, 0);
        heroTopShell.rotation.set(0, 0, 0);
        heroBotShell.position.set(0, 0, 0);
      }

      // Phase 3 (1.95s -> 2.85s): Capsule rises slightly, splits open in 3D + starlight burst!
      if (t >= 1.95) {
        flapPivot.rotation.x = THREE.MathUtils.damp(flapPivot.rotation.x, 0, 10, dt);
        if (!anim.openedSoundPlayed && anim.pendingItem) {
          anim.openedSoundPlayed = true;
          setSpinPhase('opening');
          soundEngine.playCapsuleReveal(anim.pendingItem.rarity);
        }

        const op = Math.min(1, (t - 1.95) / 0.75);
        const ease = 1 - Math.pow(1 - op, 3);
        heroGroup.visible = true;
        heroGroup.position.set(0, 0.34 + ease * 0.58, 1.95 + ease * 0.25);
        heroGroup.rotation.set(0, ease * 0.35, 0);

        heroTopShell.position.set(0, ease * 0.38, -ease * 0.14);
        heroTopShell.rotation.x = -ease * 0.78;
        heroBotShell.position.set(0, -ease * 0.22, 0);

        heroCoreGem.visible = true;
        heroCoreGem.scale.setScalar(0.2 + ease * 1.05);
        heroCoreGem.rotation.y += dt * 2.8;
        heroCoreGem.rotation.x += dt * 1.4;

        starInstanced.visible = true;
        const burstFade = Math.max(0, 1 - (t - 1.95) / 1.15);
        for (let i = 0; i < STAR_COUNT; i++) {
          const sp = starParticles[i];
          const dist = (t - 1.95) * sp.speed;
          _dummy.position.set(
            heroGroup.position.x + sp.dir.x * dist,
            heroGroup.position.y + sp.dir.y * dist - 0.35 * (t - 1.95) * (t - 1.95),
            heroGroup.position.z + sp.dir.z * dist
          );
          _dummy.rotation.set(t * sp.spin, t * sp.spin * 0.8, 0);
          _dummy.scale.setScalar(Math.max(0.001, burstFade * 1.05));
          _dummy.updateMatrix();
          starInstanced.setMatrixAt(i, _dummy.matrix);
        }
        starInstanced.instanceMatrix.needsUpdate = true;

        if (t >= 2.65 && anim.pendingItem) {
          const finishedItem = anim.pendingItem;
          const finishedNew = anim.pendingIsNew;
          anim.pendingItem = null;
          anim.active = false;
          starInstanced.visible = false;

          const nextCoins = Math.max(0, coinsRef.current - GACHA_SPIN_COST);
          const nextUnlocked = Array.from(new Set([...unlockedRef.current, finishedItem.id]));
          setRevealedResult({ item: finishedItem, isNew: finishedNew });
          setSpinPhase('revealed');
          onSpinCompleteRef.current({
            item: finishedItem,
            isNew: finishedNew,
            nextCoins,
            nextUnlockedIds: nextUnlocked,
          });
        }
      }
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      controls.update();
      if (anim.active) {
        stepSpinAnimation(dt);
      }
      renderer.render(scene, camera);

      if (anim.active) {
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
      } else {
        loopRunning = false;
        requestRender();
      }
    }

    trigger3DSpinRef.current = (item: GachaCollectibleItem, isNew: boolean) => {
      heroTopMat.color.set(item.capsuleTopHex);
      heroBotMat.color.set(item.capsuleBottomHex);
      heroGroup.visible = false;
      starInstanced.visible = false;

      anim.active = true;
      anim.elapsed = 0;
      anim.droppedSoundPlayed = false;
      anim.openedSoundPlayed = false;
      anim.pendingItem = item;
      anim.pendingIsNew = isNew;

      clock.getDelta();
      if (!loopRunning) {
        loopRunning = true;
        tick();
      }
    };

    resetHeroCapsuleRef.current = () => {
      heroGroup.visible = false;
      starInstanced.visible = false;
      requestRender();
    };

    const handleControlChange = () => requestRender();
    controls.addEventListener('change', handleControlChange);

    const handleResize = () => {
      if (!container || disposed) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 360);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    const canvasEl = renderer.domElement;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFallback(true);
    };
    const onContextRestored = () => {
      setWebglFallback(false);
      requestRender();
    };
    canvasEl.addEventListener('webglcontextlost', onContextLost);
    canvasEl.addEventListener('webglcontextrestored', onContextRestored);

    requestRender();

    return () => {
      disposed = true;
      loopRunning = false;
      trigger3DSpinRef.current = null;
      resetHeroCapsuleRef.current = null;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('change', handleControlChange);
      controls.dispose();
      canvasEl.removeEventListener('webglcontextlost', onContextLost);
      canvasEl.removeEventListener('webglcontextrestored', onContextRestored);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const canSpin = coins >= GACHA_SPIN_COST && (spinPhase === 'idle' || spinPhase === 'revealed');
  const unlockedSet = new Set(unlockedItemIds);

  const handleStartSpin = () => {
    if (!canSpin) return;
    setRevealedResult(null);
    setSpinPhase('cranking');
    soundEngine.playGachaCrank();

    const rolled = rollGachaCollectible(unlockedItemIds);
    if (trigger3DSpinRef.current && !webglFallback) {
      trigger3DSpinRef.current(rolled.item, rolled.isNew);
    } else {
      // Graceful fallback if WebGL is unavailable on an ultra-locked device
      window.setTimeout(() => {
        soundEngine.playCapsuleReveal(rolled.item.rarity);
        const nextCoins = Math.max(0, coins - GACHA_SPIN_COST);
        const nextUnlocked = Array.from(new Set([...unlockedItemIds, rolled.item.id]));
        setRevealedResult(rolled);
        setSpinPhase('revealed');
        onSpinComplete({
          item: rolled.item,
          isNew: rolled.isNew,
          nextCoins,
          nextUnlockedIds: nextUnlocked,
        });
      }, 900);
    }
  };

  const handleCloseRevealCard = () => {
    soundEngine.playTap();
    setRevealedResult(null);
    setSpinPhase('idle');
    resetHeroCapsuleRef.current?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(58, 49, 40, 0.48)' }}
      role="dialog"
      aria-modal="true"
      aria-label="3Dガチャマシンと たんけん ずかん"
    >
      <div className="relative w-full max-w-5xl h-[min(86vh,760px)] bg-[#FAF5EC] rounded-3xl border border-[#E5DEC9] shadow-xl overflow-hidden flex flex-col">
        {/* Top Minimal Header (Zero backdrop-filter over WebGL; clean 3-zone layout) */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-[#FFFDF8] border-b border-[#EAE3D2] shrink-0 z-20">
          <div className="text-base sm:text-lg font-bold text-[#3A3128] whitespace-nowrap shrink-0">
            おまつりひろばの 3Dガチャ・ずかん
          </div>

          <div className="flex items-center gap-4 text-sm text-[#6C6053] tabular-nums whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#9A5B13]">
              <Coins className="w-4 h-4 text-[#D99B26]" />
              <span>たんけんコイン: {coins}まい</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="hidden sm:inline">
              あつめた ずかん: {unlockedSet.size} / {GACHA_CATALOG.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playTap();
              onClose();
            }}
            disabled={spinPhase === 'cranking' || spinPhase === 'dropping' || spinPhase === 'opening'}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F1E8D8] border border-[#DFD5C0] text-sm font-bold text-[#3A3128] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            <span>とじる</span>
          </button>
        </div>

        {/* Main Viewport Area */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {activeTab === 'machine' ? (
            <>
              {/* Dedicated Empty WebGL Canvas Mount Container (100% Unobstructed Center) */}
              <div
                ref={canvasMountRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
              />

              {/* Subtle Top-Left Drag Hint (Solid surface, no backdrop-filter) */}
              {!revealedResult && (
                <div className="pointer-events-none absolute top-4 left-4 z-10 px-3.5 py-2 rounded-xl bg-[#FFFDF8] border border-[#E5DEC9] text-xs font-bold text-[#6C6053]">
                  ゆびや マウスで くるくる まわして みられるよ（1かい {GACHA_SPIN_COST}コイン）
                </div>
              )}

              {/* Graceful Fallback View if WebGL Context Unavailable */}
              {webglFallback && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#FAF5EC] text-center">
                  <div className="p-6 rounded-3xl bg-[#FFFDF8] border border-[#E5DEC9] max-w-md space-y-3">
                    <div className="text-lg font-bold text-[#3A3128]">
                      おまつり ガチャマシン
                    </div>
                    <p className="text-sm text-[#6C6053]">
                      したの ボタンを おすと カプセルが でてくるよ。
                    </p>
                  </div>
                </div>
              )}

              {/* Revealed Collectible Celebration Overlay */}
              {revealedResult && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#3A3128]/35">
                  <div className="w-full max-w-md rounded-3xl bg-[#FFFDF8] border-2 border-[#E2C88A] p-6 sm:p-7 text-center shadow-lg space-y-4">
                    <div className="text-xs font-bold text-[#9A5B13]">
                      {revealedResult.isNew
                        ? 'あたらしい たからものを みつけたよ！'
                        : 'ずかんの たからものが でたよ！'}
                      {' · '}
                      {'★'.repeat(revealedResult.item.rarity)}
                      {' · '}
                      {revealedResult.item.seriesLabel}
                    </div>

                    <div
                      className="mx-auto w-28 h-28 rounded-3xl flex items-center justify-center border border-[#E6DEC8]"
                      style={{ backgroundColor: revealedResult.item.bgTintHex }}
                    >
                      <GachaItemArtwork itemId={revealedResult.item.id} size={84} />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-xl font-bold text-[#3A3128]">
                        {revealedResult.item.name}
                      </h3>
                      <p className="text-sm text-[#5C5144] leading-relaxed">
                        {revealedResult.item.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleCloseRevealCard}
                        className="px-5 py-2.5 rounded-2xl bg-[#2F7A54] hover:bg-[#256343] text-white text-sm font-bold transition-colors whitespace-nowrap"
                      >
                        やったね！（マシンに もどる）
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleCloseRevealCard();
                          setActiveTab('zukan');
                        }}
                        className="px-4 py-2.5 rounded-2xl bg-[#FAF5EC] hover:bg-[#EFE6D5] border border-[#DFD5C0] text-sm font-bold text-[#3A3128] transition-colors whitespace-nowrap"
                      >
                        ずかんで みる
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Collectible Zukan Sticker Book View */
            <div className="w-full h-full overflow-y-auto p-5 sm:p-7 pb-28 space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#3A3128]">
                    たんけん ずかん コレクション
                  </h3>
                  <p className="text-sm text-[#6C6053]">
                    おかいものや どうぶつの はいたつで あつめた コインで、16しゅるいの たからものを あつめよう。
                  </p>
                </div>
                <div className="text-sm font-bold text-[#2F7A54] tabular-nums">
                  コンプリートまで あと {Math.max(0, GACHA_CATALOG.length - unlockedSet.size)} こ
                </div>
              </div>

              {selectedZukanItem && (
                <div className="rounded-2xl bg-[#FFFDF8] border border-[#DFD5C0] p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 border border-[#E6DEC8]"
                    style={{ backgroundColor: selectedZukanItem.bgTintHex }}
                  >
                    <GachaItemArtwork itemId={selectedZukanItem.id} size={64} />
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <div className="text-xs text-[#7A6B58]">
                      {selectedZukanItem.seriesLabel} · {'★'.repeat(selectedZukanItem.rarity)}
                    </div>
                    <div className="text-base font-bold text-[#3A3128]">
                      {selectedZukanItem.name}
                    </div>
                    <p className="text-sm text-[#5C5144]">{selectedZukanItem.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedZukanItem(null)}
                    className="px-3.5 py-2 rounded-xl bg-[#FAF5EC] border border-[#DFD5C0] text-xs font-bold text-[#3A3128] whitespace-nowrap"
                  >
                    とじる
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {GACHA_CATALOG.map((item, index) => {
                  const isUnlocked = unlockedSet.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => {
                        soundEngine.playTap();
                        setSelectedZukanItem(item);
                      }}
                      className={`rounded-2xl p-3.5 text-left border transition-transform ${
                        isUnlocked
                          ? 'bg-[#FFFDF8] border-[#DFD5C0] hover:-translate-y-0.5 cursor-pointer'
                          : 'bg-[#F3ECE0] border-[#E6DEC8] opacity-75 cursor-default'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-[#7A6B58] tabular-nums mb-2">
                        <span>No.{String(index + 1).padStart(2, '0')}</span>
                        <span>{'★'.repeat(item.rarity)}</span>
                      </div>
                      <div
                        className="w-full h-20 rounded-xl flex items-center justify-center mb-2.5"
                        style={{
                          backgroundColor: isUnlocked ? item.bgTintHex : '#EAE1D0',
                        }}
                      >
                        {isUnlocked ? (
                          <GachaItemArtwork itemId={item.id} size={58} />
                        ) : (
                          <span className="text-xl font-bold text-[#9C8F7E]">？</span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-[#3A3128] truncate">
                        {isUnlocked ? item.name : 'まだ みつかっていないよ'}
                      </div>
                      <div className="text-xs text-[#7A6B58] truncate mt-0.5">
                        {item.seriesLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unified Collapsible Bottom Control Dock (Zero backdrop-filter; pinned bottom-center) */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-3 z-20 w-[min(680px,94%)] transition-transform duration-200"
            style={{
              transform: dockCollapsed
                ? 'translate(-50%, calc(100% - 34px))'
                : 'translate(-50%, 0)',
            }}
          >
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setDockCollapsed((v) => !v)}
                className="inline-flex items-center gap-1 px-3.5 py-1 rounded-t-xl bg-[#FFFDF8] border border-b-0 border-[#DFD5C0] text-xs font-bold text-[#6C6053] whitespace-nowrap"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>ボタンを ひらく</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>ボタンを かくす</span>
                  </>
                )}
              </button>
            </div>

            <div className="rounded-2xl bg-[#FFFDF8] border border-[#DFD5C0] shadow-md px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              {/* Segmented Tab Switcher */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F3ECE0]">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTap();
                    setActiveTab('machine');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                    activeTab === 'machine'
                      ? 'bg-[#FFFDF8] text-[#2F7A54] shadow-xs'
                      : 'text-[#6C6053] hover:text-[#3A3128]'
                  }`}
                >
                  <RotateCw className="w-4 h-4" />
                  <span>3Dガチャマシン</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTap();
                    setActiveTab('zukan');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                    activeTab === 'zukan'
                      ? 'bg-[#FFFDF8] text-[#2F7A54] shadow-xs'
                      : 'text-[#6C6053] hover:text-[#3A3128]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    たんけん ずかん ({unlockedSet.size}/{GACHA_CATALOG.length})
                  </span>
                </button>
              </div>

              {/* Primary 3D Spin Action */}
              {activeTab === 'machine' ? (
                <button
                  type="button"
                  disabled={!canSpin}
                  onClick={handleStartSpin}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-transform active:scale-95 whitespace-nowrap ${
                    canSpin
                      ? 'bg-[#C86428] hover:bg-[#B1551E] text-white cursor-pointer'
                      : 'bg-[#E9E1D2] text-[#8E8171] cursor-not-allowed'
                  }`}
                >
                  <RotateCw
                    className={`w-4 h-4 ${
                      spinPhase === 'cranking' || spinPhase === 'dropping' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {spinPhase === 'cranking' || spinPhase === 'dropping' || spinPhase === 'opening'
                      ? 'カプセルが でてくるよ…'
                      : coins >= GACHA_SPIN_COST
                        ? `ハンドルを まわす（${GACHA_SPIN_COST}コイン）`
                        : `あと ${GACHA_SPIN_COST - coins}コインで まわせるよ`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTap();
                    setActiveTab('machine');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2F7A54] hover:bg-[#256343] text-white text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>3Dガチャマシンへ もどる</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
