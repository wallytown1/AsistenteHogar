import { useState, useCallback } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { apiRequest } from '../api/api';
import { TranscribeAudioResponse } from '../types/types';

export function useAudioRecording() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        console.warn('Permiso de micrófono denegado');
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      console.error('Error iniciando la grabación:', error);
    }
  }, [recorder]);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    try {
      if (!recorderState.isRecording) return null;

      recorder.stop();
      // En expo-audio, el uri suele estar disponible en el objeto recorder.
      const uri = recorder.uri;
      if (!uri) return null;

      setIsTranscribing(true);

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const ext = uri.split('.').pop() || 'm4a';
      const mimeType = ext === 'webm' ? 'audio/webm' : `audio/${ext}`;

      const res = await apiRequest<TranscribeAudioResponse>('/chef/transcribe', {
        method: 'POST',
        json: { audio_base64: base64, mime_type: mimeType },
        // Aumentamos el timeout porque la subida y procesamiento de audio puede tardar más
        timeoutMs: 30000,
      });

      return res.texto;
    } catch (error) {
      console.error('Error deteniendo/transcribiendo:', error);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [recorder, recorderState.isRecording]);

  return {
    startRecording,
    stopAndTranscribe,
    isRecording: recorderState.isRecording,
    isTranscribing,
  };
}
