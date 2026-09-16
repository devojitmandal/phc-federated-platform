// api/redistribute.ts
import { verifyAuth, getSupabaseAdmin, callGemini, jsonResponse, errorResponse } from './_lib/utils'

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
    return errorResponse('Method not allowed', 405)
  }

  try {
    // 1. AUTHENTICATE
    const { profile } = await verifyAuth(req)
    let { overloadedFacilityId, issueType } = await req.json()

    // 2. ENFORCE BOUNDARIES (Zero-Trust)
    // If the user is a facility worker, force the ID to their assigned facility
    if (profile.role === 'facility_worker') {
      overloadedFacilityId = profile.facility_id
    }

    if (!overloadedFacilityId) {
      return errorResponse('Facility ID is required', 400)
    }

    // 3. Initialize Supabase Admin Client
    // We use the admin client here to fetch nearby cross-district facilities for emergency diversion
    const supabaseAdmin = getSupabaseAdmin()

    // 4. Fetch and Verify Source Facility Jurisdiction
    const { data: sourceFacility, error: sourceErr } = await supabaseAdmin
      .from('facilities')
      .select('id, name_en, lat, lng, district_id')
      .eq('id', overloadedFacilityId)
      .single()

    if (sourceErr || !sourceFacility) {
      return errorResponse('Source facility not found', 404)
    }

    // If district admin, ensure the facility actually belongs to their district
    if (profile.role === 'district_admin' && sourceFacility.district_id !== profile.district_id) {
      return errorResponse('Forbidden: Facility is outside your district jurisdiction', 403)
    }

    // 5. Fetch ALL candidate facilities for diversion
    const { data: facilities, error: dbError } = await supabaseAdmin
      .from('facilities')
      .select(`
        id, 
        name_en, 
        lat, 
        lng,
        bed_status (total_beds, occupied_beds)
      `)
    
    if (dbError) throw dbError

    // 6. Calculate distance, filter by capacity, and sort locally
    const availableFacilities = facilities
      .filter(f => f.id !== overloadedFacilityId && f.lat && f.lng)
      .map(f => {
        const beds = Array.isArray(f.bed_status) ? f.bed_status[0] : f.bed_status
        const total = beds?.total_beds ?? 0
        const occupied = beds?.occupied_beds ?? 0
        const available = total - occupied
        
        const distance = getDistance(sourceFacility.lat!, sourceFacility.lng!, f.lat!, f.lng!)
        
        return { ...f, available, distance }
      })
      .filter(f => f.available >= 2)
      .sort((a, b) => a.distance - b.distance)

    if (availableFacilities.length === 0) {
      return jsonResponse({ 
        plan: "CRITICAL: No nearby facilities have available beds. Alerting state officials for immediate field hospital deployment.",
        targetFacility: null
      })
    }

    // 7. Construct the Gemini AI Prompt
    const target = availableFacilities[0]
    const prompt = `
      You are an AI logistics coordinator for a regional health department.
      The facility "${sourceFacility.name_en}" has reported a critical ${issueType || 'overload'} (95%+ capacity).
      
      I have found an alternative facility: "${target.name_en}" which has ${target.available} beds currently available and is ${target.distance.toFixed(1)} km away.
      
      Write a concise, 2-sentence emergency diversion protocol. 
      Sentence 1: Acknowledge the critical overload at the source facility.
      Sentence 2: Authorize the immediate diversion of incoming patients/ambulances to the target facility.
      Do not use markdown, keep it professional and direct.
    `

    // 8. Generate the Plan using the unified utility function
    let generatedPlan = `Divert traffic from ${sourceFacility.name_en} to ${target.name_en}.`
    try {
      generatedPlan = await callGemini(prompt)
    } catch (aiError) {
      console.error('Gemini API Failed, using smart fallback:', aiError)
    }

    // 9. Return the structured response
    return jsonResponse({
      plan: generatedPlan.trim(),
      targetFacility: target
    })

  } catch (error: any) {
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return errorResponse(error.message, 403)
    }
    console.error('Redistribution Error:', error)
    return errorResponse(error.message || 'Failed to generate mitigation plan', 500)
  }
}