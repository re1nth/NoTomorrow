'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionTitle } from '@/components/SectionTitle';
import { Button, Card } from '@/lib/ui';

interface TreeNode {
  id: string;
  question: string;
  children: TreeNode[];
}

interface HistoryPoint {
  day: string;
  score: number;
}

const TEST = {
  slug: 'depth-of-thinking',
  name: 'Depth of Thinking',
  blurb:
    'Pick a topic, keep asking better questions. Go deep, go wide. Score = nodes + 2 × depth + max branching.',
};

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function makeNode(question = ''): TreeNode {
  return { id: crypto.randomUUID(), question, children: [] };
}

function computeStats(tree: TreeNode[]): {
  totalNodes: number;
  maxDepth: number;
  maxBranching: number;
} {
  let totalNodes = 0;
  let maxDepth = 0;
  let maxBranching = 0;
  const walk = (nodes: TreeNode[], depth: number): void => {
    if (nodes.length > maxBranching) maxBranching = nodes.length;
    for (const n of nodes) {
      totalNodes += 1;
      if (depth > maxDepth) maxDepth = depth;
      if (n.children.length > 0) walk(n.children, depth + 1);
    }
  };
  walk(tree, 1);
  return { totalNodes, maxDepth, maxBranching };
}

export default function PerformancePage() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<null | {
    topic: string;
    startedAt: string;
    tree: TreeNode[];
  }>(null);
  const [ending, setEnding] = useState(false);
  const [lastResult, setLastResult] = useState<{
    score: number;
    totalNodes: number;
    maxDepth: number;
    maxBranching: number;
  } | null>(null);
  const [topicDraft, setTopicDraft] = useState('');

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/performance/history?slug=${TEST.slug}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`load failed: ${res.status}`);
      const json = (await res.json()) as { days: HistoryPoint[] };
      setHistory(json.days);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startSession() {
    const topic = topicDraft.trim();
    if (!topic) return;
    setSessionMode({
      topic,
      startedAt: new Date().toISOString(),
      tree: [makeNode('')],
    });
    setLastResult(null);
  }

  async function endSession() {
    if (!sessionMode) return;
    // Prune empty leaves so a stray "+Deeper" click doesn't inflate the score.
    const pruned = pruneEmpty(sessionMode.tree);
    if (pruned.length === 0) {
      setError('write at least one question before ending the session');
      return;
    }
    setEnding(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          testSlug: TEST.slug,
          topic: sessionMode.topic,
          startedAt: sessionMode.startedAt,
          tree: pruned,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `save failed: ${res.status}`);
      }
      const row = (await res.json()) as {
        score: number;
        totalNodes: number;
        maxDepth: number;
        maxBranching: number;
      };
      setLastResult(row);
      setSessionMode(null);
      setTopicDraft('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setEnding(false);
    }
  }

  function updateTree(mut: (tree: TreeNode[]) => TreeNode[]) {
    setSessionMode((s) => (s ? { ...s, tree: mut(s.tree) } : s));
  }

  const liveStats = useMemo(
    () => (sessionMode ? computeStats(pruneEmpty(sessionMode.tree)) : null),
    [sessionMode],
  );
  const liveScore = liveStats
    ? liveStats.totalNodes + 2 * liveStats.maxDepth + liveStats.maxBranching
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle
        title="Performance"
        subtitle="Score yourself on the tests you care about. One data point per day per test."
      />

      {error ? (
        <p className="text-sm text-glove-deep">{error}</p>
      ) : null}

      {sessionMode ? (
        <SessionCard
          topic={sessionMode.topic}
          tree={sessionMode.tree}
          liveStats={liveStats}
          liveScore={liveScore}
          onUpdate={updateTree}
          onEnd={endSession}
          ending={ending}
        />
      ) : (
        <Card>
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl uppercase tracking-wider">{TEST.name}</h2>
              <p className="text-sm text-charcoal-soft mt-1">{TEST.blurb}</p>
            </div>

            {lastResult ? (
              <div className="rounded-glove border border-glove/40 bg-glove/5 px-4 py-3 text-sm">
                <span className="font-display uppercase tracking-wider text-glove-deep">
                  Just saved:
                </span>{' '}
                score <b>{lastResult.score}</b> · {lastResult.totalNodes} nodes ·
                depth {lastResult.maxDepth} · branching {lastResult.maxBranching}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                placeholder="Topic (e.g. 'How does attention work in transformers?')"
                maxLength={300}
                className="flex-1 px-3 py-2 rounded border border-charcoal/20 bg-canvas text-sm"
              />
              <Button variant="primary" onClick={startSession} disabled={!topicDraft.trim()}>
                Start Session
              </Button>
            </div>

            <ScoreHeatmap points={history} loading={loading} />
          </div>
        </Card>
      )}
    </div>
  );
}

