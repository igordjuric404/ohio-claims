import { useState } from "react";

export function TruncatedValue({
  value,
  maxLen = 20,
  mono = false,
}: {
  value: string;
  maxLen?: number;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isLong = value.length > maxLen;
  const display = isLong ? value.substring(0, maxLen) + "..." : value;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className={`truncated-value ${mono ? "monospace" : ""}`}>
      <span className="truncated-text" title={value}>{display}</span>
      {isLong && (
        <button className="copy-btn" onClick={handleCopy} title="Copy full value">
          {copied ? "✓" : "⧉"}
        </button>
      )}
    </span>
  );
}
