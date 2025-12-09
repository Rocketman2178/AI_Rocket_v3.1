#!/usr/bin/env python3
"""
Fixed workflow architecture - addresses connection issues
"""

import json

# Read your current workflow
with open('Astra - Multi-Team Data Sync Agent (Bolt2) (1).json', 'r') as f:
    workflow = json.load(f)

print("=== FIXING WORKFLOW CONNECTIONS ===\n")

connections = workflow['connections']

# ============================================
# FIX 1: Aggregate All Chunks
# ============================================
# This node should have NO output - it accumulates data inside Loop Over Batches
# The accumulated data is accessed via $('Aggregate All Chunks').all() in Combine All Chunks
connections['Aggregate All Chunks'] = {
    "main": [[]]  # Empty output - just accumulates
}
print("✅ Fixed: Aggregate All Chunks (no output connection)")

# ============================================
# FIX 2: Collect Storage Results
# ============================================
# Should collect from BOTH vector storage nodes, then feed back to loop
connections['Collect Storage Results'] = {
    "main": [
        [
            {
                "node": "Batch Completion Signal",
                "type": "main",
                "index": 0
            }
        ]
    ]
}
print("✅ Fixed: Collect Storage Results → Batch Completion Signal")

# ============================================
# FIX 3: Batch Completion Signal
# ============================================
# After collecting storage results, feed back to Loop Over Chunk Batches
connections['Batch Completion Signal'] = {
    "main": [
        [
            {
                "node": "Loop Over Chunk Batches",
                "type": "main",
                "index": 0
            }
        ]
    ]
}
print("✅ Fixed: Batch Completion Signal → Loop Over Chunk Batches (feedback)")

# ============================================
# FIX 4: Batch Completion Metrics
# ============================================
# This node should be triggered by Loop Over Chunk Batches Done Branch
# But looking at your workflow, it's currently triggered incorrectly
# It should be called by "Release Documents for Storage" after all chunks complete

# Let's check what currently triggers it
batch_metrics_inputs = []
for node_name, node_connections in connections.items():
    for branch in node_connections.get('main', []):
        for connection in branch:
            if isinstance(connection, dict) and connection.get('node') == 'Batch Completion Metrics':
                batch_metrics_inputs.append(node_name)

print(f"\n📋 Current inputs to 'Batch Completion Metrics': {batch_metrics_inputs}")

# Remove it from wherever it's connected now
for node_name in batch_metrics_inputs:
    if node_name in connections:
        new_branches = []
        for branch in connections[node_name].get('main', []):
            new_branch = [conn for conn in branch if conn.get('node') != 'Batch Completion Metrics']
            new_branches.append(new_branch)
        connections[node_name]['main'] = new_branches

print("✅ Removed incorrect inputs to Batch Completion Metrics")

# ============================================
# FIX 5: Loop Over Chunk Batches Done Branch
# ============================================
# Should trigger Release Documents, which then goes to Batch Completion Metrics
connections['Release Documents for Storage'] = {
    "main": [
        [
            {
                "node": "Batch Completion Metrics",
                "type": "main",
                "index": 0
            }
        ]
    ]
}
print("✅ Fixed: Release Documents → Batch Completion Metrics")

# Then Batch Completion Metrics feeds to document storage
connections['Batch Completion Metrics'] = {
    "main": [
        [
            {
                "node": "Prepare Documents for Storage",
                "type": "main",
                "index": 0
            }
        ]
    ]
}
print("✅ Fixed: Batch Completion Metrics → Prepare Documents for Storage")

# ============================================
# FIX 6: Vector Storage Nodes
# ============================================
# Both should feed to Collect Storage Results
connections['Store Vector Chunks - Meetings'] = {
    "main": [
        [
            {
                "node": "Collect Storage Results",
                "type": "main",
                "index": 0
            }
        ]
    ]
}

connections['Store Vector Chunks - Strategy'] = {
    "main": [
        [
            {
                "node": "Collect Storage Results",
                "type": "main",
                "index": 0
            }
        ]
    ]
}
print("✅ Fixed: Vector storage nodes → Collect Storage Results")

# Save
output_file = 'Astra-Multi-Team-Data-Sync-FIXED-v2.json'
with open(output_file, 'w') as f:
    json.dump(workflow, f, indent=2)

print(f"\n💾 Saved: {output_file}")

print("\n" + "="*50)
print("CORRECTED FLOW:")
print("="*50)
print("""
📦 DOCUMENT BATCHING (Loop Over Batches):
  Loop Branch → Download → Chunk → Aggregate All Chunks (accumulates)
  Done Branch → Combine All Chunks (retrieves accumulated)

🔢 CHUNK BATCHING (Loop Over Chunk Batches):
  Loop Branch → Extract → Embed → Filter → Store Vectors → Collect → Signal → (back to loop)
  Done Branch → Release Documents → Batch Completion Metrics

💾 DOCUMENT STORAGE:
  Batch Completion Metrics → Prepare Documents → Clean → Store Documents → Metrics → (back to Loop Over Batches)

🔄 FEEDBACK LOOPS:
  1. Collect Storage Results → Batch Completion Signal → Loop Over Chunk Batches
  2. Document Storage Metrics → Loop Over Batches
""")

print("\n✅ All connections fixed!")
