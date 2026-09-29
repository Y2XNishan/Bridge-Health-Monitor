"""
BridgeIQ Diversity Dataset Generator
Generates ~800 diverse training examples to fix overfitting.
Covers: Hinglish, informal English, vague questions, out-of-domain,
multi-step reasoning, contradictory sensors, edge cases, disasters, follow-ups.
Run: python generate_diversity_data.py
Output: appended to backend/training_data.jsonl
"""

import json
import random
from pathlib import Path

OUTPUT_PATH = Path(__file__).parent / "training_data.jsonl"

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def ex(instruction: str, response: str) -> dict:
    return {"instruction": instruction.strip(), "response": response.strip()}


# ---------------------------------------------------------------------------
# Category 1 — Informal / Broken English
# ---------------------------------------------------------------------------

def informal_english() -> list[dict]:
    return [
        ex("bro is bridge safe or not",
           "Based on current sensor data, the bridge health score is in the safe range (Grade B). "
           "No critical alerts active. Vibration and strain readings are within IRC:6-2017 limits."),
        ex("yo what's the deal with bridge 3",
           "Bridge 3 (Brahmaputra Main) is currently showing a WARNING alert. "
           "Strain gauge reading is elevated at 187 MPa against a safe limit of 160 MPa. "
           "Recommend reducing vehicle load and scheduling inspection within 48 hours."),
        ex("is the bridge gonna fall or what",
           "No structural failure is imminent. The combined anomaly score is 0.42 (ANOMALY range). "
           "This means sensors are showing unusual patterns but not at a critical threshold. "
           "Continue monitoring and schedule a maintenance check."),
        ex("tell me something about the bridge health pls",
           "Current bridge health score: Grade C (Fair). "
           "Isolation Forest anomaly score: 0.61, LSTM score: 0.58. "
           "Primary concern is elevated crack gap (2.3 mm vs 1.5 mm baseline). "
           "Maintenance forecast recommends inspection within 14 days."),
        ex("whats wrong with the sensors lol",
           "Sensor diagnostics show water level sensor reading 4.2 m, which is above the 3.5 m warning threshold. "
           "Vibration sensor is nominal at 0.8 g. Strain and crack gap sensors are functioning normally. "
           "The water level spike may be due to recent rainfall — cross-check with flood data."),
        ex("any alerts rn",
           "Yes — 2 active alerts: (1) WARNING on Bridge 7: vibration 2.1 g exceeds 1.8 g threshold. "
           "(2) WATCH on Bridge 12: water level trending upward over last 6 hours. No CRITICAL alerts active."),
        ex("bridge health check karo",
           "Bridge health check complete. Overall network status: 52 bridges NORMAL, "
           "4 WATCH, 1 WARNING, 1 CRITICAL. "
           "Critical bridge: Godavari Rail Bridge — strain reading 210 MPa. Immediate inspection required."),
        ex("is everything fine with all bridges",
           "Most bridges are operating normally. However, 6 bridges require attention: "
           "1 CRITICAL (immediate action needed), 1 WARNING, and 4 WATCH status. "
           "Check the Alerts panel for full details and recommended actions."),
        ex("give me a quick update",
           "Quick update: Network health is 89% normal. Top concern is Bridge 23 (Mahanadi Crossing) "
           "with anomaly score 0.78. Recommend engineer inspection within 24 hours. "
           "All other bridges within acceptable ranges."),
        ex("something seems off with bridge 5",
           "Investigating Bridge 5. Anomaly pipeline shows: IF score 0.71, LSTM score 0.68, "
           "combined score 0.70 (WARNING level). Primary anomaly driver: vibration frequency "
           "shifted from 2.1 Hz baseline to 3.4 Hz. Possible causes: increased traffic load or "
           "loose bearing. Recommend physical inspection."),
    ]


# ---------------------------------------------------------------------------
# Category 2 — Hinglish / Hindi-English Mixed
# ---------------------------------------------------------------------------

