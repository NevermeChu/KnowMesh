'use client';

import { useEffect, useRef } from 'react';

type MeshNode = {
  id: number;
  radius: number;
  text: string;
  type: 'db' | 'doc' | 'sec' | 'space';
  vx: number;
  vy: number;
  x: number;
  y: number;
};

const initialNodesConfig = [
  { text: '🏢 团队空间 (Team)', type: 'space' as const, x: 0.3, y: 0.3 },
  { text: '👤 个人空间 (Personal)', type: 'space' as const, x: 0.2, y: 0.75 },
  { text: '📄 ADR-0004 权限模型', type: 'doc' as const, x: 0.55, y: 0.2 },
  { text: '📄 2026 里程碑规划', type: 'doc' as const, x: 0.65, y: 0.45 },
  { text: '🔒 Better Auth 会话', type: 'sec' as const, x: 0.45, y: 0.65 },
  { text: '⚡ PGlite 数据库', type: 'db' as const, x: 0.78, y: 0.7 },
  { text: '🔍 上下文内容检索', type: 'doc' as const, x: 0.82, y: 0.25 },
  { text: '🎯 Owner 不变量约束', type: 'sec' as const, x: 0.22, y: 0.48 },
  { text: '📝 ProseMirror 块级引擎', type: 'doc' as const, x: 0.5, y: 0.85 },
];

const connections: readonly (readonly [number, number])[] = [
  [0, 2],
  [0, 3],
  [0, 6],
  [0, 4],
  [1, 7],
  [1, 4],
  [2, 4],
  [2, 7],
  [4, 5],
  [3, 5],
  [6, 2],
  [8, 2],
  [8, 3],
];

/**
 * Draws connection lines and flowing particle pulses between nodes.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param nodes - Current array of nodes.
 * @param isDark - Whether dark mode is active.
 */
function drawConnections(ctx: CanvasRenderingContext2D, nodes: MeshNode[], isDark: boolean) {
  const lineColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(37, 99, 235, 0.14)';
  const particleColor = isDark ? '#60a5fa' : '#2563eb';

  for (const [sourceIdx, targetIdx] of connections) {
    const source = nodes[sourceIdx];
    const target = nodes[targetIdx];
    if (!source || !target) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const time = Date.now() * 0.0012;
    const progress = (time + sourceIdx * 0.35) % 1;
    const px = source.x + (target.x - source.x) * progress;
    const py = source.y + (target.y - source.y) * progress;

    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = particleColor;
    ctx.fill();
  }
}

/**
 * Updates positions and draws node pills with text and shadows.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param nodes - Current array of nodes.
 * @param bounds - Canvas bounding rect.
 * @param isDark - Whether dark mode is active.
 * @param draggedNode - Currently dragged node.
 */
function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: MeshNode[],
  bounds: DOMRect,
  isDark: boolean,
  draggedNode: MeshNode | null,
) {
  for (const node of nodes) {
    if (draggedNode !== node) {
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < 60 || node.x > bounds.width - 60) {
        node.vx *= -1;
      }
      if (node.y < 35 || node.y > bounds.height - 35) {
        node.vy *= -1;
      }
    }

    ctx.font = '600 12px "Plus Jakarta Sans Variable", "Noto Sans SC Variable", sans-serif';
    const textWidth = ctx.measureText(node.text).width;
    const boxWidth = textWidth + 24;
    const boxHeight = 32;
    const bx = node.x - boxWidth / 2;
    const by = node.y - boxHeight / 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, boxWidth, boxHeight, 8);
    ctx.fillStyle = isDark ? '#1f242d' : '#ffffff';
    ctx.shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(37, 99, 235, 0.12)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fill();

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)';
    if (node.type === 'space') {
      ctx.strokeStyle = isDark ? '#60a5fa' : '#2383e2';
    } else if (node.type === 'sec') {
      ctx.strokeStyle = isDark ? '#c084fc' : '#8b5cf6';
    } else if (node.type === 'db') {
      ctx.strokeStyle = isDark ? '#fbbf24' : '#f59e0b';
    }
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = isDark ? '#f0f3f6' : '#1f2328';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.text, node.x, node.y);
  }
}

/**
 * Renders an interactive physics-driven knowledge mesh graph on HTML5 Canvas.
 *
 * @param props - Component configuration.
 * @returns Interactive knowledge mesh canvas.
 */
