export default function Placeholder({ label, tone }) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
  const style = {
    background: `linear-gradient(135deg, hsl(${h}, 10%, 82%) 0%, hsl(${h}, 15%, 72%) 100%)`,
  };
  return (
    <div className={`ph ph-${tone}`} style={style}>
      <div className="ph-grid"></div>
      {tone !== "gallery" && <div className="ph-label">{label}</div>}
    </div>
  );
}
