import { getSupabaseAdmin, parseRequestBody, jsonResponse, errorResponse } from './_lib/utils'

interface ForecastRequestBody {
  scope: 'district' | 'state' | 'national'
  scopeId?: string
}

interface GeminiForecastItem {
  medicine_id: string
  predicted_consumption_14d: number
  stockout_risk: 'low' | 'medium' | 'high' | 'critical'
  days_until_stockout: number | null
  warning_en: string
  warning_hi: string
}

const MODEL_VERSION = 'gemini-3.1-flash-lite'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const body = await parseRequestBody<ForecastRequestBody>(req)
    const { scope, scopeId } = body

    if (scope === 'district' && !scopeId) {
      return errorResponse('scopeId is required for district scope', 400)
    }
    if (scope === 'state' && !scopeId) {
      return errorResponse('scopeId is required for state scope', 400)
    }

    const admin = getSupabaseAdmin()
    const today = new Date().toISOString().slice(0, 10)

    // 1. Fetch the relevant rollup rows for this scope
    let rollupRows: Array<{
      medicine_id: string
      total_quantity: number
      avg_daily_consumption: number
      days_of_supply: number | null
      medicines: { name_en: string; name_hi: string; reorder_threshold_days: number } | null
    }> = []

    if (scope === 'district') {
      const { data, error } = await admin
        .from('district_inventory_rollup')
        .select('medicine_id, total_quantity, avg_daily_consumption, days_of_supply, medicines(name_en, name_hi, reorder_threshold_days)')
        .eq('district_id', scopeId)
        .eq('snapshot_date', today)
      if (error) throw error
      rollupRows = (data ?? []) as unknown as typeof rollupRows
    } else if (scope === 'state') {
      const { data, error } = await admin
        .from('state_inventory_rollup')
        .select('medicine_id, total_quantity, avg_daily_consumption, days_of_supply, medicines(name_en, name_hi, reorder_threshold_days)')
        .eq('state_id', scopeId)
        .eq('snapshot_date', today)
      if (error) throw error
      rollupRows = (data ?? []) as unknown as typeof rollupRows
    } else {
      const { data, error } = await admin
        .from('national_inventory_rollup')
        .select('medicine_id, total_quantity, avg_daily_consumption, days_of_supply, medicines(name_en, name_hi, reorder_threshold_days)')
        .eq('snapshot_date', today)
      if (error) throw error
      rollupRows = (data ?? []) as unknown as typeof rollupRows
    }

    if (rollupRows.length === 0) {
      return jsonResponse({ message: 'No rollup data for this scope/date. Run recalculate rollups first.', forecasts: [] })
    }

    // 2. Build a single structured prompt covering every medicine in this scope
    const medicineSummaries = rollupRows.map((r) => ({
      medicine_id: r.medicine_id,
      name_en: r.medicines?.name_en ?? 'Unknown',
      current_quantity: r.total_quantity,
      avg_daily_consumption: r.avg_daily_consumption,
      current_days_of_supply: r.days_of_supply,
      reorder_threshold_days: r.medicines?.reorder_threshold_days ?? 7,
    }))

    const prompt = `You are a healthcare supply chain analyst for India's Primary Health Centre network.
Given the following medicine stock data for a ${scope}, forecast stockout risk for the next 14 days.

Data:
${JSON.stringify(medicineSummaries, null, 2)}

For EACH medicine, return an object with:
- medicine_id (string, copy exactly from input)
- predicted_consumption_14d (number, estimated units consumed over next 14 days based on avg_daily_consumption)
- stockout_risk ("low" | "medium" | "high" | "critical") — critical if days_of_supply is null or less than 3, high if less than reorder_threshold_days, medium if less than 2x reorder_threshold_days, else low
- days_until_stockout (number or null, estimate based on current trend)
- warning_en (short plain-language warning in English, 1 sentence, empty string if risk is low)
- warning_hi (same warning translated to Hindi, empty string if risk is low)

Return ONLY a JSON array of these objects, one per medicine, no other text.`

    // Replaced generic callGemini with the hardened 3.1 Flash Lite native JSON implementation
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_VERSION}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { 
          temperature: 0.2, // Kept low for consistent mathematical formatting
          responseMimeType: "application/json"
        }
      })
    })

    const geminiData = await geminiRes.json()
    
    if (!geminiRes.ok) {
       throw new Error(`Gemini API Error: ${geminiData.error?.message || 'Unknown error'}`)
    }

    let rawOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    rawOutput = rawOutput.replace(/```json/i, '').replace(/```/g, '').trim()

    let forecasts: GeminiForecastItem[]
    try {
      forecasts = JSON.parse(rawOutput)
      if (!Array.isArray(forecasts)) throw new Error('Response is not an array')
    } catch {
      return errorResponse(`Gemini returned invalid JSON: ${rawOutput.slice(0, 500)}`, 502)
    }

    // 3. Upsert forecasts and create alerts for high/critical risk
    const forecastRows = forecasts.map((f) => ({
      scope,
      scope_id: scope === 'national' ? null : scopeId,
      medicine_id: f.medicine_id,
      forecast_date: today,
      horizon_days: 14,
      predicted_consumption: f.predicted_consumption_14d,
      stockout_risk: f.stockout_risk,
      days_until_stockout: f.days_until_stockout,
      gemini_narrative_en: f.warning_en || null,
      gemini_narrative_hi: f.warning_hi || null,
      model_version: MODEL_VERSION,
    }))

    const { error: forecastError } = await admin.from('forecasts').insert(forecastRows)
    if (forecastError) throw forecastError

    const alertRows = forecasts
      .filter((f) => f.stockout_risk === 'high' || f.stockout_risk === 'critical')
      .map((f) => {
        const medicine = medicineSummaries.find((m) => m.medicine_id === f.medicine_id)
        return {
          scope,
          scope_id: scope === 'national' ? null : scopeId,
          alert_type: 'stockout' as const,
          severity: f.stockout_risk === 'critical' ? ('critical' as const) : ('warning' as const),
          title_en: `${medicine?.name_en ?? 'Medicine'} — ${f.stockout_risk} stockout risk`,
          title_hi: `${medicine?.name_en ?? 'दवा'} — ${f.stockout_risk === 'critical' ? 'गंभीर' : 'उच्च'} जोखिम`,
          body_en: f.warning_en,
          body_hi: f.warning_hi,
          related_medicine_id: f.medicine_id,
        }
      })

    if (alertRows.length > 0) {
      const { error: alertError } = await admin.from('alerts').insert(alertRows)
      if (alertError) throw alertError
    }

    return jsonResponse({
      forecast_date: today,
      scope,
      scope_id: scopeId ?? null,
      forecasts_generated: forecastRows.length,
      alerts_generated: alertRows.length,
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Unknown error', 500)
  }
}