import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { RTClient } from 'rt-client';
import { processAudioFile, createWavHeader } from './audio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function saveAssistantAudio(audioData, originalFileName) {
  const outputDir = path.join(process.cwd(), 'assistant_responses');
  await fs.mkdir(outputDir, { recursive: true });

  const baseName = path.parse(originalFileName).name;
  const outputPath = path.join(outputDir, `${baseName}-response-${Date.now()}.wav`);

  // Calculate proper audio length
  const audioLength = audioData.length;
  const wavHeader = createWavHeader(audioLength, 24000, 1, 16);
  
  // Ensure proper buffer handling
  const audioBuffer = Buffer.from(audioData.buffer);
  const wavFile = Buffer.concat([wavHeader, audioBuffer], wavHeader.length + audioLength);
  
  await fs.writeFile(outputPath, wavFile);
  console.log(`Assistant audio saved to: ${outputPath}`);
}

async function main() {
  const audioFolder = path.join(process.cwd(), 'audio_files');

  // Initialize client once for all files
  const client = new RTClient(
    new URL(`${process.env.AZURE_OPENAI_ENDPOINT}/openai/realtime/conversation`),
    { key: process.env.AZURE_OPENAI_API_KEY },
    { deployment: process.env.AZURE_OPENAI_DEPLOYMENT }
  );

  // Configure the client once
  await client.configure({
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: null,
    voice: 'echo',
    instructions: `Today we're going to learn a Maamar from the Rebbe together. That's pronounced 'mymerr'. You're going to be the teacher for our whole group! I'm providing you with tons of material explaining the core text, and we'll go through piece by piece. Here are some instructions on how we'll approach this:

1. Focus on the text at hand
2. Only reference the material which I provide. Don't share any insights or inferences beyond that. Don't explain any terms or ideas which you know about but don't see in the source material.
3. Take a humble approach; we don't really know anything about what's going on, we're navigating this as the Rebbe gave it to us.
4. As new concepts are introduced, explain each concept or term thoroughly, as much as the materials provide.
5. Try to adopt the sincere and focused tone of voice of the maamar itself.
6. Translate and explain, translate and explain each part
7. Don't ramble on - keep it conversational, and very short responses. Like sometimes one word is enough, you know what I mean.
8. Often a clip will cut in the middle of a sentence, so don't anticipate what is coming next. Just hold space for that part.
`
  });

  try {
    // Ensure the audio_files directory exists
    await fs.mkdir(audioFolder, { recursive: true });

    const files = await fs.readdir(audioFolder);
    const supportedExtensions = ['.wav', '.mp3', '.m4a', '.aac'];
    const audioFiles = files.filter(file => supportedExtensions.includes(path.extname(file).toLowerCase()));

    console.log(`Starting session with ${audioFiles.length} files to process`);
    
    for (const [index, file] of audioFiles.entries()) {
      console.log(`\n[${index + 1}/${audioFiles.length}] Processing file: ${file}`);
      
      try {
        // Add delay before processing
        console.log('Waiting 3 seconds before next file...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const filePath = path.join(audioFolder, file);
        const { pcmData, sampleRate, numChannels, bitsPerSample } = await processAudioFile(filePath);
        console.log(`Audio stats: ${sampleRate}Hz, ${numChannels} channels, ${bitsPerSample}-bit, ${pcmData.length} bytes`);

        // Add small delay between chunks
        const CHUNK_SIZE = 4800;
        for (let i = 0; i < pcmData.length; i += CHUNK_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 50));
          await client.sendAudio(pcmData.slice(i, i + CHUNK_SIZE));
        }

        console.log('Audio chunks sent, committing...');
        const inputAudioItem = await client.commitAudio();
        console.log('Waiting for transcription...');
        await inputAudioItem.waitForCompletion();
        console.log(`Transcription complete: ${inputAudioItem.transcription?.length || 0} chars`);

        // Add longer delay after response
        console.log('Waiting 5 seconds after response...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await client.generateResponse();
        if (response) {
          for await (const item of response) {
            if (item.type === 'message' && item.role === 'assistant') {
              let content = '';
              for await (const contentPart of item) {
                if (contentPart.type === 'text') {
                  for await (const textChunk of contentPart.textChunks()) {
                    content += textChunk;
                  }
                  console.log('Assistant response:', content);
                } else if (contentPart.type === 'audio') {
                  const audioChunks = [];
                  for await (const audio of contentPart.audioChunks()) {
                    audioChunks.push(audio);
                  }
                  // Combine all audio chunks
                  const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
                  const combinedAudio = new Uint8Array(totalLength);
                  let offset = 0;
                  for (const chunk of audioChunks) {
                    combinedAudio.set(chunk, offset);
                    offset += chunk.length;
                  }
                  await saveAssistantAudio(combinedAudio, file);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
        console.log('Waiting 10 seconds before continuing...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  } finally {
    console.log('Closing client...');
    await client.close();
  }
}

main().catch(error => {
  console.error('Error in main function:', error);
  process.exit(1);
}); 