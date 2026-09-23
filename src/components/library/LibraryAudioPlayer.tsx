import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import type { LibraryItem } from "@/domains/library/types";
import { useMediaObjectUrl } from "@/domains/media/useMedia";
import { faNum } from "@/lib/format";
import { cn } from "@/utils/cn";

function timeLabel(value: number): string {
  const seconds = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${faNum(minutes)}:${rest < 10 ? `۰${faNum(rest)}` : faNum(rest)}`;
}

function peaksFor(item: LibraryItem): number[] {
  if (item.peaks?.length) return item.peaks;
  let hash = 17;
  for (const char of item.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Array.from({ length: 52 }, (_, index) => {
    hash = (hash * 1103515245 + 12345) | 0;
    return 0.22 + (Math.abs(hash + index) % 760) / 1000;
  });
}

/**
 * The archive's audio control — deliberately not `<audio controls>`.
 *
 * The native element remains present for decoding and playback, but it is
 * visually hidden. Everything the operator sees belongs to the library room:
 * a smoked dock, a gold progress line, a waveform, volume and speed. There is
 * one dock for the room, not one competing player per card; selecting another
 * track changes the same player and pauses the previous track.
 */
export function LibraryAudioPlayer({
  item,
  expanded,
  onToggleExpanded,
  onPrevious,
  onNext,
  onClose,
}: {
  item: LibraryItem | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const url = useMediaObjectUrl(item?.mediaId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.82);
  const [rate, setRate] = useState(1);
  const bars = useMemo(() => (item ? peaksFor(item) : []), [item]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.src = url ?? "";
    audio.volume = volume;
    audio.playbackRate = rate;
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [url]);

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setCurrent(audio.currentTime);
    const loaded = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const ended = () => {
      setPlaying(false);
      setCurrent(0);
      onNext?.();
    };
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("ended", ended);
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("ended", ended);
    };
  }, [onNext]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  if (!item) return null;

  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;
  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  };
  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const position = (rect.right - event.clientX) / rect.width;
    audio.currentTime = Math.max(0, Math.min(1, position)) * duration;
    setCurrent(audio.currentTime);
  };

  return (
    <section
      aria-label={`پخش‌کنندهٔ ${item.title}`}
      className={cn(
        "fixed bottom-3 left-3 right-3 z-40 border border-gold-400/25 bg-ink-950/95 shadow-[0_18px_60px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[min(560px,calc(100vw-3rem))]",
        expanded ? "rounded-2xl p-4" : "rounded-2xl px-3 py-2.5",
      )}
    >
      <audio ref={audioRef} className="sr-only" preload="metadata" aria-hidden="true" />
      <div className="flex items-center gap-3">
        <button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label="قطعهٔ قبلی" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-white/[0.06] hover:text-gold-200 disabled:opacity-30"><SkipBack className="size-3.5" /></button>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!url}
          aria-label={playing ? "توقف" : "پخش"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-400 text-ink-950 transition hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="ms-0.5 size-4" fill="currentColor" />}
        </button>
        <button type="button" onClick={onToggleExpanded} className="min-w-0 flex-1 text-right">
          <span className="block truncate text-[12px] font-medium text-ink-50">{item.title}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ink-400">{item.composer || "آرشیو موسیقی پارسیان"} · {item.duration ?? "فایل صوتی"}</span>
        </button>
        <button type="button" onClick={onNext} disabled={!onNext} aria-label="قطعهٔ بعدی" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-white/[0.06] hover:text-gold-200 disabled:opacity-30"><SkipForward className="size-3.5" /></button>
        <button type="button" onClick={onClose} aria-label="بستن پخش‌کننده" className="rounded-lg p-1.5 text-ink-500 hover:bg-white/[0.06] hover:text-ink-200">
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="nums w-8 text-[10px] text-ink-500">{timeLabel(current)}</span>
        <div
          role="slider"
          tabIndex={0}
          aria-label="پیشرفت پخش"
          aria-valuemin={0}
          aria-valuemax={duration || 1}
          aria-valuenow={current}
          onClick={seek}
          onKeyDown={(event) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            if (event.key === "ArrowLeft") audio.currentTime = Math.min(duration, audio.currentTime + 5);
            if (event.key === "ArrowRight") audio.currentTime = Math.max(0, audio.currentTime - 5);
            setCurrent(audio.currentTime);
          }}
          className="relative flex h-7 flex-1 cursor-pointer items-center gap-[2px] overflow-hidden rounded-lg px-1 outline-none focus-visible:ring-1 focus-visible:ring-gold-400"
        >
          <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-white/[0.12]" />
          {bars.map((bar, index) => (
            <span key={index} className="relative z-10 flex-1 rounded-full" style={{ height: `${Math.max(20, bar * 100)}%`, background: index / bars.length <= ratio ? "var(--accent-400)" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>
        <span className="nums w-8 text-left text-[10px] text-ink-500">{timeLabel(duration)}</span>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-3">
          <label className="flex items-center gap-2 text-[10.5px] text-ink-400">
            <Volume2 className="size-3.5 text-gold-300" />
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="accent-gold-400" aria-label="بلندی صدا" />
          </label>
          <label className="flex items-center gap-2 text-[10.5px] text-ink-400">
            <span>سرعت</span>
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="rounded-lg border border-white/[0.1] bg-ink-900 px-2 py-1 text-[10px] text-ink-200" aria-label="سرعت پخش">
              {[0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}x</option>)}
            </select>
          </label>
          <span className="flex items-center gap-1.5 text-[10.5px] text-ink-500"><ChevronDown className="size-3.5 rotate-180" /> موج صوتی از فرادادهٔ رسانه</span>
        </div>
      )}
    </section>
  );
}
