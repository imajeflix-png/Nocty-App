import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Download,
  Loader2,
  Music2,
  Share2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { analyzeWeeklyAura } from '../utils/weeklyAuraUtils';
import { renderWeeklyAuraPosterPng } from '../utils/weeklyAuraCanvas';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';

export const WeeklyAuraModal: React.FC = () => {
  const {
    isWeeklyAuraOpen,
    setIsWeeklyAuraOpen,
    listeningHistory,
    simulateWeeklyAuraData,
    pushToast,
  } = usePlayer();

  const report = useMemo(() => analyzeWeeklyAura(listeningHistory), [listeningHistory]);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRenderingPoster, setIsRenderingPoster] = useState(false);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!isWeeklyAuraOpen) {
      setIsExportOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isExportOpen) setIsExportOpen(false);
        else setIsWeeklyAuraOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isWeeklyAuraOpen, isExportOpen, setIsWeeklyAuraOpen]);

  if (!isWeeklyAuraOpen) return null;

  const { primary, secondary } = report.auraPalette;

  const handleOpenSharePoster = async () => {
    setIsExportOpen(true);
    setIsRenderingPoster(true);
    try {
      const { blob, dataUrl } = await renderWeeklyAuraPosterPng(report);
      setPosterBlob(blob);
      setPosterDataUrl(dataUrl);
    } catch {
      pushToast('Gagal merender poster Weekly Aura', 'info');
      setIsExportOpen(false);
    } finally {
      setIsRenderingPoster(false);
    }
  };

  const handleDownloadPoster = () => {
    if (!posterBlob && !posterDataUrl) return;
    const url = posterBlob ? URL.createObjectURL(posterBlob) : posterDataUrl!;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nocty-weekly-aura.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (posterBlob) {
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    pushToast('Poster Weekly Aura 9:16 berhasil diunduh', 'success');
  };

  const handleShareDirect = async () => {
    if (!posterBlob) return;
    const file = new File([posterBlob], 'nocty-weekly-aura.png', { type: 'image/png' });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `Nocty Weekly Aura — ${report.auraTitle}`,
          text: `${report.auraTitle} • ${report.formattedTotalTime} mendengarkan minggu ini di Nocty`,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    handleDownloadPoster();
    pushToast('Peramban tidak mendukung share langsung — gambar telah diunduh', 'info');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nocty Weekly Aura"
      className="fixed inset-0 z-[72] flex flex-col overflow-hidden bg-[#0B0B0D]"
    >
      {/* Dynamic Animated Ambient Gradient Backdrop */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-24 w-[70vw] h-[70vw] max-w-[820px] max-h-[820px] rounded-full blur-3xl opacity-35 animate-pulse transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.92) 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute -bottom-36 -right-24 w-[65vw] h-[65vw] max-w-[780px] max-h-[780px] rounded-full blur-3xl opacity-30 transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.9) 0%, transparent 70%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0B0D]/35 via-[#0B0B0D]/60 to-[#0B0B0D]/90" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-10 py-4 sm:py-5 shrink-0 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-full bg-white/10 border border-white/[0.12] flex items-center justify-center shrink-0">
            <AppleEmoji unified="2728" size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
              Nocty Weekly Aura
            </h2>
            <p className="text-[11px] sm:text-xs text-white/55 truncate">
              Raport Musik Mingguan &amp; Analisis Vibe · 7 Hari Terakhir
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsWeeklyAuraOpen(false)}
          aria-label="Tutup Weekly Aura"
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.08] flex items-center justify-center text-white/80 hover:text-white transition-colors shrink-0"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </header>

      {/* Scrollable Body */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto">
          {!report.hasEnoughData ? (
            <div className="rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] p-6 sm:p-10 text-center space-y-5 shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 border border-white/[0.12] flex items-center justify-center">
                <Music2 className="w-7 h-7 text-white/85" strokeWidth={1.7} />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <span className="inline-block font-mono-tabular text-xs px-3 py-1 rounded-full bg-white/10 text-white/75">
                  {report.uniqueTrackCount}/3 lagu tercatat (&gt;20 detik)
                </span>
                <h3 className="font-display text-2xl font-bold text-white">
                  Aura Minggu Ini Sedang Terbentuk
                </h3>
                <p className="text-sm text-white/65 leading-relaxed">
                  Putar minimal 3 lagu lebih dari 20 detik agar Nocty bisa membaca jam aktif dan
                  kepribadian musikmu. Ingin langsung melihat hasil kartunya sekarang?
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={simulateWeeklyAuraData}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 text-sm font-semibold transition-all shadow-[0_10px_30px_rgba(255,255,255,0.22)]"
                >
                  <Wand2 className="w-4 h-4" strokeWidth={2} />
                  <span>Simulasi Data Minggu Ini</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsWeeklyAuraOpen(false)}
                  className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-xs font-medium text-white/85 transition-colors"
                >
                  Putar Lagu Dulu
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 pb-10">
              {/* Main Aura Title & Narrative Card */}
              <section className="relative overflow-hidden rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] p-6 sm:p-8 shadow-2xl">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full blur-3xl opacity-30"
                  style={{
                    background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9), transparent 70%)`,
                  }}
                />
                <div className="relative z-10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 border border-white/[0.12] text-xs font-medium text-white">
                      <AppleEmoji unified="2728" size={14} />
                      <span>Aura Minggu Ini</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono-tabular text-xs text-white/75">
                      <AppleEmoji unified={report.personaUnified} size={14} />
                      <span>
                        {report.personaLabel} ({report.personaRange})
                      </span>
                    </span>
                  </div>

                  <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                    {report.auraTitle}
                  </h1>
                  <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl">
                    {report.auraNarrative}
                  </p>
                </div>
              </section>

              {/* Listening Time & Persona Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.10] p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Clock className="w-3.5 h-3.5" strokeWidth={1.85} />
                    <span>Total Waktu Dengar (7 Hari)</span>
                  </div>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-white">
                    {report.formattedTotalTime}
                  </p>
                  <p className="font-mono-tabular text-xs text-white/55">
                    {report.totalPlays} lagu diputar · {report.uniqueTrackCount} judul unik
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.10] p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.85} />
                    <span>Pola Jam Aktif (Listening Persona)</span>
                  </div>
                  <p className="font-display text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <AppleEmoji unified={report.personaUnified} size={22} />
                    <span>{report.personaLabel}</span>
                  </p>
                  <p className="text-xs text-white/65 leading-relaxed">
                    <span className="font-mono-tabular text-white/85">{report.personaRange}</span> —{' '}
                    {report.personaDescription}
                  </p>
                </div>
              </div>

              {/* Top 3 Lagu & Artis Minggu Ini */}
              <section className="rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.10] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                    Top 3 Lagu Minggu Ini
                  </h2>
                  {report.topArtists[0] && (
                    <span className="text-xs text-white/60 truncate">
                      Top Artis: <strong className="text-white">{report.topArtists[0].artist}</strong>
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {report.topTracks.map((track, idx) => (
                    <div
                      key={`${track.trackId}-${idx}`}
                      className="flex items-center gap-3.5 p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]"
                    >
                      <span className="w-6 text-center font-mono-tabular text-sm font-bold text-white/45 shrink-0">
                        0{idx + 1}
                      </span>
                      <CoverArt
                        src={track.artwork}
                        alt={track.title}
                        className="w-13 h-13 shrink-0 shadow-lg"
                        roundedClass="rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                        <p className="text-xs text-white/60 truncate mt-0.5">{track.artist}</p>
                      </div>
                      <span className="font-mono-tabular text-xs px-3 py-1 rounded-full bg-white/10 text-white/85 shrink-0">
                        {track.playCount}× putar
                      </span>
                    </div>
                  ))}
                </div>

                {report.topArtists.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/50 mr-1">Top Artis:</span>
                    {report.topArtists.map((artist, idx) => (
                      <span
                        key={`${artist.artist}-${idx}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.07] border border-white/[0.08] text-xs text-white/85"
                      >
                        <span className="font-mono-tabular text-white/45">#{idx + 1}</span>
                        <span>{artist.artist}</span>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Share / Export CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={simulateWeeklyAuraData}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-medium text-white/75 hover:text-white transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" strokeWidth={1.85} />
                  <span>Simulasi Data Contoh</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSharePoster}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 text-sm font-semibold transition-all shadow-[0_10px_32px_rgba(255,255,255,0.22)] ml-auto"
                >
                  <Share2 className="w-4 h-4" strokeWidth={2} />
                  <span>Simpan &amp; Share Aura (IG Story)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 9:16 Poster Export Sub-Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#121216]/95 border border-white/[0.14] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Poster Weekly Aura 9:16
                </h3>
                <p className="text-xs text-white/55">Siap untuk Instagram Story</p>
              </div>
              <button
                type="button"
                onClick={() => setIsExportOpen(false)}
                aria-label="Tutup preview poster"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mx-auto w-[220px] aspect-[9/16] rounded-2xl overflow-hidden bg-black/50 border border-white/[0.12] flex items-center justify-center shadow-2xl">
              {isRenderingPoster || !posterDataUrl ? (
                <Loader2 className="w-6 h-6 text-white/75 animate-spin" />
              ) : (
                <img
                  src={posterDataUrl}
                  alt="Nocty Weekly Aura Poster"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={isRenderingPoster || !posterBlob}
                onClick={handleShareDirect}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 disabled:opacity-45 text-xs sm:text-sm font-semibold transition-colors"
              >
                <Share2 className="w-4 h-4" strokeWidth={2} />
                <span>Bagikan Langsung</span>
              </button>

              <button
                type="button"
                disabled={isRenderingPoster || !posterBlob}
                onClick={handleDownloadPoster}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.10] disabled:opacity-45 text-xs sm:text-sm font-medium text-white transition-colors"
              >
                <Download className="w-4 h-4" strokeWidth={1.9} />
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
