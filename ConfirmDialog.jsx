export default function ConfirmDialog({ message, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 360 }}>
        <div className="modal-body" style={{ paddingTop: '1.4rem' }}>
          <p style={{ fontSize: 14, marginBottom: '1.2rem' }}>{message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={onCancel}>Cancelar</button>
            <button className="btn btn-danger" onClick={onConfirm}>
              <i className="fas fa-trash"></i> Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
