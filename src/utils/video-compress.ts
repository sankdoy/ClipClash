/**
 * Client-side video compression using Canvas + MediaRecorder.
 * Re-encodes video at a target resolution and bitrate.
 * No external libraries — uses native browser APIs.
 */

const TARGET_HEIGHT = 480
const TARGET_VIDEO_BITRATE = 800_000 // 800 kbps
const PLAYBACK_RATE = 4 // Process at 4x speed

/**
 * Compresses a video blob by re-encoding through Canvas + MediaRecorder.
 * Returns a smaller webm blob.
 *
 * @param inputBlob - The original video blob
 * @param onProgress - Optional callback with progress 0-1
 */
export async function compressVideo(
  inputBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const videoUrl = URL.createObjectURL(inputBlob)

  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.src = videoUrl

    // Wait for metadata to load
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load video'))
    })

    const srcWidth = video.videoWidth
    const srcHeight = video.videoHeight
    const duration = video.duration

    if (!srcWidth || !srcHeight || !duration || !isFinite(duration)) {
      throw new Error('Invalid video dimensions or duration')
    }

    // Calculate target dimensions maintaining aspect ratio
    const scale = Math.min(1, TARGET_HEIGHT / srcHeight)
    const outWidth = Math.round(srcWidth * scale / 2) * 2 // Ensure even
    const outHeight = Math.round(srcHeight * scale / 2) * 2

    // Set up canvas
    const canvas = document.createElement('canvas')
    canvas.width = outWidth
    canvas.height = outHeight
    const ctx = canvas.getContext('2d')!

    // Determine best supported codec
    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? 'video/webm; codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm; codecs=vp8')
        ? 'video/webm; codecs=vp8'
        : 'video/webm'

    // Set up MediaRecorder on the canvas stream
    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: TARGET_VIDEO_BITRATE
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const recordingDone = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }))
      }
    })

    // Start recording
    recorder.start(100) // Collect data every 100ms
    video.playbackRate = PLAYBACK_RATE
    video.currentTime = 0

    // Draw frames
    await new Promise<void>((resolve) => {
      const drawFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop()
          resolve()
          return
        }
        ctx.drawImage(video, 0, 0, outWidth, outHeight)
        onProgress?.(Math.min(video.currentTime / duration, 1))
        requestAnimationFrame(drawFrame)
      }

      video.onended = () => {
        // Draw one last frame
        ctx.drawImage(video, 0, 0, outWidth, outHeight)
        recorder.stop()
        onProgress?.(1)
        resolve()
      }

      video.play().then(drawFrame).catch(() => {
        recorder.stop()
        resolve()
      })
    })

    return await recordingDone
  } finally {
    URL.revokeObjectURL(videoUrl)
  }
}
