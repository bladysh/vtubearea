import { ARKIT_BLENDSHAPE_NAMES, type FaceBlendshapes } from "@vtubearea/protocol";

export function BlendshapeMeters({ blendshapes }: { blendshapes: FaceBlendshapes }) {
  return (
    <div className="meter-grid">
      {ARKIT_BLENDSHAPE_NAMES.map((blendshape_name) => {
        const value = blendshapes[blendshape_name] ?? 0;
        return (
          <div key={blendshape_name} className="meter" aria-label={`${blendshape_name}: ${value.toFixed(2)}`}>
            <span className="meter__label">{blendshape_name}</span>
            <span className="meter__track">
              <span className="meter__fill" style={{ width: `${value * 100}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
