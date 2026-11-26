import React, { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Mic2, Trash2, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { SyncedLyricsList } from './SyncedLyricsList';
import { AppleEmoji } from './AppleEmoji';

export const RightInspectorPanel: React.FC = () => {
  const {
    rightPanelTab,
    setRightPanelTab,
    queueTracks,
    currentTrack,
    currentMood,
    isPlaying,
    playTrack,
    removeFromQueue,
    reorderQueue,
    clearUpcomingQueue,
    ambientPalette,
  } = usePlayer();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!rightPanelTab) return null;

  const { primary, secondary } = ambientPalette;

  const panelBody = (
    <div className="relative flex flex-col h-full bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Dual-Color Cover-Adaptive Ambient Aura behind Lyrics / Queue */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none blur-3xl opacity-25 transition-all duration-1000"
        style={{
          background:
            rightPanelTab === 'lyrics'
              ? `
                radial-gradient(circle at 75% 20%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9) 0%, transparent 60%),
                radial-gradient(circle at 25% 80%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.8) 0%, transparent 60%)
              `
              : `
                radial-gradient(circle at 50% 10%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.75) 0%, transparent 60%),
                radial-gradient(circle at 80% 85%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.55) 0%, transparent 60%)
              `,
        }}
      />

      {/* Panel Header Tabs */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.06]">
          <button
            type="button"
            onClick={() => setRightPanelTab('queue')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              rightPanelTab === 'queue'
                ? 'bg-white text-[#0B0B0D]'
                : 'text-white/65 hover:text-white'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Antrean</span>
            <span className="font-mono-tabular text-[11px] opacity-70">{queueTracks.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setRightPanelTab('lyrics')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              rightPanelTab === 'lyrics'
                ? 'bg-white text-[#0B0B0D]'
                : 'text-white/65 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Lirik</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setRightPanelTab(null)}
          aria-label="Tutup panel kanan"
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 text-white/75 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={1.85} />
        </button>
      </div>

      {/* Panel Content */}
      <div className="relative z-10 flex-1 min-h-0">
        {rightPanelTab === 'lyrics' ? (
          <SyncedLyricsList variant="panel" />
        ) : (
          <div className="h-full flex flex-col">
            <div className="px-4 py-2.5 flex flex-col gap-2 border-b border-white/[0.06]">
              {currentMood && (
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.10] text-[11px] font-medium text-white/90">
                    <AppleEmoji unified={currentMood.emojiUnified} size={13} />
                    <span>{currentMood.badgeText}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Seret lagu untuk ubah urutan</span>
                {queueTracks.length > 1 && (
                  <button
                    type="button"
                    onClick={clearUpcomingQueue}
                    className="text-xs text-white/55 hover:text-white transition-colors"
                  >
                    Bersihkan
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
              {queueTracks.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <p className="text-sm text-white/55">Antrean lagu masih kosong.</p>
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
                      className={`group flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-grab active:cursor-grabbing ${
                        isCurrent
                          ? 'bg-white/12'
                          : isDragOver
                            ? 'bg-white/10 ring-1 ring-white/30'
                            : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <GripVertical
                        className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 shrink-0"
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
                          className="w-10 h-10"
                          roundedClass="rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={`text-xs font-medium truncate ${
                                isCurrent ? 'text-white font-semibold' : 'text-white/90'
                              }`}
                            >
                              {track.title}
                            </p>
                            {isCurrent && isPlaying && <EqualizerBars active={true} className="h-2.5" />}
                          </div>
                          <p className="text-[11px] text-white/50 truncate">
                            {track.artist} ·{' '}
                            <span className="font-mono-tabular">{formatDuration(track.duration)}</span>
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => reorderQueue(idx, idx - 1)}
                          aria-label="Pindah ke atas"
                          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20"
                        >
                          <ArrowUp className="w-3 h-3" strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === queueTracks.length - 1}
                          onClick={() => reorderQueue(idx, idx + 1)}
                          aria-label="Pindah ke bawah"
                          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20"
                        >
                          <ArrowDown className="w-3 h-3" strokeWidth={1.75} />
                        </button>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => removeFromQueue(idx)}
                            aria-label={`Hapus ${track.title} dari antrean`}
                            className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-rose-400"
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
      {/* Desktop Docked Frosted Glass Right Panel */}
      <aside className="hidden xl:block w-[320px] 2xl:w-[340px] shrink-0 h-full">{panelBody}</aside>

      {/* Tablet / Mobile Slide-Over Sheet */}
      <div className="fixed inset-0 z-40 xl:hidden flex justify-end p-2.5">
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => setRightPanelTab(null)}
          aria-hidden="true"
        />
        <aside className="relative z-10 w-full max-w-sm h-full shadow-2xl">{panelBody}</aside>
      </div>
    </>
  );
};
