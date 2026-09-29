import json
import random
from pathlib import Path

OUTPUT_PATH = Path(__file__).resolve().parent / "training_data.jsonl"

# ── This script REPLACES training_data.jsonl with a fresh expanded dataset ──

BRIDGES = [
    {"name": "Brahmaputra Main Bridge", "id": 1, "location": "NH-27, Guwahati", "type": "NH", "score_range": (75, 98), "river": "Brahmaputra", "year": 1962},
    {"name": "Saraighat Rail Bridge", "id": 2, "location": "Amingaon, Assam", "type": "Rail", "score_range": (55, 65), "river": "Brahmaputra", "year": 1962},
    {"name": "Kamakhya Road Bridge", "id": 3, "location": "Kamakhya, Guwahati", "type": "Urban", "score_range": (45, 60), "river": "Bharalu", "year": 1978},
    {"name": "Barak Valley Bridge", "id": 4, "location": "Silchar, Assam", "type": "SH", "score_range": (65, 80), "river": "Barak", "year": 1985},
    {"name": "Dibrugarh River Bridge", "id": 5, "location": "Dibrugarh, Assam", "type": "NH", "score_range": (70, 85), "river": "Brahmaputra", "year": 1990},
    {"name": "Bogibeel Bridge", "id": 6, "location": "Dibrugarh-Dhemaji, Assam", "type": "Rail-Road", "score_range": (80, 95), "river": "Brahmaputra", "year": 2018},
    {"name": "Naranarayan Setu", "id": 7, "location": "Jogighopa, Assam", "type": "Rail-Road", "score_range": (70, 88), "river": "Brahmaputra", "year": 1998},
    {"name": "Kolia Bhomora Setu", "id": 8, "location": "Tezpur, Assam", "type": "NH", "score_range": (60, 78), "river": "Brahmaputra", "year": 1987},
    {"name": "Dhola-Sadiya Bridge", "id": 9, "location": "Dhola, Assam", "type": "NH", "score_range": (82, 96), "river": "Lohit", "year": 2017},
    {"name": "Pancharatna Bridge", "id": 10, "location": "Nagaon, Assam", "type": "SH", "score_range": (55, 72), "river": "Kolong", "year": 1975},
    {"name": "Kopili River Bridge", "id": 11, "location": "Hojai, Assam", "type": "NH", "score_range": (60, 78), "river": "Kopili", "year": 1983},
    {"name": "Digaru Bridge", "id": 12, "location": "Morigaon, Assam", "type": "SH", "score_range": (48, 65), "river": "Digaru", "year": 1971},
    {"name": "Jiabharali Bridge", "id": 13, "location": "Sonitpur, Assam", "type": "NH", "score_range": (65, 80), "river": "Jiabharali", "year": 1988},
    {"name": "Subansiri Bridge", "id": 14, "location": "Lakhimpur, Assam", "type": "NH", "score_range": (70, 85), "river": "Subansiri", "year": 1995},
    {"name": "Dibang Bridge", "id": 15, "location": "Jonai, Assam", "type": "SH", "score_range": (62, 78), "river": "Dibang", "year": 1992},
    {"name": "Puthimari Bridge", "id": 16, "location": "Kamrup, Assam", "type": "NH", "score_range": (58, 74), "river": "Puthimari", "year": 1980},
    {"name": "Manas Bridge", "id": 17, "location": "Barpeta, Assam", "type": "NH", "score_range": (65, 82), "river": "Manas", "year": 1986},
    {"name": "Champamati Bridge", "id": 18, "location": "Chirang, Assam", "type": "SH", "score_range": (50, 68), "river": "Champamati", "year": 1974},
    {"name": "Sankosh Bridge", "id": 19, "location": "Bongaigaon, Assam", "type": "NH", "score_range": (68, 84), "river": "Sankosh", "year": 1989},
    {"name": "Sonai Bridge", "id": 20, "location": "Cachar, Assam", "type": "SH", "score_range": (52, 70), "river": "Sonai", "year": 1977},
]

SENSOR_SCENARIOS = [
    # NORMAL range
    {"water_level": 1.2, "vibration": 0.20, "strain": 120, "crack_gap": 0.12, "health_score": 98, "alert": "NORMAL", "anomaly_score": 0.95, "risk_score": 5},
    {"water_level": 1.5, "vibration": 0.25, "strain": 130, "crack_gap": 0.15, "health_score": 95, "alert": "NORMAL", "anomaly_score": 0.92, "risk_score": 8},
    {"water_level": 2.0, "vibration": 0.30, "strain": 145, "crack_gap": 0.20, "health_score": 88, "alert": "NORMAL", "anomaly_score": 0.88, "risk_score": 12},
    {"water_level": 2.5, "vibration": 0.35, "strain": 150, "crack_gap": 0.22, "health_score": 84, "alert": "NORMAL", "anomaly_score": 0.85, "risk_score": 15},
    {"water_level": 3.0, "vibration": 0.40, "strain": 155, "crack_gap": 0.25, "health_score": 79, "alert": "NORMAL", "anomaly_score": 0.82, "risk_score": 18},
    # WATCH range
    {"water_level": 3.2, "vibration": 0.45, "strain": 158, "crack_gap": 0.28, "health_score": 74, "alert": "WATCH", "anomaly_score": 0.65, "risk_score": 25},
    {"water_level": 3.5, "vibration": 0.52, "strain": 162, "crack_gap": 0.30, "health_score": 70, "alert": "WATCH", "anomaly_score": 0.60, "risk_score": 30},
    {"water_level": 3.8, "vibration": 0.58, "strain": 165, "crack_gap": 0.33, "health_score": 66, "alert": "WATCH", "anomaly_score": 0.55, "risk_score": 35},
    {"water_level": 4.1, "vibration": 0.62, "strain": 168, "crack_gap": 0.36, "health_score": 63, "alert": "WATCH", "anomaly_score": 0.52, "risk_score": 38},
    {"water_level": 4.3, "vibration": 0.68, "strain": 172, "crack_gap": 0.38, "health_score": 60, "alert": "WATCH", "anomaly_score": 0.50, "risk_score": 40},
    # WARNING range
    {"water_level": 4.5, "vibration": 0.75, "strain": 175, "crack_gap": 0.42, "health_score": 56, "alert": "WARNING", "anomaly_score": 0.40, "risk_score": 48},
    {"water_level": 4.8, "vibration": 0.85, "strain": 182, "crack_gap": 0.47, "health_score": 52, "alert": "WARNING", "anomaly_score": 0.35, "risk_score": 55},
    {"water_level": 5.0, "vibration": 0.95, "strain": 190, "crack_gap": 0.50, "health_score": 46, "alert": "WARNING", "anomaly_score": 0.30, "risk_score": 62},
    {"water_level": 5.2, "vibration": 1.05, "strain": 198, "crack_gap": 0.55, "health_score": 41, "alert": "WARNING", "anomaly_score": 0.25, "risk_score": 68},
    {"water_level": 5.3, "vibration": 1.10, "strain": 204, "crack_gap": 0.58, "health_score": 38, "alert": "WARNING", "anomaly_score": 0.22, "risk_score": 72},
    # CRITICAL range
    {"water_level": 5.6, "vibration": 1.35, "strain": 215, "crack_gap": 0.68, "health_score": 28, "alert": "CRITICAL", "anomaly_score": 0.12, "risk_score": 82},
    {"water_level": 5.8, "vibration": 1.55, "strain": 225, "crack_gap": 0.74, "health_score": 22, "alert": "CRITICAL", "anomaly_score": 0.08, "risk_score": 88},
    {"water_level": 6.0, "vibration": 1.80, "strain": 240, "crack_gap": 0.82, "health_score": 15, "alert": "CRITICAL", "anomaly_score": 0.05, "risk_score": 94},
    {"water_level": 6.5, "vibration": 2.10, "strain": 255, "crack_gap": 0.90, "health_score": 8, "alert": "CRITICAL", "anomaly_score": 0.02, "risk_score": 98},
]

