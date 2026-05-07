/**
 * CommentPanel — review-mode notes attached to the selected element.
 *
 * Visible iff `mode === 'comment' && selected != null`. Lets the
 * reviewer attach plain-text notes to an element keyed by
 * `data-uid ?? selector`. Storage is in-memory (CommentStore) for now;
 * persistence is a future Phase concern.
 */
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Trash2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardHeader, CardContent } from '@/shared/ui/Card';
import type { UIStore } from '@/shared/stores/UIStore';
import type { SelectionStore } from '@/shared/stores/SelectionStore';
import type { CommentStore } from '@/shared/stores/CommentStore';
import { buildSelector } from '@/shared/types/changes';

interface Props {
  uiStore: UIStore;
  selectionStore: SelectionStore;
  commentStore: CommentStore;
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const CommentPanel = observer(({ uiStore, selectionStore, commentStore }: Props) => {
  const visible =
    uiStore.visible && uiStore.mode === 'comment' && selectionStore.selected != null;
  const [draft, setDraft] = React.useState('');

  if (!visible) return null;
  const target = selectionStore.selected!;
  const list = commentStore.listForTarget(target);

  const submit = () => {
    const c = commentStore.add(target, draft);
    if (c) setDraft('');
  };

  return (
    <aside
      role="complementary"
      aria-label="paperx comment panel"
      data-testid="paperx-comment-panel"
      className="paperx-surface fixed right-4 top-14 bottom-4 z-[2147483640] w-[280px] overflow-y-auto rounded-lg p-2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="mb-2 px-1 pt-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Selection
        </div>
        <div className="truncate font-mono text-[11px]">{buildSelector(target)}</div>
      </header>

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
            className="w-full resize-none rounded border bg-background p-1.5 text-[11px] outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="mt-1 flex justify-end">
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

      <Card>
        <CardHeader className="text-[10px] uppercase">
          Comments ({list.length})
        </CardHeader>
        <CardContent className="space-y-1.5">
          {list.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">No comments yet.</div>
          ) : (
            list
              .slice()
              .reverse()
              .map((c) => (
                <div
                  key={c.id}
                  className="group flex items-start gap-1.5 rounded border p-1.5"
                >
                  <div className="flex-1">
                    <div className="text-[11px] leading-snug">{c.text}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {fmtTs(c.ts)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => commentStore.remove(c.id)}
                    aria-label="Delete comment"
                    title="Delete"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </aside>
  );
});
CommentPanel.displayName = 'CommentPanel';
