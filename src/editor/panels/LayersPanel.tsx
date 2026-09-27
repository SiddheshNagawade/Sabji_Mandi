import { useRef } from 'react';
import { useAppStore } from '../../app/store';
import type { LayerName } from '../../app/store';

const LAYERS: { id: LayerName | 'background'; label: string }[] = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'object', label: 'Objects' },
  { id: 'flow', label: 'Flow' },
  { id: 'zone', label: 'Zones' },
  { id: 'shade', label: 'Shade' },
  { id: 'locked', label: 'Locked' },
  { id: 'background', label: 'Background' },
];

export function LayersPanel() {
  const layerVisible = useAppStore((s) => s.layerVisible);
  const toggleLayerVisible = useAppStore((s) => s.toggleLayerVisible);
  const background = useAppStore((s) => s.project.background);
  const setBackgroundImage = useAppStore((s) => s.setBackgroundImage);
  const setBackgroundOpacity = useAppStore((s) => s.setBackgroundOpacity);
  const setBackgroundRotation = useAppStore((s) => s.setBackgroundRotation);
  const bgMode = useAppStore((s) => s.bgMode);
  const setBgMode = useAppStore((s) => s.setBgMode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="text-xs">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-faint)' }}>
        Layers
      </div>
      <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
        {LAYERS.map((l) => (
          <label key={l.id} className="flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" checked={layerVisible[l.id]} onChange={() => toggleLayerVisible(l.id)} />
            {l.label}
          </label>
        ))}
      </div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-faint)' }}>
        Background trace
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setBackgroundImage(reader.result as string);
          reader.readAsDataURL(file);
          e.currentTarget.value = '';
        }}
      />
      <button
        className="mb-2 w-full rounded-lg px-2 py-1.5 text-[11px] font-medium transition hover:brightness-95"
        style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
        onClick={() => fileInputRef.current?.click()}
      >
        Import image…
      </button>
      {background && (
        <>
          <label className="mb-1 flex items-center justify-between" style={{ color: 'var(--color-text)' }}>
            Opacity
            <input type="range" min={0} max={1} step={0.05} value={background.opacity} onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))} />
          </label>
          <label className="mb-2 flex items-center justify-between" style={{ color: 'var(--color-text)' }}>
            Rotation
            <input type="range" min={-180} max={180} step={1} value={background.rotationDeg} onChange={(e) => setBackgroundRotation(parseFloat(e.target.value))} />
          </label>
          <div className="mb-2 flex gap-1">
            <button
              className="flex-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition"
              style={bgMode === 'move' ? { background: 'var(--color-accent)', color: '#fff' } : { background: 'var(--color-bg)', color: 'var(--color-text)' }}
              onClick={() => setBgMode(bgMode === 'move' ? 'none' : 'move')}
            >
              Move
            </button>
            <button
              className="flex-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition"
              style={bgMode === 'calibrate' ? { background: 'var(--color-accent)', color: '#fff' } : { background: 'var(--color-bg)', color: 'var(--color-text)' }}
              onClick={() => setBgMode(bgMode === 'calibrate' ? 'none' : 'calibrate')}
            >
              Calibrate
            </button>
          </div>
          {bgMode === 'calibrate' && (
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Click two points on the image, then enter the real distance between them.
            </p>
          )}
          {background.calibration && (
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Calibrated: {background.calibration.realMetres} m over {Math.hypot(background.calibration.pxB.x - background.calibration.pxA.x, background.calibration.pxB.y - background.calibration.pxA.y).toFixed(0)} px
            </p>
          )}
        </>
      )}
    </div>
  );
}
