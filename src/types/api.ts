export interface ForecastResponse {
  forecastsCreated: number
  alertsCreated: number
}

export interface VoiceTranscribeResponse {
  sessionId: string
  transcriptHi: string
  parsed: {
    medicineCode: string
    quantity: number
    action: 'set' | 'add'
  }
  confirmationTextHi: string
  confirmationAudioBase64: string
}
