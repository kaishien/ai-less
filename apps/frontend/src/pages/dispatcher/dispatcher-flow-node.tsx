import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { FlowNodeStatus } from './dispatcher-flow-graph';

export type DispatcherFlowNodeData = {
  label: string;
  caption: string;
  status: FlowNodeStatus;
  visits: number;
};

export const DISPATCHER_NODE_TYPE = 'dispatcherNode';

export type DispatcherFlowNodeType = Node<DispatcherFlowNodeData, typeof DISPATCHER_NODE_TYPE>;

const statusClassName: Record<FlowNodeStatus, string> = {
  active: 'border-amber-300 bg-[#2a2618] text-amber-50 shadow-[0_0_0_4px_rgba(251,191,36,0.12)]',
  done: 'border-emerald-300/50 bg-[#17251f] text-emerald-50',
  idle: 'border-white/10 bg-[#202124] text-zinc-300',
};

export const DispatcherFlowNode = memo(({ data }: NodeProps<DispatcherFlowNodeType>) => (
  <div
    className={cn(
      'h-full w-full rounded-xl border p-0 text-left shadow-[0_12px_28px_rgba(0,0,0,0.24)] transition-[border-color,background-color,box-shadow,color] duration-200',
      statusClassName[data.status],
    )}
  >
    <Handle type="target" position={Position.Left} className="!border-zinc-500 !bg-zinc-400" />
    <div className="px-4 py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 wrap-break-word text-[15px] font-semibold leading-5">{data.label}</p>
          <p className={cn('m-0 mt-1.5 text-xs leading-4', data.status === 'idle' ? 'text-zinc-500' : 'text-current/70')}>{data.caption}</p>
        </div>
        {data.visits ? (
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold leading-none text-current/80">x{data.visits}</span>
        ) : null}
      </div>
    </div>
    <Handle type="source" position={Position.Right} className="!border-zinc-500 !bg-zinc-400" />
  </div>
));

DispatcherFlowNode.displayName = 'DispatcherFlowNode';
