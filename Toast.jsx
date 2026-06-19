export default function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={'toast' + (t.type === 'error' ? ' error' : t.type === 'warning' ? ' warning' : '')}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
