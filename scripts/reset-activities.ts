import { db } from '../src/lib/db'

async function main() {
  // Reset all activities that are LIVE or COMPLETED back to PUBLISHED so they can be re-presented.
  // Also clears participants + answers + live-question state.
  const activities = await db.activity.findMany({
    where: { status: { in: ['LIVE', 'COMPLETED'] } },
    select: { id: true, title: true, status: true },
  })
  for (const a of activities) {
    await db.answer.deleteMany({ where: { activityId: a.id } })
    await db.participant.deleteMany({ where: { activityId: a.id } })
    await db.activity.update({
      where: { id: a.id },
      data: {
        status: 'PUBLISHED',
        currentQuestionId: null,
        questionStartedAt: null,
        questionEndsAt: null,
        startedAt: null,
        endedAt: null,
      },
    })
    console.log(`reset "${a.title}" (${a.status} -> PUBLISHED)`)
  }
  if (activities.length === 0) console.log('no LIVE/COMPLETED activities to reset')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