MAINTENANCE_ACTIONS = {
    "NORMAL": "Continue routine monitoring. Schedule next inspection per annual NHAI cycle. No immediate action required.",
    "WATCH": "Increase sensor polling frequency to every 5 minutes. Schedule inspection within 30 days. Review traffic loading patterns. Monitor trend over next 48 hours.",
    "WARNING": "Notify bridge engineer immediately. Implement 60% load restriction for heavy vehicles. Deploy inspection team within 7 days. Commission NDT if crack gap above 0.40mm. Prepare maintenance plan.",
    "CRITICAL": "IMMEDIATE ACTION REQUIRED. Deploy inspection team within 1 hour. Implement emergency load restrictions. Notify NHAI regional office. Consider bridge closure pending inspection. Submit incident report within 24 hours per NHAI emergency protocols.",
}

SEASONS = [
    {"name": "monsoon", "months": "June-September", "water_factor": 1.8, "risk_note": "Brahmaputra flood risk is highest. Scour monitoring is critical. Water level can rise 3m in 12 hours during heavy rainfall events."},
    {"name": "post-monsoon", "months": "October-November", "water_factor": 1.2, "risk_note": "Receding floods may expose scour damage. Foundation inspection recommended after monsoon season."},
    {"name": "winter", "months": "December-February", "water_factor": 0.7, "risk_note": "Low water levels provide opportunity for underwater foundation inspection. Thermal contraction may widen existing cracks."},
    {"name": "pre-monsoon", "months": "March-May", "water_factor": 0.9, "risk_note": "Prepare for monsoon season. Inspect and clear all drainage systems. Check scour protection works."},
]

PARAPHRASE_QUESTIONS = {
    "status": [
        "What is the current structural status of {name}?",
        "How is {name} doing right now?",
        "Is {name} safe to use currently?",
        "What does BridgeIQ show for {name}?",
        "Give me a health report for {name}.",
        "What is the condition of {name} at the moment?",
    ],
    "closure": [
        "{name} shows health score {score}. Should it be closed?",
        "Should we restrict traffic on {name} with health score {score}?",
        "Is {name} safe to keep open at health score {score}?",
        "Do we need to close {name}? Current score is {score}.",
        "Health score is {score} on {name}. What action should we take?",
    ],
    "maintenance": [
        "What maintenance actions are needed for {name} with alert level {alert}?",
        "What should we do for {name} given {alert} alert?",
        "How should we respond to {alert} status on {name}?",
        "What is the recommended action for {name} at {alert} level?",
        "{name} is showing {alert}. What steps should engineers take?",
    ],
}

def make_sensor_qa(bridge, scenario):
    pairs = []
    name = bridge["name"]
    loc = bridge["location"]
    score = scenario["health_score"]
    alert = scenario["alert"]

    # Status questions — multiple phrasings
    for q_template in PARAPHRASE_QUESTIONS["status"]:
        q = q_template.format(name=name)
        a = (
            f"{name} ({loc}) is currently in {alert} status with a health score of {score}/100. "
            f"Sensor readings: Water Level {scenario['water_level']}m, Vibration {scenario['vibration']}g, "
            f"Strain {scenario['strain']} MPa, Crack Gap {scenario['crack_gap']}mm. "
            f"Anomaly Score: {scenario['anomaly_score']}, Risk Score: {scenario['risk_score']}%. "
            f"{MAINTENANCE_ACTIONS[alert]}"
        )
        pairs.append({"instruction": q, "response": a})

    # Closure questions
    for q_template in PARAPHRASE_QUESTIONS["closure"]:
        q = q_template.format(name=name, score=score, alert=alert)
        if score >= 75:
            a = f"No closure required for {name}. Health score {score} indicates {alert} status — the bridge is operating safely within design parameters. Continue routine monitoring per NHAI standards."
        elif score >= 45:
            a = f"Closure is not immediately required for {name} but load restrictions are recommended. Health score {score} ({alert} status) indicates elevated stress. Implement 60% load restriction and deploy inspection team within 7 days per NHAI bridge maintenance protocol."
        else:
            a = f"Emergency assessment for closure of {name} is STRONGLY RECOMMENDED. Health score {score} ({alert} status) indicates the bridge is operating near or beyond safe limits. Per NHAI emergency protocols, health scores below 45 (Grade F) require immediate structural assessment before continued operation."
        pairs.append({"instruction": q, "response": a})

    # Maintenance questions
    for q_template in PARAPHRASE_QUESTIONS["maintenance"]:
        q = q_template.format(name=name, alert=alert)
        a = f"For {name} at {alert} alert level (health score {score}): {MAINTENANCE_ACTIONS[alert]} Per NHAI Works Manual 2006, all maintenance actions must be logged and reported to the regional bridge engineer."
        pairs.append({"instruction": q, "response": a})

    return pairs


def make_seasonal_qa():
    pairs = []
    for bridge in BRIDGES:
        for season in SEASONS:
            q = f"What are the monitoring priorities for {bridge['name']} during {season['name']} season?"
            a = (
                f"During {season['name']} ({season['months']}), {bridge['name']} ({bridge['location']}) requires specific monitoring focus. "
                f"{season['risk_note']} "
                f"Water level baseline adjustment: multiply normal thresholds by {season['water_factor']} during this season. "
                f"Key actions: increase monitoring frequency during peak {season['name']} conditions, "
                f"coordinate with IMD weather alerts for proactive response, "
                f"ensure all BridgeIQ alert notifications are active and bridge engineer contacts are current. "
                f"Per NHAI Works Manual 2006, seasonal inspection reports must be filed at start and end of monsoon season."
            )
            pairs.append({"instruction": q, "response": a})

        q = f"How does monsoon affect {bridge['name']} on the {bridge['river']} river?"
        a = (
            f"{bridge['name']} crosses the {bridge['river']} river, which experiences significant monsoon flooding from June to September. "
            f"Key risks during monsoon: foundation scour from high-velocity flood flows, hydraulic pressure on piers, "
            f"debris impact loading, and approach road erosion. "
            f"BridgeIQ monitors water level continuously — WATCH at 3.5m, WARNING at 4.0m, CRITICAL at 4.5m. "
            f"The {bridge['river']} can rise rapidly during cloud burst events in the catchment area. "
            f"Engineers should review BridgeIQ water level trend graphs daily during active monsoon and maintain 24-hour alert readiness."
        )
        pairs.append({"instruction": q, "response": a})

    return pairs