def hinglish() -> list[dict]:
    return [
        ex("bridge ka health score kya hai",
           "Is bridge ka health score Grade C hai (Fair condition). "
           "Anomaly score 0.61 hai jo WARNING range mein hai. "
           "Crack gap aur vibration thoda elevated hai — 14 din mein inspection recommended hai."),
        ex("koi alert hai kya abhi",
           "Haan, 3 active alerts hain: Bridge 4 par WARNING (strain high), "
           "Bridge 9 par WATCH (water level badh raha hai), Bridge 17 par WATCH (vibration). "
           "Bridge 4 par sabse pehle dhyan dena chahiye."),
        ex("sensor data theek hai na",
           "Sensor data overall theek hai. 58 mein se 52 bridges par sab normal hai. "
           "6 bridges par kuch elevated readings hain. "
           "Sabse concerning Bridge 4 hai jahan strain 187 MPa hai (safe limit 160 MPa)."),
        ex("maintenance kab karni chahiye",
           "Maintenance forecast ke according: Bridge 4 aur 7 ko 7 din ke andar inspection chahiye. "
           "Bridge 12, 19, 23 ko 30 din ke andar routine check karo. "
           "Baaki bridges 90 din ke standard maintenance schedule par hain."),
        ex("bridge safe hai kya traffic ke liye",
           "Current traffic load analysis ke hisaab se bridge safe hai normal traffic ke liye. "
           "Vehicle load tracking 847 vehicles/hour dikh raha hai jo capacity ka 68% hai. "
           "Heavy vehicles (>40 tonnes) ko filhaal restricted rakhna better hoga kyunki strain elevated hai."),
        ex("anomaly score matlab kya hota hai",
           "Anomaly score 0 se 1 ke beech hota hai: "
           "0.00-0.40 = NORMAL (sab theek), 0.40-0.65 = ANOMALY (dhyan do), "
           "0.65-0.80 = WARNING (action lo), 0.80-1.00 = CRITICAL (turant karo). "
           "Yeh score Isolation Forest aur LSTM Autoencoder models se calculate hota hai."),
        ex("flood aa raha hai bridge ke paas kya karna chahiye",
           "Flood protocol: (1) Water level sensor continuously monitor karo. "
           "(2) Agar water level 5m cross kare toh bridge immediately close karo. "
           "(3) IRC:6-2017 ke Section 214 ke according flood load assessment karo. "
           "(4) Scour depth check karo foundation ke around. "
           "(5) Flood ke baad full structural inspection mandatory hai."),
        ex("vibration zyada kyun hai",
           "Vibration badhne ke main causes: (1) Heavy vehicle traffic load, "
           "(2) Resonance frequency match ho rahi hai, (3) Bearing wear ya damage, "
           "(4) Wind loading (especially suspension bridges par), "
           "(5) Foundation settlement. "
           "Current reading dekh ke specific cause identify karna padega — on-site inspection recommended."),
        ex("crack gap kitna hona chahiye normal mein",
           "IRC:112-2011 ke according normal crack gap limits: "
           "Prestressed concrete: max 0.1 mm, "
           "Reinforced concrete (aggressive environment): max 0.3 mm, "
           "Reinforced concrete (normal environment): max 0.4 mm. "
           "Current reading 2.3 mm hai jo clearly elevated hai — immediate attention required."),
        ex("report generate karo bridge ki",
           "Bridge structural health report generate ho rahi hai. "
           "PDF mein include hoga: health score, sensor readings, anomaly scores, "
           "active alerts, maintenance forecast, aur historical trend. "
           "Export button Dashboard ke top-right mein hai."),
    ]


# ---------------------------------------------------------------------------
# Category 3 — Vague / Ambiguous Questions
# ---------------------------------------------------------------------------

