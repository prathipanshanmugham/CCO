import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Sparkle } from "@phosphor-icons/react";
import { ToolShell } from "../components/ToolShell";

const typeLabels = [
  "Ring",
  "Pendant",
  "Bracelet",
  "Earrings",
  "Necklace",
  "Bangle",
];
const typeExamples = {
  Ring: [
    "A slim rose-gold band with a single oval ruby and tiny milgrain detailing along the edges.",
    "A timeless yellow-gold ring with a round diamond for our tenth anniversary.",
    "A simple platinum band with our initials hidden inside.",
    "A floral-inspired ring in white gold with a delicate sapphire centre.",
  ],
  Pendant: [
    "A small yellow-gold pendant inspired by a lotus, with a single diamond at its heart.",
    "A modern rose-gold initial pendant for my daughter.",
    "A temple-style pendant with antique finish and ruby accents.",
    "A simple everyday pendant with an emerald-cut sapphire.",
  ],
};

function WelcomeGuide({ onClose }) {
  return (
    <div
      className="guide-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="first-visit-guide"
    >
      <div className="guide-card">
        <p className="eyebrow">Welcome to your private design room</p>
        <h1>Let’s make something personal.</h1>
        <div className="guide-steps">
          {[
            "Pick a style",
            "Describe your idea",
            "We shape your design",
            "See it in 3D and try it on",
          ].map((item, index) => (
            <div key={item}>
              <span>0{index + 1}</span>
              <b>{item}</b>
            </div>
          ))}
        </div>
        <button
          className="button button--plum"
          onClick={onClose}
          data-testid="close-first-visit-guide"
        >
          Begin
        </button>
      </div>
    </div>
  );
}

