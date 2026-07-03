import type { ReactNode } from "react";

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
        <div className="grid gap-4">
          {eyebrow ? <div className="page-header-kicker">{eyebrow}</div> : null}
          <h1 className="page-header-title">{title}</h1>
          {description ? <p className="page-header-desc">{description}</p> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
        {meta ? <div className="page-header-meta">{meta}</div> : null}
      </div>
    </header>
  );
}
