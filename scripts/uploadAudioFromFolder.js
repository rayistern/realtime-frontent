"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { RTClient } from 'rt-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Audio processing functions
function processWavFile(buffer) {
    return __awaiter(this, void 0, void 0, function () {
        var audioContext, audioBuffer, offlineContext, source, resampledBuffer, pcmData, channelData, i, s;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    audioContext = new AudioContext();
                    return [4 /*yield*/, audioContext.decodeAudioData(buffer.buffer)];
                case 1:
                    audioBuffer = _a.sent();
                    offlineContext = new OfflineAudioContext(1, audioBuffer.length, 24000);
                    source = offlineContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(offlineContext.destination);
                    source.start();
                    return [4 /*yield*/, offlineContext.startRendering()];
                case 2:
                    resampledBuffer = _a.sent();
                    pcmData = new Int16Array(resampledBuffer.length);
                    channelData = resampledBuffer.getChannelData(0);
                    for (i = 0; i < resampledBuffer.length; i++) {
                        s = Math.max(-1, Math.min(1, channelData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                    }
                    return [2 /*return*/, new Uint8Array(pcmData.buffer)];
            }
        });
    });
}
function createWavHeader(length, sampleRate, numChannels, bitsPerSample) {
    var buffer = new ArrayBuffer(44);
    var view = new DataView(buffer);
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
function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
function saveAssistantAudio(audioData, originalFileName) {
    return __awaiter(this, void 0, void 0, function () {
        var outputDir, baseName, outputPath, wavHeader, wavFile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    outputDir = path.join(process.cwd(), 'assistant_responses');
                    return [4 /*yield*/, fs.promises.mkdir(outputDir, { recursive: true })];
                case 1:
                    _a.sent();
                    baseName = path.parse(originalFileName).name;
                    outputPath = path.join(outputDir, "".concat(baseName, "-response-").concat(Date.now(), ".wav"));
                    wavHeader = createWavHeader(audioData.length, 24000, 1, 16);
                    wavFile = Buffer.concat([wavHeader, Buffer.from(audioData.buffer)]);
                    return [4 /*yield*/, fs.promises.writeFile(outputPath, wavFile)];
                case 2:
                    _a.sent();
                    console.log("Assistant audio saved to: ".concat(outputPath));
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var audioFolder, client, realtimeClient, files, wavFiles, _i, wavFiles_1, file, filePath, session, audioBuffer, pcmData, CHUNK_SIZE, i, chunk, inputAudioItem, response, _a, response_1, response_1_1, item, content, _b, item_1, item_1_1, contentPart, _c, _d, _e, textChunk, e_1_1, audioChunks, _f, _g, _h, audio, e_2_1, totalLength, combinedAudio, offset, _j, audioChunks_1, chunk, e_3_1, e_4_1, error_1;
        var _k, e_4, _l, _m, _o, e_3, _p, _q, _r, e_1, _s, _t, _u, e_2, _v, _w;
        return __generator(this, function (_x) {
            switch (_x.label) {
                case 0:
                    audioFolder = path.join(process.cwd(), 'audio_files');
                    client = new RTClient(process.env.AZURE_OPENAI_ENDPOINT, process.env.AZURE_OPENAI_API_KEY);
                    realtimeClient = client.getRealtimeConversationClient(process.env.AZURE_OPENAI_DEPLOYMENT);
                    // Create audio_files directory if it doesn't exist
                    return [4 /*yield*/, fs.promises.mkdir(audioFolder, { recursive: true })];
                case 1:
                    // Create audio_files directory if it doesn't exist
                    _x.sent();
                    return [4 /*yield*/, fs.promises.readdir(audioFolder)];
                case 2:
                    files = _x.sent();
                    wavFiles = files.filter(function (file) { return path.extname(file).toLowerCase() === '.wav'; });
                    console.log("Found ".concat(wavFiles.length, " WAV files in ").concat(audioFolder));
                    _i = 0, wavFiles_1 = wavFiles;
                    _x.label = 3;
                case 3:
                    if (!(_i < wavFiles_1.length)) return [3 /*break*/, 69];
                    file = wavFiles_1[_i];
                    filePath = path.join(audioFolder, file);
                    console.log("\nProcessing file: ".concat(file));
                    _x.label = 4;
                case 4:
                    _x.trys.push([4, 67, , 68]);
                    return [4 /*yield*/, realtimeClient.startConversationSession()];
                case 5:
                    session = _x.sent();
                    // Configure the session
                    return [4 /*yield*/, session.configure({
                            inputTranscriptionOptions: {
                                model: 'whisper-1'
                            },
                            turnDetectionOptions: {
                                type: 'none'
                            }
                        })];
                case 6:
                    // Configure the session
                    _x.sent();
                    return [4 /*yield*/, fs.promises.readFile(filePath)];
                case 7:
                    audioBuffer = _x.sent();
                    return [4 /*yield*/, processWavFile(audioBuffer)];
                case 8:
                    pcmData = _x.sent();
                    console.log('Sending audio chunks...');
                    CHUNK_SIZE = 4800;
                    i = 0;
                    _x.label = 9;
                case 9:
                    if (!(i < pcmData.length)) return [3 /*break*/, 12];
                    chunk = pcmData.slice(i, i + CHUNK_SIZE);
                    return [4 /*yield*/, session.sendAudio(chunk)];
                case 10:
                    _x.sent();
                    _x.label = 11;
                case 11:
                    i += CHUNK_SIZE;
                    return [3 /*break*/, 9];
                case 12: return [4 /*yield*/, session.commitAudio()];
                case 13:
                    inputAudioItem = _x.sent();
                    return [4 /*yield*/, inputAudioItem.waitForCompletion()];
                case 14:
                    _x.sent();
                    console.log("Transcription: ".concat(inputAudioItem.transcription));
                    return [4 /*yield*/, session.generateResponse()];
                case 15:
                    response = _x.sent();
                    if (!response) return [3 /*break*/, 64];
                    _x.label = 16;
                case 16:
                    _x.trys.push([16, 58, 59, 64]);
                    _a = true, response_1 = (e_4 = void 0, __asyncValues(response));
                    _x.label = 17;
                case 17: return [4 /*yield*/, response_1.next()];
                case 18:
                    if (!(response_1_1 = _x.sent(), _k = response_1_1.done, !_k)) return [3 /*break*/, 57];
                    _m = response_1_1.value;
                    _a = false;
                    item = _m;
                    if (!(item.type === 'message' && item.role === 'assistant')) return [3 /*break*/, 56];
                    content = '';
                    _x.label = 19;
                case 19:
                    _x.trys.push([19, 50, 51, 56]);
                    _b = true, item_1 = (e_3 = void 0, __asyncValues(item));
                    _x.label = 20;
                case 20: return [4 /*yield*/, item_1.next()];
                case 21:
                    if (!(item_1_1 = _x.sent(), _o = item_1_1.done, !_o)) return [3 /*break*/, 49];
                    _q = item_1_1.value;
                    _b = false;
                    contentPart = _q;
                    if (!(contentPart.type === 'text')) return [3 /*break*/, 34];
                    _x.label = 22;
                case 22:
                    _x.trys.push([22, 27, 28, 33]);
                    _c = true, _d = (e_1 = void 0, __asyncValues(contentPart.textChunks()));
                    _x.label = 23;
                case 23: return [4 /*yield*/, _d.next()];
                case 24:
                    if (!(_e = _x.sent(), _r = _e.done, !_r)) return [3 /*break*/, 26];
                    _t = _e.value;
                    _c = false;
                    textChunk = _t;
                    content += textChunk;
                    _x.label = 25;
                case 25:
                    _c = true;
                    return [3 /*break*/, 23];
                case 26: return [3 /*break*/, 33];
                case 27:
                    e_1_1 = _x.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 33];
                case 28:
                    _x.trys.push([28, , 31, 32]);
                    if (!(!_c && !_r && (_s = _d.return))) return [3 /*break*/, 30];
                    return [4 /*yield*/, _s.call(_d)];
                case 29:
                    _x.sent();
                    _x.label = 30;
                case 30: return [3 /*break*/, 32];
                case 31:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 32: return [7 /*endfinally*/];
                case 33:
                    console.log('Assistant response:', content);
                    return [3 /*break*/, 48];
                case 34:
                    if (!(contentPart.type === 'audio')) return [3 /*break*/, 48];
                    audioChunks = [];
                    _x.label = 35;
                case 35:
                    _x.trys.push([35, 40, 41, 46]);
                    _f = true, _g = (e_2 = void 0, __asyncValues(contentPart.audioChunks()));
                    _x.label = 36;
                case 36: return [4 /*yield*/, _g.next()];
                case 37:
                    if (!(_h = _x.sent(), _u = _h.done, !_u)) return [3 /*break*/, 39];
                    _w = _h.value;
                    _f = false;
                    audio = _w;
                    audioChunks.push(audio);
                    _x.label = 38;
                case 38:
                    _f = true;
                    return [3 /*break*/, 36];
                case 39: return [3 /*break*/, 46];
                case 40:
                    e_2_1 = _x.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 46];
                case 41:
                    _x.trys.push([41, , 44, 45]);
                    if (!(!_f && !_u && (_v = _g.return))) return [3 /*break*/, 43];
                    return [4 /*yield*/, _v.call(_g)];
                case 42:
                    _x.sent();
                    _x.label = 43;
                case 43: return [3 /*break*/, 45];
                case 44:
                    if (e_2) throw e_2.error;
                    return [7 /*endfinally*/];
                case 45: return [7 /*endfinally*/];
                case 46:
                    totalLength = audioChunks.reduce(function (sum, chunk) { return sum + chunk.length; }, 0);
                    combinedAudio = new Uint8Array(totalLength);
                    offset = 0;
                    for (_j = 0, audioChunks_1 = audioChunks; _j < audioChunks_1.length; _j++) {
                        chunk = audioChunks_1[_j];
                        combinedAudio.set(chunk, offset);
                        offset += chunk.length;
                    }
                    return [4 /*yield*/, saveAssistantAudio(combinedAudio, file)];
                case 47:
                    _x.sent();
                    _x.label = 48;
                case 48:
                    _b = true;
                    return [3 /*break*/, 20];
                case 49: return [3 /*break*/, 56];
                case 50:
                    e_3_1 = _x.sent();
                    e_3 = { error: e_3_1 };
                    return [3 /*break*/, 56];
                case 51:
                    _x.trys.push([51, , 54, 55]);
                    if (!(!_b && !_o && (_p = item_1.return))) return [3 /*break*/, 53];
                    return [4 /*yield*/, _p.call(item_1)];
                case 52:
                    _x.sent();
                    _x.label = 53;
                case 53: return [3 /*break*/, 55];
                case 54:
                    if (e_3) throw e_3.error;
                    return [7 /*endfinally*/];
                case 55: return [7 /*endfinally*/];
                case 56:
                    _a = true;
                    return [3 /*break*/, 17];
                case 57: return [3 /*break*/, 64];
                case 58:
                    e_4_1 = _x.sent();
                    e_4 = { error: e_4_1 };
                    return [3 /*break*/, 64];
                case 59:
                    _x.trys.push([59, , 62, 63]);
                    if (!(!_a && !_k && (_l = response_1.return))) return [3 /*break*/, 61];
                    return [4 /*yield*/, _l.call(response_1)];
                case 60:
                    _x.sent();
                    _x.label = 61;
                case 61: return [3 /*break*/, 63];
                case 62:
                    if (e_4) throw e_4.error;
                    return [7 /*endfinally*/];
                case 63: return [7 /*endfinally*/];
                case 64: 
                // Close the session
                return [4 /*yield*/, session.close()];
                case 65:
                    // Close the session
                    _x.sent();
                    // Wait a bit between files
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 66:
                    // Wait a bit between files
                    _x.sent();
                    return [3 /*break*/, 68];
                case 67:
                    error_1 = _x.sent();
                    console.error("Error processing file ".concat(file, ":"), error_1);
                    return [3 /*break*/, 68];
                case 68:
                    _i++;
                    return [3 /*break*/, 3];
                case 69: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error('Error in main function:', error);
    process.exit(1);
});
