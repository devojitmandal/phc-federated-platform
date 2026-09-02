import { useState, useRef } from 'react'

export default function VoiceLogger({ 
  facilityId, 
  onApplied 
}: { 
  facilityId: string | null; 
  onApplied: () => void 
}) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
  
  const recognitionRef = useRef<any>(null)

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    setToast(null)
    const win = window as any
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      setToast({ type: 'error', msg: 'Browser does not support voice recognition. Please use Chrome.' })
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'hi-IN'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: any) => {
      let current = ''
      for (let i = 0; i < event.results.length; i++) {
        current += event.results[i][0].transcript
      }
      setTranscript(current)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech Recognition Error Event:', event.error)
      setToast({ type: 'error', msg: `Mic Error: ${event.error}` })
      setIsListening(false)
    }
    
    recognition.onend = () => {
      console.log('Speech recognition service disconnected')
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const handleProcess = async () => {
    if (!transcript.trim() || !facilityId) return
    setIsProcessing(true)
    
    try {
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, facilityId })
      })
      
      const data = await res.json()
      if (data.success) {
        setToast({ type: 'success', msg: `Logged ${data.count} medicines successfully!` })
        setTranscript('')
        onApplied() // Refreshes the recent entries table in the parent component
      } else {
        setToast({ type: 'error', msg: 'AI could not identify the medicines. Please try again.' })
      }
    } catch (error) {
      setToast({ type: 'error', msg: 'Failed to process voice log.' })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative min-h-[100px] rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-inner">
        {transcript ? (
          <p className="text-sm font-medium text-slate-800">{transcript}</p>
        ) : (
          <p className="text-sm italic text-slate-400">
            {isListening ? 'Listening (Speak in Hindi or English)...' : 'Press the microphone and say "Paracetamol 50 units"'}
          </p>
        )}
      </div>

      {toast && (
        <div className={`rounded-md p-3 text-xs font-semibold ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={toggleListen}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition-all ${
            isListening ? 'animate-pulse bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-900'
          }`}
        >
          {isListening ? '🛑 Stop Recording' : '🎙️ Start Recording'}
        </button>

        <button
          onClick={handleProcess}
          disabled={!transcript || isProcessing}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
        >
          {isProcessing ? 'Processing AI...' : '✨ Save to Inventory'}
        </button>
      </div>
      
      {transcript && !isListening && (
        <button onClick={() => setTranscript('')} className="self-end text-xs font-medium text-slate-500 hover:text-slate-800">
          Clear Text
        </button>
      )}
    </div>
  )
}