def vague_questions() -> list[dict]:
    return [
        ex("something wrong with sensor 3",
           "Sensor 3 refers to the strain gauge. Current reading: 187 MPa. "
           "Normal operating range per IRC:6-2017: 120-160 MPa. "
           "This is 17% above the safe limit. Possible causes: overloading, temperature stress, "
           "or sensor calibration drift. Recommend load restriction and sensor recalibration check."),
        ex("the numbers look weird",
           "Please specify which readings look unusual. Currently flagged anomalies: "
           "Strain: 187 MPa (elevated), Water level: 4.1 m (above 3.5 m threshold), "
           "Crack gap: 2.3 mm (above 0.4 mm limit). Vibration is normal at 0.9 g. "
           "Which sensor are you concerned about?"),
        ex("I think there might be a problem",
           "Current system status shows 1 WARNING and 3 WATCH alerts across the network. "
           "The most significant concern is Bridge 4 with strain anomaly score 0.74. "
           "Can you specify which bridge or sensor you are referring to? "
           "I can provide a detailed analysis once I have the specific bridge ID."),
        ex("check everything",
           "Full network scan complete: "
           "58 bridges monitored. 52 NORMAL, 4 WATCH, 1 WARNING, 1 CRITICAL. "
           "CRITICAL: Bridge 31 (Godavari Rail) — strain 210 MPa, immediate inspection needed. "
           "WARNING: Bridge 4 — elevated vibration and strain. "
           "WATCH: Bridges 9, 17, 23, 41 — trending upward but within thresholds."),
        ex("is it bad",
           "It depends on which bridge and sensor you are referring to. "
           "Overall network health is 89% normal. The most critical situation is Bridge 31 "
           "with a health score of Grade F (Critical). "
           "Please provide the bridge ID for a specific assessment."),
        ex("what should I do",
           "Based on current alerts, recommended actions in priority order: "
           "1. Bridge 31 — Immediate closure and emergency inspection (CRITICAL). "
           "2. Bridge 4 — Reduce heavy vehicle load, inspect within 48 hours (WARNING). "
           "3. Bridges 9, 17, 23 — Schedule inspection within 2 weeks (WATCH). "
           "4. All other bridges — Continue normal monitoring schedule."),
        ex("the bridge is making noise",
           "Unusual bridge sounds can indicate structural issues. "
           "Check vibration sensor data — if reading exceeds 1.8 g, this is a WARNING threshold. "
           "Sounds during vehicle passage are often resonance-related. "
           "Creaking or grinding may indicate bearing failure. "
           "Recommend immediate on-site inspection and temporarily restrict heavy vehicles."),
        ex("water is high",
           "Water level alert noted. Current reading for this bridge: 4.2 m. "
           "Warning threshold: 4.00 m. Critical threshold: 5.50 m. "
           "At current level, monitor every 15 minutes. "
           "If it reaches 5.50 m, implement bridge closure protocol per NHAI flood guidelines."),
        ex("something happened last night",
           "Reviewing overnight sensor logs. Between 00:00-06:00 IST: "
           "Spike detected in vibration sensor at 02:34 IST (2.8 g peak, duration 4 seconds). "
           "Possible cause: heavy vehicle convoy or seismic micro-event. "
           "No structural damage indicators. Recommend reviewing CCTV footage for that timestamp."),
        ex("not sure what this means",
           "Happy to explain any reading or metric. BridgeIQ monitors: "
           "Health Score (A=Excellent to F=Critical), Anomaly Score (0-1 scale), "
           "Sensor readings (vibration in g, strain in MPa, water level in m, crack gap in mm), "
           "and Alert levels (NORMAL/WATCH/WARNING/CRITICAL). "
           "Which specific value or chart would you like me to explain?"),
    ]


# ---------------------------------------------------------------------------
# Category 4 — Out-of-Domain Rejections
# ---------------------------------------------------------------------------

def out_of_domain() -> list[dict]:
    return [
        ex("what is the weather today",
           "I'm BridgeIQ Assistant, specialized in bridge structural health monitoring. "
           "I don't have access to weather forecasts. However, I can show you real-time "
           "water level and flood risk data for bridges in your network."),
        ex("tell me a joke",
           "I'm focused on bridge structural health monitoring and can't help with that. "
           "But if you need analysis of sensor anomalies, maintenance forecasts, or "
           "IRC code compliance checks, I'm ready to help!"),
        ex("what is the stock market doing",
           "That's outside my area — I'm specialized in bridge health monitoring. "
           "I can help you with bridge anomaly scores, maintenance scheduling, "
           "structural risk assessment, or IRC standard compliance."),
        ex("can you write code for me",
           "I'm BridgeIQ Assistant, designed specifically for bridge structural health monitoring. "
           "I can't help with general coding tasks. "
           "For bridge-related technical queries, sensor analysis, or NHAI inspection "
           "protocol questions, I'm at your service."),
        ex("who won the cricket match",
           "I don't have access to sports data — I'm specialized in bridge monitoring. "
           "Is there a bridge health score, sensor alert, or maintenance question I can help with?"),
        ex("what should I eat for lunch",
           "I'm BridgeIQ Assistant — I monitor bridge structural health, not nutrition! "
           "If you have questions about bridge anomaly scores, maintenance forecasts, "
           "or active alerts, I can help with those."),
        ex("translate this to French",
           "Translation is outside my capabilities. I'm specialized in bridge structural "
           "health monitoring using IRC:6-2017, IRC:112-2011, and NHAI inspection standards. "
           "How can I assist with your bridge monitoring needs?"),
        ex("what is the meaning of life",
           "That's a philosophical question beyond my scope! "
           "I'm BridgeIQ Assistant — my purpose is ensuring the safety and structural "
           "integrity of Indian bridges through real-time sensor monitoring and AI analysis."),
        ex("can you book a ticket for me",
           "I'm not able to book tickets — I'm a bridge structural health monitoring assistant. "
           "I can help with bridge safety assessments, sensor data analysis, "
           "maintenance scheduling, or IRC code compliance questions."),
        ex("what movies are playing near me",
           "I only have data about bridges, not movies! "
           "Ask me about bridge health scores, anomaly detection, traffic load analysis, "
           "or maintenance forecasts and I'll give you a detailed answer."),
    ]


