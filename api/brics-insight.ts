import { getSupabaseAdmin, callGemini, jsonResponse, errorResponse } from './_lib/utils'

interface GeminiInsight {
  matched_country: string
  insight_en: string
  insight_hi: string
  confidence: 'low' | 'medium' | 'high'
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const admin = getSupabaseAdmin()
    const today = new Date().toISOString().slice(0, 10)

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
      // no body sent — proceed with empty BRICS data, Gemini will note nothing to compare
    }

    const prompt = `You are a global health supply chain analyst comparing India's Primary Health Centre network against recent supply chain interventions in other BRICS nations.

India's current most at-risk medicines (national aggregate, lowest days-of-supply first):
${JSON.stringify(
  inventory.map((i: any) => ({
    medicine: i.medicines?.name_en ?? i.medicine_id,
    category: i.medicines?.category ?? 'unknown',
    total_quantity: i.total_quantity,
    days_of_supply: i.days_of_supply,
  })),
  null,
  2,
)}

Recent BRICS nation supply chain interventions:
${JSON.stringify(bricsCountries, null, 2)}

Pick the ONE BRICS intervention most relevant to India's current highest-risk medicine above (match by category/scenario similarity, not just picking the first one). Return a JSON object with:
- matched_country (string, exact country name from the list)
- insight_en (2-3 sentences, English: name the matched country's intervention, its outcome, and a specific actionable recommendation for India's relevant districts)
- insight_hi (same insight translated to Hindi)
- confidence ("low" | "medium" | "high" based on how closely the scenario matches)

Return ONLY the JSON object, no other text.`

    const rawResponse = await callGemini(prompt)

    let insight: GeminiInsight
    try {
      insight = JSON.parse(rawResponse)
    } catch {
      return errorResponse(`Gemini returned invalid JSON: ${rawResponse.slice(0, 500)}`, 502)
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