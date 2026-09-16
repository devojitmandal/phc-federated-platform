import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { districtId, medicineId, medicineName } = await req.json()

    const supabaseUrl = process.env.VITE_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.VITE_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch ALL facilities across the network
    const { data: facilities, error: dbError } = await supabase
      .from('facilities')
      .select(`
        id, 
        name_en, 
        district_id,
        inventory_snapshots ( quantity, unit )
      `)
      .eq('inventory_snapshots.medicine_id', medicineId)
      .order('recorded_at', { referencedTable: 'inventory_snapshots', ascending: false })

    if (dbError) throw dbError

    // 2. Identify the specific PHC in the target district that needs the medicine most
    let victimFacility = "Unknown PHC"
    let lowestStock = 999999

    const mappedFacilities = (facilities || []).map(f => {
      const qty = f.inventory_snapshots?.[0]?.quantity || 0
      const unit = f.inventory_snapshots?.[0]?.unit || 'units'
      
      if ((!districtId || f.district_id === districtId) && qty < lowestStock) {
        lowestStock = qty
        victimFacility = f.name_en
      }
      return { ...f, qty, unit }
    })

    // 3. The Cascading Escalation Search
    let surplusSource = null
    let escalationLevel = 'District' 
    let alertLabel = '✅ LOCAL TRANSFER'

    // Tier 1: Search within the SAME District (Surplus > 50)
    if (districtId) {
      surplusSource = mappedFacilities.find(f => f.district_id === districtId && f.name_en !== victimFacility && f.qty > 50)
    }

    // Tier 2: Search Cross-Border / Regional (Different District)
    if (!surplusSource) {
      surplusSource = mappedFacilities.find(f => f.district_id !== districtId && f.qty > 50)
      if (surplusSource) {
        escalationLevel = 'State'
        alertLabel = '🟡 STATE ESCALATION'
      }
    }

    // Tier 3: If no surplus > 50 exists anywhere, trigger National Emergency Procurement
    if (!surplusSource) {
      escalationLevel = 'National'
      alertLabel = '🔴 NATIONAL ESCALATION'
    }

    // 4. Construct the Dynamic Gemini Prompt
    let prompt = ''
    if (surplusSource) {
      prompt = `
        You are an AI supply chain coordinator. 
        Facility "${victimFacility}" has critically low stock of "${medicineName}".
        
        Using our cascading protocol, I found a surplus of ${surplusSource.qty} ${surplusSource.unit} at "${surplusSource.name_en}" (Level: ${escalationLevel}).
        
        Write a concise, 2-sentence logistics transfer protocol.
        Sentence 1: Authorize the emergency transfer from the surplus facility to the depleted facility.
        Sentence 2: If the level is State, instruct officials to approve cross-border transport. If Local, instruct immediate dispatch.
        Keep it professional and direct. Do not use markdown.
      `
    } else {
      prompt = `
        You are an AI supply chain coordinator. 
        Facility "${victimFacility}" is out of "${medicineName}". There is absolutely NO surplus available anywhere in the national database.
        Write a 2-sentence emergency procurement alert to the National Health Ministry advising immediate vendor manufacturing or importing.
      `
    }

    // 5. Generate AI Plan with a Bulletproof Smart Fallback
    const smartFallback = surplusSource
      ? `Authorize immediate transfer of ${medicineName} from ${surplusSource.name_en} to ${victimFacility}.`
      : `Initiate emergency procurement for ${medicineName} at ${victimFacility}.`

    let generatedPlan = smartFallback;

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (apiKey) {
      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
          })
        })

        const geminiData = await geminiRes.json()
        if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          generatedPlan = geminiData.candidates[0].content.parts[0].text.trim()
        }
      } catch (aiError) {
        console.error('Gemini API Failed, using smart fallback:', aiError)
      }
    }

    // 6. DB PERSISTENCE: Write Tier 2 and Tier 3 escalations to the database
    if (escalationLevel === 'State' || escalationLevel === 'National') {
      const suggestedQty = surplusSource ? Math.floor(surplusSource.qty * 0.3) : 500;

      await supabase.from('redistribution_recommendations').insert({
        medicine_id: medicineId,
        from_district_id: surplusSource?.district_id || null,
        to_district_id: districtId,
        suggested_quantity: suggestedQty,
        reason_en: generatedPlan,
        reason_hi: generatedPlan,
        status: 'suggested'
      });

      await supabase.from('alerts').insert({
        title_en: `${escalationLevel} Escalation: ${medicineName}`,
        severity: escalationLevel === 'State' ? 'warning' : 'critical',
        body_en: generatedPlan,
        scope: escalationLevel.toLowerCase(),
        alert_type: escalationLevel === 'State' ? 'low_stock' : 'stockout'
      });
    }

    return new Response(JSON.stringify({ 
      plan: `${alertLabel}: ${generatedPlan}`,
      level: escalationLevel
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: 'Backend Crash',
      message: error.message || error.toString()
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}