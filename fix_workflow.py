#!/usr/bin/env python3
"""
Script to fix the Astra Multi-Team Data Sync Agent workflow
Implements Option 2: Collect ALL chunks first, then batch and process
"""

import json
import sys

def fix_workflow():
    # Read the original workflow
    input_file = 'workflows/Astra - Multi-Team Data Sync Agent (Bolt).json'
    output_file = 'Astra-Multi-Team-Data-Sync-FIXED.json'

    print(f"📖 Reading workflow from: {input_file}")
    with open(input_file, 'r') as f:
        workflow = json.load(f)

    print(f"✅ Loaded workflow: {workflow['name']}")
    print(f"   Current nodes: {len(workflow['nodes'])}")

    # Step 1: Add new nodes
    print("\n🔧 Adding new nodes...")

    # Find a good position for new nodes
    chunk_content_node = next((n for n in workflow['nodes'] if n['name'] == 'Chunk Content'), None)
    if not chunk_content_node:
        print("❌ Error: Could not find 'Chunk Content' node")
        return False

    chunk_pos = chunk_content_node['position']

    # New Node 1: Aggregate All Chunks
    aggregate_node = {
        "parameters": {
            "jsCode": "// AGGREGATE ALL CHUNKS - Collects chunks from all document batch iterations\n// This node does NOT process chunks - it just holds them until all batches complete\n\nconst incomingChunks = $input.all();\n\nconsole.log(`📦 Aggregate: Received ${incomingChunks.length} chunks from this document batch`);\n\n// Simply pass through - n8n's Split In Batches will accumulate these\n// When Loop Over Batches completes, ALL accumulated chunks go to Done Branch\nreturn incomingChunks;"
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [chunk_pos[0] + 240, chunk_pos[1]],
        "id": "aggregate-all-chunks-node",
        "name": "Aggregate All Chunks"
    }

    # New Node 2: Combine All Chunks
    combine_node = {
        "parameters": {
            "jsCode": "// COMBINE ALL CHUNKS - Triggered by Loop Over Batches Done Branch\n// Receives ALL chunks collected from ALL document batches\n\nconst allChunks = $('Aggregate All Chunks').all();\n\nconsole.log('=== COMBINE ALL CHUNKS ===');\nconsole.log(`✅ All document batches complete!`);\nconsole.log(`📊 Total chunks collected: ${allChunks.length}`);\n\nif (allChunks.length === 0) {\n  console.log('⚠️  No chunks to process - stopping here');\n  return [];\n}\n\nconsole.log(`🔄 Ready to batch into groups of 100 for vectorization...`);\n\n// Pass all chunks to batching node\nreturn allChunks;"
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [chunk_pos[0] + 480, chunk_pos[1] - 160],
        "id": "combine-all-chunks-node",
        "name": "Combine All Chunks"
    }

    # New Node 3: Release Documents for Storage
    release_node = {
        "parameters": {
            "jsCode": "// RELEASE DOCUMENTS FOR STORAGE - Triggered by Loop Over Chunk Batches Done Branch\n// All chunk batches have been vectorized, now safe to store documents\n\nconst documentsToStore = $('Wait for Vectors').all();\n\nconsole.log('=== RELEASE DOCUMENTS FOR STORAGE ===');\nconsole.log(`✅ All chunk batches processed and vectorized!`);\nconsole.log(`📄 Releasing ${documentsToStore.length} documents for storage...`);\n\nif (documentsToStore.length === 0) {\n  console.log('⚠️  No documents to store');\n  return [];\n}\n\nreturn documentsToStore;"
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [chunk_pos[0] + 1440, chunk_pos[1] - 160],
        "id": "release-documents-node",
        "name": "Release Documents for Storage"
    }

    workflow['nodes'].extend([aggregate_node, combine_node, release_node])
    print(f"   ✅ Added 3 new nodes")

    # Step 2: Update connections
    print("\n🔗 Updating connections...")

    connections = workflow['connections']

    # Fix 1: Loop Over Batches - Done Branch should go to Combine All Chunks
    connections['Loop Over Batches'] = {
        "main": [
            [
                {
                    "node": "Combine All Chunks",
                    "type": "main",
                    "index": 0
                }
            ],
            [
                {
                    "node": "Download Content (Batch)",
                    "type": "main",
                    "index": 0
                },
                {
                    "node": "Batch Completion Notification",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }
    print("   ✅ Fixed 'Loop Over Batches' connections")

    # Fix 2: Chunk Content should go to Aggregate All Chunks
    connections['Chunk Content'] = {
        "main": [
            [
                {
                    "node": "Aggregate All Chunks",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }
    print("   ✅ Fixed 'Chunk Content' connections")

    # Fix 3: Loop Over Chunk Batches - Done Branch should go to Release Documents
    connections['Loop Over Chunk Batches'] = {
        "main": [
            [
                {
                    "node": "Release Documents for Storage",
                    "type": "main",
                    "index": 0
                }
            ],
            [
                {
                    "node": "Extract Chunks from Batch",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }
    print("   ✅ Fixed 'Loop Over Chunk Batches' connections")

    # Add new node connections
    connections['Aggregate All Chunks'] = {
        "main": [[]]  # No output - just accumulates
    }

    connections['Combine All Chunks'] = {
        "main": [
            [
                {
                    "node": "Batch Chunk Groups",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }

    connections['Release Documents for Storage'] = {
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

    # Fix 4: Collect Storage Results should feed back to Loop Over Chunk Batches
    connections['Collect Storage Results'] = {
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
    print("   ✅ Added new node connections")
    print("   ✅ Fixed feedback loop for chunk batching")

    # Save the fixed workflow
    print(f"\n💾 Saving fixed workflow to: {output_file}")
    with open(output_file, 'w') as f:
        json.dump(workflow, f, indent=2)

    print(f"\n✅ SUCCESS! Fixed workflow saved")
    print(f"\n📋 Summary of changes:")
    print(f"   • Added 'Aggregate All Chunks' node")
    print(f"   • Added 'Combine All Chunks' node")
    print(f"   • Added 'Release Documents for Storage' node")
    print(f"   • Fixed Loop Over Batches Done Branch → Combine All Chunks")
    print(f"   • Fixed Chunk Content → Aggregate All Chunks")
    print(f"   • Fixed Loop Over Chunk Batches Done Branch → Release Documents")
    print(f"   • Fixed Collect Storage Results → Loop Over Chunk Batches (feedback)")
    print(f"\n🎯 New Flow:")
    print(f"   1. Loop Over Batches (Loop) → Download → Chunk → Aggregate")
    print(f"   2. Loop Over Batches (Done) → Combine All Chunks → Batch Chunk Groups")
    print(f"   3. Loop Over Chunk Batches (Loop) → Extract → Embed → Store → Collect → (back to step 3)")
    print(f"   4. Loop Over Chunk Batches (Done) → Release Documents → Store Documents")

    return True

if __name__ == '__main__':
    try:
        success = fix_workflow()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
