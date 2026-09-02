import { getSupabaseAdmin, jsonResponse, errorResponse } from './_lib/utils'

interface GeminiInsight {
  matched_country: string
  insight_en: string
  insight_hi: string
  confidence: 'low' | 'medium' | 'high'
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    const admin = getSupabaseAdmin()
    const today = new Date().toISOString().slice(0, 10)

    // Fetch at-risk inventory
    const { data: inventory, error: invError } = await admin
      .from('national_inventory_rollup')
      .select('medicine_id, total_quantity, days_of_supply, medicines(name_en, category)')
      .eq('snapshot_date', today)
      .order('days_of_supply', { ascending: true, nullsFirst: false })
      .limit(5)
    
    if (invError) throw invError

    if (!inventory || inventory.length === 0) {
      return jsonResponse({
        message: 'No national rollup data for today. Run recalculate rollups first.',
        insight: null,
      })
    }

    let bricsCountries: unknown[] = []
    try {
      const body = await req.json()
      bricsCountries = body?.bricsData ?? []
    } catch {
      // Proceed with empty BRICS data if no body sent
    }

    const prompt = `
      You are a global health supply chain analyst.
      
      India's current highest-risk medicines (lowest days-of-supply first):
      ${JSON.stringify(inventory.map((i: any) => ({
        medicine: i.medicines?.name_en ?? i.medicine_id,
        category: i.medicines?.category ?? 'unknown',
        total_quantity: i.total_quantity,
        days_of_supply: i.days_of_supply,
      })))}

      Recent BRICS nation supply chain interventions:
      ${JSON.stringify(bricsCountries)}

      INSTRUCTIONS:
      1. Pick ONE BRICS intervention most relevant to India's highest-risk medicine (match by category/scenario).
      2. Return ONLY a JSON object.

      EXPECTED JSON FORMAT:
      {
        "matched_country": "Exact Country Name",
        "insight_en": "2-3 sentences naming the intervention, outcome, and an actionable recommendation for India.",
        "insight_hi": "The exact same insight translated into Hindi.",
        "confidence": "low" | "medium" | "high"
      }
    `

    // Replaced generic callGemini with the hardened 3.1 Flash Lite native JSON implementation
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { 
          temperature: 0.3,
          responseMimeType: "application/json" // Forces strict object generation
        }
      })
    })

    const geminiData = await geminiRes.json()
    
    // Catch API key or Quota errors directly before they break JSON.parse
    if (!geminiRes.ok) {
       throw new Error(`Gemini API Error: ${geminiData.error?.message || 'Unknown error'}`)
    }

    let rawOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    
    // Failsafe Markdown stripper
    rawOutput = rawOutput.replace(/```json/i, '').replace(/```/g, '').trim()

    let insight: GeminiInsight
    try {
      insight = JSON.parse(rawOutput)
    } catch {
      return errorResponse(`Gemini returned invalid JSON: ${rawOutput.slice(0, 500)}`, 502)
    }

    return jsonResponse({
        generated_at: new Date().toISOString(),
        based_on_medicine: (inventory[0] as any)?.medicines?.name_en ?? inventory[0]?.medicine_id,
        insight,
      })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Unknown error', 500)
  }
}