function SessionCard({
  topic,
  tree,
  liveStats,
  liveScore,
  onUpdate,
  onEnd,
  ending,
}: {
  topic: string;
  tree: TreeNode[];
  liveStats: { totalNodes: number; maxDepth: number; maxBranching: number } | null;
  liveScore: number;
  onUpdate: (mut: (tree: TreeNode[]) => TreeNode[]) => void;
  onEnd: () => Promise<void>;
  ending: boolean;
}) {
  function editQuestion(id: string, question: string) {
    onUpdate((t) => mapTree(t, id, (n) => ({ ...n, question })));
  }
  function addChild(parentId: string) {
    onUpdate((t) => mapTree(t, parentId, (n) => ({ ...n, children: [...n.children, makeNode('')] })));
  }
  function addSibling(id: string) {
    onUpdate((t) => insertSibling(t, id));
  }
  function removeNode(id: string) {
    onUpdate((t) => removeById(t, id));
  }
  function addRoot() {
    onUpdate((t) => [...t, makeNode('')]);
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-xs font-display uppercase tracking-wider text-charcoal-soft">
              Topic
            </div>
            <div className="font-display text-lg">{topic}</div>
          </div>
          <div className="text-right text-xs text-charcoal-soft">
            <div className="font-display text-2xl text-charcoal tabular-nums">{liveScore}</div>
            <div>live score</div>
          </div>
        </div>

        <div className="flex gap-4 text-xs text-charcoal-soft border-y border-charcoal/10 py-2">
          <span>nodes <b className="text-charcoal">{liveStats?.totalNodes ?? 0}</b></span>
          <span>depth <b className="text-charcoal">{liveStats?.maxDepth ?? 0}</b></span>
          <span>max branching <b className="text-charcoal">{liveStats?.maxBranching ?? 0}</b></span>
        </div>

        <div className="space-y-2">
          {tree.map((n) => (
            <NodeView
              key={n.id}
              node={n}
              depth={0}
              onEdit={editQuestion}
              onAddChild={addChild}
              onAddSibling={addSibling}
              onRemove={removeNode}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={addRoot}>
            + Root question
          </Button>
        </div>

        <div className="flex gap-2 pt-2 border-t border-charcoal/10">
          <Button variant="primary" onClick={onEnd} disabled={ending}>
            {ending ? 'Saving…' : 'End Session'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NodeView({
  node,
  depth,
  onEdit,
  onAddChild,
  onAddSibling,
  onRemove,
}: {
  node: TreeNode;
  depth: number;
  onEdit: (id: string, question: string) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div
        className="flex gap-2 items-start"
        style={{ paddingLeft: depth * 20 }}
      >
        <div className="pt-2 text-[10px] uppercase tracking-wider text-charcoal-soft w-6 text-right">
          L{depth + 1}
        </div>
        <div className="flex-1 flex gap-2">
          <input
            autoFocus={node.question === ''}
            value={node.question}
            onChange={(e) => onEdit(node.id, e.target.value)}
            placeholder="Question…"
            maxLength={500}
            className="flex-1 px-3 py-2 rounded border border-charcoal/20 bg-canvas text-sm"
          />
          <Button variant="ghost" size="sm" onClick={() => onAddChild(node.id)}>
            + Deeper
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAddSibling(node.id)}>
            + Sibling
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(node.id)}>
            ×
          </Button>
        </div>
      </div>
      {node.children.map((c) => (
        <NodeView
          key={c.id}
          node={c}
          depth={depth + 1}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function ScoreHeatmap({ points, loading }: { points: HistoryPoint[]; loading: boolean }) {
  const today = todayLocal();
  const WEEKS = 26;
  const CELL = 13;
  const GAP = 3;
  const [hover, setHover] = useState<{ day: string; score: number; inFuture: boolean } | null>(
    null,
  );

  const { columns, monthLabels, max } = useMemo(() => {
    const scoreByDay = new Map<string, number>();
    let m = 0;
    for (const p of points) {
      scoreByDay.set(p.day, p.score);
      if (p.score > m) m = p.score;
    }
    const [y, mo, d] = today.split('-').map(Number) as [number, number, number];
    const anchor = new Date(y, mo - 1, d);
    const todayDow = anchor.getDay();
    const lastSunday = new Date(anchor);
    lastSunday.setDate(anchor.getDate() - todayDow);
    const start = new Date(lastSunday);
    start.setDate(lastSunday.getDate() - (WEEKS - 1) * 7);
    const cols: { day: string; score: number; inFuture: boolean }[][] = [];
    const labels: { col: number; label: string }[] = [];
    let labeledMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const col: { day: string; score: number; inFuture: boolean }[] = [];
      for (let r = 0; r < 7; r++) {
        const cell = new Date(start);
        cell.setDate(start.getDate() + w * 7 + r);
        const iso = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(
          cell.getDate(),
        ).padStart(2, '0')}`;
        col.push({
          day: iso,
          score: scoreByDay.get(iso) ?? 0,
          inFuture: cell.getTime() > anchor.getTime(),
        });
        if (r === 0 && cell.getDate() <= 7 && cell.getMonth() !== labeledMonth) {
          labels.push({
            col: w,
            label: cell.toLocaleString('en-US', { month: 'short' }),
          });
          labeledMonth = cell.getMonth();
        }
      }
      cols.push(col);
    }
    return { columns: cols, monthLabels: labels, max: m };
  }, [points, today]);

  const bestDay = points.reduce<HistoryPoint | null>(
    (acc, p) => (acc == null || p.score > acc.score ? p : acc),
    null,
  );

  return (
    <div className="border-t border-charcoal/10 pt-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="uppercase tracking-wider text-[10px] text-charcoal-soft">
          Last {WEEKS} weeks
        </span>
        <span className="text-[10px] text-charcoal-soft tabular-nums">
          {hover
            ? hover.inFuture
              ? `${hover.day} · —`
              : `${hover.day} · score ${hover.score}`
            : loading
              ? 'loading…'
              : bestDay
                ? `best ${bestDay.score} · ${points.length} ${points.length === 1 ? 'day' : 'days'}`
                : 'no sessions yet'}
        </span>
      </div>
      <div className="inline-block" onMouseLeave={() => setHover(null)}>
        <div
          className="relative text-[9px] uppercase tracking-wider text-charcoal-soft"
          style={{ height: 12, width: WEEKS * (CELL + GAP) }}
        >
          {monthLabels.map((m) => (
            <span
              key={`${m.col}-${m.label}`}
              className="absolute"
              style={{ left: m.col * (CELL + GAP) }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex" style={{ gap: GAP }}>
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
              {col.map((cell) => {
                const intensity = max > 0 ? cell.score / max : 0;
                const bg = cell.inFuture
                  ? 'transparent'
                  : cell.score === 0
                    ? 'rgba(234, 228, 214, 0.18)'
                    : `rgba(220, 38, 38, ${0.35 + intensity * 0.65})`;
                const border = cell.inFuture
                  ? '1px dashed rgba(234, 228, 214, 0.15)'
                  : '1px solid rgba(234, 228, 214, 0.28)';
                const isHovered = hover?.day === cell.day;
                return (
                  <div
                    key={cell.day}
                    title={
                      cell.inFuture
                        ? cell.day
                        : `${cell.day} — score ${cell.score}`
                    }
                    onMouseEnter={() => setHover(cell)}
                    style={{
                      width: CELL,
                      height: CELL,
                      backgroundColor: bg,
                      border,
                      borderRadius: 2,
                      outline: isHovered ? '1px solid rgba(234, 228, 214, 0.7)' : 'none',
                      outlineOffset: isHovered ? 1 : 0,
                      cursor: 'default',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- tree helpers ---
function mapTree(
  tree: TreeNode[],
  id: string,
  fn: (n: TreeNode) => TreeNode,
): TreeNode[] {
  return tree.map((n) =>
    n.id === id
      ? fn(n)
      : { ...n, children: mapTree(n.children, id, fn) },
  );
}

function insertSibling(tree: TreeNode[], id: string): TreeNode[] {
  const out: TreeNode[] = [];
  let inserted = false;
  for (const n of tree) {
    out.push({ ...n, children: insertSibling(n.children, id) });
    if (n.id === id && !inserted) {
      out.push(makeNode(''));
      inserted = true;
    }
  }
  return out;
}

function removeById(tree: TreeNode[], id: string): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of tree) {
    if (n.id === id) continue;
    out.push({ ...n, children: removeById(n.children, id) });
  }
  return out;
}

function pruneEmpty(tree: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of tree) {
    const kids = pruneEmpty(n.children);
    const trimmed = n.question.trim();
    if (trimmed === '' && kids.length === 0) continue;
    out.push({ id: n.id, question: trimmed, children: kids });
  }
  return out;
}