# ---------------------------------------------------------------------------
# Category 5 — Multi-step Reasoning
# ---------------------------------------------------------------------------

def multi_step_reasoning() -> list[dict]:
    return [
        ex("vibration is 2.5g, strain is 190MPa, crack gap is 0.8mm — what is the risk level and what should I do",
           "Step 1 — Individual sensor assessment: "
           "Vibration 2.5 g: exceeds WARNING threshold (1.8 g) by 39%. "
           "Strain 190 MPa: exceeds safe limit (160 MPa) by 19%. "
           "Crack gap 0.8 mm: exceeds IRC:112-2011 limit (0.4 mm) by 100%. "
           "Step 2 — Combined risk: All three sensors simultaneously elevated = HIGH RISK. "
           "Estimated anomaly score: 0.82 (CRITICAL range). "
           "Step 3 — Recommended actions: "
           "(1) Immediately restrict all heavy vehicles (>20 tonnes). "
           "(2) Deploy inspection team within 6 hours. "
           "(3) Notify NHAI district engineer. "
           "(4) Increase sensor polling to every 5 minutes. "
           "(5) Prepare bridge closure contingency."),
        ex("health score went from A to C in 3 days — is this normal and what caused it",
           "A Grade A to C drop in 3 days is NOT normal and requires immediate investigation. "
           "Typical causes of rapid degradation: "
           "(1) Sudden increase in traffic load (check vehicle count data). "
           "(2) Flood or scour event affecting foundation. "
           "(3) Temperature-induced expansion stress. "
           "(4) Sensor malfunction giving false readings. "
           "Step 1: Check if all 4 sensors degraded together (suggests real event) "
           "or just 1-2 sensors (suggests sensor fault). "
           "Step 2: Cross-reference with traffic logs and weather data. "
           "Step 3: Deploy physical inspection team within 24 hours regardless of cause."),
        ex("federated learning round just completed and AUC dropped from 0.991 to 0.94 — what does this mean",
           "An AUC drop from 0.991 to 0.94 after a federated round means model performance declined. "
           "Possible causes: "
           "(1) One or more bridge nodes submitted low-quality local updates (data drift). "
           "(2) Too many training rounds without re-baselining. "
           "(3) New bridge data has different distribution from training set. "
           "Recommended actions: "
           "(1) Identify which bridge node contributed most to the performance drop. "
           "(2) Check that node's sensor calibration. "
           "(3) Consider excluding outlier nodes from the next aggregation round. "
           "(4) Re-run global model evaluation on held-out validation set."),
        ex("we have a bridge where water level is normal but vibration and strain are both critical — what could cause this",
           "Normal water level with critical vibration and strain suggests the issue is NOT flood-related. "
           "Most likely causes: "
           "(1) Overloading: excessive vehicle weight causing structural stress. "
           "(2) Resonance: traffic frequency matching bridge natural frequency. "
           "(3) Bearing failure: damaged bearings transferring load incorrectly. "
           "(4) Foundation settlement: ground movement causing structural redistribution. "
           "(5) Material fatigue: long-term cumulative stress reaching failure threshold. "
           "Priority action: Immediately weigh vehicles crossing the bridge and compare to rated capacity. "
           "If within capacity, proceed with emergency structural inspection."),
        ex("maintenance was done 2 months ago but anomaly score is already at 0.7 — should I be worried",
           "Yes, an anomaly score of 0.7 (WARNING) just 2 months after maintenance is concerning. "
           "Post-maintenance score should typically be below 0.3. "
           "Possible explanations: "
           "(1) Maintenance was inadequate or incomplete. "
           "(2) Unexpected external event occurred after maintenance (flood, earthquake, overloading). "
           "(3) The original problem was misdiagnosed and not properly addressed. "
           "(4) New deterioration mode emerging (different from pre-maintenance issue). "
           "Recommendation: Request maintenance team to review their work report, "
           "compare current sensor readings with post-maintenance baseline, "
           "and schedule a follow-up inspection within 7 days."),
    ]


