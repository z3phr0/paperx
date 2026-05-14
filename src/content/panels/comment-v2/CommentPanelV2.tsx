/**
 * CommentPanelV2 — Comment-mode review notes, rebuilt on the v2 design
 * system. Replaces the v1 Tailwind/aside surface with a `.dv-inspector`
 * container, dropping the hardcoded `right:4; top:14` anchor for the
 * same `pickPanelPosition()` DOM-following machinery DesignPanelV2
 * uses, and adding the `resolved` state + explicit P0/P1/P2 composer
 * pills from the design handoff.
 *
 * Subcomponents (colocated to keep the v0.13.0 surface area contained):
 *   - PriorityPills — explicit P0/P1/P2 picker for the composer
 *   - PriBadge      — compact chip for the list-item header
 *   - Thumbnail     — snapdom PNG / skeleton / color swatch fallback
 *   - CommentListItem — full row (header + thumbnail + body + actions)
 *
 * Test-id stability: preserves the v1 ids the e2e suite reads (panel /
 * input / submit / priority-pick-X / locate-{id} / export / import /
 * import-file / toast / thumb-*) so most tests survive intact. v0.13.0
 * adds testids for the new resolve / delete / item-row affordances.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { CommentStore } from '@/shared/stores/CommentStore';
import { Icon, IconButton, Section } from '@/shared/ui-v2';
import { pickPanelPosition, type Bbox } from '@/shared/utils/positionPanel';
import { getHoverTooltipRect } from '@/content/overlays/HoverTooltip';
import { buildSelector } from '@/shared/types/changes';
import {
  COMMENT_PRIORITIES,
  COMMENT_PRI_MAP,
  DEFAULT_PRIORITY,
  parseCommentsV1,
  type CommentPriority,
  type PaperxComment,
} from '@/shared/types/comments';

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 800;
const PANEL_GAP = 12;
const PANEL_HANDLE_PAD = 12;
const PANEL_MARGIN = 8;

const DEFAULT_TOOLBAR_W = 320;
const DEFAULT_TOOLBAR_H = 48;
const DEFAULT_TOOLBAR_INSET = 24;

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  commentStore: CommentStore;
}

function toolbarBbox(
  pos: { x: number; y: number } | null,
  viewport: { width: number; height: number },
): Bbox {
  if (pos != null) {
    return {
      left: pos.x,
      top: pos.y,
      right: pos.x + DEFAULT_TOOLBAR_W,
      bottom: pos.y + DEFAULT_TOOLBAR_H,
    };
  }
  const left = viewport.width - DEFAULT_TOOLBAR_INSET - DEFAULT_TOOLBAR_W;
  const top = DEFAULT_TOOLBAR_INSET;
  return {
    left,
    top,
    right: left + DEFAULT_TOOLBAR_W,
    bottom: top + DEFAULT_TOOLBAR_H,
  };
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────────────────
 * Subcomponents
 * ──────────────────────────────────────────────────────────────────── */

interface PriorityPillsProps {
  value: CommentPriority;
  onChange: (next: CommentPriority) => void;
}

const PriorityPills: React.FC<PriorityPillsProps> = ({ value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    {COMMENT_PRIORITIES.map((p) => {
      const c = COMMENT_PRI_MAP[p];
      const active = value === p;
      return (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          data-testid={`paperx-comment-priority-pick-${p}`}
          aria-pressed={active}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 20,
            padding: '0 8px',
            borderRadius: 10,
            border: `1px solid ${active ? c.fg : 'var(--dv-border)'}`,
            background: active ? c.soft : 'transparent',
            color: active ? c.fg : 'var(--dv-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.02em',
            transition: 'all 120ms',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: c.dot,
            }}
          />
          {p}
        </button>
      );
    })}
  </div>
);

const PriBadge: React.FC<{
  priority: CommentPriority;
  'data-testid'?: string;
}> = ({ priority, ...rest }) => {
  const c = COMMENT_PRI_MAP[priority];
  return (
    <span
      data-testid={rest['data-testid']}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 18,
        padding: '0 6px',
        borderRadius: 9,
        border: `1px solid ${c.fg}`,
        background: c.soft,
        color: c.fg,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
      }}
    >
      <span
        aria-hidden
        style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }}
      />
      {priority}
    </span>
  );
};

