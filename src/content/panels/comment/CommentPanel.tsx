/**
 * CommentPanel — review-mode notes attached to a DOM element.
 *
 * Visible iff `mode === 'comment' && selected != null`. Surfaces:
 *   - new-comment composer with priority selector (P0/P1/P2, default P2)
 *   - "Comments here" — comments attached to the current selection
 *   - "All comments" — every comment in the store, grouped by target
 *   - import / export of paperx-comments-v1 JSON
 *
 * Per-row affordances:
 *   - priority chip (cycle P0→P1→P2 on click; danger / warn / info colors)
 *   - selector + size + color thumbnail block
 *   - locate button (re-resolve via WeakRef + scrollIntoView + flash)
 *   - delete button (hover-revealed)
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Crosshair, Download, Trash2, Upload } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardHeader, CardContent } from '@/shared/ui/Card';
import { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { CommentStore } from '@/shared/stores/CommentStore';
import { buildSelector } from '@/shared/types/changes';
import {
  COMMENT_PRIORITIES,
  DEFAULT_PRIORITY,
  nextPriority,
  parseCommentsV1,
  type CommentPriority,
  type PaperxComment,
} from '@/shared/types/comments';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  commentStore: CommentStore;
}

const PRIORITY_CLASS: Record<CommentPriority, string> = {
  // tailwind utility classes — the host page's styles are scoped out by
  // the Shadow DOM so we can use these freely.
  P0: 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/30',
  P1: 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30',
  P2: 'bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/30',
};

const PRIORITY_LABEL: Record<CommentPriority, string> = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
};

function fmtTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface PriorityChipProps {
  value: CommentPriority;
  onCycle?: () => void;
  testId?: string;
}

const PriorityChip: React.FC<PriorityChipProps> = ({ value, onCycle, testId }) => (
  <button
    type="button"
    onClick={onCycle}
    data-testid={testId}
    className={`inline-flex h-5 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[10px] font-semibold ${PRIORITY_CLASS[value]} ${onCycle ? 'cursor-pointer' : 'cursor-default'}`}
    aria-label={`Priority ${PRIORITY_LABEL[value]}`}
  >
    {PRIORITY_LABEL[value]}
  </button>
);

interface ThumbnailProps {
  comment: PaperxComment;
}

const Thumbnail: React.FC<ThumbnailProps> = ({ comment }) => {
  // Render priority:
  //   1. PNG capture (snapdom) when available — the canonical thumbnail
  //   2. Skeleton placeholder when capture is in-flight (fresh comment,
  //      thumbnailDataUrl still null, less than 3 s old)
  //   3. Sampled color swatch fallback for older / imported comments
  //      whose capture isn't available
  const hasImage = typeof comment.thumbnailDataUrl === 'string' && comment.thumbnailDataUrl.length > 0;
  const isFresh = Date.now() - comment.ts < 3000;
  const skeleton = !hasImage && isFresh;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {hasImage ? (
        <img
          data-testid="paperx-comment-thumb-img"
          src={comment.thumbnailDataUrl!}
          alt=""
          className="h-12 w-12 shrink-0 rounded border border-white/20 object-cover"
        />
      ) : skeleton ? (
        <div
          data-testid="paperx-comment-thumb-skeleton"
          className="h-12 w-12 shrink-0 animate-pulse rounded border border-white/20 bg-white/10"
          aria-hidden
        />
      ) : (
        <div
          data-testid="paperx-comment-thumb-color"
          className="h-12 w-12 shrink-0 rounded border border-white/20"
          style={{ background: comment.thumbnailColor ?? 'transparent' }}
          title={comment.thumbnailColor ?? 'no background'}
        />
      )}
      <div className="text-[9px] leading-tight text-muted-foreground">
        <div className="font-mono">&lt;{comment.tagName}&gt;</div>
        <div>{Math.round(comment.bbox.w)}×{Math.round(comment.bbox.h)}</div>
      </div>
    </div>
  );
};

interface RowProps {
  comment: PaperxComment;
  commentStore: CommentStore;
  uiStore: UIStore;
  onMsg: (msg: string) => void;
  showSelector?: boolean;
}

const Row: React.FC<RowProps> = ({ comment, commentStore, uiStore, onMsg, showSelector }) => {
  const locate = () => {
    const el = commentStore.getTargetById(comment.id);
    if (!el || !el.isConnected) {
      onMsg('Element no longer in DOM');
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    uiStore.flashAt(comment.id);
    onMsg(`Located ${comment.targetLabel}`);
  };
  const cyclePriority = () => {
    commentStore.setPriority(comment.id, nextPriority(comment.priority));
  };
  return (
    <div className="flex items-start gap-2 rounded border border-white/10 bg-white/5 p-1.5">
      <PriorityChip
        value={comment.priority}
        onCycle={cyclePriority}
        testId={`paperx-comment-priority-${comment.id}`}
      />
      <Thumbnail comment={comment} />
      <div className="min-w-0 flex-1">
        <div className="break-words text-[11px] leading-snug">{comment.text}</div>
        {showSelector && (
          <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground" title={comment.targetLabel}>
            {comment.targetLabel}
          </div>
        )}
        <div className="mt-0.5 text-[10px] text-muted-foreground">{fmtTs(comment.ts)}</div>
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 opacity-60 transition hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          onClick={locate}
          aria-label="Locate element"
          title="Locate"
          data-testid={`paperx-comment-locate-${comment.id}`}
          className="h-5 w-5"
        >
          <Crosshair className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => commentStore.remove(comment.id)}
          aria-label="Delete comment"
          title="Delete"
          className="h-5 w-5"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const CommentPanel = observer(({ uiStore, selectionStore, commentStore }: Props) => {
  const visible =
    uiStore.visible && uiStore.mode === 'comment' && selectionStore.selected != null;
  const [draft, setDraft] = React.useState('');
  const [draftPriority, setDraftPriority] = React.useState<CommentPriority>(DEFAULT_PRIORITY);
  const [panelMsg, setPanelMsg] = React.useState<string>('');
  const panelMsgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPanelMsg = React.useCallback((msg: string) => {
    setPanelMsg(msg);
    if (panelMsgTimerRef.current != null) clearTimeout(panelMsgTimerRef.current);
    panelMsgTimerRef.current = setTimeout(() => setPanelMsg(''), 4000);
  }, []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!visible) return null;
  const target = selectionStore.selected!;
  const here = commentStore.listForTarget(target);
  const hereKey = here[0]?.targetKey;
  const others = commentStore.comments.filter((c) => c.targetKey !== hereKey);

  const submit = () => {
    const c = commentStore.add(target, draft, draftPriority);
    if (c) setDraft('');
  };

  const onExport = () => {
    const payload = commentStore.exportV1();
    downloadJson(`paperx-comments-${new Date().toISOString().slice(0, 10)}.json`, payload);
  };

  const onImportClick = () => fileInputRef.current?.click();
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be picked again
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCommentsV1(JSON.parse(text));
      const n = commentStore.importMany(parsed.comments);
      showPanelMsg(`Imported ${n} comments.`);
    } catch (err) {
      showPanelMsg(`Import failed: ${(err as Error).message}`);
    }
  };

  return (
    <aside
      role="complementary"
      aria-label="paperx comment panel"
      data-testid="paperx-comment-panel"
      className="paperx-surface fixed right-4 top-14 bottom-4 z-[2147483640] w-[400px] overflow-y-auto rounded-lg p-2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="mb-2 flex items-start justify-between gap-2 px-1 pt-1">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Selection</div>
          <div className="truncate font-mono text-[11px]">{buildSelector(target)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onImportClick}
            aria-label="Import comments"
            title="Import paperx-comments-v1 JSON"
            data-testid="paperx-comment-import"
            className="h-6 w-6"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExport}
            aria-label="Export comments"
            title="Export paperx-comments-v1 JSON"
            data-testid="paperx-comment-export"
            className="h-6 w-6"
            disabled={commentStore.comments.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            className="hidden"
            data-testid="paperx-comment-import-file"
          />
        </div>
      </header>

      {panelMsg && (
        <div className="mb-2 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-muted-foreground" data-testid="paperx-comment-toast">
          {panelMsg}
        </div>
      )}

      <Card className="mb-2">
        <CardHeader className="text-[10px] uppercase">New comment</CardHeader>
        <CardContent>
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
            placeholder="Add a review note (Cmd/Ctrl+Enter to submit)…"
            rows={3}
            className="w-full resize-none rounded border bg-white/5 p-1.5 text-[11px] outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-1" data-testid="paperx-comment-priority-picker">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Priority</span>
              {COMMENT_PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraftPriority(p)}
                  data-testid={`paperx-comment-priority-pick-${p}`}
                  aria-pressed={draftPriority === p}
                  className={`inline-flex h-5 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[10px] font-semibold ${PRIORITY_CLASS[p]} ${draftPriority === p ? 'ring-2 ring-offset-1 ring-offset-transparent' : 'opacity-60'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={submit}
              disabled={!draft.trim()}
              data-testid="paperx-comment-submit"
              className="h-6 px-2 text-[11px]"
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-2">
        <CardHeader className="text-[10px] uppercase">Comments here ({here.length})</CardHeader>
        <CardContent className="space-y-1.5">
          {here.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">No comments on this element yet.</div>
          ) : (
            here.slice().reverse().map((c) => (
              <Row key={c.id} comment={c} commentStore={commentStore} uiStore={uiStore} onMsg={showPanelMsg} />
            ))
          )}
        </CardContent>
      </Card>

      {others.length > 0 && (
        <Card>
          <CardHeader className="text-[10px] uppercase">All comments ({others.length})</CardHeader>
          <CardContent className="space-y-1.5">
            {others
              .slice()
              .reverse()
              .map((c) => (
                <Row key={c.id} comment={c} commentStore={commentStore} uiStore={uiStore} onMsg={showPanelMsg} showSelector />
              ))}
          </CardContent>
        </Card>
      )}
    </aside>
  );
});
CommentPanel.displayName = 'CommentPanel';
