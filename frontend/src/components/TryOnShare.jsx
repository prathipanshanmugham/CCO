import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, WhatsappLogo, X } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";

export function TryOnShare({ jewelleryType, metal, onClose }) {
  const [cameraError, setCameraError] = useState("");
  const video = useRef(null);
  const stream = useRef(null);
  const mobileLink = useMemo(
    () =>
      `${window.location.origin}/?type=${encodeURIComponent(jewelleryType)}&metal=${encodeURIComponent(metal)}&tryon=1`,
    [jewelleryType, metal],
  );
  const whatsappLink = useMemo(
    () =>
      `https://wa.me/?text=${encodeURIComponent(`Take a look at my Clelia & Co. ${jewelleryType} design: ${mobileLink}`)}`,
    [jewelleryType, mobileLink],
  );

  useEffect(
    () => () => stream.current?.getTracks().forEach((track) => track.stop()),
    [],
  );

  const openCamera = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      video.current.srcObject = stream.current;
      setCameraError("");
    } catch {
      setCameraError(
        "Camera access was not available. Open this link on your phone and allow camera access to try your piece on.",
      );
    }
  };

  return (
    <div
      className="tryon-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="tryon-share-dialog"
    >
      <div className="tryon-dialog">
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="Close try-on"
          data-testid="close-tryon-dialog"
        >
          <X size={20} />
        </button>
        <p className="eyebrow">Mobile try-on</p>
        <h2>Open this on your phone.</h2>
        <p>
          Scan the code with your phone camera to open the interactive view on
          your mobile device.
        </p>
        <div className="qr-wrap" data-testid="tryon-qr-code">
          <QRCodeSVG value={mobileLink} size={176} includeMargin />
        </div>
        <a
          className="button button--outline whatsapp-share"
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          data-testid="share-tryon-whatsapp-link"
        >
          <WhatsappLogo size={18} /> Send with WhatsApp
        </a>
        <button
          className="button button--plum"
          onClick={openCamera}
          data-testid="open-tryon-camera-button"
        >
          <Camera size={18} /> Use this camera
        </button>
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          data-testid="tryon-camera-preview"
        />
        <p className="inline-error" data-testid="tryon-camera-error">
          {cameraError}
        </p>
      </div>
    </div>
  );
}
