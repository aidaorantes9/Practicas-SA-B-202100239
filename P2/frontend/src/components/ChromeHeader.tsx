interface ChromeHeaderProps {
  subtitle: string;
}

export function ChromeHeader({ subtitle }: ChromeHeaderProps) {
  return (
    <div className="chrome-header">
      <div className="retro-logo">
        <div className="chrome-glow"></div>
        <div className="logo-chrome">Práctica{'\n'}2</div>
      </div>
      <h1 className="y2k-title">
        <span className="title-chrome">SOFTWARE</span>
        <span className="title-neon">AVANZADO</span>
      </h1>
      <p className="retro-subtitle">{subtitle}</p>
    </div>
  );
}