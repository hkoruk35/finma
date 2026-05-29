interface PageHeaderProps {
  badge?: string
  title: string
  accent?: string
  subtitle?: string
  right?: React.ReactNode
}

export default function PageHeader({ badge, title, accent, subtitle, right }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between flex-wrap gap-3 border-b border-white/5 pb-6">
      <div>
        {badge && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00d2ff] font-mono">{badge}</span>
          </div>
        )}
        <h1 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-white leading-none">
          {title}
          {accent && <span className="text-[#3b82f6] ml-2 not-italic">{accent}</span>}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-white/40 font-mono uppercase tracking-widest mt-1.5">{subtitle}</p>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}
