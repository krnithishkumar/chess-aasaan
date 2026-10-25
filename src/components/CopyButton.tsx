import { useState } from 'react';

export default function CopyButton({ text, label }: { text: () => string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}
