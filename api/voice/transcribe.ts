// api/voice/transcribe.ts
import { verifyAuth, getSupabaseAdmin, jsonResponse, errorResponse } from '../_lib/utils'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    // 1. AUTHENTICATE & EXTRACT TRUSTED ID
    // Restrict access strictly to facility workers
    const { profile } = await verifyAuth(req, ['facility_worker'])
    
    // Ignore any facilityId sent from the frontend. Use the trusted database value.
    const trustedFacilityId = profile.facility_id
    if (!trustedFacilityId) {
      return errorResponse('Unauthorized: Your profile is not assigned to a facility', 403)
    }

    const { transcript } = await req.json()
    console.log('\n--- 🎙️ NEW VOICE LOG REQUEST ---')
    console.log(`User: ${profile.id} | Facility: ${trustedFacilityId}`)
    console.log('1. Transcript Received:', transcript)

    const supabaseAdmin = getSupabaseAdmin()

    const { data: meds, error: dbError } = await supabaseAdmin.from('medicines').select('id, name_en, name_hi')
    if (dbError) throw new Error(`Supabase Fetch Error: ${dbError.message}`)
    
    const medsDatabase = meds?.map(m => ({
      id: m.id,
      english: m.name_en,
      hindi: m.name_hi || ""
    }))
    
    console.log('2. Medicines loaded from DB:', meds?.length || 0, 'items found')

    if (!meds || meds.length === 0) {
      return jsonResponse({ success: false, count: 0 })
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
    console.log('4. RAW GEMINI API PAYLOAD:', JSON.stringify(geminiData, null, 2))
    
    let rawOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    
    const parsedData = JSON.parse(rawOutput)
    console.log('5. Successfully Parsed JSON:', parsedData)

    if (parsedData.length === 0) {
      return jsonResponse({ success: false, count: 0 })
    }

    // 2. ENFORCE DATA INTEGRITY
    // Inject the trusted IDs into the database insert
    const inserts = parsedData.map((item: any) => ({
      facility_id: trustedFacilityId,
      recorded_by: profile.id, // Audit trail mapping
      medicine_id: item.medicine_id,
      quantity: item.quantity,
      unit: item.unit || 'units',
      source: 'voice' 
    }))

    const { error: insertError } = await supabaseAdmin.from('inventory_snapshots').insert(inserts)
    if (insertError) throw new Error(`Supabase Insert Error: ${insertError.message}`)

    console.log('✅ Successfully inserted to database!')
    return jsonResponse({ success: true, count: inserts.length })

  } catch (error: any) {
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return errorResponse(error.message, 403)
    }
    console.error('❌ CATCH BLOCK ERROR:', error.message || error)
    return errorResponse('Backend Crash', 500)
  }
}