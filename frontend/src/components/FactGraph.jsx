/**
 * FactGraph.jsx — Cleaner, clearer Legal Fact Graph
 *
 * Fixes vs previous version:
 *  - Smaller nodes, more spread out (stronger repulsion, longer links)
 *  - Labels always readable, never cut off
 *  - Edge labels only appear on hover (no overlap clutter)
 *  - Node names stripped of internal backend prefixes (Subj_, Act_, Amt_, etc.)
 *  - Hierarchical-style layout (Clause centre → branches outward)
 *  - Proper hit area so small nodes are still clickable
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw, Network } from 'lucide-react';

// ── Node type config ─────────────────────────────────────────────────────────
const TYPE_MAP = {
  clause:   { color: '#6c63ff', icon: 'C', label: 'Clause',              size: 7 },
  party:    { color: '#00d4ff', icon: 'P', label: 'Party / Person',      size: 6 },
  action:   { color: '#ff8c42', icon: 'A', label: 'Action / Obligation', size: 5 },
  object:   { color: '#a78bfa', icon: 'E', label: 'Legal Entity',        size: 5 },
  amount:   { color: '#00c896', icon: '₹', label: 'Amount / Money',      size: 5 },
  modality: { color: '#34d399', icon: 'M', label: 'Modality',            size: 5 },
  deadline: { color: '#ffb347', icon: 'D', label: 'Date / Deadline',     size: 5 },
  penalty:  { color: '#ff6b6b', icon: '!', label: 'Penalty',             size: 5 },
  default:  { color: '#8892b0', icon: '?', label: 'Other',               size: 4 },
};

function getCfg(type) {
  return TYPE_MAP[(type || '').toLowerCase()] || TYPE_MAP.default;
}

// Strip internal backend prefixes from node labels
function cleanLabel(label, id) {
  const raw = label || id || 'Node';
  // Remove prefix patterns like "Subj_", "Act_foo_c1", "Clause clause_1" etc.
  return raw
    .replace(/^(Clause\s+clause_\w+)$/i, 'Clause')
    .replace(/^(Subj_|Act_|Amt_|Dead_|Mod_|Obj_|Pen_)/i, '')
    .replace(/_c\d+$/i, '')          // remove trailing _c1, _c2 etc.
    .replace(/_/g, ' ')              // underscores → spaces
    .trim()
    .slice(0, 28);                   // max 28 chars
}

// ── Parse graph from clause data ─────────────────────────────────────────────
function parseGraphData(clause) {
  if (!clause) return { nodes: [], links: [] };

  let raw = clause.original_graph;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }

  if (raw && (raw.nodes || raw.links)) {
    const nodes = (raw.nodes || []).map(n => ({
      id:   String(n.id),
      name: cleanLabel(n.label, n.id),
      type: (n.type || 'default').toLowerCase(),
      r:    getCfg((n.type || '').toLowerCase()).size,
    }));
    const links = (raw.links || raw.edges || []).map(e => ({
      source: String(e.source),
      target: String(e.target),
      label:  String(e.relation || e.label || '').replace(/_/g, ' '),
    }));
    if (nodes.length > 0) return { nodes, links };
  }

  return buildFromFacts(clause);
}

function buildFromFacts(clause) {
  const f = clause?.original_facts || {};
  if (!f || !Object.values(f).some(Boolean)) return { nodes: [], links: [] };
  const nodes = [], links = [];
  let cnt = 0;
  const add = (name, type) => {
    const id = `n${++cnt}`;
    nodes.push({ id, name: String(name).slice(0, 28), type, r: getCfg(type).size });
    return id;
  };
  const subj = f.subject   ? add(f.subject,   'party')    : null;
  const act  = f.action    ? add(f.action,    'action')   : null;
  const obj  = f.obj       ? add(f.obj,       'object')   : null;
  const mod  = f.modality  ? add(f.modality,  'modality') : null;
  const amt  = f.amount    ? add(f.amount,    'amount')   : null;
  const dead = f.deadline  ? add(f.deadline,  'deadline') : null;
  const pen  = f.penalty   ? add(f.penalty,   'penalty')  : null;

  if (subj && mod)  links.push({ source: subj, target: mod,  label: 'obligation' });
  if (subj && act)  links.push({ source: subj, target: act,  label: f.modality || 'performs' });
  if (act  && obj)  links.push({ source: act,  target: obj,  label: 'on' });
  if (act  && amt)  links.push({ source: act,  target: amt,  label: 'of amount' });
  if (act  && dead) links.push({ source: act,  target: dead, label: 'by' });
  if (subj && pen)  links.push({ source: subj, target: pen,  label: 'penalty' });
  return { nodes, links };
}

// ── Component ─────────────────────────────────────────────────────────────────
const FactGraph = ({ clauses = [] }) => {
  const fgRef        = useRef();
  const containerRef = useRef();
  const [width, setWidth]             = useState(760);
  const [selected, setSelected]       = useState(0);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [graphData, setGraphData]     = useState({ nodes: [], links: [] });

  useEffect(() => {
    setGraphData(parseGraphData(clauses[selected]));
  }, [clauses, selected]);

  useEffect(() => {
    const obs = new ResizeObserver(e => setWidth(e[0]?.contentRect.width || 760));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Stronger repulsion so nodes spread out
      fgRef.current.d3Force('charge')?.strength(-350);
      fgRef.current.d3Force('link')?.distance(120);
      setTimeout(() => fgRef.current?.zoomToFit?.(600, 60), 900);
    }
  }, [graphData]);

  // ── Node renderer ─────────────────────────────────────────────────────────
  const nodeCanvasObject = useCallback((node, ctx, gs) => {
    const cfg     = getCfg(node.type);
    const r       = node.r || 5;
    const isHover = hoveredNode?.id === node.id;
    const isClause = node.type === 'clause';

    // Glow ring on hover
    if (isHover || isClause) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + (isHover ? 5 : 3), 0, 2 * Math.PI);
      ctx.fillStyle = cfg.color + (isHover ? '44' : '22');
      ctx.fill();
    }

    // Shadow
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur  = isHover ? 12 : 6;

    // Circle fill
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = cfg.color;
    ctx.fill();

    // Border
    ctx.strokeStyle = isHover ? '#fff' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = isHover ? 2 : 1;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Icon letter inside circle
    const iconSz = Math.max(r * 0.9, 3.5);
    ctx.font        = `bold ${iconSz}px Inter, sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle   = '#fff';
    ctx.fillText(cfg.icon, node.x, node.y);

    // ── Label BELOW the node ──────────────────────────────────────────────
    const fsz     = Math.max(10 / gs, 2.5);
    const display = node.name;
    ctx.font        = `${isHover ? 'bold ' : ''}${fsz}px Inter, sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'top';

    const tw   = ctx.measureText(display).width;
    const padX = 3, padY = 1.5;
    const lx   = node.x - tw / 2 - padX;
    const ly   = node.y + r + 3;

    // Pill background
    ctx.fillStyle = 'rgba(6, 10, 28, 0.9)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(lx, ly - padY, tw + padX * 2, fsz + padY * 2, 3);
      ctx.fill();
    } else {
      ctx.fillRect(lx, ly - padY, tw + padX * 2, fsz + padY * 2);
    }

    ctx.fillStyle   = isHover ? '#ffffff' : cfg.color;
    ctx.fillText(display, node.x, ly);
  }, [hoveredNode]);

  // ── Link renderer — label only on hover ──────────────────────────────────
  const linkCanvasObject = useCallback((link, ctx, gs) => {
    const s = link.source, t = link.target;
    if (!s?.x || !t?.x) return;
    const isHover = hoveredLink === link;

    // Line
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = isHover ? 'rgba(108,99,255,0.95)' : 'rgba(200,210,255,0.18)';
    ctx.lineWidth   = isHover ? 1.8 : 1;
    ctx.stroke();

    // Label — only when hovered
    if (link.label && isHover) {
      const mx  = (s.x + t.x) / 2;
      const my  = (s.y + t.y) / 2;
      const fsz = Math.max(9 / gs, 2.5);
      ctx.font  = `bold ${fsz}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      const tw = ctx.measureText(link.label).width + 8;
      ctx.fillStyle = 'rgba(108,99,255,0.92)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(mx - tw / 2, my - fsz / 2 - 2, tw, fsz + 4, 3);
        ctx.fill();
      } else {
        ctx.fillRect(mx - tw / 2, my - fsz / 2 - 2, tw, fsz + 4);
      }
      ctx.fillStyle = '#fff';
      ctx.fillText(link.label, mx, my);
    }
  }, [hoveredLink]);

  const isEmpty = graphData.nodes.length === 0;

  return (
    <div>
      {/* Clause selector */}
      {clauses.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          <Network size={13} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clause:</span>
          <select value={selected} onChange={e => setSelected(Number(e.target.value))}
            style={{ flex: 1, minWidth: 200, maxWidth: 440 }}>
            {clauses.map((c, i) => (
              <option key={i} value={i}>
                {i + 1}. {(c.original_text || '').slice(0, 68)}…
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center',
        padding: '0.55rem 0.85rem', marginBottom: '0.75rem',
        background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--surface-border)',
      }}>
        {Object.entries(TYPE_MAP).filter(([k]) => k !== 'default').map(([type, cfg]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: cfg.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '8px', fontWeight: 'bold', color: '#fff', flexShrink: 0,
            }}>{cfg.icon}</div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{cfg.label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Hover edge to see relation · Click node to zoom
        </span>
      </div>

      {/* Graph */}
      <div ref={containerRef} style={{
        height: 460, background: 'rgba(4, 7, 18, 0.9)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        border: '1px solid var(--surface-border)', position: 'relative',
      }}>
        {/* Controls */}
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {[
            { icon: <ZoomIn size={14}/>,    fn: () => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300), tip: 'Zoom In'  },
            { icon: <ZoomOut size={14}/>,   fn: () => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300), tip: 'Zoom Out' },
            { icon: <Maximize2 size={14}/>, fn: () => fgRef.current?.zoomToFit(400, 60),                     tip: 'Fit'      },
            { icon: <RefreshCw size={14}/>, fn: () => setGraphData({ ...graphData }),                         tip: 'Reset'    },
          ].map((b, i) => (
            <button key={i} onClick={b.fn} title={b.tip} style={{
              width: 28, height: 28, background: 'rgba(10,15,40,0.92)',
              border: '1px solid var(--surface-border)', borderRadius: 6,
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{b.icon}</button>
          ))}
        </div>

        {/* Hover info panel */}
        {hoveredNode && (
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 10,
            background: 'rgba(6,10,28,0.95)',
            border: `1px solid ${getCfg(hoveredNode.type).color}`,
            borderRadius: 8, padding: '0.5rem 0.85rem', maxWidth: 220,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <div style={{
                width: 15, height: 15, borderRadius: '50%', background: getCfg(hoveredNode.type).color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '7px', fontWeight: 'bold', color: '#fff',
              }}>{getCfg(hoveredNode.type).icon}</div>
              <span style={{ fontSize: '0.68rem', color: getCfg(hoveredNode.type).color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {getCfg(hoveredNode.type).label}
              </span>
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{hoveredNode.name}</p>
          </div>
        )}

        {/* Hovered link info */}
        {hoveredLink && !hoveredNode && (
          <div style={{
            position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, background: 'rgba(108,99,255,0.92)',
            borderRadius: 20, padding: '0.3rem 1rem', fontSize: '0.78rem', color: '#fff', fontWeight: 600,
            pointerEvents: 'none',
          }}>
            {typeof hoveredLink.source === 'object' ? hoveredLink.source.name : hoveredLink.source}
            {' → '}
            <em>{hoveredLink.label || 'relates to'}</em>
            {' → '}
            {typeof hoveredLink.target === 'object' ? hoveredLink.target.name : hoveredLink.target}
          </div>
        )}

        {isEmpty ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
            <Network size={40} color="var(--text-secondary)" />
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.88rem' }}>
              No graph data for this clause.<br/>
              <span style={{ fontSize: '0.78rem' }}>Upload and analyze a document first.</span>
            </p>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={width} height={460}
            graphData={graphData}
            backgroundColor="transparent"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, (node.r || 5) + 14, 0, 2 * Math.PI);
              ctx.fill();
            }}
            linkCanvasObject={linkCanvasObject}
            linkCanvasObjectMode={() => 'replace'}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={() => 'rgba(200,210,255,0.4)'}
            linkCurvature={0.1}
            onNodeHover={n  => setHoveredNode(n  || null)}
            onLinkHover={l  => setHoveredLink(l  || null)}
            onNodeClick={node => {
              fgRef.current?.centerAt(node.x, node.y, 500);
              fgRef.current?.zoom(4, 500);
            }}
            cooldownTicks={120}
            d3VelocityDecay={0.3}
            d3AlphaDecay={0.02}
          />
        )}
      </div>

      {/* Footer stats */}
      {!isEmpty && (
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span>⬤ {graphData.nodes.length} nodes</span>
          <span>→ {graphData.links.length} relationships</span>
          <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
            Hover over an arrow to see the relationship label
          </span>
          <span>Clause {selected + 1} / {clauses.length}</span>
        </div>
      )}
    </div>
  );
};

export default FactGraph;
