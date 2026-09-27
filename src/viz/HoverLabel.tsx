// A small tooltip chip that follows the pointer over the canvas, describing
// whatever's underneath it (gate type, stall produce, path, agent...) so the
// user can tell what's there without clicking. Used by both the Editor and
// Simulate canvases.

export function HoverLabel({
  text,
  x,
  y,
  containerWidth,
  containerHeight,
}: {
  text: string | null;
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
}) {
  if (!text) return null;
  const estWidth = Math.min(240, 8 * text.length + 20);
  const estHeight = 26;
  const flipX = x + 14 + estWidth > containerWidth;
  const flipY = y + 14 + estHeight > containerHeight;
  const left = flipX ? x - 14 - estWidth : x + 14;
  const top = flipY ? y - 14 - estHeight : y + 14;
  return (
    <div
      className="pointer-events-none absolute z-30 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-lg"
      style={{ left, top, background: 'rgba(29,27,23,0.92)' }}
    >
      {text}
    </div>
  );
}
