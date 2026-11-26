import React, { useEffect, useMemo, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Share2, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { renderLyricCardPng } from '../utils/lyricCardCanvas';

export const LyricCardModal: React.FC = () => {
  const {
    isLyricCardOpen,
    setIsLyricCardOpen,
    currentTrack,
    currentTime,
    lyricOffset,
    ambientPalette,
    pushToast,
  } = usePlayer();

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [customText, setCustomText] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const lyricLines: string[] = useMemo(() => {
    if (!currentTrack) return [];
    if (currentTrack.lyrics.length > 0) {
      return currentTrack.lyrics.map((l) => l.text.trim()).filter(Boolean);
    }
    if (currentTrack.plainLyrics) {
      return currentTrack.plainLyrics
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
    return [];
  }, [currentTrack]);

  useEffect(() => {
    if (!isLyricCardOpen || !currentTrack) return;
    setCustomText('');

    if (lyricLines.length > 0) {
      const adjusted = currentTime + lyricOffset;
      let activeIdx = 0;
      if (currentTrack.lyrics.length > 0) {
        for (let i = 0; i < currentTrack.lyrics.length; i++) {
          if (currentTrack.lyrics[i].time <= adjusted + 0.15) {
            activeIdx = i;
          } else {
            break;
          }
        }
      }
      const start = Math.max(0, Math.min(activeIdx, Math.max(0, lyricLines.length - 3)));
      const picks: number[] = [];
      for (let i = start; i < Math.min(lyricLines.length, start + 3); i++) {
        picks.push(i);
      }
      setSelectedIndices(picks);
    } else {
      setSelectedIndices([]);
    }
  }, [isLyricCardOpen, currentTrack?.id]);

  const chosenLines = useMemo(() => {
    if (lyricLines.length > 0) {
      const rows = selectedIndices
        .map((idx) => lyricLines[idx])
        .filter((line): line is string => Boolean(line));
      return rows.length > 0 ? rows : lyricLines.slice(0, 2);
    }
    const manual = customText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    return manual.length > 0 ? manual : currentTrack ? [currentTrack.title] : [];
  }, [lyricLines, selectedIndices, customText, currentTrack]);

  useEffect(() => {
    if (!isLyricCardOpen || !currentTrack) return;
    let cancelled = false;
    setIsRendering(true);

    renderLyricCardPng({
      track: currentTrack,
      lines: chosenLines,
      palette: ambientPalette,
    })
      .then(({ blob, dataUrl }) => {
        if (cancelled) return;
        setRenderedBlob(blob);
        setPreviewDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) {
          pushToast('Gagal merender kartu lirik', 'info');
        }
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLyricCardOpen, currentTrack, chosenLines, ambientPalette, pushToast]);

  useEffect(() => {
    if (!isLyricCardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLyricCardOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLyricCardOpen, setIsLyricCardOpen]);

  if (!isLyricCardOpen || !currentTrack) return null;

  const toggleLine = (idx: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(idx)) {
        if (prev.length <= 1) return prev;
        return prev.filter((i) => i !== idx);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), idx].sort((a, b) => a - b);
      }
      return [...prev, idx].sort((a, b) => a - b);
    });
  };

  const fileSafeName = `${currentTrack.artist}-${currentTrack.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  const handleDownload = () => {
    if (!renderedBlob && !previewDataUrl) return;
    const url = renderedBlob ? URL.createObjectURL(renderedBlob) : previewDataUrl!;
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocty-${fileSafeName || 'lyric-card'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (renderedBlob) {
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    pushToast('Kartu Lirik 9:16 berhasil diunduh', 'success');
  };

  const handleShareIgStory = async () => {
    if (!renderedBlob) return;
    const file = new File([renderedBlob], `nocty-${fileSafeName || 'lyric-card'}.png`, {
      type: 'image/png',
    });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `${currentTrack.title} — ${currentTrack.artist}`,
          text: 'Didengarkan di Nocty',
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    handleDownload();
    pushToast('Peramban tidak mendukung share langsung — gambar telah diunduh untuk IG Story', 'info');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share Kartu Lirik 9:16"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/78 backdrop-blur-md"
        onClick={() => setIsLyricCardOpen(false)}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#121216]/90 backdrop-blur-2xl border border-white/[0.12] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-white/10 border border-white/[0.10] flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4 text-white" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-white truncate">
                Kartu Lirik 9:16
              </h2>
              <p className="text-xs text-white/55 truncate">
                Poster siap Instagram Story dengan warna sampul adaptif
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsLyricCardOpen(false)}
            aria-label="Tutup modal Kartu Lirik"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/75 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.9} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">
          {/* 9:16 Poster Preview */}
          <div className="mx-auto w-[210px] sm:w-[230px] md:w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black/50 border border-white/[0.12] shadow-2xl relative flex items-center justify-center">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt={`Kartu lirik ${currentTrack.title}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Loader2 className="w-6 h-6 text-white/70 animate-spin" />
            )}
            {isRendering && previewDataUrl && (
              <div className="on-artwork absolute inset-0 bg-black/35 backdrop-blur-[2px] flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Right Controls: Select 2-4 Lines + Actions */}
          <div className="flex flex-col h-full min-h-0 space-y-4">
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white/85">
                  Pilih 2–4 baris lirik untuk kartu
                </span>
                <span className="font-mono-tabular text-[11px] text-white/55">
                  {chosenLines.length}/4 baris
                </span>
              </div>

              {lyricLines.length > 0 ? (
                <div className="max-h-64 md:max-h-72 overflow-y-auto rounded-xl bg-black/35 border border-white/[0.08] p-1.5 space-y-1">
                  {lyricLines.map((line, idx) => {
                    const isSelected = selectedIndices.includes(idx);
                    return (
                      <button
                        key={`${idx}-${line.slice(0, 12)}`}
                        type="button"
                        onClick={() => toggleLine(idx)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-[13px] transition-all ${
                          isSelected
                            ? 'bg-white text-[#0B0B0D] font-medium shadow-sm'
                            : 'text-white/75 hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        {line}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  rows={4}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Tulis 2–4 baris lirik (pisahkan dengan baris baru)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30 resize-none"
                />
              )}
            </div>

            {/* Export / Share Buttons */}
            <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                disabled={isRendering || !renderedBlob}
                onClick={handleShareIgStory}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 disabled:opacity-45 text-xs sm:text-sm font-semibold transition-all shadow-[0_8px_28px_rgba(255,255,255,0.18)]"
              >
                <Share2 className="w-4 h-4" strokeWidth={2} />
                <span>Bagikan ke IG Story</span>
              </button>

              <button
                type="button"
                disabled={isRendering || !renderedBlob}
                onClick={handleDownload}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.10] disabled:opacity-45 text-xs sm:text-sm font-medium text-white transition-colors"
              >
                <Download className="w-4 h-4" strokeWidth={1.9} />
                <span>Download Gambar (PNG)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
