import { NextResponse } from 'next/server';
import { z } from 'zod';
import { perfSessions } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

type TreeNode = {
  id: string;
  question: string;
  children: TreeNode[];
};

const nodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(80),
    question: z.string().min(1).max(500),
    children: z.array(nodeSchema).max(200),
  }),
);

const bodySchema = z.object({
  testSlug: z.string().min(1).max(80),
  topic: z.string().min(1).max(300),
  startedAt: z.string().datetime(),
  tree: z.array(nodeSchema).min(1).max(500),
});

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function computeStats(tree: TreeNode[]): {
  totalNodes: number;
  maxDepth: number;
  maxBranching: number;
} {
  let totalNodes = 0;
  let maxDepth = 0;
  let maxBranching = 0;
  function walk(nodes: TreeNode[], depth: number): void {
    if (nodes.length > maxBranching) maxBranching = nodes.length;
    for (const n of nodes) {
      totalNodes += 1;
      if (depth > maxDepth) maxDepth = depth;
      if (n.children.length > 0) walk(n.children, depth + 1);
    }
  }
  walk(tree, 1);
  return { totalNodes, maxDepth, maxBranching };
}

/**
 * POST /api/performance/sessions — persist a completed session.
 *
 * The tree the user built comes in as JSON; we recompute the stats and
 * score server-side (never trust the client). Score formula, per the
 * product spec:
 *
 *   score = total_nodes + 2 * max_depth + max_branching_factor
 *
 * The tree itself is stored verbatim so a later session-detail view can
 * render exactly what the user constructed.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let user: { id: string; timezone: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
  const raw = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }
  const { testSlug, topic, startedAt, tree } = parsed.data;
  const { totalNodes, maxDepth, maxBranching } = computeStats(tree);
  const score = totalNodes + 2 * maxDepth + maxBranching;
  const day = todayInTz(user.timezone);
  const endedAt = new Date().toISOString();
  const [row] = await db
    .insert(perfSessions)
    .values({
      userId: user.id,
      testSlug,
      topic,
      day,
      startedAt,
      endedAt,
      totalNodes,
      maxDepth,
      maxBranching,
      score,
      treeJson: JSON.stringify(tree),
    })
    .returning();
  if (!row) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }
  return NextResponse.json({
    id: row.id,
    day,
    score,
    totalNodes,
    maxDepth,
    maxBranching,
  });
}
