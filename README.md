# PHC Federated Platform

### AI-Powered Healthcare Resource Coordination for India's Public Healthcare Network

> **India-first. BRICS-ready.**
>
> A scalable digital platform for coordinating medicines, beds, workforce, and emergency resources across Primary Health Centres (PHCs) using hierarchical data aggregation, AI-assisted decision support, and role-based access.

---

## 🚀 Live Demo

🔗 **[PHC Federated Platform — Live Demo](https://phc-federated-platform.vercel.app/)**

---

## 🏥 The Problem

India's public healthcare network operates across thousands of facilities, districts, and states.

However, healthcare resource information is often fragmented:

- One PHC may face a medicine shortage while another has surplus stock.
- District administrators may not have real-time visibility into facility-level resources.
- Manual reporting can delay emergency response.
- Workforce and bed availability can be difficult to monitor centrally.
- Healthcare authorities need actionable intelligence without unnecessarily centralizing sensitive facility-level information.

### The core problem:

> **Healthcare resources exist — visibility doesn't.**

---

## 💡 Our Solution

**PHC Federated Platform** connects healthcare facilities through a hierarchical digital architecture:

```text
PHC
 ↓
District
 ↓
State
 ↓
National

Each level receives the information required for its role while enabling aggregated visibility across the healthcare network.

The platform combines:

📦 Medicine inventory monitoring

🛏️ Bed availability

👨‍⚕️ Workforce attendance

🤖 AI-assisted resource analysis

⚠️ Stock-out risk detection

🔄 Resource redistribution recommendations

🎙️ Voice-based inventory updates

🌐 Multilingual support

🏥 Patient facility finder

🌍 Cross-border applicability for BRICS countries



---

✨ Key Features

1. 📦 Medicine Inventory Management

Healthcare facilities can monitor:

Current stock

Medicine consumption

Stock trends

Shortage risks

Available surplus


The system aggregates resource information from facility → district → state → national levels.


---

2. 🤖 AI-Assisted Forecasting & Analysis

The platform combines deterministic operational calculations with generative AI.

Stock-out risk workflow

Historical Inventory
        +
Consumption Trends
        +
Current Stock
        ↓
Risk Calculation
        ↓
AI Analysis
        ↓
Stock-out Warning
        ↓
Recommended Action

AI is used as an intelligence and decision-support layer, while operational data remains the source of truth.

Google Gemini is used for:

Inventory analysis

Natural-language insights

Resource redistribution recommendations

Voice-to-structured-data processing

Emergency analysis

Cross-border applicability analysis



---

3. 🔄 Resource Redistribution

When one facility is approaching a shortage while another has available resources, the platform can identify potential redistribution opportunities.

Example

PHC Alpha
Medicine A → Critical Stock
        ↓
AI identifies shortage risk
        ↓
Search nearby/connected facilities
        ↓
PHC Beta
Medicine A → Available Surplus
        ↓
Redistribution Recommendation
        ↓
Authorized Administrator
        ↓
Human Approval

> AI recommends. Authorized administrators decide.



The platform does not automatically execute critical healthcare resource transfers.


---

4. 🛏️ Bed Availability

The platform provides aggregated visibility into:

Available beds

Occupied beds

Facility capacity

District-level availability

State-level trends


This can support faster identification of facilities with available capacity.


---

5. 👨‍⚕️ Workforce Monitoring

Facility-level workforce information can be recorded and aggregated to provide administrators with visibility into:

Staff attendance

Workforce availability

Facility staffing conditions



---

6. 🎙️ Voice-Based Inventory Updates

Healthcare workers can use voice input to reduce manual data-entry requirements.

Prototype flow

Healthcare Worker
       ↓
Voice Input
       ↓
Browser Speech Recognition
       ↓
Structured Text
       ↓
Gemini Processing
       ↓
Inventory Update

The current prototype uses browser-based Speech Recognition.

For production deployment, this layer can be replaced or extended with Google Cloud Speech-to-Text for more robust large-scale multilingual voice processing.


---

7. 🌐 Multilingual Interface

The platform supports multiple languages to improve accessibility across India's diverse healthcare ecosystem.

Current prototype languages include:

English

Hindi

Bengali

Marathi

Tamil

Telugu


The architecture can be extended with additional regional languages.


---

8. 🏥 Patient Facility Finder

Citizens can identify healthcare facilities based on available capacity and resources.

The goal is to reduce the information gap between healthcare infrastructure and patients who need it.


---

🧠 Federated Healthcare Architecture

The platform follows a hierarchical federated healthcare architecture.

NATIONAL
                       │
              ┌────────┴────────┐
              │                 │
            STATE             STATE
              │                 │
        ┌─────┴─────┐     ┌─────┴─────┐
      DISTRICT    DISTRICT DISTRICT   DISTRICT
        │            │        │          │
      PHC          PHC      PHC        PHC

Core principle

> Local data → Controlled aggregation → Shared intelligence



The architecture is designed so that different administrative levels can receive appropriate aggregated information rather than requiring unrestricted access to every facility's raw operational data.

Important distinction

The current prototype demonstrates federated healthcare/data architecture and hierarchical aggregation.

Full federated machine-learning model training across independently controlled state systems is a potential future production phase.


---

🏗️ System Workflow

┌──────────────────────┐
│ Healthcare Facilities│
│      / PHCs          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Secure Data Storage  │
│ Supabase/PostgreSQL  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Hierarchical         │
│ Aggregation          │
│ PHC → District →     │
│ State → National     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ AI Decision Support  │
│      Gemini          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Human Review &       │
│ Authorized Action    │
└──────────────────────┘


---

🔐 Security & Access Control

The platform uses role-based access control to separate responsibilities across the healthcare hierarchy.

Example roles include:

PHC / Facility Staff

District Administrators

State Health Authorities

National Health Authorities


Supabase/PostgreSQL Row Level Security (RLS) is used to help restrict data access according to authorization.

The principle is:

> Users should only access the level of information required for their role.




---

🤖 AI Architecture

AI is intentionally separated from the system's operational source of truth.

Operational Data
      │
      ▼
Deterministic Calculations
      │
      ├── Stock Levels
      ├── Consumption
      ├── Capacity
      └── Resource Availability
      │
      ▼
Gemini AI
      │
      ├── Analysis
      ├── Explanations
      ├── Recommendations
      └── Natural-Language Processing
      │
      ▼
Human Decision Maker

This reduces the risk of treating generative AI output as authoritative operational data.


---

🌍 India-First, BRICS-Ready

The platform is designed around India's PHC network, while keeping its core architecture reusable across different national healthcare systems.

Common Platform Core

Inventory
Beds
Workforce
AI Analysis
Alerts
Aggregation
Resource Coordination
Role-Based Access

Country-Specific Integration Layer

Different countries can connect their own:

Healthcare facility hierarchy

Government databases

Facility/resource identifiers

Languages

Healthcare regulations

Procurement systems

Authentication systems

National health APIs


Example

PHC FEDERATED PLATFORM
                       │
             ┌─────────┴─────────┐
             │   Common Core     │
             │                   │
             │ Inventory         │
             │ Beds              │
             │ Workforce         │
             │ AI                │
             │ Coordination      │
             └─────────┬─────────┘
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
     INDIA           BRAZIL       SOUTH AFRICA
       │               │                │
 Country-specific  Country-specific  Country-specific
 Integration       Integration       Integration

The current prototype is primarily India-focused, with cross-border workflows demonstrated at the prototype level.

Production deployment would require authenticated integrations with each country's healthcare and procurement infrastructure.


---

📊 Prototype Data

The demonstration environment uses realistic/synthetic data to simulate a multi-level healthcare network.

Current prototype scope includes:

2 states

8 districts

20 PHCs

30+ medicines

Facility-level resource data

Historical inventory data

Bed availability

Workforce information


The dataset is intended for demonstration and evaluation rather than representing live government healthcare data.


---

🛠️ Technology Stack

Layer	Technology

Frontend	React + Vite
Language	TypeScript
Styling	Tailwind CSS
Database	PostgreSQL
Backend / Data Platform	Supabase
APIs	Vercel Serverless Functions
AI	Google Gemini
Voice Prototype	Browser Speech Recognition
Production Voice Direction	Google Cloud Speech-to-Text
Deployment	Vercel



---

🏛️ Architecture

USER INTERFACE
                 React + TypeScript
                         │
                         ▼
                  Vercel Application
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
       Serverless APIs         Supabase
              │                PostgreSQL
              │                     │
              ▼                     │
         Gemini AI ◄───────────────┘


---

📁 Project Structure

src/
├── components/
├── pages/
├── services/
├── hooks/
├── lib/
├── types/
└── App.tsx

api/
├── AI / Gemini endpoints
├── analysis endpoints
└── server-side services

supabase/
├── database schema
├── migrations
└── database functions


---

🚀 Running Locally

1. Clone the repository

git clone https://github.com/devojitmandal/phc-federated-platform.git
cd phc-federated-platform

2. Install dependencies

npm install

3. Configure environment variables

Create a .env file and add the required Supabase and Gemini configuration.

Example:

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key

Do not commit secret API keys to the repository.

4. Start development server

npm run dev

The application will then be available through the local development URL provided by Vite.


---

📈 Scalability

The architecture is designed to progress from a limited pilot to a large healthcare network.

Phase 1 — Pilot

Selected PHCs
     ↓
District
     ↓
State

Phase 2 — State Expansion

Multiple Districts
        ↓
State-Level Intelligence

Phase 3 — Multi-State Federation

State A ─┐
State B ─┼──→ Shared Intelligence
State C ─┘

Phase 4 — National Network

PHCs
 ↓
Districts
 ↓
States
 ↓
National Healthcare Network

The architecture can subsequently be adapted for cross-border deployments through country-specific integration layers.


---

⚙️ Prototype vs Production

Area	Current Prototype	Production Direction

Data	Synthetic / realistic demo data	Government & facility integrations
Voice	Browser Speech Recognition	Google Cloud Speech-to-Text
AI	Gemini	Gemini + validated predictive models
Aggregation	PostgreSQL-based hierarchical rollups	Event-driven / distributed aggregation
Redistribution	Recommendation workflow	Integrated authorized procurement/logistics systems
Cross-border	Simulated workflow	Authenticated country-specific integrations
Scale	Demonstration network	Multi-state / national infrastructure
Federated Learning	Future capability	Distributed model training where appropriate



---

🔮 Future Development

Potential production improvements include:

Google Cloud Speech-to-Text integration

More advanced demand forecasting models

Federated machine-learning capabilities

Real-time government health-data integrations

Automated emergency alerts

Logistics and procurement integration

Advanced geospatial facility routing

More Indian regional languages

Country-specific BRICS integrations

Event-driven distributed architecture

Stronger audit and compliance infrastructure



---

🎯 Impact

PHC Federated Platform aims to help healthcare authorities move from:

Fragmented Data
      ↓
Delayed Visibility
      ↓
Reactive Decisions

towards:

Connected Facilities
      ↓
Aggregated Visibility
      ↓
AI-Assisted Intelligence
      ↓
Early Warnings
      ↓
Coordinated Human Decisions

The objective is not to replace healthcare administrators.

It is to provide them with better visibility and decision-support when resources are limited and response time matters.


---

👥 Stakeholders

PHC / Facility Workers

Update inventory

Record workforce information

Monitor facility resources


District Administrators

Monitor facilities

Identify shortages

Coordinate redistribution


State Health Authorities

Monitor district-level trends

Identify regional shortages

Coordinate state-level resources


National Health Authorities

View aggregated national conditions

Identify large-scale resource trends

Support emergency coordination


Citizens / Patients

Find facilities

Check available healthcare capacity

Identify potentially accessible resources



---

🏆 Hackathon Context

Code for Communities 2

Theme

Building technology that can improve public healthcare resource coordination through scalable, AI-assisted infrastructure.

The project focuses on:

India-wide scalability

AI-powered decision support

Public healthcare infrastructure

Resource visibility

Emergency response

Human-in-the-loop decision making

Cross-border applicability across BRICS countries



---

📌 Project Status

Current Status: Working Prototype

The current system demonstrates the complete conceptual workflow from facility-level resource data to hierarchical aggregation, AI-assisted analysis, and human-approved coordination.

Some production capabilities — including government integrations, large-scale speech processing, advanced predictive modelling, and real federated machine learning — are represented as future deployment directions rather than fully implemented features.


---

🌐 Live Application

Launch PHC Federated Platform
https://phc-federated-platform.vercel.app/


---

👨‍💻 Project

PHC Federated Platform

Built with: React • TypeScript • Supabase • PostgreSQL • Vercel • Google Gemini

> Local data. Shared intelligence. Better healthcare coordination.



One important correction from your previous README/PPT: I deliberately changed **“Google Speech-to-Text”** to **Browser Speech Recognition** for the current prototype and kept Google Cloud Speech-to-Text under the production direction, so judges won't find a mismatch between your README and actual implementation.
