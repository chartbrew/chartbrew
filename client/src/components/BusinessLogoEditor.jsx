import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import { LuX } from "react-icons/lu";

import { getBusinessLogoFileError } from "../containers/Onboarding/onboardingState";
import { cn } from "../modules/utils";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });
}

function BusinessLogoEditor({
  businessName = "",
  logo = undefined,
  onChange = () => {},
  savedLogoUrl = null,
}) {
  const dragDepth = useRef(0);
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const logoUrl = logo?.data
    ? `data:${logo.mimeType};base64,${logo.data}`
    : logo !== null ? savedLogoUrl : null;

  const loadLogo = async (file) => {
    const nextError = getBusinessLogoFileError(file);
    if (nextError) {
      setError(nextError);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = String(dataUrl).split(",")[1];
      if (!data) throw new Error("Unable to read this image.");
      setError("");
      onChange({ data, mimeType: file.type.toLowerCase() });
    } catch (readError) {
      setError(readError.message);
    }
  };

  const selectLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    loadLogo(file);
  };

  const startDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const endDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const dropLogo = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    loadLogo(event.dataTransfer.files?.[0]);
  };

  return (
    <div
      className="group relative size-[4.5rem] shrink-0"
      onDragEnter={startDrag}
      onDragLeave={endDrag}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={dropLogo}
    >
      <input
        ref={inputRef}
        accept=".ico,.jpeg,.jpg,.png,.webp,image/jpeg,image/png,image/webp,image/x-icon"
        className="sr-only"
        onChange={selectLogo}
        type="file"
      />
      <button
        aria-label={logoUrl ? "Replace team logo. You can also drop an image here." : "Upload team logo. You can also drop an image here."}
        className={cn(
          "relative flex size-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-divider bg-content2 p-2 transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          isDragging && "border-accent ring-2 ring-accent/35"
        )}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {logoUrl ? (
          <img
            alt={`${businessName || "Team"} logo`}
            className="pointer-events-none max-h-full max-w-full object-contain"
            src={logoUrl}
          />
        ) : (
          <span className="font-tw text-xl font-semibold text-muted" aria-hidden="true">
            {(businessName.trim()[0] || "T").toUpperCase()}
          </span>
        )}
        {isDragging ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/90 text-xs font-semibold text-accent-foreground">
            Drop
          </span>
        ) : null}
      </button>
      {logoUrl ? (
        <button
          aria-label="Remove team logo"
          className="absolute -right-2 -top-2 z-10 flex size-7 items-center justify-center rounded-full border border-divider bg-content1 text-muted opacity-0 shadow-sm transition-[opacity,color,background-color] hover:bg-danger hover:text-danger-foreground focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={() => {
            setError("");
            onChange(null);
          }}
          type="button"
        >
          <LuX className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      {error ? (
        <p className="absolute left-0 top-full z-10 mt-2 w-48 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

BusinessLogoEditor.propTypes = {
  businessName: PropTypes.string,
  logo: PropTypes.shape({
    data: PropTypes.string,
    mimeType: PropTypes.string,
  }),
  onChange: PropTypes.func,
  savedLogoUrl: PropTypes.string,
};

export default BusinessLogoEditor;