const Thumbnail: React.FC<{ comment: PaperxComment }> = ({ comment }) => {
  const hasImage =
    typeof comment.thumbnailDataUrl === 'string' && comment.thumbnailDataUrl.length > 0;
  const isFresh = Date.now() - comment.ts < 3000;
  const skeleton = !hasImage && isFresh;
  const baseBox: React.CSSProperties = {
    width: '100%',
    height: 96,
    borderRadius: 6,
    border: '1px solid var(--dv-border)',
    background: 'var(--dv-bg-input)',
    overflow: 'hidden',
    position: 'relative',
  };
  return (
    <div style={baseBox}>
      {hasImage ? (
        <img
          data-testid="paperx-comment-thumb-img"
          src={comment.thumbnailDataUrl!}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : skeleton ? (
        <div
          data-testid="paperx-comment-thumb-skeleton"
          aria-hidden
          style={{
            width: '100%',
            height: '100%',
            animation: 'paperx-comment-skeleton 1.2s ease-in-out infinite',
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)',
          }}
        />
      ) : (
        <div
          data-testid="paperx-comment-thumb-color"
          style={{
            width: '100%',
            height: '100%',
            background: comment.thumbnailColor ?? 'var(--dv-bg-input)',
          }}
          title={comment.thumbnailColor ?? 'no background'}
        />
      )}
      {/* AUTO badge */}
      <span
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '2px 5px',
          borderRadius: 4,
          background: 'rgba(10,10,10,0.7)',
          color: '#fff',
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: '0.04em',
          fontFamily: 'JetBrains Mono, monospace',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span
          style={{ width: 4, height: 4, borderRadius: '50%', background: '#EF4444' }}
        />
        AUTO
      </span>
    </div>
  );
};

interface CommentListItemProps {
  comment: PaperxComment;
  commentStore: CommentStore;
  uiStore: UIStore;
  onToast: (msg: string) => void;
}

const CommentListItem: React.FC<CommentListItemProps> = ({
  comment,
  commentStore,
  uiStore,
  onToast,
}) => {
  const resolved = comment.resolved === true;
  const locate = (): void => {
    const el = commentStore.getTargetById(comment.id);
    if (!el || !el.isConnected) {
      onToast('Element no longer in DOM');
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    uiStore.flashAt(comment.id);
    onToast(`Located ${comment.targetLabel}`);
  };
  const toggleResolved = (): void => {
    commentStore.setResolved(comment.id, !resolved);
  };
  return (
    <div
      data-testid={`paperx-comment-item-${comment.id}`}
      style={{
        padding: 10,
        background: 'var(--dv-bg-input)',
        border: '1px solid var(--dv-border)',
        borderRadius: 'var(--dv-r-section)',
        opacity: resolved ? 0.68 : 1,
        transition: 'opacity 200ms',
      }}
    >
      {/* Header row: priority · selector · resolved · time */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <PriBadge
          priority={comment.priority}
          data-testid={`paperx-comment-priority-${comment.id}`}
        />
        <span
          data-testid={`paperx-comment-selector-${comment.id}`}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--dv-accent)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={comment.targetLabel}
        >
          {comment.targetLabel}
        </span>
        {resolved && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: '#16A34A',
              padding: '2px 5px',
              borderRadius: 4,
              background: 'rgba(22,163,74,0.14)',
            }}
          >
            <Icon name="check" size={9} />
            RESOLVED
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--dv-text-muted)' }}>
          {fmtRelative(comment.ts)}
        </span>
      </div>

      {/* Thumbnail */}
      <div style={{ marginBottom: 8 }}>
        <Thumbnail comment={comment} />
      </div>

      {/* Body */}
      <div
        style={{
          fontSize: 11.5,
          lineHeight: 1.45,
          color: 'var(--dv-text)',
          marginBottom: 8,
          wordBreak: 'break-word',
          textDecoration: resolved ? 'line-through' : 'none',
          textDecorationColor: resolved ? 'var(--dv-text-muted)' : 'inherit',
        }}
      >
        {comment.text}
      </div>

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          justifyContent: 'flex-end',
        }}
      >
        <IconButton
          icon="locate"
          title="Locate in page"
          onClick={locate}
          data-testid={`paperx-comment-locate-${comment.id}`}
        />
        <IconButton
          icon={resolved ? 'reset' : 'check'}
          title={resolved ? 'Reopen' : 'Resolve'}
          onClick={toggleResolved}
          data-testid={`paperx-comment-resolve-${comment.id}`}
        />
        <IconButton
          icon="minus"
          title="Delete"
          onClick={() => commentStore.remove(comment.id)}
          data-testid={`paperx-comment-delete-${comment.id}`}
        />
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────
 * Main panel
 * ──────────────────────────────────────────────────────────────────── */

