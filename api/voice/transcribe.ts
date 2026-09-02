import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { transcript, facilityId } = await req.json()
    console.log('\n--- 🎙️ NEW VOICE LOG REQUEST ---')
    console.log('1. Transcript Received:', transcript)

    const supabaseUrl = process.env.VITE_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.VITE_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: meds, error: dbError } = await supabase.from('medicines').select('id, name_en, name_hi')
    if (dbError) throw new Error(`Supabase Fetch Error: ${dbError.message}`)
    
    const medsDatabase = meds?.map(m => ({
      id: m.id,
      english: m.name_en,
      hindi: m.name_hi || ""
    }))
    
    console.log('2. Medicines loaded from DB:', meds?.length || 0, 'items found')

    if (!meds || meds.length === 0) {
      return new Response(JSON.stringify({ success: false, count: 0 }), { status: 200 })
    }

    const prompt = `
      You are a data extractor for a pharmacy. 
      Transcript: "${transcript}"

      Database:
      ${JSON.stringify(medsDatabase)}

      INSTRUCTIONS:
      1. Find the medicine in the database that sounds like the transcript (e.g. 'पेरासिटामोल' maps to 'Paracetamol').
      2. Extract the numeric quantity.
      3. Always output a JSON array.

      Format: [{"medicine_id": "exact-uuid", "quantity": 50, "unit": "units"}]
    `

    console.log('3. Sending to Gemini...')
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // BYPASS SAFETY FILTERS FOR MEDICAL INVENTORY APP
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { 
          temperature: 0.1, 
          responseMimeType: "application/json" 
        }
      })
    })

    const geminiData = await geminiRes.json()
    
    // NEW: Log the entire raw API response to see if there are safety blocks or errors
    console.log('4. RAW GEMINI API PAYLOAD:', JSON.stringify(geminiData, null, 2))
    
    let rawOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    
    const parsedData = JSON.parse(rawOutput)
    console.log('5. Successfully Parsed JSON:', parsedData)

    if (parsedData.length === 0) {
      return new Response(JSON.stringify({ success: false, count: 0 }), { status: 200 })
    }

    const inserts = parsedData.map((item: any) => ({
      facility_id: facilityId,
      medicine_id: item.medicine_id,
      quantity: item.quantity,
      unit: item.unit || 'units',
      source: 'voice' 
    }))

    const { error: insertError } = await supabase.from('inventory_snapshots').insert(inserts)
    if (insertError) throw new Error(`Supabase Insert Error: ${insertError.message}`)

    console.log('✅ Successfully inserted to database!')
    return new Response(JSON.stringify({ success: true, count: inserts.length }), { status: 200 })

  } catch (error: any) {
    console.error('❌ CATCH BLOCK ERROR:', error.message || error)
    return new Response(JSON.stringify({ success: false, error: 'Backend Crash' }), { status: 500 })
  }
}