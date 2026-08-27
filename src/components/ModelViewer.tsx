"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/* Palette du portfolio (cf. globals.css) */
const BACKGROUND = new THREE.Color("#b2b2b2");

/** Dose de teinte vers le gris de fond appliquée aux matériaux. */
const TINT = 0.16;

type ModelConfig = {
  url: string;
  /** Taille cible du plus grand côté, en unités monde (la caméra cadre ~2.2). */
  targetSize: number;
  /** Rotation de repos autour de Y, pour orienter le modèle vers le centre. */
  yaw: number;
  /** Décalage vertical après recentrage automatique. */
  lift: number;
  /**
   * Filtre CSS du canvas : seule façon d'atteindre les textures. Réglé par
   * modèle, car leurs line arts n'ont pas la même dureté.
   */
  filter: string;
  /** Filtre au survol : une partie des couleurs d'origine revient. */
  hoverFilter: string;
};

const MIKU: ModelConfig = {
  url: "/psychic_type_pokemon_trainer_hatsune_miku.glb",
  targetSize: 1.75,
  yaw: 0.35,
  lift: -0.05,
  filter: "grayscale(0.7) saturate(0.5) contrast(1.35) brightness(0.95)",
  hoverFilter: "grayscale(0.15) saturate(1) contrast(1.2) brightness(1)",
};

const MIMIKYU: ModelConfig = {
  url: "/mimikyu.glb",
  targetSize: 1.35,
  yaw: -0.35,
  lift: -0.05,
  // Contraste abaissé : ses outlines sont peintes en noir pur et épais, ce
  // contraste les remonte vers le gris pour égaler la finesse du trait de Miku.
  filter: "grayscale(0.7) saturate(0.5) contrast(0.72) brightness(1.16)",
  hoverFilter: "grayscale(0.15) saturate(1) contrast(0.85) brightness(1.08)",
};

/** Vue minimale du parser GLTFLoader, non typée par les d.ts de drei. */
type GltfParser = {
  json: { materials?: { emissiveTexture?: { index: number } }[] };
  associations: Map<object, { materials?: number }>;
  getDependency: (type: string, index: number) => Promise<unknown>;
};

type Entry = {
  material: THREE.MeshStandardMaterial;
  source: THREE.Material;
  /** Couleur d'origine du .glb, avant harmonisation. */
  origin: THREE.Color;
};

/**
 * Harmonise la couleur : sur un matériau texturé, `color` est un multiplicateur
 * — on se contente de la teinte. Sans texture, on désature aussi.
 */
function applyTone(entry: Entry) {
  const out = entry.origin.clone();
  if (!entry.material.map) {
    const luminance = 0.299 * out.r + 0.587 * out.g + 0.114 * out.b;
    out.lerp(new THREE.Color(luminance, luminance, luminance), 0.7);
  }
  entry.material.color.copy(out.lerp(BACKGROUND, TINT));
  entry.material.needsUpdate = true;
}

/**
 * Clone et harmonise un matériau : surfaces plus mates, teinte vers la palette.
 * Le clone est indispensable — muter l'original polluerait le cache de useGLTF.
 */
function harmonize(source: THREE.Material): Entry {
  const material = source.clone() as THREE.MeshStandardMaterial;

  if (typeof material.roughness === "number") {
    material.roughness = THREE.MathUtils.clamp(material.roughness * 0.8 + 0.3, 0, 1);
  }
  if (typeof material.metalness === "number") {
    material.metalness = Math.min(material.metalness, 0.15);
  }

  const entry: Entry = {
    material,
    source,
    origin: material.color ? material.color.clone() : new THREE.Color(1, 1, 1),
  };
  applyTone(entry);
  return entry;
}

/**
 * Rattrape les .glb exportés en `KHR_materials_unlit` dont la texture est rangée
 * dans `emissiveTexture` : GLTFLoader les convertit en MeshBasicMaterial, qui n'a
 * pas de canal emissive, et la texture est perdue (modèle uni, souvent noir).
 * On la récupère depuis le JSON d'origine et on la réaffecte en `map`.
 */
async function recoverUnlitTextures(parser: GltfParser, entries: Entry[]) {
  const definitions = parser.json.materials ?? [];

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.material.map) return;

      const index = parser.associations.get(entry.source)?.materials;
      if (index === undefined) return;

      const textureIndex = definitions[index]?.emissiveTexture?.index;
      if (textureIndex === undefined) return;

      const texture = (await parser.getDependency("texture", textureIndex)) as
        | THREE.Texture
        | undefined;
      if (!texture) return;

      entry.material.map = texture;
      // Le baseColorFactor noir de ces exports masquerait la texture.
      entry.origin.setRGB(1, 1, 1);
      applyTone(entry);
    }),
  );
}

