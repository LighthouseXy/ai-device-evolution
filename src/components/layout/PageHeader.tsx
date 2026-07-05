import type { ReactNode } from "react";
import TickDivider from "@/components/layout/TickDivider";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={`page-header${className ? ` ${className}` : ""}`}>
      <div className="page-header-inner">
        <div className="page-header-copy">
          {eyebrow ? <div className="page-header-kicker">{eyebrow}</div> : null}
          <h1 className="page-header-title">{title}</h1>
          {description ? <p className="page-header-desc">{description}</p> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
        {meta ? <div className="page-header-meta">{meta}</div> : null}
      </div>
      <TickDivider count={28} className="site-container page-header-divider" />
    </header>
  );
}
