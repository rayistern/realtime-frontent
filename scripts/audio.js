import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { PassThrough } from 'stream';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

console.log('FFmpeg path:', ffmpegInstaller.path);
console.log('FFprobe path:', ffprobeInstaller.path);

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function createWavHeader(length, sampleRate, numChannels, bitsPerSample) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* Format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* Format chunk length */
  view.setUint32(16, 16, true);
  /* Sample format (raw) */
  view.setUint16(20, 1, true);
  /* Channel count */
  view.setUint16(22, numChannels, true);
  /* Sample rate */
  view.setUint32(24, sampleRate, true);
  /* Byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  /* Block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  /* Bits per sample */
  view.setUint16(34, bitsPerSample, true);
  /* Data chunk identifier */
  writeString(view, 36, 'data');
  /* Data chunk length */
  view.setUint32(40, length, true);

  return Buffer.from(buffer);
}

function processAudioFile(filePath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = new PassThrough();

    ffmpeg(filePath)
      .format('s16le')
      .audioFrequency(24000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .on('start', commandLine => {
        console.log('Spawned FFmpeg with command: ' + commandLine);
      })
      .on('error', reject)
      .pipe(stream);

    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => {
      const pcmData = Buffer.concat(chunks);
      const sampleRate = 24000;
      const numChannels = 1;
      const bitsPerSample = 16;
      resolve({ pcmData: new Uint8Array(pcmData), sampleRate, numChannels, bitsPerSample });
    });
  });
}

export { processAudioFile, createWavHeader };