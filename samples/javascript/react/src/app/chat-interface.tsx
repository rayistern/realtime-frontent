"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Send, Mic, MicOff, Power } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Modality,
  RTClient,
  RTInputAudioItem,
  RTResponse,
  TurnDetection,
  RTAudioContent,
} from "rt-client";
import { AudioHandler } from "@/lib/audio";

interface Message {
  type: "user" | "assistant" | "status";
  content: string;
}

interface ToolDeclaration {
  name: string;
  parameters: string;
  returnValue: string;
}

const ChatInterface = () => {
  const [isAzure, setIsAzure] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [deployment, setDeployment] = useState("");
  const [useVAD, setUseVAD] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [temperature, setTemperature] = useState(0.9);
  const [modality, setModality] = useState("audio");
  const [tools, setTools] = useState<ToolDeclaration[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const clientRef = useRef<RTClient | null>(null);
  const audioHandlerRef = useRef<AudioHandler | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);

  const addTool = () => {
    setTools([...tools, { name: "", parameters: "", returnValue: "" }]);
  };

  const updateTool = (index: number, field: string, value: string) => {
    const newTools = [...tools];

    if (field === "name") {
      newTools[index].name = value;
    } else if (field === "parameters") {
      newTools[index].parameters = value;
    } else if (field === "returnValue") {
      newTools[index].returnValue = value;
    }
    setTools(newTools);
  };

  const handleConnect = async () => {
    if (!isConnected) {
      try {
        setIsConnecting(true);
        clientRef.current = isAzure
          ? new RTClient(new URL(endpoint), { key: apiKey }, { deployment })
          : new RTClient(
              { key: apiKey },
              { model: "gpt-4o-realtime-preview-2024-10-01" }
            );

        const modalities: Modality[] =
          modality === "audio" ? ["text", "audio"] : ["text"];
        const turnDetection: TurnDetection = useVAD
          ? { type: "server_vad" }
          : null;

        await clientRef.current.configure({
          instructions: instructions?.length > 0 ? instructions : undefined,
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: turnDetection,
          tools,
          temperature,
          modalities,
        });

        // Start listening to events without causing recursion
        startResponseListener();

        setIsConnected(true);
      } catch (error) {
        console.error("Connection failed:", error);
      } finally {
        setIsConnecting(false);
      }
    } else {
      await disconnect();
    }
  };

  const disconnect = async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.close();
        clientRef.current = null;
        setIsConnected(false);
      } catch (error) {
        console.error("Disconnect failed:", error);
      }
    }
  };

  const handleResponse = async (event: RTResponse) => {
    try {
      for await (const item of event) {
        console.log("Received item:", item);
        if (item.type === "message" && item.role === "assistant") {
          const message: Message = {
            type: item.role,
            content: "",
          };
          setMessages((prevMessages) => [...prevMessages, message]);

          for await (const content of item) {
            console.log("Processing content:", content);

            if (content.type === "text") {
              for await (const text of content.textChunks()) {
                message.content += text;
                setMessages((prevMessages) => {
                  prevMessages[prevMessages.length - 1].content = message.content;
                  return [...prevMessages];
                });
              }
            } else if (content.type === "audio") {
              await handleAudioContent(content);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error handling response:", error);
    }
  };

  const handleAudioContent = async (content: RTAudioContent) => {
    audioHandlerRef.current?.startStreamingPlayback();

    const audioChunks: Uint8Array[] = [];

    for await (const audio of content.audioChunks()) {
      audioHandlerRef.current?.playChunk(audio);
      audioChunks.push(audio);
    }

    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    try {
      console.log("Sending assistant audio to server");
      const response = await fetch("/api/save-assistant-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: combinedAudio,
      });
      if (!response.ok) {
        console.error("Failed to save assistant audio on server:", response.statusText);
      } else {
        console.log("Assistant audio saved on server");
      }
    } catch (error) {
      console.error("Error saving assistant audio on server:", error);
    }
  };

  const handleInputAudio = async (item: RTInputAudioItem) => {
    audioHandlerRef.current?.stopStreamingPlayback();
    await item.waitForCompletion();
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        type: "user",
        content: item.transcription || "",
      },
    ]);
  };

  const startResponseListener = () => {
    if (!clientRef.current) return;

    const handleEvents = async () => {
      try {
        for await (const serverEvent of clientRef.current!.events()) {
          if (serverEvent.type === "response") {
            handleResponse(serverEvent);
          } else if (serverEvent.type === "input_audio") {
            handleInputAudio(serverEvent);
          }
        }
      } catch (error) {
        console.error("Error in event listener:", error);
      }
    };

    // Start handling events without awaiting
    handleEvents();
  };

  const sendMessage = async () => {
    if (currentMessage.trim() && clientRef.current) {
      try {
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            type: "user",
            content: currentMessage,
          },
        ]);

        await clientRef.current.sendItem({
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: currentMessage }],
        });
        await clientRef.current.generateResponse();
        setCurrentMessage("");
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  };

  const handleStartRecording = async () => {
    if (audioHandlerRef.current) {
      await audioHandlerRef.current.startRecording();
      setIsRecording(true);
    }
  };

  const handleStopRecording = async () => {
    if (audioHandlerRef.current) {
      const audioData = await audioHandlerRef.current.stopRecording();
      setIsRecording(false);

      try {
        const response = await fetch("/api/save-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: audioData,
        });
        if (!response.ok) {
          console.error("Failed to upload audio");
        } else {
          console.log("Audio uploaded successfully");
        }
      } catch (error) {
        console.error("Error uploading audio:", error);
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await handleStopRecording();
    } else {
      await handleStartRecording();
    }
  };

  const handleAudioUpload = async () => {
    if (!selectedAudioFile || !isConnected || !clientRef.current) return;
    
    try {
      // Keep existing configuration, just disable transcription
      const currentConfig = clientRef.current.session || {};
      await clientRef.current.configure({
        ...currentConfig,
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

  const processWavFile = async (file: File): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Resample to 24kHz
    const targetSampleRate = 24000;
    const resampledBuffer = await resampleAudioBuffer(audioBuffer, targetSampleRate);
    
    // Convert to mono if needed
    const monoBuffer = resampledBuffer.numberOfChannels > 1 ? 
      convertToMono(resampledBuffer) : resampledBuffer;
      
    // Convert to 16-bit PCM
    const pcmData = audioBufferToPCM(monoBuffer);
    
    return pcmData;
  };

  const resampleAudioBuffer = async (buffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> => {
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.duration * targetSampleRate,
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(0);

    const resampledBuffer = await offlineContext.startRendering();
    return resampledBuffer;
  };

  const convertToMono = (buffer: AudioBuffer): AudioBuffer => {
    const audioContext = new AudioContext({ sampleRate: buffer.sampleRate });
    const numChannels = buffer.numberOfChannels;
    const monoBuffer = audioContext.createBuffer(
      1,
      buffer.length,
      buffer.sampleRate
    );

    const channelData = monoBuffer.getChannelData(0);
    for (let channel = 0; channel < numChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        channelData[i] += data[i] / numChannels;
      }
    }

    return monoBuffer;
  };

  const audioBufferToPCM = (buffer: AudioBuffer): Uint8Array => {
    const rawData = buffer.getChannelData(0); // Using first channel for mono
    const pcmData = new Int16Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
      const s = Math.max(-1, Math.min(1, rawData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    return new Uint8Array(pcmData.buffer);
  };

  useEffect(() => {
    const initAudioHandler = async () => {
      const handler = new AudioHandler();
      await handler.initialize();
      audioHandlerRef.current = handler;
    };

    initAudioHandler().catch(console.error);

    return () => {
      disconnect();
      audioHandlerRef.current?.close().catch(console.error);
    };
  }, []);

  return (
    <div className="flex h-screen">
      {/* Parameters Panel */}
      <div className="w-80 bg-gray-50 p-4 flex flex-col border-r">
        <div className="flex-1 overflow-y-auto">
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="connection">
              <AccordionTrigger className="text-lg font-semibold">
                Connection Settings
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Use Azure OpenAI</span>
                  <Switch
                    checked={isAzure}
                    onCheckedChange={setIsAzure}
                    disabled={isConnected}
                  />
                </div>

                {isAzure && (
                  <>
                    <Input
                      placeholder="Azure Endpoint"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      disabled={isConnected}
                    />
                    <Input
                      placeholder="Deployment Name"
                      value={deployment}
                      onChange={(e) => setDeployment(e.target.value)}
                      disabled={isConnected}
                    />
                  </>
                )}

                <Input
                  type="password"
                  placeholder="API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isConnected}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Conversation Settings */}
            <AccordionItem value="conversation">
              <AccordionTrigger className="text-lg font-semibold">
                Conversation Settings
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Use Server VAD</span>
                  <Switch
                    checked={useVAD}
                    onCheckedChange={setUseVAD}
                    disabled={isConnected}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instructions</label>
                  <textarea
                    className="w-full min-h-[100px] p-2 border rounded"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    disabled={isConnected}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tools</label>
                  {tools.map((tool, index) => (
                    <Card key={index} className="p-2">
                      <Input
                        placeholder="Function name"
                        value={tool.name}
                        onChange={(e) =>
                          updateTool(index, "name", e.target.value)
                        }
                        className="mb-2"
                        disabled={isConnected}
                      />
                      <Input
                        placeholder="Parameters"
                        value={tool.parameters}
                        onChange={(e) =>
                          updateTool(index, "parameters", e.target.value)
                        }
                        className="mb-2"
                        disabled={isConnected}
                      />
                      <Input
                        placeholder="Return value"
                        value={tool.returnValue}
                        onChange={(e) =>
                          updateTool(index, "returnValue", e.target.value)
                        }
                        disabled={isConnected}
                      />
                    </Card>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addTool}
                    className="w-full"
                    disabled={isConnected || true}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tool
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Temperature ({temperature})
                  </label>
                  <Slider
                    value={[temperature]}
                    onValueChange={([value]) => setTemperature(value)}
                    min={0.6}
                    max={1.2}
                    step={0.1}
                    disabled={isConnected}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Modality</label>
                  <Select
                    value={modality}
                    onValueChange={setModality}
                    disabled={isConnected}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Connect Button */}
        <Button
          className="mt-4"
          variant={isConnected ? "destructive" : "default"}
          onClick={handleConnect}
          disabled={isConnecting}
        >
          <Power className="w-4 h-4 mr-2" />
          {isConnecting
            ? "Connecting..."
            : isConnected
            ? "Disconnect"
            : "Connect"}
        </Button>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 p-3 rounded-lg ${
                message.type === "user"
                  ? "bg-blue-100 ml-auto max-w-[80%]"
                  : "bg-gray-100 mr-auto max-w-[80%]"
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyUp={(e) => e.key === "Enter" && sendMessage()}
              disabled={!isConnected}
            />
            <Button
              variant="outline"
              onClick={toggleRecording}
              className={isRecording ? "bg-red-100" : ""}
              disabled={!isConnected}
            >
              {isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            <Button onClick={sendMessage} disabled={!isConnected}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center mt-2">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                setSelectedAudioFile(e.target.files?.[0] || null);
              }}
              disabled={!isConnected}
            />
            <Button
              onClick={handleAudioUpload}
              disabled={!selectedAudioFile || !isConnected}
            >
              Upload Audio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