def make_multi_sensor_correlation_qa():
    pairs = [
        {
            "instruction": "Water level is high at 5.0m but vibration and strain are normal. What does this mean?",
            "response": "High water level with normal vibration and strain is a common early-monsoon pattern in BridgeIQ. The water level elevation indicates flood conditions approaching WARNING threshold, but the lack of corresponding vibration/strain increase suggests the superstructure is not yet experiencing abnormal loading. Primary concern is foundation scour — rising water increases flow velocity eroding riverbed around pier foundations without immediately affecting above-water sensor readings. Action: increase monitoring frequency, deploy underwater inspection team to check foundation condition, monitor water level trend closely for further rise. This pattern requires WATCH-level response even though overall health score may still be moderate."
        },
        {
            "instruction": "Vibration is high at 1.1g but water level and strain are normal. What is causing this?",
            "response": "High vibration with normal water level and strain is a specific diagnostic pattern in BridgeIQ indicating dynamic loading anomaly rather than flood or structural stress. Most likely causes: deteriorated expansion joints causing impact loads as vehicles cross (most common in Indian bridges), heavy vehicle convoy crossing simultaneously creating resonance, bearing malfunction causing abnormal vibration transmission, or structural resonance from traffic frequency matching bridge natural frequency. The normal strain reading is reassuring — it means overall structural stress is not elevated. Recommended action: focused inspection of all expansion joints and bearings, review traffic logs for convoy crossings, check vibration frequency signature if accelerometers support spectral analysis. Do not close bridge unless vibration sustained above 1.5g."
        },
        {
            "instruction": "Strain is at 195 MPa and crack gap is 0.55mm but water level is normal. What is the risk?",
            "response": "High strain (195 MPa, 92.9% of 210 MPa critical threshold) combined with elevated crack gap (0.55mm, 84.6% of 0.65mm critical threshold) with normal water level indicates structural stress from traffic loading rather than flood conditions. This is a WARNING-level condition. The combination of both strain AND crack gap being elevated simultaneously suggests active structural deterioration — the two readings are correlated, meaning the same underlying cause (likely overloading or advanced concrete fatigue) is driving both. Per IRC:112-2011, crack widths above 0.3mm indicate potential rebar corrosion. Immediate actions: implement 50% load restriction, deploy inspection team within 48 hours, commission half-cell potential testing for rebar corrosion assessment, prepare emergency maintenance plan. Do not wait for threshold breach."
        },
        {
            "instruction": "All four sensors suddenly dropped to zero. Is the bridge collapsing?",
            "response": "Simultaneous zero readings across all four sensors is almost certainly a sensor malfunction or communication failure, NOT a structural collapse. Bridge collapse produces sudden spike then loss of signal, not clean zero readings. Clean simultaneous zeros indicate: power failure at sensor node, communication link failure (GSM/LoRa disconnection), data logger malfunction, or software/firmware crash at the monitoring unit. BridgeIQ will show SENSOR_OFFLINE alert for this condition, separate from structural alerts. Immediate action: check sensor power supply and communication link, attempt remote restart of monitoring unit, dispatch technician to bridge site for physical inspection of monitoring equipment. Continue using last known sensor values for health assessment until sensors are restored. Do not trigger emergency closure based on sensor failure alone."
        },
        {
            "instruction": "Crack gap is normal at 0.22mm but has been increasing by 0.01mm every day for 2 weeks. Should I be concerned?",
            "response": "Yes, this trend requires immediate attention despite the absolute value being in normal range. At 0.01mm/day, the crack gap will reach WATCH threshold (0.35mm) in 13 days and WARNING threshold (0.45mm) in 23 days. BridgeIQ's LSTM Autoencoder detects this gradual drift pattern — the anomaly score will be elevated even though individual readings look normal. This is exactly the type of early warning that continuous monitoring is designed to catch. Causes of progressive crack growth: active rebar corrosion (most common), foundation settlement, thermal cycling fatigue, or sustained overloading. Per IRC:112-2011, crack propagation rate above 0.005mm/day in reinforced concrete bridges warrants engineering assessment. Action: schedule inspection within 7 days, investigate cause, prepare epoxy injection if crack exceeds 0.30mm."
        },
        {
            "instruction": "Water level dropped suddenly from 4.5m to 1.0m overnight. What does this mean?",
            "response": "A sudden water level drop of 3.5m overnight is unusual and requires investigation. Possible causes: sensor malfunction (most likely for such a rapid change), upstream dam release temporarily diverting flow, natural channel avulsion (the Brahmaputra is known for sudden channel shifts), or blockage upstream temporarily reducing flow. If the drop is real (not sensor error), it may actually expose previously submerged foundation elements for inspection — this is an opportunity for underwater foundation inspection. Cross-check with IMD river gauge data for the location. If sensor reading is inconsistent with upstream/downstream gauge data, suspect sensor malfunction. Sudden drops followed by rapid rise can also indicate flash flood conditions upstream — maintain elevated alert status for 24 hours after such events."
        },
        {
            "instruction": "Vibration and strain are both elevated but only during morning hours (7-10 AM). Why?",
            "response": "Time-correlated sensor elevation during morning hours (7-10 AM) is a classic traffic peak signature in BridgeIQ data. This is expected behavior reflecting morning commute traffic concentration — buses, trucks, and construction vehicles typically peak during this window. This pattern is NOT a structural concern if: readings return to baseline by mid-morning, peak values stay below threshold (vibration below 1.2g, strain below 210 MPa), and the pattern is consistent with historical data. Action: compare with historical morning peak data to confirm pattern is stable. If morning peaks are increasing week-over-week, this indicates growing traffic loading requiring load management. If peaks are new or suddenly higher, investigate for new heavy vehicle routes or construction traffic. BridgeIQ traffic fatigue score accumulates these daily peak loading cycles in the cumulative damage calculation."
        },
        {
            "instruction": "Health score is 72 but anomaly score is 0.15. Which one should I trust?",
            "response": "Trust the anomaly score in this case — the discrepancy is a critical warning. Health score 72 (Grade C, Fair) suggests moderate condition requiring monitoring. But anomaly score 0.15 (scale 0-1, lower = more anomalous) means the ML model considers current sensor patterns highly unusual compared to historical normal. This combination typically occurs when: sensor readings are individually within thresholds (keeping health score moderate) but their combination or temporal pattern is abnormal (flagged by LSTM/Isolation Forest). This is exactly the scenario the dual ML pipeline is designed to catch. The anomaly score is more sensitive to novel failure modes. Recommended action: treat this as WARNING-level despite moderate health score, deploy inspection team within 7 days, review full sensor trend history for the past 72 hours, check for unusual combinations that individual thresholds would miss."
        },
        {
            "instruction": "Two bridges in the same district are both showing WARNING simultaneously. Is this a network issue?",
            "response": "Simultaneous WARNING alerts on multiple bridges in the same district can indicate either a regional event or a network/sensor issue. Differentiate as follows: Regional event (real alerts) — check if there is active rainfall, flooding, or seismic activity in the district. Simultaneous elevation makes sense during monsoon flood events when multiple bridges over the same river system are affected. In this case, treat all alerts as genuine and follow WARNING response protocol for each bridge. Network/sensor issue (false alerts) — if weather conditions are normal and no seismic activity is reported, simultaneous alerts across multiple bridges may indicate a data transmission error, incorrect threshold configuration, or a software bug in the monitoring system. Check if all affected bridges show the same sensor values (suggests data copy error) or different values (suggests genuine regional event). Contact BridgeIQ system administrator to verify data integrity before dispatching inspection teams."
        },
    ]
    return pairs


