/**
 * Compact waveform audio player.
 *
 * Visual direction is the familiar chat-app voice message — a bar waveform that
 * fills as it plays — rendered with Arena's own tokens rather than copying any
 * product's UI.
 *
 * PERFORMANCE (§14)
 *
 * The expensive way to draw a waveform is `decodeAudioData` on the whole file,
 * which allocates the entire decoded PCM buffer (minutes of 44.1 kHz stereo =
 * tens of MB) just to compute a few dozen bar heights. This component never
 * decodes:
 *
 *   1. If the asset carries precomputed `peaks`, they are used directly.
 *   2. Otherwise a deterministic placeholder is derived from the id, so the
 *      row still renders at a stable shape and no CPU is spent.
 *
 * Peaks are computed ONCE at upload time (see the media domain) rather than on
 * every render. Playback position is read from the `timeupdate` event, which
 * the browser throttles to ~4/s, instead of a `requestAnimationFrame` loop —
 * a list of many players therefore stays idle.
 *
 * Bars are plain divs: for the ~48 bars shown here that is cheaper and far more
 * accessible than a canvas, and it scales/reflows for free in RTL.
 *
 * ACCESSIBILITY (§20)
 *  - the seek bar is a real `role="slider"` with arrow-key support
 *  - play/pause is a labelled button reflecting state via `aria-pressed`
 *  - progress is announced through `aria-valuetext` in Persian digits
 *  - errors are surfaced in the UI, never swallowed
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { faNum } from "@/lib/format";
import { cn } from "@/utils/cn";

const BAR_COUNT = 48;

/**
 * Formats seconds as `m:ss` in Persian digits.
 *
 * `faNum` takes a number, so the seconds are localized first and then padded
 * with the Persian zero — padding the ASCII string before conversion would
 * leave a mixed-script "۰5".
 */
function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  const paddedSeconds = s < 10 ? `۰${faNum(s)}` : faNum(s);
  return `${faNum(m)}:${paddedSeconds}`;
}

/**
 * Deterministic placeholder shape for audio with no precomputed peaks.
 * Derived from the id so the same track always looks the same, and cheap
 * enough to run inline (no decoding, no allocation beyond the array).
 */
function placeholderPeaks(seed: string, count = BAR_COUNT): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const out = new Array<number>(count);
  for (let i = 0; i < count; i += 1) {
    hash = (hash * 1103515245 + 12345) | 0;
    // Keep bars in a readable 0.25..1 band rather than near-zero slivers.
    out[i] = 0.25 + (Math.abs(hash % 1000) / 1000) * 0.75;
  }
  return out;
}

/** Resamples arbitrary-length peaks onto the fixed bar count. */
function resample(peaks: readonly number[], count = BAR_COUNT): number[] {
  if (peaks.length === 0) return [];
  if (peaks.length === count) return [...peaks];
  const out = new Array<number>(count);
  const ratio = peaks.length / count;
  for (let i = 0; i < count; i += 1) {
    // Average the source window so downsampling keeps the envelope shape.
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end && j < peaks.length; j += 1) sum += peaks[j];
    out[i] = sum / (end - start);
  }
  return out;
}

export interface AudioMessagePlayerProps {
  /** Playable URL. When absent the player renders disabled with a reason. */
  src?: string;
  /** Precomputed normalized peaks (0..1). Avoids decoding entirely. */
  peaks?: readonly number[];
  /** Stable id used to derive placeholder bars when `peaks` is absent. */
  seed: string;
  /** Track title for the accessible label. */
  title: string;
  /** Known duration in seconds, shown before metadata loads. */
  durationSeconds?: number;
  /** Explains why playback is unavailable, e.g. a missing demo binary. */
  unavailableReason?: string;
  className?: string;
}

