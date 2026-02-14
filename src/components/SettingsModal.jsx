import React, { useState, useEffect } from 'react';
import { X, Save, Command, Settings as SettingsIcon, Keyboard, Sparkles, AlertTriangle, User, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateWorkspace } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { FeatherSparkles, FeatherFileText, FeatherCpu, FeatherEye } from '@subframe/core';

export default function SettingsModal({ onClose, activeWorkspace, onUpdateWorkspace, onResetAllData, user }) {
    const [activeTab, setActiveTab] = useState('general');
    const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || '');
    const [workspaceIcon, setWorkspaceIcon] = useState(activeWorkspace?.icon?.value || '');
    const [iconType, setIconType] = useState(activeWorkspace?.icon?.type === 'image' ? 'image' : 'text');
    const [intelligenceLevel, setIntelligenceLevel] = useState(activeWorkspace?.intelligenceLevel || 'quick');

    const intelligenceTiers = [

        { id: 'quick', icon: <FeatherFileText className="w-5 h-5 text-zinc-600" />, name: 'Quick', desc: 'Extract tags from URL and filename', cost: 'Free' },
        { id: 'smart', icon: <FeatherCpu className="w-5 h-5 text-zinc-600" />, name: 'Smart', desc: 'AI understands metadata context', cost: '~$0.02/100' },
        { id: 'deep', icon: <FeatherEye className="w-5 h-5 text-zinc-600" />, name: 'Deep', desc: 'AI analyzes image content', cost: '~$0.15/100' },
        { id: 'ultra', icon: <FeatherSparkles className="w-5 h-5 text-zinc-600" />, name: 'Ultra', desc: 'Smart + Deep combined', cost: '~$0.17/100' }
    ];

    useEffect(() => {
        if (activeWorkspace) {
            setWorkspaceName(activeWorkspace.name);
            setWorkspaceIcon(activeWorkspace.icon?.value || activeWorkspace.name[0]);
            setIconType(activeWorkspace.icon?.type === 'image' ? 'image' : 'text');
            setIntelligenceLevel(activeWorkspace.intelligenceLevel || 'quick');
        }
    }, [activeWorkspace]);

    const handleSaveWorkspace = async () => {
        if (!activeWorkspace) return;

        const updates = {
            name: workspaceName,
            icon: {
                type: iconType,
                value: iconType === 'text' ? workspaceIcon.charAt(0).toUpperCase() : workspaceIcon
            },
            intelligenceLevel
        };

        await updateWorkspace(activeWorkspace.id, updates);
        onUpdateWorkspace(); // Trigger reload in parent
        onClose();
    };

    const handleResetAllData = () => {
        if (!onResetAllData) return;
        const confirmed = window.confirm(
            'This will permanently delete all items, collections, workspaces, and settings. Continue?'
        );
        if (!confirmed) return;

        const confirmationText = window.prompt('Type RESET to confirm.');
        if (confirmationText !== 'RESET') return;

        onResetAllData();
        onClose();
    };

    const shortcuts = [
        { label: 'Search / Filter', keys: ['Cmd', 'K'] },
        { label: 'Close Modal', keys: ['Esc'] },
        { label: 'Delete Item', keys: ['Backspace'] },
        { label: 'Deselect Items', keys: ['Esc'] },
        { label: 'Save Page (Ext)', keys: ['⌥', '⇧', 'S'] },
        { label: 'Smart Picker (Ext)', keys: ['⌥', '⇧', 'I'] },
        { label: 'Image Selector (Ext)', keys: ['⌥', '⇧', 'C'] },
        { label: 'Full Page Screenshot (Ext)', keys: ['⌥', '⇧', 'P'] },
        { label: 'Area Screenshot (Ext)', keys: ['⌥', '⇧', 'A'] },
        { label: 'Area Record (Ext)', keys: ['⌥', '⇧', 'R'] },
    ];

    return (
        <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px]"
                onClick={e => e.stopPropagation()}
                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 20, opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-100 rounded-lg">
                            <SettingsIcon className="w-5 h-5 text-zinc-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-zinc-900">Settings</h2>
                            <p className="text-sm text-zinc-500">Manage your workspace and preferences</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>

                <div className="flex flex-grow overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-48 bg-zinc-50 border-r border-zinc-100 p-4 space-y-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100'
                                }`}
                        >
                            <SettingsIcon size={16} />
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('shortcuts')}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'shortcuts' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100'
                                }`}
                        >
                            <Keyboard size={16} />
                            Shortcuts
                        </button>
                        <button
                            onClick={() => setActiveTab('intelligence')}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'intelligence' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100'
                                }`}
                        >
                            <Sparkles size={16} />
                            Intelligence
                        </button>
                        <button
                            onClick={() => setActiveTab('account')}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'account' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100'
                                }`}
                        >
                            <User size={16} />
                            Account
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-8 overflow-y-auto">
                        {activeTab === 'general' && (
                            <div className="space-y-6 max-w-md">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium text-zinc-900">Workspace Settings</h3>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700">Workspace Name</label>
                                        <input
                                            type="text"
                                            value={workspaceName}
                                            onChange={(e) => setWorkspaceName(e.target.value)}
                                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 text-sm"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700">Workspace Icon</label>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => setIconType('text')}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${iconType === 'text' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}
                                                >
                                                    Text / Emoji
                                                </button>
                                                <button
                                                    onClick={() => setIconType('image')}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${iconType === 'image' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}
                                                >
                                                    Image URL
                                                </button>
                                            </div>

                                            <div className="flex items-start gap-4">
                                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center text-white text-xl font-bold shadow-lg overflow-hidden">
                                                    {iconType === 'image' && workspaceIcon ? (
                                                        <img src={workspaceIcon} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span>{iconType === 'text' ? workspaceIcon.charAt(0).toUpperCase() : '?'}</span>
                                                    )}
                                                </div>

                                                <div className="flex-grow">
                                                    {iconType === 'text' ? (
                                                        <input
                                                            type="text"
                                                            maxLength={1}
                                                            value={workspaceIcon}
                                                            onChange={(e) => setWorkspaceIcon(e.target.value)}
                                                            className="w-16 px-3 py-2 text-center border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 text-lg font-bold uppercase"
                                                            placeholder="A"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={workspaceIcon}
                                                            onChange={(e) => setWorkspaceIcon(e.target.value)}
                                                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 text-sm"
                                                            placeholder="https://example.com/logo.png"
                                                        />
                                                    )}
                                                    <p className="mt-2 text-xs text-zinc-500">
                                                        {iconType === 'text' ? 'Single letter or emoji' : 'Direct link to an image file'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-zinc-100">
                                    <button
                                        onClick={handleSaveWorkspace}
                                        className="flex items-center gap-2 px-6 py-2 bg-zinc-950 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/10"
                                    >
                                        <Save size={16} />
                                        Save Changes
                                    </button>
                                </div>

                                <div className="pt-6 border-t border-zinc-100">
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle size={16} className="mt-0.5 text-red-600" />
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold text-red-800">Danger Zone</p>
                                                <p className="text-xs text-red-700">
                                                    Reset all local app data. This action cannot be undone.
                                                </p>
                                                <button
                                                    onClick={handleResetAllData}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                                                >
                                                    Reset All Data
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'shortcuts' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium text-zinc-900">Keyboard Shortcuts</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {shortcuts.map((shortcut, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                                            <span className="text-sm font-medium text-zinc-700">{shortcut.label}</span>
                                            <div className="flex items-center gap-1.5">
                                                {shortcut.keys.map((key, k) => (
                                                    <kbd
                                                        key={k}
                                                        className="px-2 py-1 bg-white border border-zinc-200 rounded-md text-xs font-semibold text-zinc-500 min-w-[24px] text-center shadow-sm"
                                                    >
                                                        {key}
                                                    </kbd>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Some browsers (Arc, Dia) may reserve certain shortcuts. Use the toolbar icon or right-click menu as a fallback.
                                </p>
                            </div>
                        )}

                        {activeTab === 'account' && (
                            <div className="space-y-6 max-w-md">
                                <div>
                                    <h3 className="text-lg font-medium text-zinc-900">Account</h3>
                                    <p className="text-sm text-zinc-500 mt-1">
                                        Manage your account and session
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center">
                                                    <User size={20} className="text-zinc-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-zinc-900 truncate">
                                                        {user?.email || 'Unknown'}
                                                    </p>
                                                    <p className="text-xs text-zinc-500">
                                                        Signed in via Supabase Auth
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-xs text-zinc-400 space-y-1">
                                                <p>User ID: <span className="font-mono">{user?.id?.slice(0, 8)}...</span></p>
                                                {user?.created_at && (
                                                    <p>Member since: {new Date(user.created_at).toLocaleDateString()}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            await supabase.auth.signOut();
                                            onClose();
                                        }}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'intelligence' && (
                            <div className="space-y-6 max-w-md">
                                <div>
                                    <h3 className="text-lg font-medium text-zinc-900">Canvas Intelligence</h3>
                                    <p className="text-sm text-zinc-500 mt-1">
                                        Auto-tag level for new images in this workspace
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {intelligenceTiers.map(tier => (
                                        <button
                                            key={tier.id}
                                            onClick={() => setIntelligenceLevel(tier.id)}
                                            className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${intelligenceLevel === tier.id
                                                ? 'border-zinc-900 bg-zinc-50'
                                                : 'border-zinc-200 hover:border-zinc-300 bg-white'
                                                }`}
                                        >
                                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-100">{tier.icon}</div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-zinc-900">{tier.name}</span>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tier.cost === 'Free'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {tier.cost}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-zinc-500 mt-0.5">{tier.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="pt-4 border-t border-zinc-100">
                                    <p className="text-xs text-zinc-400">
                                        Use the <strong>✨ Enhance</strong> button on any image to upgrade to Ultra analysis
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleSaveWorkspace}
                                        className="flex items-center gap-2 px-6 py-2 bg-zinc-950 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/10"
                                    >
                                        <Save size={16} />
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
