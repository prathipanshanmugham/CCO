import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fieldErrors } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { Brand, Icon, useToast, ErrorBox } from '../../components/ui.jsx';
import { PieceStep, DescribeStep, DetailsStep, ReviewStep, DoneStep } from './steps.jsx';
import { DesignStep } from './DesignStep.jsx';

const STEPS = ['Piece', 'Describe', 'Design', 'Details', 'Review'];
const PIECE_DEFAULT = { CLELIA: 'ring', SCORPLING: 'cuban-chain' };

export default function StudioPage({ brand = 'CLELIA' }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { data: cfg, error: cfgError, reload } = useApi(() => api.get('/api/content'), []);
  const [step, setStep] = useState(0);
  const [spec, setSpec] = useState({ brand, pieceType: PIECE_DEFAULT[brand], prompt: '', metal: brand === 'SCORPLING' ? 'silver-925' : 'gold-18k', stone: brand === 'SCORPLING' ? 'cz' : 'none', styleTags: [], params: null, variant: 0 });
  const [refFiles, setRefFiles] = useState([]);           // File objects chosen by the customer
  const [design, setDesign] = useState(null);             // server record
  const [built, setBuilt] = useState(null);               // { group, weightG, volumeMm3, dimensions, summary, stoneCount, exports() }
  const [details, setDetails] = useState({ customerName: '', phone: '', email: '', address1: '', address2: '', city: '', state: '', pincode: '', customerNotes: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { document.documentElement.dataset.brand = brand === 'SCORPLING' ? 'scorpling' : ''; return () => { document.documentElement.dataset.brand = ''; }; }, [brand]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const update = useCallback((patch) => setSpec((s) => ({ ...s, ...patch })), []);

  // Create or refresh the server-side design record (needed for AI images and the quote).
  const syncDesign = useCallback(async (extra = {}) => {
    const body = { brand: spec.brand, pieceType: spec.pieceType, prompt: spec.prompt, metal: spec.metal, stone: spec.stone, styleTags: spec.styleTags, params: spec.params || {}, ...extra };
    const d = design ? await api.patch(`/api/designs/${design.id}`, body) : await api.post('/api/designs', body);
    setDesign(d);
    if (!design && refFiles.length) {
      const fd = new FormData(); refFiles.forEach((f) => fd.append('files', f));
      try { const withRefs = await api.post(`/api/designs/${d.id}/references`, fd); setDesign(withRefs); } catch (e) { toast(e.message, 'bad'); }
    }
    return d;
  }, [spec, design, refFiles, toast]);

  const next = async () => {
    setErrors({});
    try {
      if (step === 1) {
        if (spec.prompt.trim().length < 8) return setErrors({ prompt: 'Tell us a little more about the piece (a sentence is enough).' });
        setBusy(true); await syncDesign(); setStep(2);
      } else if (step === 2) {
        if (!built) return;
        setBusy(true);
        // Upload the print-ready files and preview so staff get exactly what the customer saw.
        const files = await built.exports();
        const fd = new FormData();
        for (const [name, blob] of Object.entries(files)) fd.append('files', blob, name);
        if (built.preview) fd.append('preview', await (await fetch(built.preview)).blob(), 'preview.png');
        fd.append('weightG', String(built.weightG)); fd.append('volumeMm3', String(built.volumeMm3));
        fd.append('dimensions', JSON.stringify(built.dimensions)); fd.append('summary', built.summary);
        await api.patch(`/api/designs/${design.id}`, { params: built.params || spec.params, styleTags: spec.styleTags, metal: spec.metal, stone: spec.stone, summary: built.summary, weightG: built.weightG, volumeMm3: built.volumeMm3, dimensions: built.dimensions });
        const d = await api.post(`/api/designs/${design.id}/model`, fd);
        setDesign(d); setStep(3);
      } else if (step === 3) {
        const e = validateDetails(details); if (Object.keys(e).length) return setErrors(e);
        setStep(4);
      } else if (step === 4) {
        setBusy(true);
        const r = await api.post('/api/quotes', { designId: design.id, ...details });
        setResult(r); setStep(5);
      } else setStep(step + 1);
    } catch (e) {
      const fe = fieldErrors(e); if (Object.keys(fe).length) { setErrors(fe); if (step === 4) setStep(3); } else toast(e.message, 'bad');
    } finally { setBusy(false); }
  };

  const content = cfg?.content;
  const canNext = step === 0 ? !!spec.pieceType : step === 1 ? spec.prompt.trim().length >= 8 : step === 2 ? !!built : true;

  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <header className="studio-head">
        <Link to={brand === 'SCORPLING' ? '/scorpling' : '/'} style={{ textDecoration: 'none' }}><Brand brand={brand} sub="Design studio" /></Link>
        <nav className="row" style={{ gap: 6 }}>
          {brand === 'CLELIA' ? <Link className="btn btn-ghost btn-sm" to="/scorpling">Scorpling · iced-out</Link> : <Link className="btn btn-ghost btn-sm" to="/">Clelia &amp; Co.</Link>}
          <Link className="btn btn-secondary btn-sm" to="/track">Track a request</Link>
        </nav>
      </header>

      {cfgError && <ErrorBox error={cfgError} retry={reload} />}

      {step < 5 && (
        <div className="steps" aria-label="Progress" style={{ marginBottom: 18 }}>
          {STEPS.map((s, i) => <span key={s} className={`step ${i < step ? 'done' : i === step ? 'now' : ''}`}><i>{i < step ? '✓' : i + 1}</i><span className="label">{s}</span></span>)}
        </div>
      )}

      {step === 0 && <PieceStep spec={spec} update={update} brand={brand} content={content} pieces={cfg?.pieces} />}
      {step === 1 && <DescribeStep spec={spec} update={update} brand={brand} refFiles={refFiles} setRefFiles={setRefFiles} errors={errors} metals={cfg?.content?.metals} stones={cfg?.stones} />}
      {step === 2 && <DesignStep spec={spec} update={update} design={design} setDesign={setDesign} ai={cfg?.ai} onBuilt={setBuilt} brand={brand} />}
      {step === 3 && <DetailsStep details={details} setDetails={setDetails} errors={errors} />}
      {step === 4 && <ReviewStep spec={spec} built={built} design={design} details={details} content={content} brand={brand} />}
      {step === 5 && <DoneStep result={result} details={details} content={content} brand={brand} onNew={() => navigate(0)} />}

      {step < 5 && (
        <div className="sticky-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || busy}><Icon name="left" size={16} /> Back</button>
          <button type="button" className="btn btn-primary btn-lg" onClick={next} disabled={!canNext || busy}>
            {busy ? <><span className="spin" /> {step === 2 ? 'Saving your design…' : step === 4 ? 'Sending…' : 'One moment…'}</> : step === 4 ? 'Request my quote' : step === 2 ? 'Continue with this design' : 'Continue'} {!busy && <Icon name="right" size={16} />}
          </button>
        </div>
      )}

      <footer className="footer">
        <span>© {new Date().getFullYear()} Clelia &amp; Co. {brand === 'SCORPLING' && '· Scorpling'}</span>
        <span className="row" style={{ gap: 14 }}>
          {content?.supportPhone && <a href={`tel:${content.supportPhone}`}>{content.supportPhone}</a>}
          <a href={`mailto:${content?.supportEmail || 'hello@cleliaandco.com'}`}>{content?.supportEmail || 'hello@cleliaandco.com'}</a>
          <Link to="/staff/login" className="muted" style={{ textDecoration: 'none' }}>Staff</Link>
        </span>
      </footer>
    </div>
  );
}

function validateDetails(d) {
  const e = {};
  if (d.customerName.trim().length < 2) e.customerName = 'Please enter your name';
  if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(d.phone.trim())) e.phone = 'Enter a valid 10-digit mobile number';
  if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) e.email = 'That email looks incomplete';
  if (d.address1.trim().length < 4) e.address1 = 'Please enter your address';
  if (!/^[1-9]\d{5}$/.test(d.pincode)) e.pincode = 'Enter a 6-digit PIN code';
  if (d.city.trim().length < 2) e.city = 'City is required';
  if (d.state.trim().length < 2) e.state = 'State is required';
  return e;
}