export function AudioMessagePlayer({
  src,
  peaks,
  seed,
  title,
  durationSeconds,
  unavailableReason,
  className,
}: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [error, setError] = useState<string | null>(null);

  const bars = useMemo(
    () => (peaks && peaks.length > 0 ? resample(peaks) : placeholderPeaks(seed)),
    [peaks, seed],
  );

  const disabled = !src || Boolean(unavailableReason);
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  // Pause and detach when the source changes or the row unmounts, so a list of
  // players can never leave audio running in the background.
  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.src = "";
      }
    };
  }, [src]);

  const toggle = useCallback(async () => {
    const el = audioRef.current;
    if (!el || disabled) return;
    setError(null);
    try {
      if (el.paused) {
        setBuffering(true);
        await el.play();
        setPlaying(true);
      } else {
        el.pause();
        setPlaying(false);
      }
    } catch (cause) {
      // Autoplay refusals and decode failures are reported, never swallowed.
      setPlaying(false);
      setError(cause instanceof Error ? cause.message : "پخش این فایل ممکن نشد.");
    } finally {
      setBuffering(false);
    }
  }, [disabled]);

  const seekTo = useCallback(
    (ratio: number) => {
      const el = audioRef.current;
      if (!el || duration <= 0) return;
      const clamped = Math.min(1, Math.max(0, ratio));
      el.currentTime = clamped * duration;
      setCurrent(el.currentTime);
    },
    [duration],
  );

  const onBarsPointer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      // RTL: the visual start is the RIGHT edge, so the ratio is mirrored.
      const fromRight = rect.right - event.clientX;
      seekTo(fromRight / rect.width);
    },
    [disabled, seekTo],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || duration <= 0) return;
      const step = 5 / duration;
      // In RTL, ArrowLeft advances and ArrowRight rewinds.
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekTo(progress + step);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seekTo(progress - step);
      } else if (event.key === "Home") {
        event.preventDefault();
        seekTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        seekTo(1);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        void toggle();
      }
    },
    [disabled, duration, progress, seekTo, toggle],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5",
        disabled && "opacity-70",
        className,
      )}
    >
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const value = e.currentTarget.duration;
            if (Number.isFinite(value)) setDuration(value);
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          onError={() => setError("بارگذاری فایل صوتی ناموفق بود.")}
        />
      )}

      <button
        type="button"
        onClick={() => void toggle()}
        disabled={disabled}
        aria-pressed={playing}
        aria-label={playing ? `توقف ${title}` : `پخش ${title}`}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border transition-colors",
          "border-gold-500/35 bg-gold-500/12 text-gold-300",
          "hover:bg-gold-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400",
          "disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-ink-400",
        )}
      >
        {buffering ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : playing ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Play className="size-4" aria-hidden />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={`جایگاه پخش ${title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={`${formatTime(current)} از ${formatTime(duration)}`}
          aria-disabled={disabled}
          onClick={onBarsPointer}
          onKeyDown={onKeyDown}
          className={cn(
            "flex h-8 items-center gap-[2px]",
            !disabled && "cursor-pointer",
            "rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400",
          )}
        >
          {bars.map((height, index) => {
            // Bars before the playhead are highlighted. Index is stable for the
            // lifetime of the component, so it is a safe key here.
            const filled = index / bars.length < progress;
            return (
              <span
                key={index}
                aria-hidden
                style={{ height: `${Math.round(height * 100)}%` }}
                className={cn(
                  "block w-[3px] shrink-0 rounded-full transition-colors",
                  filled ? "bg-gold-300" : "bg-white/20",
                )}
              />
            );
          })}
        </div>

        <div className="mt-1 flex items-center justify-between text-[10.5px] text-ink-400">
          <span className="nums">{formatTime(current)}</span>
          <span className="nums">{formatTime(duration)}</span>
        </div>
      </div>

      {(unavailableReason || error) && (
        <p role="alert" className="max-w-[40%] shrink-0 text-[10.5px] leading-relaxed text-warn-400">
          {error ?? unavailableReason}
        </p>
      )}
    </div>
  );
}
