function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-[28px] border border-border bg-surface p-6 sm:p-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card
