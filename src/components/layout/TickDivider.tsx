type TickDividerProps = {
  count?: number;
  className?: string;
};

export default function TickDivider({ count = 30, className }: TickDividerProps) {
  return (
    <div className={`tick-divider${className ? ` ${className}` : ""}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span className="tick" key={index} />
      ))}
    </div>
  );
}