export function KnowledgeMeshCanvas(props: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<MeshNode[]>([]);
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<MeshNode | null>(null);
  const renderRef = useRef<() => void>(() => {
    // The renderer is assigned after the canvas context is available.
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return () => {
        // No-op cleanup
      };
    }

    let animationFrameId: number | undefined;
    let isVisible = true;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initNodes = () => {
      resize();
      const rect = canvas.getBoundingClientRect();
      nodesRef.current = initialNodesConfig.map((item, idx) => ({
        id: idx,
        radius: 28,
        text: item.text,
        type: item.type,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        x: item.x * rect.width,
        y: item.y * rect.height,
      }));
    };

    initNodes();

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const isDark = document.documentElement.classList.contains('dark');

      drawConnections(ctx, nodesRef.current, isDark);
      drawNodes(
        ctx,
        nodesRef.current,
        rect,
        isDark,
        isDraggingRef.current ? draggedNodeRef.current : null,
      );
    };
    renderRef.current = draw;

    const stopAnimation = () => {
      if (animationFrameId !== undefined) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
      }
    };

    const animate = () => {
      animationFrameId = undefined;
      draw();
      if (isVisible && !reducedMotionQuery.matches) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    const startAnimation = () => {
      if (isVisible && !reducedMotionQuery.matches && animationFrameId === undefined) {
        animationFrameId = requestAnimationFrame(animate);
      } else if (reducedMotionQuery.matches) {
        draw();
      }
    };

    draw();
    startAnimation();

    const handlePointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      for (const node of nodesRef.current) {
        const dx = node.x - pointerX;
        const dy = node.y - pointerY;
        if (Math.hypot(dx, dy) < 45) {
          isDraggingRef.current = true;
          draggedNodeRef.current = node;
          canvas.setPointerCapture(event.pointerId);
          break;
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current || !draggedNodeRef.current) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      draggedNodeRef.current.x = Math.max(50, Math.min(rect.width - 50, event.clientX - rect.left));
      draggedNodeRef.current.y = Math.max(30, Math.min(rect.height - 30, event.clientY - rect.top));
      if (reducedMotionQuery.matches) {
        draw();
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      draggedNodeRef.current = null;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (animationFrameId === undefined) {
        draw();
      }
    });
    resizeObserver.observe(canvas);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false;
      if (isVisible) {
        startAnimation();
      } else {
        stopAnimation();
      }
    });
    visibilityObserver.observe(canvas);

    const handleReducedMotionChange = () => {
      stopAnimation();
      startAnimation();
    };
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    const themeObserver = new MutationObserver(() => {
      if (animationFrameId === undefined) {
        draw();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributeFilter: ['class'],
      attributes: true,
    });

    return () => {
      stopAnimation();
      renderRef.current = () => {
        // Prevent reset actions from drawing after unmount.
      };
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  const handleReset = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    nodesRef.current = initialNodesConfig.map((item, idx) => ({
      id: idx,
      radius: 28,
      text: item.text,
      type: item.type,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      x: item.x * rect.width,
      y: item.y * rect.height,
    }));
    renderRef.current();
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '1.25rem',
        boxShadow: 'var(--shadow-overlay)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1.25rem',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <span
          className="badge-pill"
          style={{
            fontSize: '0.75rem',
            background: 'var(--surface)',
            color: 'var(--ink)',
            borderColor: 'var(--line)',
          }}
        >
          ✦ 交互式拓扑示意 (支持拖拽节点与微引力碰撞)
        </span>
      </div>

      <div style={{ position: 'absolute', top: '1rem', right: '1.25rem', zIndex: 10 }}>
        <button
          type="button"
          onClick={handleReset}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            padding: '0.35rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--ink-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          重置节点分布
        </button>
      </div>

      <canvas
        ref={canvasRef}
        aria-label="动态知识拓扑图"
        style={{
          width: '100%',
          height: '420px',
          borderRadius: '1.25rem 1.25rem 0 0',
          background: 'var(--card)',
          display: 'block',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
        className={props.className ?? ''}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          padding: '1.25rem',
          background: 'var(--surface)',
          borderTop: '1px solid var(--line)',
          fontSize: '0.8125rem',
          color: 'var(--ink-secondary)',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          🔵 <strong>空间层</strong>：个人私有空间 / 团队资产库
        </div>
        <div>
          🟢 <strong>文档层</strong>：架构决策 (ADR) / 里程碑 / 规范
        </div>
        <div>
          🟣 <strong>安全层</strong>：Better Auth / 能力授权矩阵
        </div>
        <div>
          🟠 <strong>存储层</strong>：Drizzle ORM / PGlite 数据库
        </div>
      </div>
    </div>
  );
}