def make_irc_nhai_deep_qa():
    pairs = [
        {
            "instruction": "What does IRC:6-2017 clause 219 say about seismic design of bridges?",
            "response": "IRC:6-2017 clause 219 covers seismic design requirements for road bridges in India. Key provisions: Zone-based design — India is divided into Seismic Zones II-V with zone factors Z = 0.10, 0.16, 0.24, 0.36 respectively. Assam falls in Zone V (Z=0.36), the highest hazard. Design approach — bridges use either Seismic Coefficient Method (for simple bridges) or Response Spectrum Method (for important bridges). The design horizontal seismic coefficient Ah = Z/2 × Sa/g × I/R, where Sa/g is spectral acceleration, I is importance factor (1.5 for major bridges), R is response reduction factor. Ductile detailing — pier reinforcement must meet ductile detailing requirements per IRC:112 to allow plastic hinge formation without collapse. Foundation design — liquefaction assessment mandatory for Zone IV and V bridges. BridgeIQ vibration sensors provide post-earthquake assessment data — simultaneous spike across all sensors above 0.8g triggers post-seismic inspection protocol."
        },
        {
            "instruction": "What are IRC:112-2011 requirements for reinforced concrete bridge decks?",
            "response": "IRC:112-2011 specifies comprehensive requirements for RC bridge decks: Concrete grade — minimum M35 for bridge decks (higher than IRC:21's M25 requirement, reflecting updated knowledge). Cover — 40mm minimum for deck slab top surface, 50mm for severe exposure (coastal, industrial). Reinforcement — minimum reinforcement ratio 0.26% of gross cross-section, maximum 4% to ensure ductility. Crack control — crack width limited to 0.3mm under quasi-permanent loads for reinforced concrete. Durability — water-cement ratio maximum 0.40 for moderate exposure, 0.35 for severe exposure. Waterproofing — bituminous waterproofing membrane mandatory on deck top surface. In BridgeIQ monitoring, crack gap readings above 0.30mm indicate crack widths likely exceeding IRC:112 limits, requiring immediate engineering assessment and repair per IRC:SP:40 repair guidelines."
        },
        {
            "instruction": "How does NHAI Works Manual define bridge maintenance categories?",
            "response": "NHAI Works Manual 2006 Section 7 defines four bridge maintenance categories: Routine Maintenance — annual activities including drainage cleaning, expansion joint maintenance, vegetation removal, minor concrete repairs (crack width below 0.2mm). Budget: approximately Rs 0.5-2 lakhs per bridge per year. Periodic Maintenance — every 3-5 years including waterproofing renewal, bearing inspection, major joint repairs, protective coating of steel elements. Budget: Rs 5-20 lakhs per cycle. Special Repairs — condition-based intervention triggered by inspection findings or BridgeIQ alerts, including concrete rehabilitation, bearing replacement, scour protection. Budget: Rs 20-100 lakhs per intervention. Emergency Works — immediate response to sudden structural distress, overload damage, flood damage, or seismic damage. No budget limit — work proceeds on emergency authorization. BridgeIQ enables condition-based maintenance by providing real-time health data to justify special repairs before they become emergency works."
        },
        {
            "instruction": "What is IRC:SP:35 and how does it guide bridge inspection in India?",
            "response": "IRC:SP:35 is the Indian Roads Congress Special Publication on Guidelines for Inspection and Maintenance of Bridges, published in 1990. It establishes the framework for systematic bridge inspection in India. Inspection frequency — Routine inspection: annually by bridge maintenance engineer. Periodic inspection: every 3 years by qualified structural engineer with underwater inspection. Special inspection: after floods, earthquakes, accidents, or when anomalies detected. Inspection elements — IRC:SP:35 provides detailed checklists for 18 bridge elements including deck, expansion joints, bearings, girders, piers, abutments, foundations, approach slabs, and drainage systems. Condition rating — each element rated 1-5 (Good to Critical) based on observed defects. Documentation — inspection reports must include photographs, measurements, and prioritized maintenance recommendations. BridgeIQ continuous monitoring complements IRC:SP:35 by providing data-driven condition assessment between periodic inspections, enabling risk-based scheduling of special inspections when sensor trends indicate deterioration."
        },
        {
            "instruction": "What are the load combinations for bridge design per IRC:6-2017?",
            "response": "IRC:6-2017 clause 202 specifies load combinations for bridge design using limit state design approach. Basic loads: Dead load (DL), Superimposed dead load (SIDL), Live load (LL), Impact load (IL). Additional loads: Wind load (WL), Seismic load (SL), Temperature effects (TE), Braking force (BR), Centrifugal force (CF), Earth pressure (EP), Buoyancy (BO), Water current (WC), Deformation effects (DF). Key combinations — Ultimate Limit State: 1.35 DL + 1.75 LL + 1.5 WL. Serviceability Limit State: 1.0 DL + 1.0 LL + 0.6 WL. Seismic combination: 1.35 DL + 0.2 LL + 1.5 SL. BridgeIQ monitoring relevance: simultaneous high readings in water current (water level sensor) + traffic (vibration sensor) during monsoon represents the most critical load combination per IRC:6, requiring CRITICAL-level alert response."
        },
        {
            "instruction": "What does NHAI Quality Assurance Manual say about concrete testing for bridges?",
            "response": "NHAI Quality Assurance Manual specifies concrete testing requirements for bridge construction and maintenance assessment: Fresh concrete tests — slump test (IS:1199) for workability, air content test, temperature measurement. Hardened concrete tests — compressive strength (IS:516): minimum 3 cubes per batch, 28-day strength must meet design grade. Non-destructive assessment during inspection: Rebound Hammer (IS:13311 Part 2) — indicative strength only, calibrated against core samples. Acceptance: rebound number above 25 indicates adequate strength. Ultrasonic Pulse Velocity (IS:13311 Part 1) — velocity above 4.5 km/s: excellent quality. 3.5-4.5 km/s: good. 3.0-3.5 km/s: medium. Below 3.0 km/s: poor quality, further investigation needed. Core sampling — when NDT indicates concern, extract 150mm diameter cores, test per IS:516. Core strength correction factor 1.25 applied for comparison with cube strength. BridgeIQ crack gap monitoring triggers NDT recommendation when crack gap exceeds 0.30mm."
        },
        {
            "instruction": "What is the IRC:5 requirement for bridge foundation depth?",
            "response": "IRC:5-2015 (Standard Specifications and Code of Practice for Road Bridges, Section I) specifies foundation depth requirements: Minimum depth below scour level — for piers: 1.33 times maximum scour depth below HFL. For abutments: 1.27 times maximum scour depth. Minimum depth below ground — for open foundations: 2m below lowest ground level or scour level whichever is lower. For well foundations: founded on rock or competent stratum. Pile foundations — piles must extend at least 3m into rock or 10 pile diameters into dense sand/gravel below scour level. Brahmaputra-specific considerations — design scour depth for Brahmaputra bridges at Guwahati can reach 20-30m due to extreme discharge (72,000 cumecs design flood) and alluvial riverbed. Foundation depths of 30-40m are common for major Brahmaputra crossings. BridgeIQ water level monitoring provides early warning when flood stages approach design scour thresholds, allowing engineers to assess foundation safety margins."
        },
        {
            "instruction": "How does IRC:6 define overloading and what are the penalties?",
            "response": "IRC:6-2017 and the Motor Vehicles Act 1988 together define overloading for Indian road bridges: Legal axle load limits — single axle: 10.2 tonnes (102 kN), tandem axle: 19 tonnes (190 kN), tridem axle: 24 tonnes. Gross vehicle weight — two-axle truck: 16.2 tonnes, three-axle: 25 tonnes, multi-axle: up to 55 tonnes. Overloading definition — any vehicle exceeding these limits by more than 5% tolerance. Penalties per Motor Vehicles (Amendment) Act 2019 — Rs 20,000 for first offence plus Rs 2,000 per tonne excess. Vehicle detained until excess load removed. State governments may impound overloaded vehicles. Structural impact in BridgeIQ — overloaded trucks are classified in vehicle load module as Overloaded Truck (40-75t). Each crossing adds to cumulative fatigue score per Miner's Rule at exponential rate. BridgeIQ records overload events with timestamp and estimated load for maintenance records and potential legal documentation."
        },
    ]
    return pairs


