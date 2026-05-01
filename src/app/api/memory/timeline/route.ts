import { NextResponse } from 'next/server';
import { listMemories } from '@/services/memory/memory.service';

export async function GET() {
  try {
    const memories = await listMemories(20, 0);
    
    // Format for timeline display
    const timeline = memories.map(m => ({
      hash: m.hash,
      content: m.content.substring(0, 300),
      model: m.model,
      score: m.score,
      timestamp: m.timestamp,
      verified: m.verified,
    }));

    return NextResponse.json({
      memories: timeline,
      total: timeline.length,
    });
  } catch (error) {
    console.error('[Timeline API] Error:', error);
    return NextResponse.json({ memories: [], total: 0 });
  }
}
