import type { ReactElement } from "react";
import { Button } from "../Button";
import styles from "./DataTable.module.css";

interface PaginationProps {
  pageIndex: number;
  pageCount: number;
  onPageChange: (index: number) => void;
}

export function Pagination({ pageIndex, pageCount, onPageChange }: PaginationProps): ReactElement {
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <div className={styles.pagination}>
      <Button
        size="sm"
        variant="ghost"
        disabled={!canPrev}
        onClick={() => onPageChange(0)}
        aria-label="First page"
      >
        ⏮
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={!canPrev}
        onClick={() => onPageChange(pageIndex - 1)}
        aria-label="Previous page"
      >
        ◀
      </Button>
      <span className={styles.pageInfo}>
        Page {pageIndex + 1} of {Math.max(1, pageCount)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={!canNext}
        onClick={() => onPageChange(pageIndex + 1)}
        aria-label="Next page"
      >
        ▶
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={!canNext}
        onClick={() => onPageChange(pageCount - 1)}
        aria-label="Last page"
      >
        ⏭
      </Button>
    </div>
  );
}