def make_troubleshooting_qa():
    pairs = [
        {
            "instruction": "BridgeIQ is showing negative health score. What happened?",
            "response": "A negative health score in BridgeIQ indicates a calculation error, not an actual bridge condition. Possible causes: sensor returning out-of-range values far above thresholds causing formula to produce negative result, database corruption in sensor data, division by zero error in health score calculation, or null values being treated as zero in calculations. This is a system issue, not a structural emergency. Actions: check raw sensor readings in the database for obvious errors, restart the BridgeIQ backend service, review application logs for calculation errors, check if sensor calibration values are correctly configured. The bridge's actual condition should be assessed using the last valid health score before the error occurred. Report the bug to the BridgeIQ development team with the timestamp of when the negative score appeared."
        },
        {
            "instruction": "The PDF export feature is generating blank reports. How do I fix this?",
            "response": "Blank PDF reports in BridgeIQ are typically caused by: Data loading timing issue — the PDF generator is capturing the page before sensor data has loaded. Fix: ensure all API calls complete before triggering PDF generation, add a 2-second delay before PDF capture. Chart rendering issue — Recharts or other visualization libraries may not render in the PDF generation context. Fix: use server-side chart generation or ensure charts are fully rendered before PDF capture. Authentication issue — PDF generation may be running without proper auth headers, causing API calls to fail silently. Fix: pass authentication token to PDF generation service. Template issue — HTML-to-PDF conversion may have CSS conflicts causing content to be hidden. Fix: review PDF-specific CSS, ensure white background and visible text colors. Check BridgeIQ backend logs for any errors during PDF generation requests."
        },
        {
            "instruction": "FAISS vector store is throwing an error when I query the AI Chat. What should I do?",
            "response": "FAISS vector store errors in BridgeIQ AI Chat are typically caused by: Index file corruption — the FAISS index in rag_docs/faiss_index/ may be corrupted. Fix: delete the index directory and rebuild it by re-running the RAG indexing script. Dimension mismatch — if the embedding model was changed after index creation, vector dimensions will mismatch. Fix: ensure the same embedding model is used for both indexing and query. Memory issue — FAISS can fail if insufficient RAM is available to load the index. Fix: check available memory, restart the backend service to clear memory. Python version incompatibility — FAISS version may not match Python version. Fix: reinstall faiss-cpu matching your Python version. If rebuilding the index, ensure all four RAG documents (IRC:6, IRC:112, NHAI Works Manual, NHAI QA Manual) are present in the rag_docs/ directory before running the indexer."
        },
        {
            "instruction": "The federated learning page shows AUC 0.000 for all rounds. What is wrong?",
            "response": "AUC 0.000 in all federated learning rounds indicates the federated model is making random predictions (chance level). Causes: Label encoding issue — if binary labels (0/1) are not correctly mapped, the model may be predicting all one class. Fix: verify label distribution in training data for each simulated client. Model initialization issue — if model weights are not properly initialized or aggregated, all rounds may start from a broken state. Fix: check FedAvg aggregation function for correct weight averaging. Data issue — if simulated client data has no anomaly samples, the model cannot learn to detect anomalies. Fix: ensure SMOTE oversampling is applied before federation to balance classes. Threshold issue — if prediction threshold is set incorrectly (e.g., 0.99 instead of 0.3), AUC calculation may fail. Fix: verify threshold parameter in evaluation function. Check the BridgeIQ federated learning logs for specific error messages during round execution."
        },
        {
            "instruction": "Backend server crashes when I start it. Error says port 8000 is already in use.",
            "response": "Port 8000 already in use means a previous BridgeIQ backend instance is still running. Fix on Windows: open PowerShell and run: netstat -ano | findstr :8000 to find the process ID (PID) using port 8000. Then run: taskkill /F /PID <PID_NUMBER> to kill it. Then restart: uvicorn main:app --reload. Alternatively, run BridgeIQ on a different port: uvicorn main:app --reload --port 8001 and update the frontend API base URL to match. To prevent this in future: always use Ctrl+C to stop the server gracefully rather than closing the terminal window. If running multiple terminal sessions, check all terminals for running uvicorn processes. On Windows, some processes may survive terminal closure — use Task Manager to find and kill python.exe processes if the above method does not work."
        },
        {
            "instruction": "Sensor data is showing the same values for the last 6 hours. Is this a malfunction?",
            "response": "Identical sensor readings for 6+ hours is almost certainly a malfunction — real bridge sensors experience natural variation from thermal effects, traffic, and environmental changes. This pattern indicates: sensor stuck at last known value (most common), data pipeline caching stale values, sensor hardware failure, or communication link frozen transmitting last packet repeatedly. Actions: check if the timestamp on sensor readings is actually updating (if timestamps are frozen, confirms communication issue). Compare readings with expected environmental variation — if ambient temperature changed significantly but strain/crack gap are identical, confirms stuck sensor. Check sensor hardware power supply and communication link. Restart data acquisition service. If sensors are unresponsive after restart, physical inspection and potential sensor replacement is needed. BridgeIQ should flag this as SENSOR_STALE alert when readings are unchanged beyond expected variation for more than 30 minutes."
        },
        {
            "instruction": "How do I reset the FAISS index after adding new documents to rag_docs?",
            "response": "To rebuild the BridgeIQ FAISS index after adding new documents: Stop the backend server (Ctrl+C in uvicorn terminal). Delete the existing index: remove the rag_docs/faiss_index/ directory completely. Place new PDF documents in rag_docs/ directory. Run the RAG indexing script: python rag.py (or whatever your indexing script is named — check for a build_index() or create_index() function in rag.py). Wait for indexing to complete — for the four current documents (IRC:6, IRC:112, NHAI Works Manual, NHAI QA Manual) this takes 2-5 minutes. Restart the backend: uvicorn main:app --reload. Test the AI Chat with a question relevant to the new document to confirm it is being retrieved. Note: adding documents increases index size and query time slightly, which is acceptable for the current document set."
        },
    ]
    return pairs


