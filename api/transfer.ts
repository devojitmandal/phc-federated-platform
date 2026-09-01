// api/transfer.ts
import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { districtId, stateId, medicineId, medicineName } = await req.json()

    const supabaseUrl = process.env.VITE_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.VITE_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch ALL facilities and their latest stock for this specific medicine
    const { data: facilities, error: dbError } = await supabase
      .from('facilities')
      .select(`
        id, 
        name_en, 
        district_id,
        state_id,
        inventory_snapshots ( quantity, unit )
      `)
      .eq('inventory_snapshots.medicine_id', medicineId)
      .order('recorded_at', { referencedTable: 'inventory_snapshots', ascending: false })

    if (dbError) throw dbError

    // 2. Identify the specific PHC in THIS district that needs the medicine most (The Victim)
    let victimFacility = "Unknown PHC"
    let lowestStock = 999999

    const mappedFacilities = (facilities || []).map(f => {
      const qty = f.inventory_snapshots?.[0]?.quantity || 0
      const unit = f.inventory_snapshots?.[0]?.unit || 'units'
      
      if (f.district_id === districtId && qty < lowestStock) {
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
    surplusSource = mappedFacilities.find(f => f.district_id === districtId && f.id !== victimFacility && f.qty > 50)

    // Tier 2: Search within the SAME State (Different District)
    if (!surplusSource) {
      surplusSource = mappedFacilities.find(f => f.state_id === stateId && f.qty > 50)
      if (surplusSource) {
        escalationLevel = 'State'
        alertLabel = '🟡 STATE ESCALATION'
      }
    }

    // Tier 3: Search National (Any State)
    if (!surplusSource) {
      surplusSource = mappedFacilities.find(f => f.qty > 50)
      if (surplusSource) {
        escalationLevel = 'National'
        alertLabel = '🔴 NATIONAL ESCALATION'
      }
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
        Sentence 2: If the level is State or National, instruct the respective officials to approve the cross-border transport. If Local, instruct immediate dispatch.
        Keep it highly professional and direct. Do not use markdown.
      `
    } else {
      prompt = `
        You are an AI supply chain coordinator. 
        Facility "${victimFacility}" is out of "${medicineName}". There is absolutely NO surplus available anywhere in the national database.
        Write a 2-sentence emergency procurement alert to the National Health Ministry advising immediate vendor manufacturing or importing.
      `
      alertLabel = '🚨 CRITICAL SHORTAGE'
    }

    // 5. Generate AI Plan
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    })

    const geminiData = await geminiRes.json()
    const generatedPlan = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Emergency transfer required.'

    // 6. Return the plan with the appropriate alert badge
    return new Response(JSON.stringify({ 
      plan: `${alertLabel}: ${generatedPlan.trim()}`,
      level: escalationLevel
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Escalation AI Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate transfer plan' }), { status: 500 })
  }
}