export const CommentPanelV2 = observer(
  ({ uiStore, selectionStore, commentStore }: Props) => {
    const visible =
      uiStore.visible &&
      uiStore.mode === 'comment' &&
      selectionStore.selected != null;

    const [draft, setDraft] = React.useState('');
    const [draftPriority, setDraftPriority] =
      React.useState<CommentPriority>(DEFAULT_PRIORITY);
    const [toast, setToast] = React.useState('');
    const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const showToast = React.useCallback((msg: string) => {
      setToast(msg);
      if (toastTimerRef.current != null) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(''), 4000);
    }, []);

    const [vp, setVp] = React.useState<{ width: number; height: number }>(() => ({
      width: typeof window !== 'undefined' ? window.innerWidth : 1280,
      height: typeof window !== 'undefined' ? window.innerHeight : 800,
    }));

    React.useEffect(() => {
      if (!visible) return;
      let raf = 0;
      const onChange = (): void => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          setVp({ width: window.innerWidth, height: window.innerHeight });
          selectionStore.refresh();
        });
      };
      window.addEventListener('resize', onChange);
      window.addEventListener('scroll', onChange, true);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onChange);
        window.removeEventListener('scroll', onChange, true);
      };
    }, [selectionStore, visible]);

    if (!visible) return null;
    const target = selectionStore.selected!;

    const selectedRect = selectionStore.selectedRect;
    const hovered = selectionStore.hovered;
    const hoveredRect = selectionStore.hoveredRect;
    const tbarPos = uiStore.toolbarPosition;

    const avoid: Bbox[] = [toolbarBbox(tbarPos, vp)];
    if (
      hovered != null &&
      hovered !== selectionStore.selected &&
      hoveredRect != null
    ) {
      avoid.push(getHoverTooltipRect(hoveredRect, vp));
    }

    const panelSize = {
      width: PANEL_WIDTH,
      height: Math.min(PANEL_MAX_HEIGHT, vp.height - 2 * PANEL_MARGIN),
    };
    const placement = pickPanelPosition({
      targetRect: selectedRect,
      panelSize,
      viewport: vp,
      avoid,
      gap: PANEL_GAP,
      handlePad: PANEL_HANDLE_PAD,
      margin: PANEL_MARGIN,
    });

    const height = Math.max(
      160,
      Math.min(PANEL_MAX_HEIGHT, vp.height - placement.top - PANEL_MARGIN),
    );

    const submit = (): void => {
      const c = commentStore.add(target, draft, draftPriority);
      if (c) setDraft('');
    };

    const onExport = (): void => {
      const payload = commentStore.exportV1();
      downloadJson(
        `paperx-comments-${new Date().toISOString().slice(0, 10)}.json`,
        payload,
      );
    };

    const onImportClick = (): void => fileInputRef.current?.click();
    const onImportFile = async (
      e: React.ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = parseCommentsV1(JSON.parse(text));
        const n = commentStore.importMany(parsed.comments);
        showToast(`Imported ${n} comments.`);
      } catch (err) {
        showToast(`Import failed: ${(err as Error).message}`);
      }
    };

    const comments = [...commentStore.comments].reverse();
    const count = comments.length;
    const targetSelector = buildSelector(target);

    return (
      <div
        role="region"
        aria-label="paperx comment panel"
        data-testid="paperx-comment-panel"
        data-mode={uiStore.mode ?? undefined}
        className="dv-inspector"
        style={{
          position: 'fixed',
          left: `${placement.left}px`,
          top: `${placement.top}px`,
          width: `${PANEL_WIDTH}px`,
          height: `${height}px`,
          zIndex: 2147483646,
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px var(--dv-section-pad-x)',
            borderBottom: '1px solid var(--dv-divider)',
            minHeight: 36,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: COMMENT_PRI_MAP[draftPriority].dot,
              boxShadow: `0 0 6px ${COMMENT_PRI_MAP[draftPriority].dot}99`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 11,
              color: 'var(--dv-text-secondary)',
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={targetSelector}
          >
            {targetSelector}
          </span>
          <IconButton
            icon="upload"
            title="Import paperx-comments-v1 JSON"
            onClick={onImportClick}
            data-testid="paperx-comment-import"
          />
          <IconButton
            icon="download"
            title="Export paperx-comments-v1 JSON"
            onClick={onExport}
            disabled={commentStore.comments.length === 0}
            data-testid="paperx-comment-export"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            style={{ display: 'none' }}
            data-testid="paperx-comment-import-file"
          />
        </div>

        {/* Toast */}
        {toast && (
          <div
            data-testid="paperx-comment-toast"
            style={{
              padding: '6px var(--dv-section-pad-x)',
              fontSize: 10.5,
              color: 'var(--dv-text-secondary)',
              background: 'var(--dv-bg-input)',
              borderBottom: '1px solid var(--dv-divider)',
            }}
          >
            {toast}
          </div>
        )}

        {/* Composer */}
        <div
          style={{
            padding: 'var(--dv-section-pad-y) var(--dv-section-pad-x)',
            borderBottom: '1px solid var(--dv-divider)',
          }}
        >
          <textarea
            data-testid="paperx-comment-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Leave a comment…"
            rows={3}
            style={{
              width: '100%',
              resize: 'none',
              border: '1px solid var(--dv-border)',
              borderRadius: 'var(--dv-r-input)',
              background: 'var(--dv-bg-input)',
              outline: 'none',
              padding: '8px 10px',
              fontFamily: 'inherit',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--dv-text)',
              marginBottom: 8,
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            data-testid="paperx-comment-priority-picker"
          >
            <span
              style={{
                fontSize: 10,
                color: 'var(--dv-text-muted)',
                fontWeight: 500,
                marginRight: 2,
              }}
            >
              Priority
            </span>
            <PriorityPills value={draftPriority} onChange={setDraftPriority} />
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              data-testid="paperx-comment-submit"
              style={{
                height: 24,
                padding: '0 14px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--dv-accent)',
                color: '#fff',
                fontSize: 10.5,
                fontWeight: 600,
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
                opacity: draft.trim() ? 1 : 0.45,
                fontFamily: 'inherit',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
              }}
            >
              Comment
            </button>
          </div>
        </div>

        {/* Comments list */}
        <div className="dv-scroll" style={{ flex: 1, minHeight: 0 }}>
          <Section title={`Comments · ${count}`}>
            {count === 0 ? (
              <div
                data-testid="paperx-comment-empty"
                style={{
                  padding: '24px 10px',
                  textAlign: 'center',
                  color: 'var(--dv-text-muted)',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                }}
              >
                No comments yet — switch to Comment mode and click an element to
                leave one.
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                data-testid="paperx-comment-list"
              >
                {comments.map((c) => (
                  <CommentListItem
                    key={c.id}
                    comment={c}
                    commentStore={commentStore}
                    uiStore={uiStore}
                    onToast={showToast}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>

        <style>{`
          @keyframes paperx-comment-skeleton {
            0% { opacity: 0.45; }
            50% { opacity: 0.85; }
            100% { opacity: 0.45; }
          }
        `}</style>
      </div>
    );
  },
);
CommentPanelV2.displayName = 'CommentPanelV2';
