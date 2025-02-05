# Azure OpenAI Audio Chat Interface

*Forked from [Azure-Samples/aoai-realtime-audio-sdk](https://github.com/Azure-Samples/aoai-realtime-audio-sdk)*

This project provides two tools for interacting with Azure OpenAI's audio capabilities:

## 1. Bulk Audio Processing (scripts/uploadAudioFromFolder.mjs)

Process multiple audio files in sequence while maintaining one continuous conversation session. The session starts when you run the script and processes all files present in the folder at that time.

### Setup
1. Create `.env` file in root with:
```
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_DEPLOYMENT=your_deployment
```

2. Create an `audio_files` folder in root
3. Place audio files (.wav, .mp3, .m4a, .aac) in the folder
4. Configure system prompt in `scripts/uploadAudioFromFolder.mjs` by editing the `instructions` field in the client configuration
5. To add prompts before your audio files, simply record a voice note and ensure it appears first alphabetically in the folder

### Run
```bash
node scripts/uploadAudioFromFolder.mjs
```

## 2. Next.js Chat Interface (src/app)

Web interface built with Next.js for real-time audio conversations.

### Features
- Upload and process audio files
- Download assistant responses
- Real-time conversation
- Session history maintained

### Configuration
- System prompt and voice settings: Edit `src/app/chat-interface.tsx` in the `handleConnect` function
- Audio settings: Modify `input_audio_transcription` and `turn_detection` in `handleAudioUpload` function

### Run
```bash
npm install
npm run dev
```
Then open http://localhost:3000

## Requirements
- Node.js 18+
- Azure OpenAI access with gpt-4o-realtime-preview model

## Known Issues
- Microphone input is currently not working in the frontend interface
- Do not send multiple messages before receiving a response - this will cause the session to be lost
- Sessions may occasionally drop unexpectedly
- Frontend app compatibility with OpenAI keys not verified (only tested with Azure OpenAI)
