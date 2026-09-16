// api/transfer.ts
import { verifyAuth, getSupabaseAdmin, errorResponse, jsonResponse } from './_lib/utils.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    // 1. AUTHENTICATE & AUTHORIZE
    // Only allow District, State, and National admins to request transfers
    const { profile } = await verifyAuth(req, ['district_admin', 'state_viewer', 'national_admin'])
    const { medicineId, medicineName } = await req.json()

    // 2. ENFORCE BOUNDARIES (Zero-Trust)
    // If the user is a district admin, force the request to use THEIR assigned district.
    // Do not trust a district ID sent from the frontend payload.
    const targetDistrictId = profile.role === 'district_admin' ? profile.district_id : null
    
    // We use the admin client here ONLY because a district admin needs read access 
    // to cross-border facilities to search for surplus stock (which RLS normally blocks).
    const supabaseAdmin = getSupabaseAdmin()

    // 3. Fetch ALL facilities across the network
    const { data: facilities, error: dbError } = await supabaseAdmin
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

    // 4. Identify the specific PHC in the target district that needs the medicine most
    let victimFacility = "Unknown PHC"
    let lowestStock = 999999

    const mappedFacilities = (facilities || []).map(f => {
      const qty = f.inventory_snapshots?.[0]?.quantity || 0
      const unit = f.inventory_snapshots?.[0]?.unit || 'units'
      
      if ((!targetDistrictId || f.district_id === targetDistrictId) && qty < lowestStock) {
        lowestStock = qty
        victimFacility = f.name_en
      }
      return { ...f, qty, unit }
    })

    // 5. The Cascading Escalation Search
    let surplusSource = null
    let escalationLevel = 'District' 
    let alertLabel = '✅ LOCAL TRANSFER'

    // Tier 1: Search within the SAME District (Surplus > 50)
    if (targetDistrictId) {
      surplusSource = mappedFacilities.find(f => f.district_id === targetDistrictId && f.name_en !== victimFacility && f.qty > 50)
    }

    // Tier 2: Search Cross-Border / Regional (Different District)
    if (!surplusSource) {
      surplusSource = mappedFacilities.find(f => f.district_id !== targetDistrictId && f.qty > 50)
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

    // 6. Construct the Dynamic Gemini Prompt
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

    // 7. Generate AI Plan with a Bulletproof Smart Fallback
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

    // 8. DB PERSISTENCE: Write Tier 2 and Tier 3 escalations to the database
    if (escalationLevel === 'State' || escalationLevel === 'National') {
      const suggestedQty = surplusSource ? Math.floor(surplusSource.qty * 0.3) : 500;

      await supabaseAdmin.from('redistribution_recommendations').insert({
        medicine_id: medicineId,
        from_district_id: surplusSource?.district_id || null,
        to_district_id: targetDistrictId,
        suggested_quantity: suggestedQty,
        reason_en: generatedPlan,
        reason_hi: generatedPlan,
        status: 'suggested'
      });

      await supabaseAdmin.from('alerts').insert({
        title_en: `${escalationLevel} Escalation: ${medicineName}`,
        severity: escalationLevel === 'State' ? 'warning' : 'critical',
        body_en: generatedPlan,
        body_hi: generatedPlan,
        scope: escalationLevel.toLowerCase(),
        alert_type: escalationLevel === 'State' ? 'low_stock' : 'stockout'
      });
    }

    return jsonResponse({ 
      plan: `${alertLabel}: ${generatedPlan}`,
      level: escalationLevel
    })

  } catch (error: any) {
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return errorResponse(error.message, 403)
    }
    return errorResponse(error.message || 'Internal Server Error', 500)
  }
}