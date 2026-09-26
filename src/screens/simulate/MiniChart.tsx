import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export function MiniChart({ title, x, y, color }: { title: string; x: number[]; y: number[]; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    plotRef.current = new uPlot(
      {
        width: containerRef.current.clientWidth || 240,
        height: 90,
        series: [{}, { stroke: color, width: 1.5, fill: `${color}22` }],
        axes: [{ show: true, size: 24, stroke: '#888', font: '10px sans-serif' }, { show: true, size: 34, stroke: '#888', font: '10px sans-serif' }],
        legend: { show: false },
        cursor: { show: true, points: { show: false } },
        scales: { x: { time: false } },
      },
      [x.length > 0 ? x : [0], y.length > 0 ? y : [0]],
      containerRef.current,
    );
    return () => {
      plotRef.current?.destroy();
      plotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    plotRef.current?.setData([x.length > 0 ? x : [0], y.length > 0 ? y : [0]]);
  }, [x, y]);

  return (
    <div className="mb-2">
      <div className="mb-0.5 text-[10px] font-semibold text-neutral-500">{title}</div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
