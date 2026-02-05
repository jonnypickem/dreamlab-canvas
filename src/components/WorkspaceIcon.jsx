import React from 'react';

export default function WorkspaceIcon({ workspace, active, onClick }) {
    const isEmoji = workspace.icon?.type === 'emoji' || (typeof workspace.icon === 'string' && /[\u{1F300}-\u{1F9FF}]/u.test(workspace.icon));
    const isImage = workspace.icon?.type === 'image';

    const iconValue = typeof workspace.icon === 'string' ? workspace.icon : workspace.icon?.value;

    return (
        <div className="relative group flex justify-center">
            <div
                onClick={onClick}
                className="w-9 h-9 flex items-center justify-center cursor-pointer transition-all duration-150 relative"
                style={{
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: active ? 'var(--ds-gray-1000)' : 'var(--ds-gray-100)',
                    color: active ? 'var(--ds-background-100)' : 'var(--ds-gray-700)',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none'
                }}
                onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = 'var(--ds-gray-200)';
                }}
                onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = 'var(--ds-gray-100)';
                }}
            >
                {isImage ? (
                    <img src={iconValue} alt={workspace.name} className="w-5 h-5 object-contain" />
                ) : isEmoji ? (
                    <span className="text-lg">{iconValue}</span>
                ) : (
                    <span className="text-sm font-semibold uppercase tracking-tight">
                        {workspace.name[0]}
                    </span>
                )}

                {/* Active Indicator (Dot Below) */}
                {active && (
                    <div
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ backgroundColor: 'var(--ds-gray-1000)' }}
                    />
                )}
            </div>

            {/* Tooltip */}
            <div
                className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100]"
                style={{
                    backgroundColor: 'var(--ds-gray-1000)',
                    color: 'var(--ds-background-100)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)'
                }}
            >
                {workspace.name}
            </div>
        </div>
    );
}
