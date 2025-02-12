import { NextRequest, NextResponse } from 'next/server';
import { RTClient } from 'rt-client';
import { promises as fs } from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // **Provide the server URL when initializing RTClient**
    const client = new RTClient(
      new URL('wss://api.openai.com/v1/realtime/conversation'), // Replace with your server URL
      { key: process.env.OPENAI_API_KEY },
      { model: 'gpt-4o-realtime-preview-2024-10-01' },
    );

    await client.configure({
      input_audio_transcription: { model: 'whisper-1' },
      // Add any other configurations as needed
    });

    await client.sendAudio(new Uint8Array(buffer));
    const inputAudioItem = await client.commitAudio();

    // Wait for the transcription to complete
    await inputAudioItem.waitForCompletion();

    const transcription = inputAudioItem.transcription || '';

    // Generate the assistant's response
    const response = await client.generateResponse();
    const responses = [];

    // Process the response items
    for await (const item of response) {
      if (item.type === 'message' && item.role === 'assistant') {
        let content = '';
        for await (const contentPart of item) {
          if (contentPart.type === 'text') {
            for await (const textChunk of contentPart.textChunks()) {
              content += textChunk;
            }
          } else if (contentPart.type === 'audio') {
            // Handle assistant audio if needed
            // For example, collect audio chunks or save them
          }
        }
        responses.push({ type: 'assistant', content });
      }
    }

    // Close the client
    await client.close();

    return NextResponse.json({ transcription, responses });
  } catch (error) {
    console.error('Error processing uploaded audio:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 