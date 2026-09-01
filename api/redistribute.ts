import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
}

// Helper to calculate real-world distance in km locally (zero AI tokens)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { overloadedFacilityId, overloadedFacilityName, issueType } = await req.json()

    // 1. Initialize Supabase Admin Client
    const supabaseUrl = process.env.VITE_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.VITE_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. Fetch ALL facilities so we can find the source's exact coordinates
    const { data: facilities, error: dbError } = await supabase
      .from('facilities')
      .select(`
        id, 
        name_en, 
        lat, 
        lng,
        bed_status (total_beds, occupied_beds)
      `)
    
    if (dbError) throw dbError

    // 3. Find the overloaded facility to act as our geographic origin point
    const sourceFacility = facilities.find(f => f.id === overloadedFacilityId)
    if (!sourceFacility) throw new Error("Source facility not found")

    // 4. Calculate distance, filter by capacity, and sort locally
    const availableFacilities = facilities
      .filter(f => f.id !== overloadedFacilityId)
      .map(f => {
        const beds = Array.isArray(f.bed_status) ? f.bed_status[0] : f.bed_status
        const total = beds?.total_beds ?? 0
        const occupied = beds?.occupied_beds ?? 0
        const available = total - occupied
        
        // Use our local function to find exact km distance
        const distance = getDistance(sourceFacility.lat, sourceFacility.lng, f.lat, f.lng)
        
        return { ...f, available, distance }
      })
      .filter(f => f.available >= 2)
      .sort((a, b) => a.distance - b.distance) // Sort closest to furthest

    if (availableFacilities.length === 0) {
      return new Response(JSON.stringify({ 
        plan: "CRITICAL: No nearby facilities have available beds. Alerting state officials for immediate field hospital deployment.",
        targetFacility: null
      }), { status: 200 })
    }

    // 5. Construct the Gemini AI Prompt using the mathematical closest target
    const target = availableFacilities[0]
    const prompt = `
      You are an AI logistics coordinator for a regional health department.
      The facility "${overloadedFacilityName}" has reported a critical ${issueType} (95%+ capacity).
      
      I have found an alternative facility: "${target.name_en}" which has ${target.available} beds currently available and is ${target.distance.toFixed(1)} km away.
      
      Write a concise, 2-sentence emergency diversion protocol. 
      Sentence 1: Acknowledge the critical overload at the source facility.
      Sentence 2: Authorize the immediate diversion of incoming patients/ambulances to the target facility.
      Do not use markdown, keep it professional and direct.
    `

    // 6. Ping Gemini to generate the human-readable plan
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 } // Keep it strict and logistical
      })
    })

    const geminiData = await geminiRes.json()
    const generatedPlan = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 
      `Divert traffic from ${overloadedFacilityName} to ${target.name_en}.`

    // 7. Return the structured response to the frontend
    return new Response(JSON.stringify({
      plan: generatedPlan.trim(),
      targetFacility: target
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Redistribution Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate mitigation plan' }), { status: 500 })
  }
}