const handleAudioUpload = async () => {
  if (!selectedAudioFile || !isConnected || !clientRef.current) return;
    
  try {
    // Configure with just the necessary settings for audio upload
    await clientRef.current.configure({
      input_audio_transcription: null,
      turn_detection: null
    });

    const pcmData = await processWavFile(selectedAudioFile);
      
    // Send audio in chunks
    const CHUNK_SIZE = 4800;
    for (let i = 0; i < pcmData.length; i += CHUNK_SIZE) {
      const chunk = pcmData.slice(i, i + CHUNK_SIZE);
      await clientRef.current.sendAudio(chunk);
    }
      
    await clientRef.current.commitAudio();
    const response = await clientRef.current.generateResponse();
      
    if (response) {
      await handleResponse(response);
    }
  } catch (error) {
    console.error("Error processing audio:", error);
  }
};