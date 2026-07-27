import { useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ArrowsOutSimple,
  ArrowCounterClockwise,
  CaretDown,
} from "@phosphor-icons/react";

const metalMaterials = {
  "18K Yellow Gold": "#d7ae4a",
  "18K Rose Gold": "#c97e70",
  "18K White Gold": "#d8dad8",
  Platinum: "#cfd1d2",
  "925 Silver": "#b7bdc4",
};

function RingModel({ metal }) {
  const ring = useRef();
  const colour = metalMaterials[metal] || metalMaterials["18K Yellow Gold"];
  useFrame((_, delta) => {
    ring.current.rotation.y += delta * 0.35;
  });
  return (
    <group ref={ring} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow receiveShadow>
        <torusGeometry args={[1.45, 0.18, 42, 128]} />
        <meshStandardMaterial
          color={colour}
          metalness={0.94}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, 1.42, 0]} castShadow>
        <sphereGeometry args={[0.28, 48, 48]} />
        <meshPhysicalMaterial
          color="#fffaf5"
          transmission={0.2}
          roughness={0.08}
          metalness={0.12}
        />
      </mesh>
    </group>
  );
}

function ViewerScene({ metal, controls }) {
  const { camera } = useThree();
  controls.current = {
    reset: () => {
      camera.position.set(0, 0.3, 5.8);
      camera.lookAt(0, 0.25, 0);
    },
  };
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 5, 4]} intensity={3.2} castShadow />
      <directionalLight position={[-4, -2, 3]} intensity={1.2} />
      <RingModel metal={metal} />
    </>
  );
}

export function JewelleryViewer({ metal, onMetalChange }) {
  const controls = useRef();
  const frame = useRef();
  const [webglError, setWebglError] = useState(false);

  const resetView = () => controls.current?.reset();
  const openFullscreen = () => frame.current?.requestFullscreen?.();

  return (
    <section className="jewellery-viewer" data-testid="jewellery-3d-viewer">
      <div className="viewer-toolbar">
        <label>
          Metal
          <select
            value={metal}
            onChange={(event) => onMetalChange(event.target.value)}
            data-testid="viewer-metal-select"
          >
            {Object.keys(metalMaterials).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <CaretDown size={14} />
        </label>
        <div>
          <button
            onClick={resetView}
            aria-label="Reset view"
            data-testid="viewer-reset-button"
          >
            <ArrowCounterClockwise size={18} />
          </button>
          <button
            onClick={openFullscreen}
            aria-label="View fullscreen"
            data-testid="viewer-fullscreen-button"
          >
            <ArrowsOutSimple size={18} />
          </button>
        </div>
      </div>
      <div
        className="viewer-canvas"
        ref={frame}
        data-testid="viewer-canvas-container"
      >
        {webglError ? (
          <div
            className="viewer-fallback"
            data-testid="viewer-fallback-message"
          >
            Your browser cannot display the interactive view. Please continue on
            a device with WebGL enabled.
          </div>
        ) : (
          <Canvas
            shadows
            camera={{ position: [0, 0.3, 5.8], fov: 38 }}
            onCreated={({ gl }) => gl.setClearColor("#f3eee7")}
            onError={() => setWebglError(true)}
          >
            <ViewerScene metal={metal} controls={controls} />
          </Canvas>
        )}
      </div>
      <p className="viewer-caption" data-testid="viewer-caption">
        Drag to turn your piece. Pinch to zoom. Change the metal whenever you
        like.
      </p>
    </section>
  );
}
