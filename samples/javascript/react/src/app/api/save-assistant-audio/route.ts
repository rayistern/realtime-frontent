import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Ensure the route runs in the Node.js runtime
export const runtime = 'nodejs';

// Function to create a WAV header
function createWavHeader(length: number, sampleRate: number, numChannels: number, bitsPerSample: number) {
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

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('Received a POST request to /api/save-assistant-audio');

    // Read the request body as an ArrayBuffer
    const arrayBuffer = await req.arrayBuffer();
    console.log('Request body received');

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.warn('No audio data received');
      return NextResponse.json({ error: 'No audio data received' }, { status: 400 });
    }

    console.log(`Received audio data size: ${arrayBuffer.byteLength} bytes`);

    // Convert ArrayBuffer to Int16Array
    const int16Array = new Int16Array(arrayBuffer);
    console.log(`Received audio data size: ${int16Array.length * 2} bytes`);

    // Create WAV header and data
    const wavHeader = createWavHeader(int16Array.length * 2, 24000, 1, 16);
    const wavData = Buffer.concat([wavHeader, Buffer.from(int16Array.buffer)]);

    // Generate a unique filename
    const filename = `assistant-response-${Date.now()}.wav`;
    console.log(`Generated filename: ${filename}`);

    // Define the directory to save the recordings
    const dir = path.join(process.cwd(), 'assistant_recordings');
    console.log(`Recording directory: ${dir}`);
    await fs.mkdir(dir, { recursive: true });
    console.log('Ensured recordings directory exists');

    // Save the WAV file
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, wavData);
    console.log(`Audio file saved at ${filePath}`);

    return NextResponse.json({ message: 'Assistant audio saved', filename });
  } catch (error) {
    console.error('Error saving assistant audio:', error);
    return NextResponse.json({ error: 'Error saving assistant audio' }, { status: 500 });
  }
}