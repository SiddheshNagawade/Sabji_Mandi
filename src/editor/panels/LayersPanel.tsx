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
    <div className="border-b border-neutral-200 p-2 text-xs">
      <div className="mb-1 font-semibold text-neutral-500">Layers</div>
      <div className="mb-2 grid grid-cols-2 gap-x-2 gap-y-1">
        {LAYERS.map((l) => (
          <label key={l.id} className="flex items-center gap-1">
            <input type="checkbox" checked={layerVisible[l.id]} onChange={() => toggleLayerVisible(l.id)} />
            {l.label}
          </label>
        ))}
      </div>

      <div className="mb-1 font-semibold text-neutral-500">Background trace</div>
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
      <button className="mb-2 w-full rounded bg-neutral-100 px-2 py-1" onClick={() => fileInputRef.current?.click()}>
        Import image…
      </button>
      {background && (
        <>
          <label className="mb-1 flex items-center justify-between">
            Opacity
            <input type="range" min={0} max={1} step={0.05} value={background.opacity} onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))} />
          </label>
          <label className="mb-2 flex items-center justify-between">
            Rotation
            <input type="range" min={-180} max={180} step={1} value={background.rotationDeg} onChange={(e) => setBackgroundRotation(parseFloat(e.target.value))} />
          </label>
          <div className="mb-2 flex gap-1">
            <button className={`flex-1 rounded px-1 py-1 ${bgMode === 'move' ? 'bg-neutral-800 text-white' : 'bg-neutral-100'}`} onClick={() => setBgMode(bgMode === 'move' ? 'none' : 'move')}>
              Move
            </button>
            <button className={`flex-1 rounded px-1 py-1 ${bgMode === 'calibrate' ? 'bg-neutral-800 text-white' : 'bg-neutral-100'}`} onClick={() => setBgMode(bgMode === 'calibrate' ? 'none' : 'calibrate')}>
              Calibrate
            </button>
          </div>
          {bgMode === 'calibrate' && <p className="text-[10px] text-neutral-500">Click two points on the image, then enter the real distance between them.</p>}
          {background.calibration && (
            <p className="text-[10px] text-neutral-500">
              Calibrated: {background.calibration.realMetres} m over {Math.hypot(background.calibration.pxB.x - background.calibration.pxA.x, background.calibration.pxB.y - background.calibration.pxA.y).toFixed(0)} px
            </p>
          )}
        </>
      )}
    </div>
  );
}
