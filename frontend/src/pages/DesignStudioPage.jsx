import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ImageSquare,
  Sparkle,
  UploadSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { SiteShell } from "../components/SiteShell";

const types = [
  "Ring",
  "Pendant",
  "Bracelet",
  "Earrings",
  "Necklace",
  "Bangle",
  "Nose Pin",
  "Anklet",
  "Brooch",
  "Cufflinks",
  "Men's Band",
];
const concepts = [
  "https://images.unsplash.com/photo-1514612497953-05d1e5e171fa?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1613945407943-59cd755fd69e?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=85",
];

export default function DesignStudioPage() {
  const [step, setStep] = useState(1);
  const [type, setType] = useState("Ring");
  const [model, setModel] = useState("gpt-image-1");
  const [prompt, setPrompt] = useState("");
  const [selectedConcept, setSelectedConcept] = useState(null);
  const labels = useMemo(
    () => ["Choose", "Describe", "Specify", "Concepts"],
    [],
  );
  const advance = () => {
    if (step === 2 && prompt.length < 12)
      return toast.error("Tell us a little more about the piece you imagine.");
    setStep((current) => Math.min(current + 1, 4));
  };
  return (
    <SiteShell>
      <section className="studio-page" data-testid="design-studio-page">
        <div className="studio-heading">
          <p className="eyebrow">Private Design Studio</p>
          <h1>Let’s begin with a feeling.</h1>
          <p data-testid="studio-subheading">
            A few thoughtful details will guide your first concepts.
          </p>
        </div>
        <ol className="stepper" data-testid="design-studio-progress">
          {labels.map((label, index) => (
            <li
              key={label}
              className={step >= index + 1 ? "is-active" : ""}
              data-testid={`studio-step-${index + 1}`}
            >
              <span>
                {step > index + 1 ? <Check size={13} /> : `0${index + 1}`}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <div className="studio-workspace">
          {step === 1 && (
            <div className="studio-section" data-testid="choose-type-section">
              <p className="section-kicker">01 — The starting point</p>
              <h2>What would you like to create?</h2>
              <div className="type-grid">
                {types.map((item, index) => (
                  <button
                    key={item}
                    className={`type-card ${type === item ? "is-selected" : ""}`}
                    onClick={() => setType(item)}
                    data-testid={`jewellery-type-${item.toLowerCase().replaceAll(" ", "-")}`}
                  >
                    <span className="type-index">0{index + 1}</span>
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div
              className="studio-section describe-layout"
              data-testid="describe-design-section"
            >
              <div>
                <p className="section-kicker">02 — The point of view</p>
                <h2>Describe the piece you see.</h2>
                <p className="form-hint">
                  A mood, memory, person or silhouette is a beautiful place to
                  start.
                </p>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="A refined emerald-cut ring inspired by old Bombay cinema, with a delicate milgrain edge…"
                  data-testid="design-prompt-input"
                />
                <div className="prompt-chips">
                  {[
                    "Art Deco",
                    "Minimal",
                    "Temple",
                    "Floral",
                    "For an anniversary",
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() =>
                        setPrompt((current) => `${current} ${chip}`.trim())
                      }
                      data-testid={`prompt-chip-${chip.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
              <label
                className="upload-panel"
                data-testid="reference-upload-panel"
              >
                <UploadSimple size={29} weight="thin" />
                <strong>Reference images</strong>
                <span>Sketches, inspiration, or a treasured heirloom</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  data-testid="reference-image-input"
                />
                <small>Up to 5 images</small>
              </label>
            </div>
          )}
          {step === 3 && (
            <div
              className="studio-section"
              data-testid="specify-design-section"
            >
              <p className="section-kicker">03 — The particulars</p>
              <h2>Give form to the details.</h2>
              <div className="spec-grid">
                <label>
                  Metal
                  <select data-testid="metal-select">
                    <option>18K Yellow Gold</option>
                    <option>18K Rose Gold</option>
                    <option>Platinum</option>
                    <option>925 Silver</option>
                  </select>
                </label>
                <label>
                  Primary stone
                  <select data-testid="stone-select">
                    <option>Diamond</option>
                    <option>Emerald</option>
                    <option>Ruby</option>
                    <option>None</option>
                  </select>
                </label>
                <label>
                  Size / length
                  <input placeholder="Ring size 12" data-testid="size-input" />
                </label>
                <label>
                  Engraving
                  <input
                    placeholder="Forever, A."
                    maxLength="24"
                    data-testid="engraving-input"
                  />
                </label>
              </div>
              <div className="model-selector">
                <p>Concept model</p>
                {[
                  ["gpt-image-1", "GPT Image 1", "Detailed, editorial renders"],
                  [
                    "gemini-nano-banana",
                    "Gemini Nano Banana",
                    "Expressive, rapid variations",
                  ],
                ].map(([id, title, note]) => (
                  <button
                    key={id}
                    onClick={() => setModel(id)}
                    className={model === id ? "is-selected" : ""}
                    data-testid={`ai-model-${id}`}
                  >
                    <span>{model === id && <Check size={14} />}</span>
                    <strong>{title}</strong>
                    <small>{note}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 4 && (
            <div
              className="studio-section"
              data-testid="concepts-gallery-section"
            >
              <p className="section-kicker">04 — Your first concepts</p>
              <h2>Three interpretations, one story.</h2>
              <p className="form-hint">
                Choose a favourite to refine, view in 3D, or request a private
                quote.
              </p>
              <div className="concept-grid">
                {concepts.map((image, index) => (
                  <button
                    key={image}
                    className={`concept-card ${selectedConcept === index ? "is-selected" : ""}`}
                    onClick={() => setSelectedConcept(index)}
                    data-testid={`concept-select-${index + 1}`}
                  >
                    <img src={image} alt={`Design concept ${index + 1}`} />
                    <span>
                      0{index + 1} —{" "}
                      {
                        ["The Heirloom", "The Modern Muse", "The Signature"][
                          index
                        ]
                      }
                    </span>
                  </button>
                ))}
              </div>
              {selectedConcept !== null && (
                <div className="concept-actions">
                  <button
                    className="button button--outline"
                    onClick={() => toast("The 3D preview is being prepared.")}
                    data-testid="view-3d-button"
                  >
                    <ImageSquare size={18} /> View in 3D
                  </button>
                  <button
                    className="button button--plum"
                    onClick={() =>
                      toast.success(
                        "Your private quote request has been saved.",
                      )
                    }
                    data-testid="request-quote-button"
                  >
                    Request a private quote <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {step < 4 && (
          <div className="studio-footer">
            <button
              className="text-button"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              disabled={step === 1}
              data-testid="studio-back-button"
            >
              Back
            </button>
            <button
              className="button button--plum"
              onClick={advance}
              data-testid="studio-continue-button"
            >
              {step === 3 ? (
                <>
                  <Sparkle size={17} /> Generate concepts
                </>
              ) : (
                <>
                  Continue <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