export default function DesignStudioPage() {
  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialType = search
    .get("type")
    ?.replace(/^./, (letter) => letter.toUpperCase());
  const [step, setStep] = useState(1);
  const [type, setType] = useState(
    typeLabels.includes(initialType) ? initialType : "Ring",
  );
  const [description, setDescription] = useState("");
  const [metal, setMetal] = useState("18K Yellow Gold");
  const [guideOpen, setGuideOpen] = useState(
    () => localStorage.getItem("clelia-guide-seen") !== "yes",
  );
  const [guidance, setGuidance] = useState("");
  const [isGuiding, setIsGuiding] = useState(false);
  const [error, setError] = useState("");
  const [sessionId] = useState(() => crypto.randomUUID());
  const examples = typeExamples[type] || typeExamples.Ring;

  useEffect(() => {
    if (initialType && typeLabels.includes(initialType)) setType(initialType);
  }, [initialType]);

  const closeGuide = () => {
    localStorage.setItem("clelia-guide-seen", "yes");
    setGuideOpen(false);
  };

  const moveForward = async () => {
    setError("");
    if (step === 1) return setStep(2);
    if (step === 2) {
      if (description.trim().length < 12) {
        return setError(
          "Please add a little more detail so we can understand the piece you have in mind.",
        );
      }
      return setStep(3);
    }
    if (step === 3) return setStep(4);
    if (step === 4) {
      setIsGuiding(true);
      setGuidance("");
      try {
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/design-guidance/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              jewellery_type: type,
              description,
              specifications: { metal },
            }),
          },
        );
        if (!response.ok || !response.body) throw new Error("guidance failed");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          chunk.split("\n\n").forEach((part) => {
            if (part.startsWith("data: "))
              setGuidance((current) => current + part.replace("data: ", ""));
          });
        }
        setStep(5);
      } catch {
        setError(
          "We could not shape your design just now. Please try again or adjust your description.",
        );
      } finally {
        setIsGuiding(false);
      }
      return;
    }
    if (step === 5) return setStep(6);
    const returnUrl = search.get("return_url");
    if (returnUrl) window.location.assign(returnUrl);
  };

  const title = [
    "Choose the piece you’d love to make.",
    "Tell us what you have in mind.",
    "Choose the metal.",
    "We’re shaping your design.",
    "See your idea from every angle.",
    "Your design is ready to confirm.",
  ][step - 1];
  const detail = [
    "Start with the type of jewellery that feels right.",
    "A memory, a person, an occasion or a visual detail is all we need.",
    "You can always revisit this before confirming.",
    "We’re turning your description into a clear design direction.",
    "The final piece will be prepared by our atelier after your approval.",
    "We’ll keep these details ready for your private consultation.",
  ][step - 1];

  return (
    <ToolShell step={step} onHelp={() => setGuideOpen(true)}>
      {guideOpen && <WelcomeGuide onClose={closeGuide} />}
      <section className="focused-step" data-testid={`designer-step-${step}`}>
        <p className="eyebrow">Your bespoke piece</p>
        <h1>{title}</h1>
        <p className="step-detail">{detail}</p>
        {step === 1 && (
          <div className="type-grid focused-grid">
            {typeLabels.map((item) => (
              <button
                className={`type-card ${type === item ? "is-selected" : ""}`}
                key={item}
                onClick={() => setType(item)}
                data-testid={`designer-type-${item.toLowerCase()}`}
              >
                <span>{type === item && <Check size={15} />}</span>
                {item}
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="description-step">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="For example, a delicate ring that reminds me of…"
              data-testid="idea-description-input"
            />
            <p className="field-label">Need a starting point?</p>
            <div className="example-prompts">
              {examples.map((example, index) => (
                <button
                  key={example}
                  onClick={() => setDescription(example)}
                  data-testid={`example-idea-${index + 1}`}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="metal-options" data-testid="metal-options">
            {[
              "18K Yellow Gold",
              "18K Rose Gold",
              "18K White Gold",
              "Platinum",
              "925 Silver",
            ].map((item) => (
              <button
                key={item}
                className={metal === item ? "is-selected" : ""}
                onClick={() => setMetal(item)}
                data-testid={`metal-option-${item.toLowerCase().replaceAll(" ", "-")}`}
              >
                {metal === item && <Check size={15} />}
                {item}
              </button>
            ))}
          </div>
        )}
        {step === 4 && (
          <div className="creation-state" data-testid="creation-progress">
            <span className="creation-ring">
              <Sparkle size={26} />
            </span>
            <p>
              {isGuiding
                ? "Reading the details you’ve shared…"
                : "Ready when you are."}
            </p>
            <small>
              {isGuiding
                ? "Usually less than a minute"
                : "We’ll make a clear design direction for you."}
            </small>
          </div>
        )}
        {step === 5 && (
          <div className="design-review" data-testid="design-guidance-result">
            <div className="review-jewel">
              <span>{type}</span>
            </div>
            <div>
              <p className="eyebrow">Your design direction</p>
              <p className="guidance-copy">
                {guidance ||
                  "Your design direction is ready for the next stage."}
              </p>
              <button
                className="text-button"
                onClick={() => setStep(2)}
                data-testid="adjust-description-button"
              >
                Adjust the description
              </button>
            </div>
          </div>
        )}
        {step === 6 && (
          <div className="confirmation-card" data-testid="design-confirmation">
            <p className="eyebrow">Private design summary</p>
            <dl>
              <div>
                <dt>Piece</dt>
                <dd>{type}</dd>
              </div>
              <div>
                <dt>Metal</dt>
                <dd>{metal}</dd>
              </div>
              <div>
                <dt>Your idea</dt>
                <dd>{description}</dd>
              </div>
            </dl>
            <p>
              When you confirm, your private design will be saved and our team
              can prepare your next step.
            </p>
          </div>
        )}
        {error && (
          <p className="inline-error" data-testid="designer-error-message">
            {error}
          </p>
        )}
        <div className="focused-actions">
          <button
            className="text-button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1 || isGuiding}
            data-testid="designer-back-button"
          >
            Back
          </button>
          <button
            className="button button--plum"
            onClick={moveForward}
            disabled={isGuiding}
            data-testid="designer-primary-button"
          >
            {step === 6
              ? "Confirm my design"
              : step === 4
                ? "Create my design"
                : "Continue"}
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