def make_bridge_age_qa():
    pairs = []
    for bridge in BRIDGES:
        age = 2026 - bridge["year"]
        if age > 40:
            condition = "aging infrastructure requiring enhanced monitoring"
            recommendation = "bi-annual major inspections rather than the standard 5-year cycle"
        elif age > 20:
            condition = "mature infrastructure in active monitoring phase"
            recommendation = "standard annual inspection cycle with condition-based supplementary inspections"
        else:
            condition = "relatively new infrastructure with good residual design life"
            recommendation = "standard NHAI inspection cycle with BridgeIQ continuous monitoring"

        q = f"How old is {bridge['name']} and what does this mean for monitoring?"
        a = (
            f"{bridge['name']} was built in {bridge['year']}, making it {age} years old as of 2026. "
            f"This classifies it as {condition}. "
            f"Per IRC design standards, bridges are designed for 100-year service life assuming proper maintenance. "
            f"At {age} years, the bridge has consumed approximately {min(age, 100)}% of its design life. "
            f"Key age-related concerns: concrete carbonation depth (increases with age, threatening rebar corrosion), "
            f"accumulated fatigue cycles from decades of traffic loading, "
            f"expansion joint and bearing degradation from thermal cycling. "
            f"BridgeIQ recommendation: {recommendation}. "
            f"Per NHAI Works Manual, bridges above 40 years old require enhanced inspection protocols."
        )
        pairs.append({"instruction": q, "response": a})

    return pairs


def make_general_qa():
    pairs = [
        {
            "instruction": "How do I interpret the BridgeIQ dashboard health score?",
            "response": "The BridgeIQ health score (0-100) gives an instant structural health summary: 90-100 (Grade A, Excellent) — bridge in optimal condition, all sensors within baseline, routine monitoring only. 75-89 (Grade B, Good) — minor deviations within acceptable range, schedule next inspection per annual cycle. 60-74 (Grade C, Fair) — moderate stress detected, increase monitoring frequency, inspect within 30 days. 45-59 (Grade D, Poor) — significant deterioration, implement load restrictions, inspect within 7 days. Below 45 (Grade F, Critical) — emergency assessment required, consider closure. The score updates in real-time from sensor readings processed through BridgeIQ's dual ML pipeline (Isolation Forest + LSTM Autoencoder for anomaly detection, Random Forest + XGBoost for risk prediction)."
        },
        {
            "instruction": "What is BridgeIQ?",
            "response": "BridgeIQ is an AI-powered bridge structural health monitoring system designed for Indian infrastructure. It continuously monitors bridge condition using four sensor types: water level, vibration, strain, and crack gap. The system uses a dual ML pipeline — Pipeline A (Isolation Forest + LSTM Autoencoder) for unsupervised anomaly detection, and Pipeline B (Random Forest + XGBoost) for supervised risk prediction. BridgeIQ features include real-time health scoring (0-100), alert management (NORMAL/WATCH/WARNING/CRITICAL), maintenance forecasting, India bridge network monitoring (58 bridges), federated learning across bridge nodes, digital twin simulation, PDF report export, and an AI Chat powered by fine-tuned LLaMA with RAG over IRC:6, IRC:112, and NHAI standards documents."
        },
        {
            "instruction": "Can BridgeIQ predict when a bridge will fail?",
            "response": "BridgeIQ provides probabilistic failure risk assessment rather than deterministic failure prediction — exact failure timing cannot be predicted due to the complexity of structural failure modes. What BridgeIQ does provide: real-time risk score (0-100%) from ML pipeline combining anomaly scores and sensor trends, maintenance forecast showing projected health score trajectory over 30/60/90 days, fatigue consumption rate indicating remaining fatigue life percentage, rate-of-change alerts when degradation is accelerating. These tools enable proactive intervention before failure — the goal is to keep health score above 60 through condition-based maintenance. Per structural engineering principles, bridge failures rarely occur without warning signs detectable by instrumented monitoring; BridgeIQ is designed to catch these signs early."
        },
        {
            "instruction": "What is the difference between anomaly score and risk score in BridgeIQ?",
            "response": "BridgeIQ generates two distinct scores from its dual ML pipeline: Anomaly Score (0.0-1.0) from Pipeline A — produced by Isolation Forest and LSTM Autoencoder, measures how abnormal current sensor readings are compared to historical normal patterns. Score near 0.0 = highly anomalous, near 1.0 = completely normal. Does not require labeled failure data. Best for detecting novel or gradual anomalies. Risk Score (0-100%) from Pipeline B — produced by Random Forest + XGBoost ensemble, measures probability of structural failure event based on supervised learning on historical failure data. Requires labeled training data. Best for known failure patterns with interpretable probability output. Both scores feed into the Health Score and Alert Level. A bridge can have high anomaly score (unusual readings) but low risk score (pattern not matching known failure modes) — both are displayed separately in BridgeIQ for engineer interpretation."
        },
        {
            "instruction": "How does BridgeIQ's RAG system work for answering engineering questions?",
            "response": "BridgeIQ's RAG (Retrieval-Augmented Generation) system provides answers grounded in official Indian bridge engineering documents. When you ask a technical question in the AI Chat: Query embedding — your question is converted to a vector embedding. Document retrieval — FAISS vector store searches IRC:6-2017, IRC:112-2011, NHAI Works Manual 2006, and NHAI Quality Assurance Manual for relevant passages. Context assembly — top-k relevant passages are assembled as context alongside current bridge sensor data. LLM generation — fine-tuned LLaMA model generates a response grounded in retrieved IRC/NHAI context plus live sensor readings. This ensures answers about load limits, inspection intervals, design standards, and maintenance protocols are always sourced from authoritative IRC and NHAI documents rather than general AI knowledge, making BridgeIQ suitable for professional engineering use."
        },
        {
            "instruction": "How many bridges does BridgeIQ monitor?",
            "response": "BridgeIQ monitors 58 bridges across India's national bridge network, with concentration in Assam and Northeast India. The network includes National Highway bridges, State Highway bridges, rail-road combined bridges, and urban flyovers. All 58 bridges share the same four-sensor monitoring suite (water level, vibration, strain, crack gap) with bridge-specific threshold calibration reflecting individual structural characteristics, design loads, and environmental conditions. The India Network feature provides a national overview dashboard showing health status of all monitored bridges with color-coded alert status and sortable health rankings."
        },
        {
            "instruction": "What is federated learning in BridgeIQ?",
            "response": "Federated learning in BridgeIQ allows multiple bridge monitoring nodes to collaboratively train a shared ML model without sharing raw sensor data. Each bridge acts as a client that trains locally on its own sensor data, then shares only model weight updates (not raw readings) with a central server using the FedAvg (Federated Averaging) algorithm across 15 communication rounds. This achieves AUC 0.991 on anomaly detection while preserving data privacy — important for national security infrastructure. Benefits: privacy preservation (raw sensor data never leaves the bridge node), bandwidth efficiency (only gradients transmitted, not raw sensor streams), and improved model robustness by learning from diverse bridge conditions across India's 58 monitored bridges including Brahmaputra bridges, Himalayan highway bridges, coastal bridges, and urban flyovers."
        },
        {
            "instruction": "How do I add a new bridge to BridgeIQ monitoring?",
            "response": "To add a new bridge to BridgeIQ monitoring: Database — add bridge record to the bridges table with fields: id, name, location, bridge_type, latitude, longitude, health_score (initial), alert_level (NORMAL), sensor baselines (water_level_baseline, vibration_baseline, strain_baseline, crack_gap_baseline). Sensor configuration — configure thresholds for each sensor based on bridge design parameters: WATCH at 150% of baseline, WARNING at 200%, CRITICAL at 250% or design limit whichever is lower. Sensor hardware — install four sensors at bridge site: water level gauge at pier base, accelerometer on deck, strain gauge on main girder, crack gauge at critical crack location. Data pipeline — register sensor IDs in anomaly_pipeline.py so readings are processed through ML pipeline. Frontend — bridge appears automatically in India Network map once database record is created. Testing — verify health score calculation and alert generation with simulated sensor readings before going live."
        },
        {
            "instruction": "What ML models does BridgeIQ use?",
            "response": "BridgeIQ uses a dual ML pipeline architecture: Pipeline A (Unsupervised Anomaly Detection) — Isolation Forest: ensemble of 100 isolation trees, trained on normal sensor readings, AUC 0.985, F1 0.951. Detects instantaneous statistical anomalies. LSTM Autoencoder: encoder-decoder architecture on 60-minute sensor sequences, AUC 0.992, F1 0.964. Detects temporal pattern anomalies and gradual drift. Pipeline B (Supervised Risk Prediction) — Random Forest: 100 decision trees on 50+ engineered features, AUC 0.726. XGBoost: gradient boosted trees, AUC 0.726. Ensemble average of RF + XGBoost produces final risk score. Training: SMOTE oversampling at threshold 0.30 for class balance. Federated Learning: FedAvg across 15 rounds, 58 bridge clients, global model AUC 0.991. Fine-tuned LLM: LLaMA 3.2 3B with QLoRA adapters, trained on BridgeIQ domain Q&A for AI Chat feature."
        },
        {
            "instruction": "How does BridgeIQ calculate fatigue score?",
            "response": "BridgeIQ calculates bridge fatigue score using Miner's Rule (linear damage accumulation): Each vehicle crossing causes a stress cycle in bridge members. Damage per cycle = (actual load / design load)^m where m = 3-5 for steel, 3 for concrete. Cumulative damage D = sum of (ni/Ni) where ni is number of cycles at stress level i and Ni is cycles to failure at that stress level. Fatigue score = D × 100%. Thresholds: LOW (below 20%) — normal operation. MODERATE (20-60%) — monitor closely, plan maintenance. HIGH (above 60%) — structural assessment required, consider load restrictions. Critical factors: overloaded trucks cause exponentially higher fatigue damage than legal vehicles. A 65-tonne truck (3.2× legal limit) causes approximately 33x more fatigue damage per crossing than a legal 20-tonne truck (using m=3). BridgeIQ vehicle load module tracks daily traffic composition and computes running fatigue accumulation for each monitored bridge."
        },
    ]
    return pairs


