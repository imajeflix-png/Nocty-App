import React, { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Mic2, Trash2, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { SyncedLyricsList } from './SyncedLyricsList';

export const RightInspectorPanel: React.FC = () => {
  const {
    rightPanelTab,
    setRightPanelTab,
    queueTracks,
    currentTrack,
    isPlaying,
    playTrack,
    removeFromQueue,
    reorderQueue,
    clearUpcomingQueue,
    ambientColor,
  } = usePlayer();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!rightPanelTab) return null;

  const panelBody = (
    <div className="relative flex flex-col h-full bg-[#0E0E14] border-l border-white/[0.07] overflow-hidden">
      {/* Subtle Adaptive Ambient Glow behind Lyrics/Queue */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background:
            rightPanelTab === 'lyrics'
              ? `radial-gradient(circle at 70% 18%, rgba(${ambientColor.r}, ${ambientColor.g}, ${ambientColor.b}, 0.18) 0%, transparent 62%)`
              : `radial-gradient(circle at 50% 0%, rgba(${ambientColor.r}, ${ambientColor.g}, ${ambientColor.b}, 0.08) 0%, transparent 50%)`,
        }}
      />

      {/* Panel Header Tabs */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#14141C] border border-white/[0.07]">
          <button
            type="button"
            onClick={() => setRightPanelTab('queue')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              rightPanelTab === 'queue'
                ? 'bg-white/[0.1] text-lime-300'
                : 'text-[#9499A6] hover:text-white'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Antrean</span>
            <span className="font-mono-tabular text-[11px] opacity-70">{queueTracks.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setRightPanelTab('lyrics')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              rightPanelTab === 'lyrics'
                ? 'bg-white/[0.1] text-lime-300'
                : 'text-[#9499A6] hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Lirik</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setRightPanelTab(null)}
          aria-label="Tutup panel kanan"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9499A6] hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Panel Content */}
      <div className="relative z-10 flex-1 min-h-0">
        {rightPanelTab === 'lyrics' ? (
          <SyncedLyricsList variant="panel" />
        ) : (
          <div className="h-full flex flex-col">
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.05]">
              <span className="text-xs text-[#9499A6]">Seret lagu untuk ubah urutan</span>
              {queueTracks.length > 1 && (
                <button
                  type="button"
                  onClick={clearUpcomingQueue}
                  className="text-xs text-[#9499A6] hover:text-rose-400 transition-colors"
                >
                  Bersihkan
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
              {queueTracks.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <p className="text-sm text-[#9499A6]">Antrean lagu masih kosong.</p>
                </div>
              ) : (
                queueTracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isDragOver = dragOverIndex === idx && dragIndex !== idx;

                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverIndex !== idx) setDragOverIndex(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === idx) setDragOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== idx) {
                          reorderQueue(dragIndex, idx);
                        }
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`group flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                        isCurrent
                          ? 'bg-emerald-500/[0.09] border-emerald-400/30'
                          : isDragOver
                            ? 'bg-white/[0.08] border-lime-300/50'
                            : 'border-transparent hover:bg-white/[0.04]'
                      }`}
                    >
                      <GripVertical
                        className="w-3.5 h-3.5 text-[#5B6070] group-hover:text-[#9499A6] shrink-0"
                        strokeWidth={1.75}
                      />

                      <button
                        type="button"
                        onClick={() => playTrack(track)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <CoverArt
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-9 h-9"
                          roundedClass="rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={`text-xs font-medium truncate ${
                                isCurrent ? 'text-lime-300' : 'text-white'
                              }`}
                            >
                              {track.title}
                            </p>
                            {isCurrent && isPlaying && <EqualizerBars active={true} className="h-2.5" />}
                          </div>
                          <p className="text-[11px] text-[#9499A6] truncate">
                            {track.artist} ·{' '}
                            <span className="font-mono-tabular">{formatDuration(track.duration)}</span>
                          </p>
                        </div>
                      </button>

                      {/* Accessible Reorder & Remove Controls */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => reorderQueue(idx, idx - 1)}
                          aria-label="Pindah ke atas"
                          className="w-6 h-6 rounded flex items-center justify-center text-[#5B6070] hover:text-white disabled:opacity-20"
                        >
                          <ArrowUp className="w-3 h-3" strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === queueTracks.length - 1}
                          onClick={() => reorderQueue(idx, idx + 1)}
                          aria-label="Pindah ke bawah"
                          className="w-6 h-6 rounded flex items-center justify-center text-[#5B6070] hover:text-white disabled:opacity-20"
                        >
                          <ArrowDown className="w-3 h-3" strokeWidth={1.75} />
                        </button>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => removeFromQueue(idx)}
                            aria-label={`Hapus ${track.title} dari antrean`}
                            className="w-6 h-6 rounded flex items-center justify-center text-[#5B6070] hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Docked Inspector Panel */}
      <aside className="hidden xl:block w-80 2xl:w-[340px] shrink-0 h-full">{panelBody}</aside>

      {/* Tablet / Mobile Overlay Sheet */}
      <div className="fixed inset-0 z-40 xl:hidden flex justify-end">
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-sm"
          onClick={() => setRightPanelTab(null)}
          aria-hidden="true"
        />
        <aside className="relative z-10 w-full max-w-sm h-full shadow-2xl">{panelBody}</aside>
      </div>
    </>
  );
};
