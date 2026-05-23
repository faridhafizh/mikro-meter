import { NextResponse } from 'next/server';
import { getConfigSnapshots } from '@/lib/dataStore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id1 = searchParams.get('id1');
  const id2 = searchParams.get('id2');

  if (!id1 || !id2) {
    return NextResponse.json({ error: 'Missing id1 and id2 query parameters' }, { status: 400 });
  }

  const snapshots = getConfigSnapshots();
  const snap1 = snapshots.find(s => s.id === id1);
  const snap2 = snapshots.find(s => s.id === id2);

  if (!snap1 || !snap2) {
    return NextResponse.json({ error: 'One or both snapshots not found' }, { status: 404 });
  }

  // Compute a simple line-by-line diff
  const lines1 = snap1.content.split('\n');
  const lines2 = snap2.content.split('\n');

  // Use a simple LCS-based diff approach
  const diff = computeDiff(lines1, lines2);

  return NextResponse.json({
    snapshot1: { id: snap1.id, routerName: snap1.routerName, timestamp: snap1.timestamp, label: snap1.label },
    snapshot2: { id: snap2.id, routerName: snap2.routerName, timestamp: snap2.timestamp, label: snap2.label },
    diff,
  });
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  line1?: number; // line number in snapshot1 (for removed/unchanged)
  line2?: number; // line number in snapshot2 (for added/unchanged)
  content: string;
}

function computeDiff(lines1: string[], lines2: string[]): DiffLine[] {
  // Simple Myers-like diff using LCS
  const result: DiffLine[] = [];
  const lcs = longestCommonSubsequence(lines1, lines2);

  let i1 = 0, i2 = 0;
  for (const lcsLine of lcs) {
    // Lines removed from lines1 not in LCS
    while (i1 < lines1.length && lines1[i1] !== lcsLine) {
      result.push({ type: 'removed', line1: i1 + 1, content: lines1[i1] });
      i1++;
    }
    // Lines added from lines2 not in LCS
    while (i2 < lines2.length && lines2[i2] !== lcsLine) {
      result.push({ type: 'added', line2: i2 + 1, content: lines2[i2] });
      i2++;
    }
    // Common line
    result.push({ type: 'unchanged', line1: i1 + 1, line2: i2 + 1, content: lcsLine });
    i1++;
    i2++;
  }

  // Remaining lines from lines1
  while (i1 < lines1.length) {
    result.push({ type: 'removed', line1: i1 + 1, content: lines1[i1] });
    i1++;
  }
  // Remaining lines from lines2
  while (i2 < lines2.length) {
    result.push({ type: 'added', line2: i2 + 1, content: lines2[i2] });
    i2++;
  }

  return result;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length, n = b.length;
  // Use a space-optimized approach: compute LCS length matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const result: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}
