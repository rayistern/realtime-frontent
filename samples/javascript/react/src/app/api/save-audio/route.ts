import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Ensure the route runs in the Node.js runtime (not Edge)
export const runtime = 'nodejs';

// Function to create a WAV file buffer from PCM data
function createWavBuffer(pcmData: Buffer, sampleRate: number, numChannels: number) {
  const byteRate = sampleRate * numChannels * 2; // 16-bit audio, so 2 bytes per sample
  const blockAlign = numChannels * 2;
  const wavHeader = Buffer.alloc(44);

  // RIFF chunk descriptor
  wavHeader.write('RIFF', 0); // ChunkID
  wavHeader.writeUInt32LE(36 + pcmData.length, 4); // ChunkSize
  wavHeader.write('WAVE', 8); // Format

  // fmt sub-chunk
  wavHeader.write('fmt ', 12); // Subchunk1ID
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  wavHeader.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  wavHeader.writeUInt16LE(numChannels, 22); // NumChannels
  wavHeader.writeUInt32LE(sampleRate, 24); // SampleRate
  wavHeader.writeUInt32LE(byteRate, 28); // ByteRate
  wavHeader.writeUInt16LE(blockAlign, 32); // BlockAlign
  wavHeader.writeUInt16LE(16, 34); // BitsPerSample

  // data sub-chunk
  wavHeader.write('data', 36); // Subchunk2ID
  wavHeader.writeUInt32LE(pcmData.length, 40); // Subchunk2Size

  // Combine header and PCM data
  return Buffer.concat([wavHeader, pcmData]);
}

export async function POST(req: NextRequest) {
  try {
    console.log("Received a POST request to /api/save-audio");

    // Read the request body as an ArrayBuffer
    const arrayBuffer = await req.arrayBuffer();
    console.log("Request body received");

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.warn("No audio data received");
      return NextResponse.json(
        { error: "No audio data received" },
        { status: 400 },
      );
    }

    // Convert ArrayBuffer to Node.js Buffer
    const pcmBuffer = Buffer.from(arrayBuffer);
    console.log(`PCM audio buffer length: ${pcmBuffer.length}`);

    // Create WAV buffer
    const wavBuffer = createWavBuffer(pcmBuffer, 24000, 1);
    console.log(`WAV audio buffer length: ${wavBuffer.length}`);

    // Generate a unique filename
    const filename = `recording-${Date.now()}.wav`;
    console.log(`Generated filename: ${filename}`);

    // Define the directory where you want to save the recordings
    const dir = path.join(process.cwd(), "recordings");
    console.log(`Recording directory: ${dir}`);
    await fs.mkdir(dir, { recursive: true });
    console.log("Ensured recordings directory exists");

    // Save the WAV file
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, wavBuffer);
    console.log(`Audio file saved at ${filePath}`);

    return NextResponse.json({ message: "Audio saved", filename: filename });
  } catch (error) {
    console.error("Error saving audio:", error);
    return NextResponse.json({ error: "Error saving audio" }, { status: 500 });
  }
}