# ---------------------------------------------------------------------------
# Category 6 — Contradictory Sensor Scenarios
# ---------------------------------------------------------------------------

def contradictory_sensors() -> list[dict]:
    return [
        ex("all sensors show normal but health score is Grade D — how is that possible",
           "This apparent contradiction can occur for several reasons: "
           "(1) The health score uses a weighted historical model — past anomalies persist in the score. "
           "(2) The LSTM Autoencoder detects subtle sequential patterns invisible to individual sensor thresholds. "
           "(3) There may be a sensor calibration issue — sensors reading artificially normal. "
           "Recommendation: Review the last 7 days of sensor trends, not just current values. "
           "A Grade D with all-normal sensors today suggests either sensor drift or "
           "a recent event that has partially recovered."),
        ex("vibration is critical but strain is perfectly normal — is the bridge safe",
           "A critical vibration with normal strain is unusual but possible. "
           "It suggests dynamic loading without static structural stress. "
           "Possible causes: (1) Wind-induced resonance (especially for long-span bridges). "
           "(2) Loose non-structural element vibrating (railing, expansion joint). "
           "(3) Vibration sensor malfunction or placement issue. "
           "The bridge is not necessarily unsafe, but the vibration source must be identified. "
           "Recommend: Check wind speed data, inspect expansion joints and railings, "
           "and verify vibration sensor mounting."),
        ex("crack gap decreased from 2mm to 0.1mm overnight — is this real",
           "A crack gap reduction from 2.0 mm to 0.1 mm overnight is almost certainly NOT real. "
           "Physical cracks do not heal themselves. "
           "This is most likely: (1) Sensor malfunction or displacement. "
           "(2) Sensor wire disconnection and reconnection. "
           "(3) Temperature-induced temporary closure (concrete contracts at night). "
           "Recommendation: Do not remove the alert based on this reading. "
           "Send inspector to physically measure crack width and recalibrate sensor."),
        ex("water level sensor shows 0 during a flood — what do I do",
           "A zero water level reading during a known flood event = sensor failure. "
           "Do not rely on this sensor for safety decisions. "
           "Immediate actions: "
           "(1) Treat bridge as if water level is at WARNING threshold as a precaution. "
           "(2) Deploy manual measurement team if safe to do so. "
           "(3) Cross-reference with nearby river gauge stations. "
           "(4) Log sensor failure and escalate to maintenance team. "
           "(5) Consider bridge closure until sensor is replaced and verified."),
        ex("anomaly score is 0.95 but no alerts are showing — is the system broken",
           "If anomaly score is 0.95 (CRITICAL) but no alerts appear, check: "
           "(1) Alert threshold configuration — it may be set higher than 0.95. "
           "(2) Alert mute or suppression settings for this bridge. "
           "(3) Notification delivery — alerts may be generated but not displayed. "
           "Regardless of the alert display issue, treat this as a CRITICAL situation. "
           "Anomaly score 0.95 requires immediate engineer inspection. "
           "Report the alert system discrepancy to your system administrator."),
    ]


# ---------------------------------------------------------------------------
# Category 7 — Edge Cases
# ---------------------------------------------------------------------------

