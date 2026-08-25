"use client";

import { useEffect, useState } from "react";

interface PreHydrationLoaderProps {
  show?: boolean;
  text?: string;
}

/**
 * Pre-hydration loader with SVG ring/ball animation.
 *
 * Renders on top of the raw #pre-hydration-bg div (which has the correct
 * theme background immediately via [data-theme] CSS selectors).
 *
 * Uses [data-theme] selectors with hardcoded colors matching app/globals.css
 * (not CSS variables, because globals.css may not be fully applied during
 * early hydration). The no-flash script sets data-theme before hydration,
 * so the correct colors are applied from the first render.
 */
export default function PreHydrationLoader({
  show = true,
  text = "Preparing your workspace…",
}: PreHydrationLoaderProps) {
  const [hidden, setHidden] = useState(!show);

  useEffect(() => {
    if (show) {
      setHidden(false);
    } else {
      const t = setTimeout(() => setHidden(true), 400);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (hidden) return null;

  return (
    <>
      <style>{`
        .pre-hydration-loader {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          z-index: 99999;
          transition: opacity 0.4s ease;
          background: transparent;
        }
        .pre-hydration-loader.fade-out {
          opacity: 0;
          pointer-events: none;
        }
        .pl {
          display: block;
          width: 6.25em;
          height: 6.25em;
        }
        .pl__ring, .pl__ball {
          animation: pl-ring 2s ease-out infinite;
        }
        .pl__ball {
          animation-name: pl-ball;
        }
        @keyframes pl-ring {
          from { stroke-dasharray: 0 257 0 0 1 0 0 258; }
          25%  { stroke-dasharray: 0 0 0 0 257 0 258 0; }
          50%, to { stroke-dasharray: 0 0 0 0 0 515 0 0; }
        }
        @keyframes pl-ball {
          from, 50%  { animation-timing-function: ease-in; stroke-dashoffset: 1; }
          64%        { animation-timing-function: ease-in; stroke-dashoffset: -109; }
          78%        { animation-timing-function: ease-in; stroke-dashoffset: -145; }
          92%        { animation-timing-function: ease-in; stroke-dashoffset: -157; }
          57%, 71%, 85%, 99%, to {
            animation-timing-function: ease-out;
            stroke-dashoffset: -163;
          }
        }
        .pl-brand {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: -0.01em;
          /* Light: --color-title (#444050) */
          color: #444050;
        }
        [data-theme="dark"] .pl-brand {
          /* Dark: --color-title (#e4e4ef) */
          color: #e4e4ef;
        }
        .pl-brand span {
          /* Purple gradient — matches --color-primary (#7367f0) */
          background: linear-gradient(90deg, #7367f0, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        [data-theme="dark"] .pl-brand span {
          /* Dark: lighter purple gradient */
          background: linear-gradient(90deg, #7367f0, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .pl-text {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 500;
          font-size: 0.72rem;
          letter-spacing: 0.04em;
          margin-top: -0.5rem;
          /* Light: --color-text-secondary (#7d7f85) */
          color: #7d7f85;
        }
        [data-theme="dark"] .pl-text {
          /* Dark: --color-text-secondary (#a0a0b5) */
          color: #a0a0b5;
        }
      `}</style>
      <div
        className={show ? "pre-hydration-loader" : "pre-hydration-loader fade-out"}
      >
        <svg className="pl" viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="pl-grad1" x1="1" y1="0.5" x2="0" y2="0.5">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#7367f0" />
            </linearGradient>
            <linearGradient id="pl-grad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#7367f0" />
            </linearGradient>
          </defs>
          <circle className="pl__ring" cx="100" cy="100" r="82" fill="none"
            stroke="url(#pl-grad1)" strokeWidth="36"
            strokeDasharray="0 257 1 257" strokeDashoffset="0.01"
            strokeLinecap="round" transform="rotate(-90,100,100)" />
          <line className="pl__ball" stroke="url(#pl-grad2)"
            x1="100" y1="18" x2="100.01" y2="182"
            strokeWidth="36" strokeDasharray="1 165" strokeLinecap="round" />
        </svg>
        <div className="pl-brand">Teco<span>Chat</span></div>
        <div className="pl-text">{text}</div>
      </div>
    </>
  );
}
