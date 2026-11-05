/** Rolling-digit counter. Each digit is a vertical strip 0–9 translated into place. */
export function Odometer({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`odo ${className}`} aria-label={value} role="text">
      {value.split('').map((ch, i) => {
        const d = ch.charCodeAt(0) - 48;
        if (d < 0 || d > 9) {
          return (
            <span key={`s${i}-${ch}`} className="odo-sym" aria-hidden>
              {ch}
            </span>
          );
        }
        return (
          <span key={`d${value.length - i}`} className="odo-digit" aria-hidden>
            <span className="odo-strip" style={{ transform: `translateY(${-d * 10}%)` }}>
              {'0123456789'.split('').map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