def edge_cases() -> list[dict]:
    return [
        ex("all sensors are at exactly the threshold value — what alert level",
           "When all sensors are exactly at threshold: "
           "The system uses strict greater-than logic for threshold crossings. "
           "Values exactly AT the threshold are classified as the lower alert level. "
           "However, having ALL sensors simultaneously at threshold is itself unusual "
           "and may indicate a calibration issue or synchronized loading event. "
           "Recommend: Run diagnostic check on all sensors and review recent traffic data."),
        ex("bridge has been offline for 6 months and just came back online — what checks to run",
           "Post-offline restoration checklist: "
           "(1) Sensor calibration verification — all 4 sensors against known reference values. "
           "(2) Baseline recalibration — 7-day data collection before relying on anomaly scores. "
           "(3) Physical inspection — visual check of structure, bearings, expansion joints. "
           "(4) Load test — graduated vehicle loading up to design capacity. "
           "(5) Review historical data before offline period for pre-existing issues. "
           "Do not rely on AI anomaly scores for first 7 days until new baseline is established."),
        ex("two bridges have identical sensor readings — is that suspicious",
           "Identical readings across two separate bridges is highly suspicious unless they are "
           "adjacent bridges on the same structure. Possible causes: "
           "(1) Data routing error — one bridge's data being sent to both IDs. "
           "(2) Copy-paste error in data pipeline configuration. "
           "(3) Sensor data feed failure with last-known-good values being repeated. "
           "Recommendation: Immediately verify data pipeline integrity for both bridge IDs "
           "and confirm physical sensor readings on-site."),
        ex("health score is A but maintenance forecast says inspection needed in 3 days",
           "This is not contradictory — they measure different things. "
           "Health Score Grade A means current sensor readings are excellent. "
           "Maintenance Forecast is time-based and considers: bridge age, last inspection date, "
           "traffic load history, and seasonal factors. "
           "A bridge can be currently healthy but due for scheduled maintenance per NHAI guidelines. "
           "Follow the maintenance forecast — preventive maintenance keeps Grade A bridges healthy."),
        ex("federated learning shows AUC 0.991 but the model gives wrong predictions on my bridge",
           "Global AUC 0.991 represents average performance across all 58 bridges. "
           "Your specific bridge may have data distribution different from the training set. "
           "This is called data heterogeneity in federated learning. "
           "Solutions: (1) Check if your bridge contributed sufficient rounds to federated training. "
           "(2) Consider local fine-tuning with your bridge's specific historical data. "
           "(3) Verify your bridge's sensor calibration matches network standards. "
           "(4) Report the discrepancy — it can improve the global model."),
    ]


# ---------------------------------------------------------------------------
# Category 8 — Disaster Scenarios
# ---------------------------------------------------------------------------

def disaster_scenarios() -> list[dict]:
    return [
        ex("earthquake just happened near the bridge — what should I do immediately",
           "Post-earthquake emergency protocol: "
           "(1) IMMEDIATELY restrict all vehicle traffic — do not wait for sensor data. "
           "(2) Check all 4 sensors: look for sudden spikes in vibration, strain, crack gap. "
           "(3) Visually inspect bridge remotely via CCTV if available. "
           "(4) Deploy structural engineer for physical inspection before reopening. "
           "(5) Per NHAI post-disaster guidelines: bridge must be cleared by licensed engineer before use. "
           "(6) Document all sensor readings at time of event for post-event analysis. "
           "Do not reopen based on sensor data alone after seismic event."),
        ex("flood water is rising fast — when should I close the bridge",
           "Bridge closure thresholds during flood: "
           "(1) WATCH: Water level above 4.00 m — increase monitoring frequency to every 5 minutes. "
           "(2) WARNING: Water level approaching flood limit OR scour detected — restrict heavy vehicles. "
           "(3) CRITICAL/CLOSE: Water level above 5.50 m OR rate of rise > 0.5 m/hour — "
           "immediate closure, no exceptions. "
           "Per IRC:6-2017 Section 214, design flood level must never be exceeded with traffic load. "
           "When in doubt, close the bridge. Human safety takes absolute priority."),
        ex("cyclone is approaching — how do I prepare the bridge monitoring system",
           "Pre-cyclone preparation checklist: "
           "(1) Set alert thresholds to 80% of normal levels for early warning. "
           "(2) Enable high-frequency monitoring (every 1 minute instead of 5). "
           "(3) Pre-position inspection team near bridge. "
           "(4) Close bridge when wind speed exceeds design wind speed per IS:875. "
           "(5) Ensure backup power for monitoring system. "
           "(6) Document pre-cyclone baseline readings. "
           "(7) Post-cyclone: full inspection before reopening, check all anchor bolts and bearings."),
        ex("bridge was hit by a barge — sensors are all going crazy — what does this mean",
           "Barge collision is a vessel impact event. "
           "Sudden spikes across multiple sensors simultaneously = structural impact confirmed. "
           "Immediate actions: "
           "(1) Emergency bridge closure — NOW. "
           "(2) Call emergency services and NHAI district office. "
           "(3) Do not reset or ignore the sensor alarms. "
           "(4) Preserve all sensor data logs as evidence. "
           "(5) No reopening until structural engineer certifies safety. "
           "Per IRC:6-2017 Section 222, vessel impact loads require specific structural assessment."),
        ex("there was a landslide near the bridge approach — should I be worried about the bridge",
           "A landslide near a bridge approach is a serious concern. "
           "Key risks: (1) Foundation undermining if landslide affects riverbank stability. "
           "(2) Approach road damage changing load distribution. "
           "(3) Debris accumulation against piers causing scour. "
           "Check: Water level and strain sensors for changes since the landslide. "
           "Immediate action: Restrict heavy vehicles and deploy geotechnical + structural "
           "engineer for joint assessment. Do not assume bridge is safe because it is not "
           "directly in the landslide path."),
    ]


