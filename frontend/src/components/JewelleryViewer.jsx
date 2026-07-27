import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
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

function RingModel({ metal, rotation, scale }) {
  const colour = metalMaterials[metal] || metalMaterials["18K Yellow Gold"];
  return (
    <group rotation={[rotation[0], rotation[1], 0]} scale={scale}>
      <mesh castShadow receiveShadow>
        <torusGeometry args={[1.45, 0.18, 42, 128]} />
        <meshStandardMaterial
          color={colour}
          metalness={0.94}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, 1.43, 0]} castShadow>
        <sphereGeometry args={[0.34, 48, 48]} />
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

export function JewelleryViewer({ metal, onMetalChange }) {
  const frame = useRef();
  const [webglError, setWebglError] = useState(false);
  const [rotation, setRotation] = useState([0.12, -0.3]);
  const [scale, setScale] = useState(1);
  const pointer = useRef(null);

  const resetView = () => {
    setRotation([0.12, -0.3]);
    setScale(1);
  };
  const openFullscreen = () => frame.current?.requestFullscreen?.();
  const startDrag = (event) => {
    pointer.current = { x: event.clientX, y: event.clientY, rotation };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const drag = (event) => {
    if (!pointer.current) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    setRotation([
      pointer.current.rotation[0] + dy * 0.012,
      pointer.current.rotation[1] + dx * 0.012,
    ]);
  };
  const endDrag = () => {
    pointer.current = null;
  };

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
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(event) => {
          event.preventDefault();
          setScale((current) =>
            Math.max(0.72, Math.min(1.55, current - event.deltaY * 0.001)),
          );
        }}
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
            <ambientLight intensity={1.5} />
            <directionalLight position={[4, 5, 4]} intensity={3.2} castShadow />
            <directionalLight position={[-4, -2, 3]} intensity={1.2} />
            <RingModel metal={metal} rotation={rotation} scale={scale} />
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
