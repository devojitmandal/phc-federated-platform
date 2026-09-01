export interface BricsCountryData {
    country: string
    code: string
    event: string
    intervention: string
    outcome: string
  }
  
  export const BRICS_MOCK_DATA: BricsCountryData[] = [
    {
      country: 'Brazil',
      code: 'BR',
      event: 'Dengue outbreak across São Paulo state (March 2026)',
      intervention:
        'Increased IV fluid and antipyretic buffer stock by 15% across affected municipalities, pre-positioned mobile hydration units near high-incidence zones',
      outcome: 'Reduced emergency ward overflow by 22% within 3 weeks',
    },
    {
      country: 'Russia',
      code: 'RU',
      event: 'Seasonal influenza surge in Moscow Oblast (January 2026)',
      intervention:
        'Redistributed antiviral stock from low-incidence rural clinics to urban polyclinics using centralized demand forecasting',
      outcome: 'Cut average time-to-treatment by 1.8 days',
    },
    {
      country: 'China',
      code: 'CN',
      event: 'Heatwave-driven dehydration cases in Henan province (July 2026)',
      intervention:
        'Deployed a predictive model to pre-stock ORS and electrolyte solutions 5 days ahead of forecasted heat peaks',
      outcome: 'Stockout incidents dropped from 12% to 2% of facilities',
    },
    {
      country: 'South Africa',
      code: 'ZA',
      event: 'TB medication shortage in Eastern Cape (February 2026)',
      intervention:
        'Cross-provincial redistribution network reallocated surplus stock from Western Cape within 48 hours',
      outcome: 'Avoided treatment interruption for approximately 3,200 patients',
    },
  ]