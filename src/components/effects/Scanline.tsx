export function Scanline() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1000,
        background:
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(99, 102, 241, 0.015) 2px, rgba(99, 102, 241, 0.015) 4px)',
        animation: 'scanline 8s linear infinite',
      }}
    />
  );
}
