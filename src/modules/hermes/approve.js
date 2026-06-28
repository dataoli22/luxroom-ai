import readline from 'readline';
import { getAllListings, updateDraft } from '../../db/database.js';
import { sendApprovedDraft } from './hermes.js';

const DIVIDER = '─────────────────────────────';

function printListingSummary(listing, draft) {
  console.log('\n' + DIVIDER);
  console.log(`📍 ${listing.location ?? 'Unknown'} · ${listing.corridor ?? 'Unknown corridor'}`);
  console.log(`💶 ${listing.rentTotal ?? '?'} · ⏱ ${listing.estimatedCommute ?? '?'}`);
  console.log(
    `🏆 Score: ${listing.score ?? '?'}/10 · Opportunity: ${listing.opportunityScore ?? '?'}/10`
  );
  console.log(`🔗 ${listing.url}`);
  console.log(DIVIDER);
  console.log(`📝 Draft (${draft.type ?? 'unknown'} in ${draft.language ?? 'unknown'}):`);
  console.log(draft.body ?? '');
  console.log(DIVIDER);
}

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function run() {
  const listings = getAllListings();

  const pending = [];
  for (const listing of listings) {
    const drafts = (listing.messageDrafts ?? []).filter(
      (d) => d.approved === false && d.discarded === false
    );
    for (const draft of drafts) {
      pending.push({ listing, draft });
    }
  }

  if (pending.length === 0) {
    console.log('No pending messages.');
    process.exit(0);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  for (const { listing, draft } of pending) {
    printListingSummary(listing, draft);

    let answered = false;
    while (!answered) {
      const answer = await prompt(rl, '[A]pprove / [D]iscard / [S]kip ? ');
      const key = answer.trim().toLowerCase();

      if (key === 'a') {
        const approvedDraft = { ...draft, approved: true };
        updateDraft(listing.url, draft.id, {
          approved: true,
          approvedAt: new Date().toISOString(),
        });
        try {
          const event = await sendApprovedDraft(listing, approvedDraft);
          if (event.status === 'failed') {
            console.error(`  Error sending: ${event.errorMessage}`);
          } else {
            console.log('  Sent successfully');
          }
        } catch (err) {
          console.error(`  Error sending: ${err.message ?? String(err)}`);
        }
        answered = true;
      } else if (key === 'd') {
        updateDraft(listing.url, draft.id, { discarded: true });
        console.log('  Discarded.');
        answered = true;
      } else if (key === 's') {
        console.log('  Skipped.');
        answered = true;
      } else {
        console.log('  Please enter A, D, or S.');
      }
    }
  }

  rl.close();
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