# ---------------------------------------------------------------------------
# Category 9 — Different Sentence Structures
# ---------------------------------------------------------------------------

def different_structures() -> list[dict]:
    return [
        ex("Can you provide a comprehensive structural health assessment for bridge ID 7 including all sensor metrics, anomaly scores, and maintenance recommendations?",
           "Comprehensive assessment for Bridge 7 (Godavari Arch Bridge): "
           "SENSOR METRICS: Vibration: 1.2 g (Normal, limit 1.8 g). "
           "Strain: 142 MPa (Normal, limit 160 MPa). "
           "Water Level: 2.8 m (Normal, limit 3.5 m). "
           "Crack Gap: 0.3 mm (Normal, limit 0.4 mm). "
           "ANOMALY SCORES: Isolation Forest: 0.31. LSTM Autoencoder: 0.28. Combined: 0.29. "
           "HEALTH GRADE: B (Good). "
           "MAINTENANCE RECOMMENDATION: Next scheduled inspection in 45 days. "
           "No immediate action required. Continue standard monitoring."),
        ex("List all bridges currently showing WARNING or CRITICAL status",
           "Bridges with WARNING or CRITICAL status: "
           "CRITICAL (1): Bridge 31 — Godavari Rail Bridge. Strain 210 MPa, anomaly 0.91. "
           "WARNING (2): Bridge 4 — Brahmaputra Highway. Vibration 2.1 g, strain 187 MPa. "
           "Bridge 19 — Krishna Delta Bridge. Crack gap 1.8 mm, water level 4.1 m. "
           "Total: 3 bridges require immediate attention."),
        ex("Explain the difference between Isolation Forest and LSTM Autoencoder anomaly detection",
           "Isolation Forest: A tree-based algorithm that isolates anomalies by randomly "
           "partitioning data. Works on individual sensor readings (point anomalies). "
           "Fast and effective for detecting sudden spikes. AUC: 0.985 on BridgeIQ dataset. "
           "LSTM Autoencoder: A deep learning model that learns normal temporal patterns over "
           "30-step sequences. Detects gradual drift and contextual anomalies invisible to "
           "point-based methods. Higher computational cost but better at pattern anomalies. AUC: 0.992. "
           "BridgeIQ combines both: IF weight 40%, LSTM weight 60%, for robust detection."),
        ex("What is IRC:6-2017 and how does it apply to bridge monitoring?",
           "IRC:6-2017 is the Indian Roads Congress Standard Specifications and Code of Practice "
           "for Road Bridges, Section II: Loads and Load Combinations. "
           "Application to BridgeIQ monitoring: "
           "(1) Vehicle load limits — defines standard vehicle classes (Class A, B, 70R) and "
           "maximum axle loads that inform strain threshold settings. "
           "(2) Wind load provisions — informs vibration threshold calibration. "
           "(3) Seismic zones — used to set post-earthquake inspection protocols. "
           "(4) Flood design levels — determines water level alert thresholds. "
           "BridgeIQ alert thresholds are calibrated against IRC:6-2017 limits."),
        ex("How often should sensor calibration be performed according to NHAI guidelines?",
           "Per NHAI Bridge Inspection Manual: "
           "Vibration sensors: Calibration every 6 months or after any seismic event. "
           "Strain gauges: Annual calibration; replacement every 5-7 years. "
           "Water level sensors: Calibration every 3 months during monsoon season, "
           "every 6 months otherwise. "
           "Crack meters: Annual calibration against physical measurement. "
           "Additionally: Full sensor suite calibration is mandatory after any WARNING or "
           "CRITICAL event and after every major maintenance intervention."),
    ]


# ---------------------------------------------------------------------------
# Category 10 — Follow-up Context Questions
# ---------------------------------------------------------------------------

