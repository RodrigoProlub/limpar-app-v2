export default function ConfirmDialog({ message, onCancel, onConfirm, confirmLabel, confirmIcon, danger }) {
  const isDanger = danger !== false
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 360 }}>
        <div className="modal-body" style={{ paddingTop: '1.4rem' }}>
          <p style={{ fontSize: 14, marginBottom: '1.2rem' }}>{message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={onCancel}>Cancelar</button>
            <button className={isDanger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
              <i className={'fas ' + (confirmIcon || (isDanger ? 'fa-trash' : 'fa-check'))}></i> {confirmLabel || (isDanger ? 'Excluir' : 'Confirmar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
