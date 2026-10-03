import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

import '@xyflow/react/dist/style.css'

import {
  StationNodeComponent,
  type StationNode,
} from '@/features/projects/components/station-node'
import type { Station } from '@/lib/contracts'

const nodeTypes = { station: StationNodeComponent }
const NODE_WIDTH = 240
const GAP = 64
const PRO_OPTIONS = { hideAttribution: true }

function layoutLine(
  stations: readonly Station[],
  selectedKey: string | null,
  invalidKeys: ReadonlySet<string>,
  previewMissing: boolean,
): { nodes: StationNode[]; edges: Edge[] } {
  const nodes: StationNode[] = []
  let x = 0
  for (const [index, station] of stations.entries()) {
    nodes.push({
      id: station.key,
      type: 'station',
      position: { x, y: 0 },
      data: {
        station,
        index,
        invalid: invalidKeys.has(station.key),
        previewMissing: previewMissing && station.kind === 'qa',
      },
      selected: station.key === selectedKey,
      draggable: false,
      connectable: false,
    })
    x += NODE_WIDTH + GAP
  }
  const edges: Edge[] = nodes.slice(1).map((node, index) => {
    const source = nodes[index]?.id ?? ''
    return { id: `${source}->${node.id}`, source, target: node.id }
  })
  return { nodes, edges }
}

/** The line, left to right in execution order. Clicking a station selects it. */
export function LineCanvas({
  stations,
  selectedKey,
  invalidKeys,
  previewMissing,
  onSelect,
}: {
  stations: readonly Station[]
  selectedKey: string | null
  invalidKeys: ReadonlySet<string>
  previewMissing: boolean
  onSelect: (key: string) => void
}) {
  const { resolvedTheme } = useTheme()
  const { nodes, edges } = useMemo(
    () => layoutLine(stations, selectedKey, invalidKeys, previewMissing),
    [stations, selectedKey, invalidKeys, previewMissing],
  )
  const onNodeClick = useMemo<NodeMouseHandler>(
    () => (_, node) => onSelect(node.id),
    [onSelect],
  )

  return (
    <div className="h-full min-h-96 w-full overflow-hidden rounded-lg border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        colorMode={resolvedTheme === 'light' ? 'light' : 'dark'}
        fitView
        proOptions={PRO_OPTIONS}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--canvas-dot)"
          bgColor="var(--background)"
        />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  )
}
