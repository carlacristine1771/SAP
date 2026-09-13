interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  loading?: boolean;
  onChange: (page: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  totalElements,
  loading = false,
  onChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="sap-pagination" aria-label="Paginação de resultados">
      <span className="sap-pagination-summary">
        Página {page + 1} de {totalPages} · {totalElements} registros
      </span>
      <div className="sap-pagination-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onChange(page - 1)}
          disabled={loading || page === 0}
        >
          Anterior
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onChange(page + 1)}
          disabled={loading || page + 1 >= totalPages}
        >
          Próxima
        </button>
      </div>
    </nav>
  );
}
