import type { MddDoc, DependencyGraph, DependencyNode } from '../types/index.js';

export function buildDependencyGraph(docs: MddDoc[]): DependencyGraph {
  const activeDocs = docs.filter(d => !d.archived);
  const idSet = new Set(activeDocs.map(d => d.id));
  const deprecatedIds = new Set(
    activeDocs.filter(d => d.status === 'deprecated').map(d => d.id)
  );
  const inProgressIds = new Set(
    activeDocs
      .filter(d => d.status === 'draft' || d.status === 'in_progress')
      .map(d => d.id)
  );

  const nodes: DependencyNode[] = activeDocs.map(doc => ({
    id: doc.id,
    title: doc.title,
    status: doc.status,
    dependsOn: doc.dependsOn,
    dependents: activeDocs
      .filter(d => d.dependsOn.includes(doc.id))
      .map(d => d.id),
  }));

  const brokenEdges: DependencyGraph['brokenEdges'] = [];
  const riskyEdges: DependencyGraph['riskyEdges'] = [];

  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (!idSet.has(dep) || deprecatedIds.has(dep)) {
        brokenEdges.push({ from: node.id, to: dep });
      } else if (node.status === 'complete' && inProgressIds.has(dep)) {
        riskyEdges.push({ from: node.id, to: dep });
      }
    }
  }

  const orphans = nodes
    .filter(n => n.dependsOn.length === 0 && n.dependents.length === 0)
    .map(n => n.id);

  return { nodes, brokenEdges, riskyEdges, orphans };
}

export function renderGraphAscii(graph: DependencyGraph): string {
  const lines: string[] = [];

  const edges = graph.nodes.filter(n => n.dependsOn.length > 0);
  if (edges.length === 0 && graph.orphans.length === 0) {
    return '(no dependencies defined)';
  }

  for (const node of edges) {
    for (const dep of node.dependsOn) {
      const broken = graph.brokenEdges.some(e => e.from === node.id && e.to === dep);
      const risky = graph.riskyEdges.some(e => e.from === node.id && e.to === dep);
      const marker = broken ? ' [broken]' : risky ? ' [risky]' : '';
      lines.push(`  ${node.id} --> ${dep}${marker}`);
    }
  }

  if (graph.orphans.length > 0) {
    lines.push('');
    lines.push('  Orphans (no dependencies):');
    for (const id of graph.orphans) {
      lines.push(`    ${id}`);
    }
  }

  return lines.join('\n');
}
