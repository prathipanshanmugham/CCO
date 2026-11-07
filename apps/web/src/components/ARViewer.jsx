// AR through <model-viewer>: Scene Viewer on Android, Quick Look on iPhone (USDZ generated on device).
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Icon } from './ui.jsx';

let loaded;
const loadModelViewer = () => (loaded ||= import('@google/model-viewer'));

export function ARButton({ getGlb, label = 'See it on you (AR)' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}><Icon name="ar" size={16} /> {label}</button>
      {open && <ARModal getGlb={getGlb} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ARModal({ getGlb, glbUrl, onClose }) {
  const [ready, setReady] = useState(false);
  const [url, setUrl] = useState(glbUrl || null);
  useEffect(() => { loadModelViewer().then(() => setReady(true)); }, []);
  useEffect(() => {
    if (glbUrl || !getGlb) return;
    let objUrl; (async () => { const buf = await getGlb(); objUrl = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' })); setUrl(objUrl); })();
    return () => { if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [getGlb, glbUrl]);
  const isMobile = useMemo(() => /Android|iPhone|iPad/i.test(navigator.userAgent), []);
  return (
    <Modal title="See it in your space" onClose={onClose} wide>
      <div style={{ height: 'min(60vh, 520px)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface-2)' }}>
        {ready && url ? (
          <model-viewer src={url} ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" camera-controls auto-rotate shadow-intensity="1" exposure="1" environment-image="neutral" alt="Your jewellery design" style={{ width: '100%', height: '100%' }}>
            <button slot="ar-button" className="btn btn-primary" style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)' }}><Icon name="ar" size={16} /> View in your room</button>
          </model-viewer>
        ) : <div className="empty"><span className="spin" /> Preparing the 3D model…</div>}
      </div>
      <p className="hint">
        {isMobile ? 'Tap "View in your room", then point the camera at a flat surface. The piece appears at its real size.' : 'On a phone, this button places the piece at real size through the camera. On a computer you can turn and zoom it here.'}
      </p>
    </Modal>
  );
}