/**
 * Charge un .glb, le clone, harmonise ses matériaux puis le normalise :
 * recentré sur l'origine et redimensionné à `targetSize`. Le cadrage ne dépend
 * donc plus de l'échelle arbitraire de chaque fichier.
 */
function usePreparedModel({ url, targetSize, lift }: ModelConfig) {
  const gltf = useGLTF(url);
  const { scene } = gltf;

  return useMemo(() => {
    const root = cloneSkinned(scene);
    const entries: Entry[] = [];

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;

      const apply = (source: THREE.Material) => {
        const entry = harmonize(source);
        entries.push(entry);
        return entry.material;
      };

      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(apply)
        : apply(mesh.material);
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z) || 1;

    root.position.sub(center);

    const holder = new THREE.Group();
    holder.add(root);
    holder.scale.setScalar(targetSize / largest);
    holder.position.y = lift;

    const parser = (gltf as unknown as { parser: GltfParser }).parser;
    const repair = () => recoverUnlitTextures(parser, entries);

    return { object: holder, repair };
  }, [gltf, scene, targetSize, lift]);
}

function Model({ config }: { config: ModelConfig }) {
  const { object, repair } = usePreparedModel(config);

  // Récupération asynchrone des textures : muter les matériaux suffit, la
  // boucle de rendu de R3F redessine la scène à la frame suivante.
  useEffect(() => {
    void repair();
  }, [repair]);

  return (
    <group rotation={[0, config.yaw, 0]}>
      <primitive object={object} />
    </group>
  );
}

function Loader() {
  return (
    <Html center>
      <span className="select-none text-xs tracking-widest text-black/50">
        ···
      </span>
    </Html>
  );
}

function Stage({ config, className }: { config: ModelConfig; className: string }) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Le drag continue hors du cadre : c'est window qui doit voir le relâchement.
  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [dragging]);

  return (
    // Le wrapper ne capte pas la souris, mais les events du canvas remontent
    // jusqu'ici par bubbling — d'où onPointerOver/Out plutôt que :hover en CSS.
    <div
      className={`pointer-events-none absolute z-20 select-none ${className}`}
      style={{
        filter: hovered || dragging ? config.hoverFilter : config.filter,
        transition: "filter 450ms ease",
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onPointerDown={() => setDragging(true)}
    >
      <Canvas
        className="pointer-events-auto h-full w-full cursor-grab touch-none active:cursor-grabbing"
        camera={{ position: [0, 0, 4.2], fov: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 1.75]}
      >
        {/* Éclairage doux et diffus. Note : les matériaux `unlit` de ces deux
            .glb l'ignorent — il ne sert qu'aux éventuelles parties PBR. */}
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#ffffff", "#7d7d7d", 0.65]} />
        <directionalLight position={[3, 4, 5]} intensity={0.9} />
        <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#b2b2b2" />

        <Suspense fallback={<Loader />}>
          <Float speed={0.45} rotationIntensity={0.1} floatIntensity={0.12}>
            <Model config={config} />
          </Float>
        </Suspense>

        {/* Le survol ne touche qu'au filtre CSS. OrbitControls suspend de
            lui-même l'auto-rotation pendant le glisser-déposer. */}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.08}
          autoRotate
          autoRotateSpeed={0.4}
          minPolarAngle={Math.PI / 2.8}
          maxPolarAngle={Math.PI / 1.6}
        />
      </Canvas>
    </div>
  );
}

/**
 * Les modèles ne sont montés qu'à partir de `md`. Un simple `hidden md:block`
 * téléchargerait les .glb malgré tout : ici rien n'est requêté sur mobile.
 */
function useHasRoomForModels() {
  const [hasRoom, setHasRoom] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setHasRoom(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return hasRoom;
}

export default function ModelViewer() {
  const hasRoom = useHasRoomForModels();

  useEffect(() => {
    if (!hasRoom) return;
    useGLTF.preload(MIMIKYU.url);
    useGLTF.preload(MIKU.url);
  }, [hasRoom]);

  if (!hasRoom) return null;

  return (
    <>
      {/* Flancs gauche / droite, centrés verticalement. */}
      <Stage
        config={MIKU}
        className="left-0 top-1/2 h-[380px] w-[380px] -translate-y-1/2 lg:left-6 lg:h-[460px] lg:w-[460px]"
      />
      <Stage
        config={MIMIKYU}
        className="right-0 top-1/2 h-[380px] w-[380px] -translate-y-1/2 lg:right-6 lg:h-[460px] lg:w-[460px]"
      />
    </>
  );
}
