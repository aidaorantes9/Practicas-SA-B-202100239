interface ChromeHeaderProps {
  subtitle: string;
}

export function ChromeHeader({ subtitle }: ChromeHeaderProps) {
  return (
    <div className="chrome-header">
      <div className="retro-logo">
        <div className="logo-chrome">SA</div>
      </div>
      <h1 className="y2k-title">Software Avanzado</h1>
      <p className="retro-subtitle">{subtitle}</p>
    </div>
  );
}