def make_original_29():
    """Return the original 29 high-quality hand-crafted examples."""
    return [
        {"instruction": "What does a vibration reading of 1.5g mean for a bridge?", "response": "A vibration reading of 1.5g exceeds the critical threshold of 1.2g defined for bridge structural monitoring. This indicates a HIGH RISK condition. The baseline vibration for healthy bridges is 0.30g. At 1.5g, the bridge is experiencing vibration 5x above baseline, likely caused by heavy vehicle crossings or structural resonance. Immediate inspection is recommended. Per IRC:6-2017, excessive dynamic loading can cause fatigue damage to structural members."},
        {"instruction": "Bridge strain is reading 195 MPa. Is this dangerous?", "response": "A strain reading of 195 MPa is in the WARNING zone. The baseline strain for healthy bridges is 145 MPa, and the critical threshold is 210 MPa. At 195 MPa, the bridge is operating at 92.9% of its critical limit with only 15 MPa of safety margin remaining. This level of strain indicates significant structural stress, likely from heavy traffic loading. Per IRC:112-2011, sustained strain near design limits accelerates concrete fatigue and rebar corrosion. Recommend immediate load restriction and engineering inspection within 24 hours."},
        {"instruction": "What is the safe water level for bridges over the Brahmaputra?", "response": "For the Brahmaputra Main Bridge (NH-27), the baseline water level is 2.0m with a critical threshold of 4.5m. Water levels between 2.0m and 3.5m are considered NORMAL. Between 3.5m and 4.0m triggers a WATCH alert. Above 4.0m triggers WARNING, and above 4.5m is CRITICAL requiring immediate bridge closure assessment. The Brahmaputra is particularly prone to monsoon flooding in Assam, which can cause scour around bridge foundations. Per IRC:6-2017 clause 213, hydraulic forces during floods must be accounted for in bridge design."},
        {"instruction": "What does a crack gap of 0.55mm indicate?", "response": "A crack gap of 0.55mm is in the WARNING zone approaching CRITICAL. The baseline crack gap for healthy bridges is 0.20mm, and the critical threshold is 0.65mm. At 0.55mm, the crack has grown to 2.75x baseline width, representing 84.6% of the critical limit. This level of crack propagation suggests active structural deterioration. Per IRC:112-2011 Section 12, crack widths exceeding 0.3mm in reinforced concrete bridges indicate potential corrosion of reinforcement. Immediate non-destructive testing and structural assessment is required."},
        {"instruction": "An overloaded truck of 65 tonnes crossed the bridge. What is the impact?", "response": "A 65-tonne truck significantly exceeds safe loading limits. Per IRC:6-2017 Section 204, the maximum single axle load is 100 kN (10.2 tonnes) and maximum tandem axle load is 200 kN (20.4 tonnes). A 65-tonne vehicle represents approximately 3.2x the permissible load. Expected impacts: peak vibration 1.75-2.50g (above 1.2g critical), strain delta of 60-90 MPa above baseline, accelerated fatigue damage to deck and girders, potential scour acceleration at foundations. Each overloaded crossing reduces bridge fatigue life. Recommend installing weigh-in-motion sensors and enforcing load restrictions under Motor Vehicles Act 1988."},
        {"instruction": "What is the health score calculation for bridges?", "response": "Bridge health score (0-100) is calculated using a composite weighted index of four sensor parameters: Water Level (20% weight) — scored based on deviation from 2.0m baseline, penalized heavily above 4.0m. Vibration (30% weight) — scored based on deviation from 0.30g baseline, critical deduction above 1.2g. Strain (30% weight) — scored based on deviation from 145 MPa baseline, critical deduction above 210 MPa. Crack Gap (20% weight) — scored based on deviation from 0.20mm baseline, critical deduction above 0.65mm. Grades: A (90-100, Excellent), B (75-89, Good), C (60-74, Fair), D (45-59, Poor), F (below 45, Critical). The score is further adjusted by ML anomaly detection scores from Isolation Forest and LSTM Autoencoder models."},
        {"instruction": "What are the IRC:6 load classes for road bridges in India?", "response": "Per IRC:6-2017, Indian road bridges are designed for the following load classes: Class AA Loading — tracked vehicles of 70 tonnes or wheeled vehicles of 40 tonnes, used for bridges on national highways and state highways. Class A Loading — a train of wheel loads totaling 554 kN, standard for most highway bridges. Class B Loading — lighter version of Class A, used for temporary bridges and timber bridges. Class 70R Loading — 70-tonne tracked or wheeled vehicle, similar to Class AA. Special Vehicle Loading — for abnormal indivisible loads. For the Brahmaputra Main Bridge on NH-27, Class AA loading applies as it is a National Highway bridge. The bridge must also account for impact factors, braking forces, centrifugal forces, and seismic loads as per IRC:6-2017 clauses 208-228."},
        {"instruction": "How does the Isolation Forest model detect bridge anomalies?", "response": "The BridgeIQ Isolation Forest model (AUC 0.985, F1 0.951) detects anomalies using unsupervised learning on four sensor streams: water level, vibration, strain, and crack gap. The algorithm works by randomly partitioning the feature space — anomalous readings require fewer splits to isolate, producing a lower anomaly score closer to 0.0. Normal readings score near 1.0. Threshold: scores above 0.6 trigger anomaly alerts. The model was trained on historical sensor data from Indian bridge monitoring datasets with SMOTE oversampling for rare failure events. Combined with the LSTM Autoencoder (AUC 0.992), which detects temporal pattern anomalies in time-series sequences, the dual-pipeline approach achieves robust anomaly detection across both instantaneous spikes and gradual degradation patterns."},
        {"instruction": "What maintenance actions should be taken when health score drops below 60?", "response": "When bridge health score drops below 60 (Grade C — Fair), the following maintenance protocol applies per NHAI bridge maintenance guidelines: Immediate actions (0-24 hours) — deploy inspection team, install temporary load restrictions (reduce to 60% of design load), increase sensor monitoring frequency. Short-term actions (1-7 days) — conduct visual inspection of all structural members, check bearing conditions, inspect expansion joints, assess scour depth at foundations, review traffic loading patterns. Medium-term actions (1-4 weeks) — commission non-destructive testing (NDT) including ultrasonic pulse velocity, rebound hammer, and half-cell potential tests, prepare detailed inspection report. If score drops below 45 (Grade F), immediate closure for emergency structural assessment is mandatory. Per IRC:SP:35, bridges should undergo major inspection every 5 years and routine inspection every year."},
        {"instruction": "What is federated learning and how is it used in BridgeIQ?", "response": "Federated learning in BridgeIQ allows multiple bridge monitoring nodes to collaboratively train a shared ML model without sharing raw sensor data. Each bridge acts as a client that trains locally on its own data, then shares only model weight updates (not raw readings) with a central server. The BridgeIQ implementation uses FedAvg (Federated Averaging) across 15 communication rounds, achieving AUC 0.991 on anomaly detection. This approach preserves data privacy (important for national security infrastructure), reduces bandwidth requirements (only gradients transmitted, not raw sensor streams), and enables learning from diverse bridge conditions across India's 58 monitored bridges. Each round, the global model improves by aggregating insights from Brahmaputra bridges, Himalayan highway bridges, coastal bridges, and urban flyovers — creating a more robust national bridge health model than any single bridge could produce."},
        {"instruction": "What causes crack gap widening in concrete bridges?", "response": "Crack gap widening in concrete bridges has several causes per IRC:112-2011 and structural engineering principles: Primary causes — corrosion of reinforcement steel (most common in Indian bridges due to humidity and chloride exposure), overloading beyond design capacity, thermal expansion and contraction cycles, carbonation of concrete reducing pH and initiating rebar corrosion, alkali-silica reaction (ASR) in older bridges. Secondary causes — foundation settlement causing differential movement, seismic activity, scour erosion weakening foundations, fatigue from repeated heavy vehicle loading. In BridgeIQ monitoring: crack gap above 0.30mm triggers WATCH, above 0.45mm triggers WARNING, above 0.65mm triggers CRITICAL. Rate of change is equally important — a crack growing 0.05mm/day is more serious than a stable 0.50mm crack. Recommend immediate epoxy injection for active cracks above 0.40mm."},
        {"instruction": "How does the LSTM Autoencoder detect temporal anomalies in bridge sensors?", "response": "The BridgeIQ LSTM Autoencoder (AUC 0.992, F1 0.964) detects temporal anomalies by learning normal time-series patterns in bridge sensor data. Architecture — encoder LSTM compresses 60-minute sensor sequences into a latent representation, decoder LSTM reconstructs the original sequence from the latent code. Training — model trained only on normal sensor readings, learns to reconstruct healthy patterns accurately. Inference — reconstruction error (MSE between input and output) is the anomaly score. Normal readings: low reconstruction error. Anomalous readings: high reconstruction error because the autoencoder has never seen these patterns. Advantages over instantaneous detection — catches gradual drift that threshold-based systems miss, detects pattern anomalies even when individual readings are within normal range, sensitive to rate-of-change anomalies. Combined with Isolation Forest, the dual-model approach achieves robust detection across both instantaneous spikes and temporal pattern anomalies."},
        {"instruction": "What are the maintenance intervals for bridges per NHAI standards?", "response": "Per NHAI Works Manual 2006 and IRC:SP:35, bridge maintenance intervals are: Routine Maintenance (Annual) — cleaning of drains and weep holes, maintenance of expansion joints, painting of steel members, repair of approach roads, vegetation removal from waterways. Periodic Maintenance (Every 3 years) — waterproofing of deck, repainting of railings and crash barriers, repair of minor cracks (below 0.3mm) by epoxy injection, bearing inspection and lubrication, checking and tightening of bolted connections. Major Maintenance (Every 5 years) — major inspection with NDT, rehabilitation of deteriorated concrete by jacketing or shotcrete, replacement of expansion joints if required, scour protection works at foundations, load testing if capacity doubts exist. Special Maintenance (Condition-based) — triggered by BridgeIQ CRITICAL alerts, post-flood inspection, post-seismic inspection, post-overload incident inspection. Emergency Maintenance — immediate response to sudden structural distress. BridgeIQ enables transition from time-based to condition-based maintenance, potentially reducing maintenance costs by 30-40%."},
    ]