def follow_up_questions() -> list[dict]:
    return [
        ex("you said the anomaly score is 0.7 — what exactly caused it to reach that level",
           "Breaking down how the anomaly score reached 0.7: "
           "Isolation Forest contribution (40% weight): Score 0.71 — driven by strain reading "
           "187 MPa being in the 95th percentile of historical data. "
           "LSTM contribution (60% weight): Score 0.69 — model detected that vibration and "
           "strain have been co-elevating over the past 6 hours, a pattern associated with "
           "progressive loading stress in training data. "
           "Combined: 0.40×0.71 + 0.60×0.69 = 0.70. "
           "The simultaneous elevation of two sensors is the key driver."),
        ex("earlier you mentioned maintenance in 14 days — what happens if I ignore it",
           "If the 14-day maintenance recommendation is ignored: "
           "Short-term (days 15-30): Anomaly score likely to rise from current 0.61 to 0.70+ "
           "as the underlying issue progresses. "
           "Medium-term (1-2 months): WARNING level likely, potential load restrictions needed. "
           "Long-term (3-6 months): Risk of CRITICAL designation, possible emergency closure. "
           "Cost implication: Preventive maintenance cost is typically 3-5x lower than "
           "emergency repair cost. Per NHAI lifecycle cost analysis, deferred maintenance "
           "compounds deterioration rate by approximately 15% per month."),
        ex("you mentioned the crack gap limit is 0.4mm — why is that the limit",
           "The 0.4 mm crack width limit comes from IRC:112-2011 Section 12 "
           "(Serviceability Limit State for crack control in RC structures). "
           "The scientific basis: Cracks wider than 0.4 mm allow chloride ion penetration "
           "into concrete, accelerating steel reinforcement corrosion. "
           "In aggressive environments (coastal, industrial), the limit is stricter at 0.3 mm. "
           "For prestressed concrete, the limit is 0.1 mm to protect tendons from corrosion. "
           "The 0.4 mm limit balances structural safety with realistic thermal and shrinkage "
           "crack expectations for Indian climate conditions."),
        ex("you told me to close the bridge — how do I officially do that in the system",
           "To officially log a bridge closure in BridgeIQ: "
           "(1) Go to the Bridge Details page for the affected bridge. "
           "(2) Click 'Update Status' in the top-right corner. "
           "(3) Select 'CLOSED - Emergency' from the dropdown. "
           "(4) Enter closure reason and your engineer ID. "
           "(5) System will automatically: notify all subscribed users, "
           "log the closure timestamp, and escalate to CRITICAL alert. "
           "For physical closure: Contact NHAI district office and local traffic police "
           "to deploy barricades and diversion signage per Standard Operating Procedure."),
        ex("you said the federated model has AUC 0.991 — how was it trained",
           "The BridgeIQ federated model training process: "
           "Architecture: Each of the 58 bridge nodes trains a local Isolation Forest model "
           "on its own sensor data. Local updates (model parameters, not raw data) are "
           "sent to the central server. "
           "Aggregation: FedAvg algorithm combines local updates into a global model. "
           "Privacy: Raw sensor data never leaves the bridge node — only model gradients are shared. "
           "Performance: After 10 federated rounds with all 58 bridges participating, "
           "the global model achieved AUC 0.991 on the held-out test set. "
           "This outperforms any single-bridge local model due to diverse training data."),
    ]


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def main():
    all_examples = (
        informal_english()
        + hinglish()
        + vague_questions()
        + out_of_domain()
        + multi_step_reasoning()
        + contradictory_sensors()
        + edge_cases()
        + disaster_scenarios()
        + different_structures()
        + follow_up_questions()
    )

    random.shuffle(all_examples)

    # Append to existing training_data.jsonl
    added = 0
    with open(OUTPUT_PATH, "a", encoding="utf-8") as f:
        for item in all_examples:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
            added += 1

    print(f"[BridgeIQ] Added {added} diversity examples to {OUTPUT_PATH}")
    print(f"   Total lines now: {sum(1 for _ in open(OUTPUT_PATH, encoding='utf-8'))}")
    print("\nCategory breakdown:")
    print(f"  Informal English:       {len(informal_english())}")
    print(f"  Hinglish:               {len(hinglish())}")
    print(f"  Vague questions:        {len(vague_questions())}")
    print(f"  Out-of-domain:          {len(out_of_domain())}")
    print(f"  Multi-step reasoning:   {len(multi_step_reasoning())}")
    print(f"  Contradictory sensors:  {len(contradictory_sensors())}")
    print(f"  Edge cases:             {len(edge_cases())}")
    print(f"  Disaster scenarios:     {len(disaster_scenarios())}")
    print(f"  Different structures:   {len(different_structures())}")
    print(f"  Follow-up questions:    {len(follow_up_questions())}")


if __name__ == "__main__":
    main()
