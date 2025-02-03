# Azure OpenAI Audio Chat Interface

This project provides two tools for interacting with Azure OpenAI's audio capabilities:

## 1. Bulk Audio Processing (scripts/uploadAudioFromFolder.mjs)

Process multiple audio files in sequence while maintaining conversation context.

### Setup
1. Create `.env` file in root with:
```
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_DEPLOYMENT=your_deployment
```

2. Create an `audio_files` folder in root
3. Place audio files (.wav, .mp3, .m4a, .aac) in the folder

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

### Run
```bash
npm install
npm run dev
```
Then open http://localhost:3000

## Requirements
- Node.js 18+
- Azure OpenAI access with gpt-4o-realtime-preview model
