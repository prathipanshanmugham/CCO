import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPiece, paramSchema, defaultParams, interpretPrompt, exportSTL, export3MF, exportOBJ, exportGLB, PIECE_TYPES, STONES } from '@clelia/engine';
import { api } from '../../lib/api.js';
import { Viewer3D, renderThumbnail } from '../../components/Viewer3D.jsx';
import { ARButton } from '../../components/ARViewer.jsx';
import { Icon, Lightbox, useToast } from '../../components/ui.jsx';
import { grams, title } from '../../lib/format.js';

export function DesignStep({ spec, update, design, setDesign, ai, onBuilt, brand }) {
  const toast = useToast();
  const viewer = useRef(null);
  const [thumbs, setThumbs] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const schema = useMemo(() => paramSchema(spec.pieceType), [spec.pieceType]);

  // First visit: derive params from the prompt. Keep customer edits afterwards.
  const interp = useMemo(() => interpretPrompt(spec.prompt, spec.pieceType), [spec.prompt, spec.pieceType]);
  useEffect(() => {
    if (!spec.params) update({ params: { ...defaultParams(spec.pieceType), ...interp.params }, styleTags: interp.styleTags || [], ...(interp.metal ? { metal: interp.metal } : {}), ...(interp.stone ? { stone: interp.stone } : {}) });
  }, [spec.params, spec.pieceType, interp, update]);

  const params = spec.params || defaultParams(spec.pieceType);
  const base = useMemo(() => ({ pieceType: spec.pieceType, metal: spec.metal, stone: spec.stone, prompt: spec.prompt, params, brand }), [spec.pieceType, spec.metal, spec.stone, spec.prompt, params, brand]);

  // The three variants share params; the engine varies head/profile/pattern per variant.
  const variants = useMemo(() => [0, 1, 2].map((v) => { try { return buildPiece({ ...base, variant: v }); } catch (e) { console.error(e); return null; } }), [base]);
  const current = variants[spec.variant] || variants[0];

  useEffect(() => { setThumbs(variants.map((v) => (v ? renderThumbnail(v.group, 220) : null))); }, [variants]);

  useEffect(() => {
    if (!current) return onBuilt(null);
    const snapshot = () => viewer.current?.snapshot?.(768);
    onBuilt({
      ...current,
      get preview() { return snapshot(); },
      exports: async () => ({
        'model.stl': new Blob([exportSTL(current.group)], { type: 'model/stl' }),
        'model.3mf': new Blob([export3MF(current.group, { title: `${brand} ${spec.pieceType}` })], { type: 'model/3mf' }),
        'model.obj': new Blob([exportOBJ(current.group)], { type: 'text/plain' }),
        'model.glb': new Blob([exportGLB(current.group)], { type: 'model/gltf-binary' }),
      }),
    });
  }, [current, onBuilt, brand, spec.pieceType]);

  const getGlb = useCallback(async () => exportGLB(current.group), [current]);

  const generateImages = async () => {
    if (!design) return;
    setAiBusy(true); setAiError('');
    try {
      // Save current params first so the server prompt matches what the customer sees.
      await api.patch(`/api/designs/${design.id}`, { params: current?.params || params, styleTags: spec.styleTags, metal: spec.metal, stone: spec.stone, summary: current?.summary });
      const r = await api.post(`/api/designs/${design.id}/images`, { count: ai?.imagesPerDesign || 3 });
      const d = await api.get(`/api/designs/${design.id}`);
      setDesign(d);
      if (r.warning) toast('Some images could not be generated', 'bad');
    } catch (e) { setAiError(e.message); }
    finally { setAiBusy(false); }
  };

  const piece = PIECE_TYPES.find((p) => p.id === spec.pieceType);
  const aiImages = design?.aiImages || [];

  return (
    <div className="design-layout">
      <div className="stack">
        <div className="row between">
          <div><span className="eyebrow">Step 3</span><h2>Your {piece?.label.toLowerCase()}, in 3D</h2></div>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => viewer.current?.reset()}><Icon name="refresh" size={14} /> Reset view</button>
            {current && <ARButton getGlb={getGlb} />}
          </div>
        </div>
        <Viewer3D ref={viewer} object={current?.group}>
          <div className="overlay">
            <span className="stat">{current ? `≈ ${grams(current.weightG)} · ${current.dimensions.widthMm.toFixed(1)} × ${current.dimensions.heightMm.toFixed(1)} × ${current.dimensions.depthMm.toFixed(1)} mm` : 'Building…'}</span>
            <span className="stat muted">Drag to turn · scroll to zoom</span>
          </div>
        </Viewer3D>
        <div className="variants" role="radiogroup" aria-label="Design options">
          {variants.map((v, i) => v && (
            <button type="button" key={i} role="radio" aria-checked={spec.variant === i} className={`variant ${spec.variant === i ? 'active' : ''}`} onClick={() => update({ variant: i })}>
              {thumbs[i] ? <img src={thumbs[i]} alt="" /> : <div className="ph" />}
              <span>Option {i + 1} · {grams(v.weightG)}</span>
            </button>
          ))}
        </div>
        <div className="summary-box">{current?.summary}</div>

        <div className="panel stack" style={{ padding: 18 }}>
          <div className="row between">
            <div><h4>AI concept images</h4><p className="hint">Photographic ideas of your description, to help you picture the finish. The 3D model above is what we actually make.</p></div>
            {ai?.live && <button type="button" className="btn btn-secondary btn-sm" onClick={generateImages} disabled={aiBusy || !design}>{aiBusy ? <><span className="spin" /> Generating…</> : <><Icon name="spark" size={14} /> {aiImages.length ? 'Generate more' : 'Generate images'}</>}</button>}
          </div>
          {!ai?.live && <p className="hint">Concept images are switched off at the moment. Your 3D design and quote work as normal.</p>}
          {aiError && <p className="error">{aiError}</p>}
          {(aiBusy || aiImages.length > 0) && (
            <div className="ai-grid">
              {aiImages.slice(-6).map((im) => <img key={im.url} src={im.url} alt="AI concept" onClick={() => setLightbox(im.url)} />)}
              {aiBusy && Array.from({ length: ai?.imagesPerDesign || 3 }).map((_, i) => <div key={i} className="ph" />)}
            </div>
          )}
        </div>
      </div>

      <aside className="panel stack">
        <div><h4>Adjust</h4><p className="hint">Sizes are real millimetres. Weight updates live.</p></div>
        {schema.map((f) => (
          <div key={f.key} className="param">
            <div className="row"><label htmlFor={`p-${f.key}`}>{f.label}</label>{f.type === 'range' && <span className="val">{formatVal(params[f.key], f)}</span>}</div>
            {f.type === 'range'
              ? <input id={`p-${f.key}`} type="range" className="range" min={f.min} max={f.max} step={f.step} value={params[f.key] ?? f.default} onChange={(e) => update({ params: { ...params, [f.key]: Number(e.target.value) } })} />
              : <select id={`p-${f.key}`} className="select" value={params[f.key] ?? f.default} onChange={(e) => update({ params: { ...params, [f.key]: e.target.value } })}>{f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? title(o)}</option>)}</select>}
          </div>
        ))}
        <hr className="divider" />
        <div className="param"><div className="row"><label>Stone</label></div>
          <select className="select" value={spec.stone} onChange={(e) => update({ stone: e.target.value })}>{STONES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </div>
        <p className="hint">{spec.stone !== 'none' && current ? `${current.stoneCount} stone${current.stoneCount === 1 ? '' : 's'} in this design.` : 'Pick a stone to add settings.'}</p>
      </aside>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

function formatVal(v, f) {
  if (v == null) return '';
  if (f.unit === 'IN' || f.key === 'size' || f.key === 'ringSize') return `Size ${v}`;
  if (f.unit === 'mm') return `${Number(v).toFixed(f.step < 1 ? 1 : 0)} mm`;
  if (f.unit) return `${v} ${f.unit}`;
  return String(v);
}
