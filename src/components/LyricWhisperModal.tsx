import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Link2, Sparkles, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import {
  WHISPER_BADGES,
  WHISPER_BADGE_EMOJI,
  WhisperBadge,
  buildWhisperShareUrl,
} from '../utils/whisperUtils';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';

interface SelectableLyricRow {
  index: number;
  text: string;
  time: number;
}

export const LyricWhisperModal: React.FC = () => {
  const {
    isWhisperComposerOpen,
    setIsWhisperComposerOpen,
    currentTrack,
    currentTime,
    lyricOffset,
    ambientPalette,
    pushToast,
  } = usePlayer();

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [customSnippet, setCustomSnippet] = useState('');
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [badge, setBadge] = useState<WhisperBadge>('Couple / LDR');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lyricRows: SelectableLyricRow[] = useMemo(() => {
    if (!currentTrack) return [];
    if (currentTrack.lyrics.length > 0) {
      return currentTrack.lyrics
        .map((line, index) => ({
          index,
          text: line.text.trim(),
          time: Math.max(0, line.time - lyricOffset),
        }))
        .filter((r) => r.text.length > 0);
    }
    if (currentTrack.plainLyrics) {
      return currentTrack.plainLyrics
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text, index) => ({
          index,
          text,
          time: Math.max(0, Math.round(currentTime)),
        }));
    }
    return [];
  }, [currentTrack, lyricOffset, currentTime]);

  useEffect(() => {
    if (!isWhisperComposerOpen || !currentTrack) return;

    setMessage('');
    setSenderName('');
    setBadge('Couple / LDR');
    setGeneratedUrl(null);
    setCopied(false);
    setCustomSnippet('');

    if (lyricRows.length > 0) {
      const adjusted = currentTime + lyricOffset;
      let activeIdx = 0;
      if (currentTrack.lyrics.length > 0) {
        for (let i = 0; i < lyricRows.length; i++) {
          if (lyricRows[i].time <= adjusted + 0.15) {
            activeIdx = i;
          } else {
            break;
          }
        }
      }
      const nextIdx = activeIdx + 1 < lyricRows.length ? [activeIdx, activeIdx + 1] : [activeIdx];
      setSelectedIndices(nextIdx);
    } else {
      setSelectedIndices([]);
    }
  }, [isWhisperComposerOpen, currentTrack?.id]);

  useEffect(() => {
    if (!isWhisperComposerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsWhisperComposerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isWhisperComposerOpen, setIsWhisperComposerOpen]);

  if (!isWhisperComposerOpen || !currentTrack) return null;

  const { primary, secondary } = ambientPalette;

  const toggleLine = (rowIdx: number) => {
    setGeneratedUrl(null);
    setCopied(false);
    setSelectedIndices((prev) => {
      if (prev.includes(rowIdx)) {
        return prev.filter((i) => i !== rowIdx);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), rowIdx].sort((a, b) => a - b);
      }
      return [...prev, rowIdx].sort((a, b) => a - b);
    });
  };

  const selectedRows = selectedIndices
    .map((idx) => lyricRows[idx])
    .filter((r): r is SelectableLyricRow => Boolean(r));

  const effectiveLines =
    lyricRows.length > 0
      ? selectedRows.map((r) => r.text)
      : customSnippet
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3);

  const effectiveStartTime =
    selectedRows.length > 0 && currentTrack.lyrics.length > 0
      ? selectedRows[0].time
      : Math.max(0, Math.round(currentTime));

  const canCreate = effectiveLines.length >= 1;

  const handleCreateLink = () => {
    if (!canCreate) {
      pushToast('Pilih minimal 1 baris lirik terlebih dahulu', 'info');
      return;
    }

    const shareUrl = buildWhisperShareUrl({
      track: {
        id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || '',
        coverUrl: currentTrack.coverUrl,
        videoId: currentTrack.videoId,
        audioUrl: currentTrack.sourceType === 'online' ? currentTrack.audioUrl : undefined,
        duration: currentTrack.duration,
      },
      startTime: effectiveStartTime,
      lines: effectiveLines,
      message: message.trim(),
      senderName: senderName.trim() || 'Seseorang / Secret Admirer',
      badge,
    });

    setGeneratedUrl(shareUrl);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      pushToast('Link Whisper berhasil disalin!', 'success');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      pushToast('Salin tautan secara manual dari kolom di atas', 'info');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kirim Lyric Whisper"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
        onClick={() => setIsWhisperComposerOpen(false)}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-[#121216]/90 backdrop-blur-2xl border border-white/[0.12] shadow-2xl overflow-hidden">
        {/* Subtle Ambient Cover Aura */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 inset-x-0 h-52 blur-3xl opacity-25"
          style={{
            background: `radial-gradient(circle at 30% 30%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9), rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.7), transparent 72%)`,
          }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-white/10 border border-white/[0.10] flex items-center justify-center shrink-0">
              <AppleEmoji unified="2728" size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-white truncate">
                Kirim Lyric Whisper
              </h2>
              <p className="text-xs text-white/55 truncate">
                Titipkan pesan rahasia di potongan lirik lagu ini
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsWhisperComposerOpen(false)}
            aria-label="Tutup modal Whisper"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/75 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.9} />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* Active Track Summary */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
            <CoverArt
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-11 h-11 shrink-0"
              roundedClass="rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-white/55 truncate">{currentTrack.artist}</p>
            </div>
            {currentTrack.lyrics.length > 0 && selectedRows.length > 0 && (
              <span className="font-mono-tabular text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/80 shrink-0">
                {formatDuration(effectiveStartTime)}
              </span>
            )}
          </div>

          {/* Step 1: Select 1–3 Lyric Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-white/80">
                1. Pilih 1–3 baris lirik
              </label>
              <span className="font-mono-tabular text-[11px] text-white/55">
                {effectiveLines.length}/3 dipilih
              </span>
            </div>

            {lyricRows.length > 0 ? (
              <div className="max-h-44 overflow-y-auto rounded-xl bg-black/30 border border-white/[0.08] p-1.5 space-y-1">
                {lyricRows.map((row, idx) => {
                  const isSelected = selectedIndices.includes(idx);
                  return (
                    <button
                      key={`${row.index}-${row.time}`}
                      type="button"
                      onClick={() => toggleLine(idx)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-[13px] transition-all flex items-start justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-white text-[#0B0B0D] font-medium shadow-sm'
                          : 'text-white/75 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="leading-snug flex-1">{row.text}</span>
                      {currentTrack.lyrics.length > 0 && (
                        <span
                          className={`font-mono-tabular text-[10px] shrink-0 mt-0.5 ${
                            isSelected ? 'text-[#0B0B0D]/65' : 'text-white/40'
                          }`}
                        >
                          {formatDuration(row.time)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                rows={3}
                value={customSnippet}
                onChange={(e) => {
                  setCustomSnippet(e.target.value);
                  setGeneratedUrl(null);
                }}
                placeholder="Tulis 1–3 baris penggalan lirik favoritmu..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30 resize-none"
              />
            )}
          </div>

          {/* Step 2: Secret Personal Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="whisper-message" className="text-xs font-medium text-white/80">
                2. Pesan rahasia pribadi
              </label>
              <span className="font-mono-tabular text-[11px] text-white/50">
                {message.length}/120
              </span>
            </div>
            <input
              id="whisper-message"
              type="text"
              maxLength={120}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setGeneratedUrl(null);
              }}
              placeholder="Dengerin bagian ini deh..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Step 3: Sender Name & Relationship Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="whisper-sender" className="block text-xs font-medium text-white/80 mb-1.5">
                3. Nama pengirim (opsional)
              </label>
              <input
                id="whisper-sender"
                type="text"
                maxLength={40}
                value={senderName}
                onChange={(e) => {
                  setSenderName(e.target.value);
                  setGeneratedUrl(null);
                }}
                placeholder="Seseorang / Secret Admirer"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-white/80 mb-1.5">
                4. Nuansa hubungan
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WHISPER_BADGES.map((option) => {
                  const active = badge === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setBadge(option);
                        setGeneratedUrl(null);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white text-[#0B0B0D]'
                          : 'bg-white/[0.07] hover:bg-white/[0.12] text-white/75 border border-white/[0.08]'
                      }`}
                    >
                      <AppleEmoji unified={WHISPER_BADGE_EMOJI[option]} size={14} />
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Generated Link Output */}
          {generatedUrl && (
            <div className="p-3.5 rounded-xl bg-white/[0.06] border border-white/[0.12] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/85">
                <Link2 className="w-3.5 h-3.5 text-white/75" strokeWidth={1.9} />
                <span>Link Whisper siap dikirim</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] font-mono-tabular text-xs text-white/85 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-[#0B0B0D] hover:bg-white/90 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-white/[0.08] bg-white/[0.02] shrink-0">
          <button
            type="button"
            onClick={() => setIsWhisperComposerOpen(false)}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs font-medium text-white/85 transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={handleCreateLink}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 disabled:opacity-40 text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Buat Link Whisper</span>
          </button>
        </div>
      </div>
    </div>
  );
};