def main():
    all_examples = []

    # Original 29 hand-crafted examples
    for ex in make_original_29():
        all_examples.append(ex)

    # 1. Sensor scenario Q&A for first 8 bridges (paraphrased)
    for bridge in BRIDGES[:8]:
        for scenario in SENSOR_SCENARIOS:
            pairs = make_sensor_qa(bridge, scenario)
            all_examples.extend(pairs)

    # 2. Seasonal Q&A
    all_examples.extend(make_seasonal_qa())

    # 3. Multi-sensor correlation Q&A
    all_examples.extend(make_multi_sensor_correlation_qa())

    # 4. Deep IRC/NHAI Q&A
    all_examples.extend(make_irc_nhai_deep_qa())

    # 5. Troubleshooting Q&A
    all_examples.extend(make_troubleshooting_qa())

    # 6. Bridge age Q&A
    all_examples.extend(make_bridge_age_qa())

    # 7. General system Q&A
    all_examples.extend(make_general_qa())

    # Shuffle
    random.shuffle(all_examples)

    # Write fresh (overwrite existing)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for example in all_examples:
            record = {
                "messages": [
                    {"role": "user", "content": example["instruction"]},
                    {"role": "assistant", "content": example["response"]}
                ]
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Generated {len(all_examples)} total examples")
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
