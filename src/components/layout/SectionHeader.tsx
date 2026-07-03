import type { ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  centered?: boolean;
  className?: string;
};

export default function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  centered = false,
  className,
}: SectionHeaderProps) {
  return (
    <div className={`section-header${centered ? " is-centered" : ""}${className ? ` ${className}` : ""}`}>
      <div className="section-copy">
        {eyebrow ? <div className="section-eyebrow">{eyebrow}</div> : null}
        <h2 className="section-title">{title}</h2>
        {description ? <p className="section-desc">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
