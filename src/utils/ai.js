// AI service. Calls the `claude` Supabase Edge Function which proxies
// to the Anthropic API. The Edge Function holds the API key.

import { supabase } from '../lib/supabase';
import { formatDateObject } from './helpers';

// ---------- Core caller ----------

// Plain text path. Returns the trimmed text response.
async function callClaude({ system, prompt, max_tokens = 800 }) {
  const { data, error } = await supabase.functions.invoke('claude', {
    body: { system, prompt, max_tokens },
  });

  if (error) {
    console.error('claude function error:', error);
    throw new Error(error.message || 'AI call failed');
  }
  if (data?.error) {
    console.error('claude function returned error:', data.error);
    throw new Error(data.error);
  }
  return (data?.text || '').trim();
}

// Structured output path. Pass a tool schema; Claude is forced to return
// data matching the schema. The structured `input` is returned directly,
// already parsed.
async function callClaudeWithTool({ system, prompt, tool, max_tokens = 800 }) {
  const { data, error } = await supabase.functions.invoke('claude', {
    body: {
      system,
      prompt,
      max_tokens,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    },
  });

  if (error) {
    console.error('claude function error:', error);
    throw new Error(error.message || 'AI call failed');
  }
  if (data?.error) {
    console.error('claude function returned error:', data.error);
    throw new Error(data.error);
  }
  if (!data?.tool_input) {
    console.warn('callClaudeWithTool: no tool_input in response, falling back', data);
    throw new Error('AI did not return structured data');
  }
  return data.tool_input;
}

// ---------- Date helpers ----------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function todayMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayMinusDaysUS(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  return m + '/' + day + '/' + y;
}

function todayUS() {
  return todayMinusDaysUS(0);
}

function daysBetween(isoDate) {
  if (!isoDate) return null;
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function humanGap(isoDate) {
  const d = daysBetween(isoDate);
  if (d === null) return null;
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  if (d < 365) return `${Math.round(d / 30)} months ago`;
  return `${Math.round(d / 365)} years ago`;
}

// ---------- Contact summary ----------

function displayNameOf(c) {
  if (!c) return '';
  const composed = [c.firstName, c.lastName]
    .filter((s) => typeof s === 'string' && s.trim())
    .join(' ')
    .trim();
  if (composed) return composed;
  return typeof c.name === 'string' ? c.name.trim() : '';
}

function summarizeContact(c) {
  if (!c) return '';
  const lines = [];
  const today = todayISO();
  lines.push(`Today's date: ${today}`);
  lines.push('');

  const displayName = [c.firstName, c.lastName]
    .filter((s) => typeof s === 'string' && s.trim())
    .join(' ')
    .trim() || c.name || '(unknown)';
  lines.push(`Name: ${displayName}`);
  if (c.role || c.company) {
    lines.push(`Role: ${[c.role, c.company].filter(Boolean).join(' at ')}`);
  }

  if (c.initialIntroduction) lines.push(`Initial introduction: ${c.initialIntroduction}`);
  if (c.howMet) lines.push(`How we met: ${c.howMet}`);
  if (c.howHelp) lines.push(`How I can help them: ${c.howHelp}`);
  if (c.tags?.length) lines.push(`Tags: ${c.tags.join(', ')}`);
  if (c.priority) lines.push(`This person is a VIP / priority contact.`);

  if (c.lastContacted) {
    const gap = humanGap(c.lastContacted);
    lines.push(`Last contacted: ${c.lastContacted}${gap ? ` (${gap})` : ''}`);
  }
  if (c.freq && c.freq !== 'never') lines.push(`Follow-up cadence: ${c.freq}`);

  if (c.location) lines.push(`Currently in: ${c.location}`);
  if (c.hometown) lines.push(`From: ${c.hometown}`);

  if (c.married === 'married' && c.spouseName) {
    lines.push(`Spouse: ${c.spouseName}`);
  } else if (c.married) {
    lines.push(`Marital status: ${c.married}`);
  }
  if (c.anniversary) lines.push(`Anniversary: ${c.anniversary}`);
  if (c.birthday) lines.push(`Birthday: ${c.birthday}`);
  if (c.kids?.length) {
    const kidStr = c.kids
      .map((k) => {
        const parts = [];
        if (k.name) parts.push(k.name);
        if (k.age) parts.push(`age ${k.age}`);
        if (k.notes) parts.push(`(${k.notes})`);
        return parts.join(' ');
      })
      .filter(Boolean)
      .join('; ');
    if (kidStr) lines.push(`Kids: ${kidStr}`);
  }

  if (c.interests?.length) lines.push(`Interests: ${c.interests.join(', ')}`);
  if (c.experience) lines.push(`Experience (manually entered): ${c.experience}`);
  if (c.pastCompanies?.length) {
    const pc = c.pastCompanies
      .map((p) => [p.company, p.role].filter(Boolean).join(' / '))
      .filter(Boolean)
      .join('; ');
    if (pc) lines.push(`Past companies (manually entered): ${pc}`);
  }

  if (c.topics) lines.push(`Recent topics noted: ${c.topics}`);
  if (c.notes) lines.push(`General notes: ${c.notes}`);

  if (c.convLog?.length) {
    const recent = c.convLog
      .slice(0, 10)
      .map((e) => {
        const gap = humanGap(e.date);
        const tag = `[${e.date}${gap ? `, ${gap}` : ''}, ${e.type || 'other'}]`;
        return `- ${tag} ${e.text}`;
      })
      .join('\n');
    lines.push(`\nConversation log (most recent first):\n${recent}`);
  } else {
    lines.push(`Conversation log: (empty, no logged conversations yet)`);
  }

  return lines.join('\n');
}

// ---------- Meeting summary length preference ----------
//
// User-configurable in Settings. Drives the format and length of meeting
// summaries produced by aiExtractFromVoice and aiExtractMeetingNote.

export const SUMMARY_LENGTH_OPTIONS = {
  detailed: {
    key: 'detailed',
    label: 'Detailed',
    description: '3-8 sentence prose summary capturing every relevant detail.',
  },
  standard: {
    key: 'standard',
    label: 'Standard',
    description: '2-4 sentence prose summary covering the key points.',
  },
  bullets_long: {
    key: 'bullets_long',
    label: 'Long bullets',
    description: 'Up to 10 bullet points, one per key fact or moment.',
  },
  bullets_short: {
    key: 'bullets_short',
    label: 'Short bullets',
    description: 'Up to 5 bullet points covering only the most important takeaways.',
  },
};

export const DEFAULT_SUMMARY_LENGTH = 'detailed';

function normalizeSummaryLength(value) {
  if (typeof value === 'string' && SUMMARY_LENGTH_OPTIONS[value]) return value;
  return DEFAULT_SUMMARY_LENGTH;
}

// Produces the format-specific instructions injected into the system
// prompt of any function that generates a meeting summary.
function buildSummaryLengthInstruction(length, contactNameForBullets) {
  const lengthKey = normalizeSummaryLength(length);
  const subject = contactNameForBullets || 'the contact';

  switch (lengthKey) {
    case 'standard':
      return `LENGTH AND FORMAT: Prose paragraph. 2-4 sentences. Tight and ` +
        `factual. Past tense, third person about ${subject}. No bullets. No ` +
        `headers. Just the prose body.`;

    case 'bullets_long':
      return `LENGTH AND FORMAT: Up to 10 bullet points. Each bullet is one ` +
        `concrete fact or moment. Format each bullet as a single line starting ` +
        `with "- " (hyphen, space, then the bullet text). Separate bullets with ` +
        `a newline. Past tense, third person about ${subject}. No introductory ` +
        `paragraph. No headers. No conclusion. Just the bullets.

EXAMPLE FORMAT:
- ${subject} mentioned [specific fact]
- ${subject} shared [specific detail]
- ${subject} committed to [specific action]

QUALITY: Each bullet must carry weight. Skip filler. If there are only 4 ` +
        `worthwhile bullets to write, write 4. Do NOT pad to hit 10.`;

    case 'bullets_short':
      return `LENGTH AND FORMAT: Up to 5 bullet points. Only the most important ` +
        `takeaways. Each bullet is one concrete fact or moment. Format each ` +
        `bullet as a single line starting with "- " (hyphen, space, then text). ` +
        `Separate bullets with a newline. Past tense, third person about ` +
        `${subject}. No introductory paragraph. No headers. No conclusion.

EXAMPLE FORMAT:
- ${subject} mentioned [most important fact]
- ${subject} committed to [most important action]

QUALITY: Be ruthless. Top 5 only. If there are only 2 worthwhile bullets, ` +
        `write 2. Do NOT pad to hit 5.`;

    case 'detailed':
    default:
      return `LENGTH AND FORMAT: Prose paragraph. 3-8 sentences. Capture every ` +
        `relevant detail: family ${subject} mentioned, deals discussed, plans ` +
        `shared, opinions expressed, news. Past tense, third person about ` +
        `${subject} ("${subject} mentioned...", "He said...", "She shared..."). ` +
        `No bullets. No headers. Just the prose body.`;
  }
}

// ---------- User identity block ----------

function buildUserIdentityBlock(myCard) {
  if (!myCard) {
    return `IMPORTANT: The user is one of the speakers in the transcript. You ` +
      `do NOT know their identity. Infer which speaker is the user (the ` +
      `one running this CRM) versus the contact (the OTHER speaker) from ` +
      `context. Never attribute the user's own first-person statements as ` +
      `facts about the contact.`;
  }

  const userName = displayNameOf(myCard);
  const userCompany = (myCard.company || '').trim();
  const userRole = (myCard.role || '').trim();
  const userLocation = (myCard.location || '').trim();
  const userHometown = (myCard.hometown || '').trim();
  const userSpouse = (myCard.spouseName || '').trim();
  const userInterests = Array.isArray(myCard.interests) ? myCard.interests.filter(Boolean) : [];
  const userKids = Array.isArray(myCard.kids)
    ? myCard.kids.map((k) => (k?.name || '').trim()).filter(Boolean)
    : [];
  const userPastCompanies = Array.isArray(myCard.pastCompanies)
    ? myCard.pastCompanies.map((p) => (p?.company || '').trim()).filter(Boolean)
    : [];

  const userFacts = [];
  if (userName) userFacts.push(`Name: ${userName}`);
  if (userRole) userFacts.push(`Role: ${userRole}`);
  if (userCompany) userFacts.push(`Company: ${userCompany}`);
  if (userPastCompanies.length) userFacts.push(`Past companies: ${userPastCompanies.join(', ')}`);
  if (userLocation) userFacts.push(`Currently lives: ${userLocation}`);
  if (userHometown) userFacts.push(`Hometown: ${userHometown}`);
  if (userSpouse) userFacts.push(`Spouse: ${userSpouse}`);
  if (userKids.length) userFacts.push(`Kids: ${userKids.join(', ')}`);
  if (userInterests.length) userFacts.push(`Interests: ${userInterests.join(', ')}`);

  return `IMPORTANT: The user (the person USING this CRM, who is one of the ` +
    `speakers in the transcript) has the following identity. NONE of ` +
    `these facts belong to the contact. If you see any of these mentioned ` +
    `in the transcript, they describe the USER, not the contact.

USER'S OWN IDENTITY (do NOT attach to the contact's record):
${userFacts.map((f) => '  - ' + f).join('\n')}

The contact you are extracting is the OTHER speaker(s) in the conversation. ` +
    `When the user says "I just started at ${userCompany || '[company]'}" or "my wife and I moved to ${userLocation || '[city]'}" or "I went to BYU", those are USER facts, NEVER contact facts.`;
}

// ---------- Post-extraction scrubber ----------

function normalizeForCompare(s) {
  return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function scrubExtractedAgainstMyCard(extracted, myCard) {
  if (!myCard || !extracted) return extracted;

  const userCompany = normalizeForCompare(myCard.company);
  const userRole = normalizeForCompare(myCard.role);
  const userLocation = normalizeForCompare(myCard.location);
  const userHometown = normalizeForCompare(myCard.hometown);
  const userSpouse = normalizeForCompare(myCard.spouseName);
  const userPastCompanies = new Set(
    (Array.isArray(myCard.pastCompanies) ? myCard.pastCompanies : [])
      .map((p) => normalizeForCompare(p?.company))
      .filter(Boolean)
  );
  const userKidNames = new Set(
    (Array.isArray(myCard.kids) ? myCard.kids : [])
      .map((k) => normalizeForCompare(k?.name))
      .filter(Boolean)
  );
  const userInterests = new Set(
    (Array.isArray(myCard.interests) ? myCard.interests : [])
      .map(normalizeForCompare)
      .filter(Boolean)
  );

  const out = { ...extracted };
  const stripped = [];

  if (userCompany && normalizeForCompare(out.company) === userCompany) {
    stripped.push(`company="${out.company}"`);
    out.company = '';
    if (out.role) {
      stripped.push(`role="${out.role}" (stripped because company stripped)`);
      out.role = '';
    }
  } else if (userRole && userCompany && normalizeForCompare(out.role) === userRole) {
    if (!out.company) {
      stripped.push(`role="${out.role}" (matches user role, no contact company)`);
      out.role = '';
    }
  }

  if (userLocation && normalizeForCompare(out.location) === userLocation) {
    stripped.push(`location="${out.location}"`);
    out.location = '';
  }
  if (userHometown && normalizeForCompare(out.hometown) === userHometown) {
    stripped.push(`hometown="${out.hometown}"`);
    out.hometown = '';
  }

  if (userSpouse && normalizeForCompare(out.spouseName) === userSpouse) {
    stripped.push(`spouseName="${out.spouseName}"`);
    out.spouseName = '';
    if (out.married) {
      stripped.push(`married="${out.married}" (stripped because spouse stripped)`);
      out.married = '';
    }
  }

  if (Array.isArray(out.pastCompanies) && userPastCompanies.size > 0) {
    const filtered = out.pastCompanies.filter((p) => {
      const c = normalizeForCompare(p?.company);
      if (c && userPastCompanies.has(c)) {
        stripped.push(`pastCompany="${p.company}"`);
        return false;
      }
      return true;
    });
    out.pastCompanies = filtered;
  }

  if (Array.isArray(out.kids) && userKidNames.size > 0) {
    const filtered = out.kids.filter((k) => {
      const n = normalizeForCompare(k?.name);
      if (n && userKidNames.has(n)) {
        stripped.push(`kid="${k.name}"`);
        return false;
      }
      return true;
    });
    out.kids = filtered;
  }

  if (Array.isArray(out.interests) && out.interests.length > 0 && userInterests.size > 0) {
    const normalized = out.interests.map(normalizeForCompare);
    const allMatch = normalized.every((i) => userInterests.has(i));
    if (allMatch) {
      stripped.push(`interests=[${out.interests.join(', ')}] (all matched user)`);
      out.interests = [];
    }
  }

  if (stripped.length > 0) {
    console.warn('[ai scrubber] stripped user-leak fields:', stripped.join('; '));
  }

  return out;
}

// ---------- Shared instruction snippets ----------

const HONESTY_RULES = `
Hard rules:
- Never invent facts about this person, their company, family, deals, employment history, or anything else. Use only what is in the contact info.
- If you don't know something, leave it out. No commentary about what is or isn't in the data. Do not say "no information available about X", just don't mention X.
- Skip filler openers like "Based on the information provided".`.trim();

const FORMATTING_RULES = `
Formatting rules:
- Do NOT add a title at the top. No "# Background Dossier", no "Background for [Name]", no preamble.
- Do NOT use # markdown headers (no # or ##).
- Do NOT use divider lines (no ===, no ---, no ***).
- Use **double-asterisk bold** for headers, like: **PROFESSIONAL** or **Family**
- Use "- " for bullet points (a hyphen and a space).
- Blank line between sections.`.trim();

// ---------- aiMeetingPrep ----------

export async function aiMeetingPrep(contact) {
  const summary = summarizeContact(contact);
  const system =
    `You prepare someone for a one-on-one meeting. You give terse, ` +
    `factual reminders. You are NOT a coach. You do NOT suggest what ` +
    `they should share or come prepared with. You do NOT opine on the ` +
    `relationship.

STYLE, TERSE BULLETS:
Every section is bullets. Each bullet is one short factual line. No ` +
    `transitional phrases. No "worth getting an update" or "worth ` +
    `noting" or "important to". State the fact, stop. The reader is ` +
    `smart enough to infer what to do with it.

ANTI-PATTERNS, DO NOT WRITE THESE:
- "Last spoke yesterday, May 7, no log entry exists for that contact." -> write "Last spoke May 7 (no notes)."
- "Five days ago he mentioned his team was evaluating a site in Provo. Worth getting an update." -> write "May 3: his team evaluating a Provo site for a JV."
- "No other concrete follow-ups exist in the log." -> just don't mention it.
- "No birthdays, anniversaries, or upcoming personal events are noted in the contact info." -> just don't mention it.

USE TODAY'S DATE to compute "X days/weeks/months ago" framing where ` +
    `useful, but keep it short.

OUTPUT FORMAT, exactly three sections with these headers, in this order. ` +
    `Each section is bullets only.

**RELATIONSHIP CONTEXT**
- How we met
- Tags
- Last contact (date + channel + one-line topic if log exists, ` +
    `or "(no notes)" if not)

**TALKING POINTS**
- Each bullet = one item from the conversation log. Format: ` +
    `"[date]: [what was discussed]" or framed as a follow-up question ` +
    `if appropriate.
- 3-6 bullets max. Most recent first.
- If they made an explicit request in a past conversation ("you said ` +
    `you'd send X"), include it as a bullet.
- If the log has nothing concrete to follow up on, output a single ` +
    `bullet: "- No open threads in the log."

**PERSONAL TOUCHPOINTS**
- Family: spouse, kids by name and age
- Location
- Interests
- Birthdays/anniversaries IF they're within 30 days of today
- 3-5 bullets max. Skip categories that don't apply, don't list ` +
    `the absence.

${FORMATTING_RULES}

${HONESTY_RULES}`;
  const prompt =
    `Help me show up to this meeting prepared.\n\n` +
    `Contact info:\n\n${summary}`;
  return callClaude({ system, prompt, max_tokens: 700 });
}

// ---------- aiBackground ----------

export async function aiBackground(contact) {
  const summary = summarizeContact(contact);
  const system =
    `You write a background dossier for a contact. Two sections, with ` +
    `very different rules. Output the two sections back to back. NO ` +
    `title at the top. NO preamble. Start directly with the first section header.

The two sections are:

**PROFESSIONAL** — career and education only
**PERSONAL** — exhaustive memory bank organized into subsections

------ SECTION 1: PROFESSIONAL ------

SCOPE: Career and education ONLY. Where we met, current job, past ` +
    `jobs, schools, degrees. NOTHING ELSE.

DO NOT include in PROFESSIONAL:
- Open threads, deals in progress, current projects, ongoing ` +
    `evaluations, things they're "exploring", those belong in ` +
    `Meeting Prep, not here.
- Meta-commentary like "suggests a BYU network" or "indicates ` +
    `experience in...". Just state facts.
- Inference about what someone in their role typically does.
- Personal info (family, hobbies, etc.), that's section 2.

PROFESSIONAL FORMAT:

**PROFESSIONAL**

Met: [one short line, how we met]

Currently: [Title at Company, Location]

**Previously**
- [Title at Company, Location, Years if known]
- [Title at Company, Location, Years if known]

**Education**
- [School, Degree, Major, Years if known]

Skip "Previously" or "Education" if no data exists for them. Don't ` +
    `list the absence. Mine BOTH the explicit fields AND the ` +
    `conversation log. When something comes from the log rather than ` +
    `a structured field, you can add a small "(per past conversations)" ` +
    `tag, but only when useful, don't repeat it every line.

------ SECTION 2: PERSONAL ------

SCOPE: Everything you know about them as a human being, organized ` +
    `for memory. The point is "don't forget anything." Mine the ` +
    `explicit fields AND the conversation log exhaustively. Capture ` +
    `every personal detail, vacations they've taken or talked about, ` +
    `favorite foods or candies, restaurants they like, books they've ` +
    `read, hobbies, sports teams they follow, faith, family stories, ` +
    `causes they care about, pets, anything.

PERSONAL FORMAT, start with the section header, then subsection ` +
    `headers based on what's actually known:

**PERSONAL**

**Hometown & places lived**
- (bullets)

**Family**
- (bullets)

**Vacations & travel**
- (bullets)

**Interests & hobbies**
- (bullets)

**Favorites**
- Foods, drinks, candies, restaurants, books, music, anything they like

**Faith & values**
- (bullets if applicable)

**Health & wellness**
- (bullets if applicable)

**Pets**
- (bullets if applicable)

**Other**
- Anything notable that doesn't fit elsewhere

Use only the subsections that have real data. Skip the rest. If ` +
    `there's almost nothing to say in personal, output a single short ` +
    `line acknowledging what you do know and stop.

${FORMATTING_RULES}

${HONESTY_RULES}`;
  const prompt =
    `Build me a background dossier on this person. Two sections: ` +
    `PROFESSIONAL and PERSONAL.\n\n` +
    `Contact info:\n\n${summary}`;
  return callClaude({ system, prompt, max_tokens: 1200 });
}

// ---------- aiTemplate ----------

const TEMPLATE_INSTRUCTIONS = {
  cold:
    `Write a cold outreach email. We don't know each other well or at ` +
    `all. The reason for outreach should be specific and grounded in ` +
    `something real from the contact info. Keep it short and human.`,
  followup:
    `Write a follow-up email after we recently met or spoke. Reference ` +
    `something specific from the most recent conversation log entry. ` +
    `Warm and short.`,
  checkin:
    `Write a casual check-in email. We're not transacting on anything. ` +
    `Just staying in touch. If the conversation log has personal ` +
    `details (family, life events, travel), reference one naturally.`,
  intro_req:
    `Write an email asking for a warm introduction. Be specific about ` +
    `who I want to meet and why. Make it easy for them to forward.`,
  share:
    `Write a short email sharing something useful, an article, an ` +
    `idea, a person to know. Specific to their interests or current ` +
    `focus.`,
};

export async function aiTemplate(contact, type) {
  const summary = summarizeContact(contact);
  const instruction = TEMPLATE_INSTRUCTIONS[type] || TEMPLATE_INSTRUCTIONS.checkin;
  const system =
    `You draft personal, professional emails that feel human, not ` +
    `templated. The output is the email itself, ready to send. No ` +
    `commentary. No "Here is your email".\n\n` +
    `Format: first line is "Subject: ..." then a blank line then the ` +
    `body. Use the recipient's first name only. Keep it short, 4-7 ` +
    `sentences. Sign off naturally with "Best," or similar, then ` +
    `"[Your name]" as a placeholder.\n\n` +
    `Reference something specific from the contact info or recent ` +
    `conversation log when natural. Don't shoehorn references in. ` +
    `Don't invent.\n\n${HONESTY_RULES}`;
  const prompt =
    `Recipient:\n\n${summary}\n\n` +
    `Task: ${instruction}\n\n` +
    `Write the email. Specific over generic. Short over long.`;
  return callClaude({ system, prompt, max_tokens: 500 });
}
// ============================================================
// PASTE THIS FUNCTION INTO src/utils/ai.js
// Add it right after aiTemplate (around line 657 in current file),
// before the `// ---------- aiExtractMeetingNote ----------` comment.
// ============================================================

// ---------- aiAnswerQuestion ----------
//
// Multi-turn Q&A about a specific contact. Given the user's chat history
// with Claude about this contact and a new question, returns Claude's
// answer. The full contact record (including convLog and any saved
// transcripts) is provided as context. Claude grounds answers in that
// data and openly says when it doesn't know something.
//
// history: array of { role: 'user'|'assistant', content: string }.
// newQuestion: the latest user question (a string).

export async function aiAnswerQuestion(contact, history, newQuestion) {
  if (!newQuestion || !newQuestion.trim()) {
    throw new Error('No question provided');
  }

  const summary = summarizeContact(contact);
  const contactName = displayNameOf(contact) || 'this contact';

  // Pull raw transcripts off any convLog entries that have them, since
  // the contact summary only shows the summarized text. Transcripts are
  // the densest source of detail for Q&A.
  const transcripts = (contact.convLog || [])
    .filter((e) => e.rawTranscript && e.rawTranscript.trim())
    .slice(0, 10)
    .map((e) => {
      const header = `--- Transcript from ${e.date}${e.type ? ' (' + e.type + ')' : ''} ---`;
      return header + '\n' + e.rawTranscript.trim();
    });

  const transcriptBlock = transcripts.length
    ? `\n\nRAW TRANSCRIPTS (verbatim, may contain rich details not in the summary above):\n\n${transcripts.join('\n\n')}`
    : '';

  const system =
    `You are answering questions about a specific person (${contactName}) ` +
    `the user knows. The user has saved details about this person in a CRM ` +
    `and is asking you questions to recall information, find patterns, or ` +
    `prepare for an interaction.

YOUR JOB:
- Answer the user's questions about ${contactName} accurately, grounded ` +
    `ONLY in the contact data and transcripts provided below.
- Be concise. The user is on mobile in a chat interface. Keep answers ` +
    `tight unless they ask for detail.
- If the data contains the answer, give it directly. Cite the relevant ` +
    `conversation date when it adds clarity (e.g. "back in March he ` +
    `mentioned...") but don't drown the answer in citations.
- If the data does NOT contain the answer, say so plainly. Do not guess, ` +
    `do not invent, do not fill in plausible details from general knowledge.
- For interpretive questions ("what's he interested in", "how's the ` +
    `relationship", "what should I talk about"), synthesize from the data ` +
    `but make clear what's inference vs fact.
- For factual recall ("when did we last meet", "where does she work"), ` +
    `give just the fact.
- Multi-turn: if the user asks a follow-up, treat the prior turns as ` +
    `context. Don't re-explain things you already said.

STYLE:
- Conversational, not corporate. Plain prose. No headers. No bullet lists ` +
    `unless the user explicitly asks for a list.
- Refer to the contact by first name where natural.
- Never start with "Based on the data..." or "According to the records...". ` +
    `Just answer.

${HONESTY_RULES}

CONTACT DATA (this is everything you know about ${contactName}):

${summary}${transcriptBlock}`;

  // Encode the prior turns as a transcript-style block, then the new
  // question at the end. The single-prompt callClaude doesn't take a
  // messages array, so we serialize the chat into one string.
  const historyLines = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => {
      const tag = m.role === 'assistant' ? 'Assistant' : 'User';
      return tag + ': ' + m.content.trim();
    });

  let prompt;
  if (historyLines.length === 0) {
    prompt = `User question: ${newQuestion.trim()}\n\nYour answer:`;
  } else {
    prompt =
      `Prior conversation:\n\n` +
      historyLines.join('\n\n') +
      `\n\nUser: ${newQuestion.trim()}\n\nAssistant:`;
  }

  return callClaude({ system, prompt, max_tokens: 800 });
}
// ---------- aiExtractMeetingNote ----------
//
// summaryLength controls the format/length of the output.
// See SUMMARY_LENGTH_OPTIONS for valid values. Defaults to 'detailed'.

export async function aiExtractMeetingNote(contact, rawText, myCard, summaryLength) {
  if (!rawText?.trim()) {
    throw new Error('No text provided');
  }
  const summary = summarizeContact(contact);
  const contactName = displayNameOf(contact) || 'the contact';

  const userIdBlock = buildUserIdentityBlock(myCard);
  const userName = displayNameOf(myCard);
  const userCompany = (myCard?.company || '').trim();

  const lengthInstruction = buildSummaryLengthInstruction(summaryLength, contactName);

  const system =
    `You extract a clean, focused meeting log entry from raw meeting ` +
    `notes. The notes might come from Granola, Otter, Fireflies, Zoom ` +
    `AI Companion, an email summary, or just typed text. They might ` +
    `cover a 1-on-1 or a multi-person meeting. Your job is to capture ` +
    `what's relevant ABOUT THE CONTACT (${contactName}), NOT about the user.

${userIdBlock}

THE CONTACT THIS LOG ENTRY IS FOR:
${contactName}. You are extracting what ${contactName} said, did, revealed, ` +
    `or committed to. Everything in the output should be ABOUT ${contactName}.

CRITICAL ATTRIBUTION RULES:
- First-person statements ("I", "my", "we" meaning the user's side) in the ` +
    `transcript are the USER speaking, NOT the contact. Do NOT attribute ` +
    `those facts to the contact.
- WORKED EXAMPLE: If the transcript says "I just started a new job at ` +
    `${userCompany || 'AcmeCo'}" and the user is the one speaking, that fact ` +
    `belongs to the USER. Do NOT write "${contactName} started at ` +
    `${userCompany || 'AcmeCo'}".
- WORKED EXAMPLE: If the user says "my wife and I moved to Lehi", do NOT ` +
    `write that the contact moved to Lehi.
- WORKED EXAMPLE: If the contact says "congrats on the new job" and the ` +
    `user says "thanks, I just started at X", the new job belongs to the ` +
    `USER, not the contact, even though the contact mentioned it first.
- When a speaker is labeled by name, match it to the right person. If the ` +
    `transcript only labels speakers as "Speaker A / Speaker B", infer from ` +
    `context which one is ${contactName} (whose company/role/family details ` +
    `match the contact info above) and which is the user.
- If you genuinely can't tell who said something, leave it out rather than ` +
    `guessing.

WHAT TO CAPTURE (about ${contactName}):
- What ${contactName} said about their life, family, work, health, ` +
    `interests, plans, vacations, food preferences, etc.
- What ${contactName} revealed about themselves, their company, their team, ` +
    `their deals, their goals.
- Open threads or follow-ups: things ${contactName} wants from the user, ` +
    `things the user committed to send them, things either side said would ` +
    `happen next.
- Decisions ${contactName} made, opinions they expressed, news they shared.

WHAT TO LEAVE OUT:
- Anything that is actually the USER talking about themselves, their own ` +
    `family, their own job, their own plans, their own move, their own ` +
    `company news. Those are not facts about the contact.
- Filler, small talk, "how are you" pleasantries.
- Stuff said by other meeting attendees (not the contact, not the user) that ` +
    `doesn't involve the contact.
- Verbatim transcript style. Compress everything.

${lengthInstruction}

Don't interpret or coach. Don't add follow-up suggestions. Just record what ` +
    `happened.

NO PREAMBLE.

${HONESTY_RULES}`;
  const prompt =
    `Contact this log entry is for:\n\n${summary}\n\n` +
    `Raw meeting content:\n\n${rawText}\n\n` +
    `Extract a clean log entry focused on what ${contactName} said and ` +
    `revealed. Remember: first-person "I" in the transcript is ` +
    `${userName || 'the user'}, NOT ${contactName}. Do not move user ` +
    `facts onto ${contactName}'s record.`;
  return callClaude({ system, prompt, max_tokens: 800 });
}

// ---------- aiSuggestContactsForAttendee ----------

export async function aiSuggestContactsForAttendee({ attendee, meetingTitle, meetingDate, transcriptSnippet, contacts }) {
  if (!attendee) return [];
  const candidates = (contacts || []).filter((c) => !c.archived);
  if (candidates.length === 0) return [];

  const trimmed = candidates.slice(0, 200).map((c) => {
    const lastTopic = c.convLog?.[0]?.text
      ? c.convLog[0].text.slice(0, 100).replace(/\s+/g, ' ')
      : '';
    return {
      id: c.id,
      name: displayNameOf(c),
      company: c.company || '',
      role: c.role || '',
      tags: (c.tags || []).slice(0, 3),
      lastTopic,
    };
  });

  const attendeeLine = [
    attendee.name ? `Name: ${attendee.name}` : null,
    attendee.email ? `Email: ${attendee.email}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const meetingLine = [
    meetingTitle ? `Meeting: ${meetingTitle}` : null,
    meetingDate ? `Date: ${meetingDate}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const snippet = (transcriptSnippet || '').slice(0, 1500);

  const system =
    `You match meeting attendees to existing CRM contacts. The user ` +
    `had a meeting where one attendee couldn't be matched automatically ` +
    `by email. Your job is to look at the attendee's name + the meeting ` +
    `title + a transcript snippet, and propose up to 3 candidates from ` +
    `the user's contact list who could plausibly be this person.

RULES:
- Use ONLY the contactId values exactly as listed in the candidates. ` +
    `Do not invent IDs.
- If no contact is a plausible match, return an empty suggestions array.
- "reason" should be ONE short sentence (under 15 words) that names ` +
    `the specific evidence.
- Confidence: "high" = name + corroborating context. "medium" = name ` +
    `match alone or weak corroboration. "low" = thin guess.
- Do NOT include the user themselves. Do NOT include archived contacts.
- A bare first-name match alone is "medium" at best, never "high".
- Return up to 3 suggestions, ranked best first.`;

  const prompt =
    `Unmatched attendee:\n${attendeeLine}\n\n` +
    `Meeting context:\n${meetingLine}\n\n` +
    `Transcript excerpt (may be empty or truncated):\n${snippet}\n\n` +
    `Candidate contacts (id | name | role at company | tags | last log topic):\n` +
    trimmed
      .map((c) => {
        const role = [c.role, c.company].filter(Boolean).join(' at ');
        const tags = c.tags.length ? ` [${c.tags.join(', ')}]` : '';
        const last = c.lastTopic ? ` | last: ${c.lastTopic}` : '';
        return `${c.id} | ${c.name}${role ? ' | ' + role : ''}${tags}${last}`;
      })
      .join('\n');

  const tool = {
    name: 'suggest_contact_matches',
    description: 'Suggest CRM contacts that might match an unmatched meeting attendee.',
    input_schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description: 'Up to 3 ranked candidate matches. Empty array if no plausible match.',
          items: {
            type: 'object',
            properties: {
              contactId: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              reason: { type: 'string' },
            },
            required: ['contactId', 'confidence', 'reason'],
          },
        },
      },
      required: ['suggestions'],
    },
  };

  let result;
  try {
    result = await callClaudeWithTool({ system, prompt, tool, max_tokens: 500 });
  } catch (e) {
    console.error('aiSuggestContactsForAttendee tool call failed:', e?.message);
    return [];
  }

  const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
  const knownIds = new Set(candidates.map((c) => c.id));
  return suggestions
    .filter((s) => s && knownIds.has(s.contactId))
    .slice(0, 3)
    .map((s) => ({
      contactId: s.contactId,
      confidence: ['high', 'medium', 'low'].includes(s.confidence)
        ? s.confidence
        : 'low',
      reason: typeof s.reason === 'string' ? s.reason.slice(0, 200) : '',
    }));
}

// ---------- aiSummarizeMeetingForReview ----------

function trimForMeetingSummary(rawText) {
  if (!rawText) return '';
  const max = 3000;
  if (rawText.length <= max) return rawText;
  const headLen = Math.floor(max * 0.7);
  const tailLen = max - headLen;
  const head = rawText.slice(0, headLen);
  const tail = rawText.slice(rawText.length - tailLen);
  return head + '\n\n[...transcript truncated...]\n\n' + tail;
}

export async function aiSummarizeMeetingForReview(rawText, userInfo = {}) {
  if (!rawText?.trim()) {
    throw new Error('No text provided');
  }
  const trimmed = trimForMeetingSummary(rawText);

  const userName = displayNameOf(userInfo);
  const userCompany = (userInfo.company || '').trim();
  const userIdLine = userName
    ? `The user is ${userName}${userCompany ? ` (${userCompany})` : ''}. ` +
      `Do NOT mention them or their info in the summary. They already know who they are.`
    : `The user is one of the speakers. Try to identify which speaker they ` +
      `aren't and focus only on the OTHER attendees.`;

  const system =
    `You write a 1-3 sentence summary of who the OTHER attendees in a meeting ` +
    `are, so the user can identify them in their CRM contact list.

${userIdLine}

HARD RULES:
- Maximum 3 sentences. Often 1-2 is enough.
- Around 30-60 words total. Tight.
- Focus ONLY on the people who are NOT the user. The user is excluded.
- For each non-user speaker: name + company + role/context + anything identifying.
- Skip: anything about the user, biographical histories, career arcs.
- If a non-user speaker has no name (just "Speaker B" etc), say so. Don't invent.

NO HEADERS. NO BULLETS. NO PREAMBLE. Just the focused identification.

${HONESTY_RULES}`;
  const prompt =
    `Meeting transcript:\n\n${trimmed}\n\n` +
    `Summarize the OTHER attendees in 1-3 sentences. Skip the user. ` +
    `Names + identifying details only.`;
  return callClaude({ system, prompt, max_tokens: 150 });
}

// ---------- aiExtractFromVoice ----------
//
// opts.summaryLength controls the format/length of meetingSummary.
// See SUMMARY_LENGTH_OPTIONS for valid values. Defaults to 'detailed'.

const EMPTY_VOICE_RESULT = {
  firstName: '',
  lastName: '',
  company: '',
  role: '',
  priority: false,
  phones: [],
  emails: [],
  addresses: [],
  recipientName: '',
  initialIntroduction: '',
  meetingSummary: '',
  tags: [],
  experience: '',
  pastCompanies: [],
  hometown: '',
  location: '',
  timezone: '',
  birthday: null,
  married: '',
  spouseName: '',
  anniversary: null,
  kids: [],
  interests: [],
  touchpoint: null,
};

export async function aiExtractFromVoice(transcript, opts = {}) {
  if (!transcript?.trim()) {
    return { ...EMPTY_VOICE_RESULT };
  }

  const myCard = opts.myCard || null;
  const attendeeHint = (opts.attendeeName || '').trim();
  const summaryLength = normalizeSummaryLength(opts.summaryLength);

  const userIdBlock = buildUserIdentityBlock(myCard);
  const userName = displayNameOf(myCard);
  const userCompany = (myCard?.company || '').trim();

  const summarySubject = attendeeHint || 'the contact';
  const lengthInstruction = buildSummaryLengthInstruction(summaryLength, summarySubject);

  let attendeeLine = '';
  if (attendeeHint) {
    attendeeLine =
      `The contact being created is named "${attendeeHint}" (this name ` +
      `came from the meeting attendee list). Use this as the contact's ` +
      `name and extract everything ELSE the transcript reveals about ` +
      `THIS specific person, never about the user.`;
  }

  const today = todayUS();
  const system =
    `You extract structured contact information from a transcript. The ` +
    `transcript may be:
  (a) a voice memo the user dictated about a person they know, OR
  (b) a meeting transcript between the user and one or more other people.

${userIdBlock}

${attendeeLine}

For case (a) the user is describing the contact in third person, easy.
For case (b) you need to figure out which speaker is the user (skip ` +
    `their info) and which is the contact (extract their info).

CRITICAL ATTRIBUTION RULES, read carefully, this is the #1 source of bugs:
- First-person statements ("I", "my", "we" meaning the user's side) in the ` +
    `transcript are the USER speaking, NOT the contact.
- The user's own facts (their company, role, kids, spouse, hometown, ` +
    `location, interests, past jobs) NEVER belong on the contact's record, ` +
    `even when the user mentions them in conversation with the contact.
- WORKED EXAMPLE: User says "I just started at ${userCompany || 'AcmeCo'}". ` +
    `The contact says "congrats on the new role at ${userCompany || 'AcmeCo'}". ` +
    `Result: company="${userCompany || 'AcmeCo'}" goes on the USER, NOT the contact. ` +
    `Do NOT extract company="${userCompany || 'AcmeCo'}" for the contact just ` +
    `because both speakers said the words.
- WORKED EXAMPLE: User says "my wife and I just moved to Lehi". ` +
    `Result: Do NOT set location="Lehi" on the contact.
- WORKED EXAMPLE: User says "I went to BYU". Contact says "oh, I went there too". ` +
    `Result: ONLY the contact's "I went there too" is a contact fact. The contact's ` +
    `education is BYU. The user's BYU is not the contact's.
- If the contact NEVER personally states or confirms a fact about themselves, ` +
    `do NOT extract it for them. Better empty than wrong.
- Match speakers to names using context: role, company, family, location ` +
    `details should align with the right person.
- If a speaker says "I have two kids named X and Y" and that speaker is the ` +
    `USER, those kids belong to the user, NOT the contact.
- If a speaker says "I have two kids named X and Y" and that speaker is the ` +
    `CONTACT, those kids DO belong to the contact.
- If you genuinely cannot tell who said what, leave the field empty rather ` +
    `than guess.

WHAT TO LOOK FOR (about the CONTACT only, never the user):

Basic identity:
- firstName: the contact's first/given name. Required if you know any part of their name.
- lastName: the contact's last/family name. Empty string if not stated. Don't make one up.
- company: the contact's CURRENT employer (NOT the user's). Only extract if the ` +
    `contact themselves stated or confirmed where they work.
- role: the contact's job title (NOT the user's).
- Priority: priority=true ONLY if explicitly called VIP/important.

Do NOT return a "name" field, a "linkedin" field, "howMet", "howHelp", or "topics". Those are legacy and have been removed from the schema.

Contact info:
- phones: array of {label, value}. Labels: Cell/Work/Home/Other.
- emails: array of {label, value}. Labels: Personal/Work/Other.
- addresses: array of {label, line1, line2, city, state, zip, country}.
- recipientName: only if specified.

Context:
- initialIntroduction: a single short string capturing how the user met the contact, where they were introduced, what context brought them together, and (if mentioned) what they care about talking about. Combine all relationship context into this one field. Examples: "ULI conference, interested in Mountain West multifamily", "Referral from Sarah Chen, looking for LP commitments for fund III", "Cousin's wedding in 2019, works in healthcare consulting". Resolve relative dates: "last week" = ${todayMinusDaysUS(7)}, "yesterday" = ${todayMinusDaysUS(1)}, today is ${today}. Leave empty if nothing relevant.
- tags: relationship category like Friend, Colleague, Mentor, Client, Vendor.

Background (the CONTACT's, never the user's):
- experience: notable career background, education, achievements OF THE CONTACT. ` +
    `Do NOT include the user's career background here, even if the user mentioned ` +
    `it in the conversation.
- pastCompanies: array of {company, role} for the CONTACT's previous jobs. ` +
    `Do NOT include the user's past companies.

Personal (ABOUT THE CONTACT, not the user):
- hometown: where the CONTACT grew up. NOT where the user grew up.
- location: where the CONTACT lives now. NOT where the user lives.
- timezone: ET, CT, MT, PT if stated for the contact.
- birthday: {month, day, year} for the contact. Use null for unknown components.
- married: "married", "single", "divorced", "widowed", about the CONTACT.
- spouseName: CONTACT's spouse name, not the user's spouse.
- anniversary: same {month, day, year} format, for the contact.
- kids: the CONTACT's kids only. NOT the user's kids.
- interests: the CONTACT's hobbies/sports/etc. NOT the user's.

KIDS FORMAT:
Each kid is { name, gender, age, ageMode, ageAsOf, birthday, notes }:
- name, age (string), gender (boy/girl), notes
- ageMode: "age" if number, "birthday" if date
- ageAsOf: if age set, { age: <number>, asOf: "${todayUS()}" }; else null
- birthday: {month,day,year} object or null

QUALITY BAR: Better to leave a field empty than guess. Do not fabricate. ` +
    `If a field would only be populated by attributing the user's statement ` +
    `to the contact, leave it empty.

MEETING SUMMARY (this is critical, replaces the old notes field):
- meetingSummary: a summary of what the CONTACT said, revealed, decided, or ` +
    `committed to during the conversation. This will become a contact-log ` +
    `entry for the contact.
- Pull out concrete details: family THE CONTACT mentioned, deals THE CONTACT ` +
    `discussed, plans THE CONTACT shared, opinions THE CONTACT expressed.
- DO NOT include things the USER said about themselves. If the user said "I ` +
    `just started at ${userCompany || 'AcmeCo'}", that does NOT belong in the ` +
    `contact's meeting summary, even though it happened during the meeting.
- DO include things the contact said about the user's situation if they're ` +
    `relevant to the relationship (e.g. "${userName || 'The user'} offered to ` +
    `introduce her to a real estate broker", that's a commitment between them).
- LEAVE OUT: stuff the user said about themselves, small talk.
- For voice memos (case a) where the user is describing someone they already ` +
    `know rather than recording a conversation, leave meetingSummary empty.
- DO NOT include the verbatim transcript here. This is a summary.

${lengthInstruction}

DO NOT include a "notes" field. Notes are reserved for the user's manual ` +
    `input. AI must not write to notes.

TOUCHPOINT (only for voice memos describing an interaction, NOT for ` +
    `meeting transcripts):
For meeting transcripts (case b above), the caller handles the touchpoint ` +
    `separately. Always return touchpoint: null for meeting transcripts.

For voice memos, return touchpoint = { date, type, text } only if user ` +
    `describes an actual interaction. Otherwise null.
- date: YYYY-MM-DD. Today is ${todayISO()}.
- type: call/email/text/meeting/linkedin/other
- text: 1-2 sentence summary, not the full transcript.`;

  const prompt = `Transcript:\n${transcript}`;

  const dateObjectSchema = {
    type: 'object',
    description: 'Date object. Any unknown component should be null.',
    properties: {
      month: { type: ['integer', 'null'], description: '1-12 or null' },
      day: { type: ['integer', 'null'], description: '1-31 or null' },
      year: { type: ['integer', 'null'], description: 'Four-digit year or null' },
    },
  };

  const tool = {
    name: 'extract_contact',
    description: 'Extract structured contact information from a transcript. Only extract facts about the CONTACT, never about the user.',
    input_schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: "Contact's first/given name." },
        lastName: { type: 'string', description: "Contact's last/family name. Empty string if not stated." },
        company: { type: 'string', description: "Contact's current employer. NOT the user's company. Empty string if the contact never confirmed where they work." },
        role: { type: 'string', description: "Contact's job title. NOT the user's role." },
        priority: { type: 'boolean' },
        phones: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, value: { type: 'string' } },
            required: ['label', 'value'],
          },
        },
        emails: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, value: { type: 'string' } },
            required: ['label', 'value'],
          },
        },
        addresses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              line1: { type: 'string' },
              line2: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              zip: { type: 'string' },
              country: { type: 'string' },
            },
            required: ['label', 'line1', 'line2', 'city', 'state', 'zip', 'country'],
          },
        },
        recipientName: { type: 'string' },
        initialIntroduction: {
          type: 'string',
          description:
            'Single short string combining how the user met the contact, the introduction context, and any topics they care about. Empty string if nothing relevant.',
        },
        meetingSummary: {
          type: 'string',
          description:
            'Summary of what the CONTACT (not the user) said and revealed in the conversation. Length and format are dictated by the LENGTH AND FORMAT block in the system prompt. Empty string if not a conversation transcript.',
        },
        tags: { type: 'array', items: { type: 'string' } },
        experience: { type: 'string', description: "The CONTACT's career background, education, achievements. NOT the user's." },
        pastCompanies: {
          type: 'array',
          description: "The CONTACT's previous jobs. NOT the user's previous jobs.",
          items: {
            type: 'object',
            properties: { company: { type: 'string' }, role: { type: 'string' } },
            required: ['company', 'role'],
          },
        },
        hometown: { type: 'string', description: "Where the CONTACT grew up. NOT where the user grew up." },
        location: { type: 'string', description: "Where the CONTACT currently lives. NOT where the user lives." },
        timezone: { type: 'string' },
        birthday: dateObjectSchema,
        married: { type: 'string', description: "The CONTACT's marital status." },
        spouseName: { type: 'string', description: "The CONTACT's spouse name. NOT the user's spouse." },
        anniversary: dateObjectSchema,
        kids: {
          type: 'array',
          description: "The CONTACT's kids. NOT the user's kids.",
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              gender: { type: 'string', enum: ['boy', 'girl'] },
              age: { type: 'string' },
              ageMode: { type: 'string', enum: ['age', 'birthday'] },
              ageAsOf: {
                type: ['object', 'null'],
                properties: {
                  age: { type: 'number' },
                  asOf: { type: 'string' },
                },
              },
              birthday: dateObjectSchema,
              notes: { type: 'string' },
            },
            required: ['name', 'gender', 'age', 'ageMode', 'birthday', 'notes'],
          },
        },
        interests: { type: 'array', items: { type: 'string' }, description: "The CONTACT's interests. NOT the user's interests." },
        touchpoint: {
          type: ['object', 'null'],
          properties: {
            date: { type: 'string' },
            type: {
              type: 'string',
              enum: ['call', 'email', 'text', 'meeting', 'linkedin', 'other'],
            },
            text: { type: 'string' },
          },
        },
      },
      required: ['firstName', 'lastName', 'meetingSummary'],
    },
  };

  let result;
  try {
    result = await callClaudeWithTool({ system, prompt, tool, max_tokens: 2500 });
  } catch (e) {
    console.error('aiExtractFromVoice tool call failed:', e?.message);
    return { ...EMPTY_VOICE_RESULT };
  }

  const safeArr = (v) => (Array.isArray(v) ? v : []);
  const safeStr = (v) => (typeof v === 'string' ? v : '');
  const safeDateObj = (v) =>
    v && typeof v === 'object'
      ? {
          month: Number.isFinite(v.month) ? v.month : null,
          day: Number.isFinite(v.day) ? v.day : null,
          year: Number.isFinite(v.year) ? v.year : null,
        }
      : null;

  let firstName = safeStr(result.firstName);
  let lastName = safeStr(result.lastName);
  if (!firstName && !lastName && typeof result.name === 'string' && result.name.trim()) {
    const trimmed = result.name.trim();
    const idx = trimmed.indexOf(' ');
    if (idx < 0) {
      firstName = trimmed;
    } else {
      firstName = trimmed.slice(0, idx);
      lastName = trimmed.slice(idx + 1).trim();
    }
  }

  let initialIntroduction = safeStr(result.initialIntroduction);
  if (!initialIntroduction) {
    const legacyParts = [
      safeStr(result.howMet),
      safeStr(result.howHelp),
      safeStr(result.topics),
    ].filter((s) => s && s.trim());
    if (legacyParts.length) initialIntroduction = legacyParts.join(' / ');
  }

  const normalized = {
    firstName,
    lastName,
    company: safeStr(result.company),
    role: safeStr(result.role),
    priority: !!result.priority,
    phones: safeArr(result.phones).map((p) => ({
      label: safeStr(p?.label) || 'Cell',
      value: safeStr(p?.value),
    })),
    emails: safeArr(result.emails).map((e) => ({
      label: safeStr(e?.label) || 'Personal',
      value: safeStr(e?.value),
    })),
    addresses: safeArr(result.addresses).map((a) => ({
      label: safeStr(a?.label) || 'Home',
      line1: safeStr(a?.line1),
      line2: safeStr(a?.line2),
      city: safeStr(a?.city),
      state: safeStr(a?.state),
      zip: safeStr(a?.zip),
      country: safeStr(a?.country),
    })),
    recipientName: safeStr(result.recipientName),
    initialIntroduction,
    meetingSummary: safeStr(result.meetingSummary),
    tags: safeArr(result.tags).map(safeStr).filter(Boolean),
    experience: safeStr(result.experience),
    pastCompanies: safeArr(result.pastCompanies).map((pc) => ({
      company: safeStr(pc?.company),
      role: safeStr(pc?.role),
    })),
    hometown: safeStr(result.hometown),
    location: safeStr(result.location),
    timezone: safeStr(result.timezone),
    birthday: safeDateObj(result.birthday),
    married: safeStr(result.married),
    spouseName: safeStr(result.spouseName),
    anniversary: safeDateObj(result.anniversary),
    kids: safeArr(result.kids).map((k) => ({
      name: safeStr(k?.name),
      gender: k?.gender === 'girl' ? 'girl' : 'boy',
      age: safeStr(k?.age),
      ageMode: k?.ageMode === 'birthday' ? 'birthday' : 'age',
      ageAsOf:
        k?.ageAsOf && typeof k.ageAsOf === 'object' && Number.isFinite(k.ageAsOf.age)
          ? { age: Number(k.ageAsOf.age), asOf: safeStr(k.ageAsOf.asOf) || todayUS() }
          : null,
      birthday: safeDateObj(k?.birthday),
      notes: safeStr(k?.notes),
    })),
    interests: safeArr(result.interests).map(safeStr).filter(Boolean),
    touchpoint: (() => {
      const tp = result.touchpoint;
      if (!tp || typeof tp !== 'object') return null;
      const validTypes = ['call', 'email', 'text', 'meeting', 'linkedin', 'other'];
      const date = safeStr(tp.date);
      const type = validTypes.includes(tp.type) ? tp.type : 'other';
      const text = safeStr(tp.text);
      if (!date || !text) return null;
      return { date, type, text };
    })(),
  };

  return scrubExtractedAgainstMyCard(normalized, myCard);
}

// ---------- aiExtractFromImage ----------

export async function aiExtractFromImage(_base64) {
  return {
    firstName: '',
    lastName: '',
    company: '',
    role: '',
    email: '',
    phone: '',
  };
}

// ---------- aiSuggestOutreaches ----------

export async function aiSuggestOutreaches({ contacts, myCard }) {
  const candidates = (contacts || []).filter((c) => !c.archived);
  if (candidates.length === 0) return [];

  const today = todayUS();

  const contactSummaries = candidates.map((c) => {
    const lastContact = c.lastContacted
      ? `${c.lastContacted} (${daysBetween(c.lastContacted)}d ago)`
      : 'never';
    const recentLog = (c.convLog || [])
      .slice(0, 2)
      .map((e) => `${e.date}: ${(e.text || '').slice(0, 120)}`)
      .join(' | ');
    const bday = formatDateObject(c.birthday);
    const anniv = formatDateObject(c.anniversary);
    const tags = (c.tags || []).join(', ');
    const displayName = [c.firstName, c.lastName]
      .filter((s) => typeof s === 'string' && s.trim())
      .join(' ')
      .trim() || c.name || '';

    return {
      id: c.id,
      name: displayName,
      role: c.role,
      company: c.company,
      tags,
      priority: !!c.priority,
      lastContact,
      freq: c.freq && c.freq !== 'never' ? c.freq : '',
      birthday: bday,
      anniversary: anniv,
      recentLog,
      initialIntroduction: c.initialIntroduction || '',
      howMet: c.howMet || '',
      howHelp: c.howHelp || '',
    };
  });

  let trimmed = contactSummaries;
  if (trimmed.length > 80) {
    trimmed.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (!!a.freq !== !!b.freq) return (b.freq ? 1 : 0) - (a.freq ? 1 : 0);
      return 0;
    });
    trimmed = trimmed.slice(0, 80);
  }

  const userDisplayName = displayNameOf(myCard);
  const userInfo = userDisplayName ? `The user is ${userDisplayName}` +
    (myCard.role ? `, ${myCard.role}` : '') +
    (myCard.company ? ` at ${myCard.company}` : '') + '.' : '';

  const system =
    `You are a relationship intelligence assistant helping the user decide ` +
    `who to reach out to in their professional/personal network right now. ` +
    `${userInfo}

Today's date: ${today}.

CRITICAL QUALITY BAR:
- Return between 2 and 5 suggestions. NEVER pad to hit a quota.
- Each suggestion needs a SPECIFIC, COMPELLING reason.
- Look for genuinely actionable triggers.

For each suggestion provide contactId, reason, urgency, suggestedAction.`;

  const prompt = `Contacts in the network:\n` +
    trimmed
      .map((c) => {
        const parts = [
          `id=${c.id}`,
          `name=${c.name}`,
          c.role && `role=${c.role}`,
          c.company && `company=${c.company}`,
          c.tags && `tags=${c.tags}`,
          c.priority && 'priority=true',
          `lastContact=${c.lastContact}`,
          c.freq && `freq=${c.freq}`,
          c.birthday && `birthday=${c.birthday}`,
          c.anniversary && `anniversary=${c.anniversary}`,
          c.initialIntroduction && `initialIntroduction=${c.initialIntroduction}`,
          c.howMet && `howMet=${c.howMet}`,
          c.howHelp && `howHelp=${c.howHelp}`,
          c.recentLog && `recentLog=${c.recentLog}`,
        ].filter(Boolean);
        return parts.join(' | ');
      })
      .join('\n');

  const tool = {
    name: 'suggest_outreaches',
    description: 'Recommend 2-5 contacts to reach out to.',
    input_schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          items: {
            type: 'object',
            properties: {
              contactId: { type: 'string' },
              reason: { type: 'string' },
              urgency: { type: 'string', enum: ['high', 'medium', 'low'] },
              suggestedAction: { type: 'string' },
            },
            required: ['contactId', 'reason', 'urgency', 'suggestedAction'],
          },
        },
      },
      required: ['suggestions'],
    },
  };

  let result;
  try {
    result = await callClaudeWithTool({ system, prompt, tool, max_tokens: 1500 });
  } catch (e) {
    console.error('aiSuggestOutreaches tool call failed:', e?.message);
    return [];
  }

  const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
  const knownIds = new Set(candidates.map((c) => c.id));
  return suggestions
    .filter((s) => s && knownIds.has(s.contactId))
    .slice(0, 5)
    .map((s) => ({
      contactId: s.contactId,
      reason: typeof s.reason === 'string' ? s.reason.slice(0, 200) : '',
      urgency: ['high', 'medium', 'low'].includes(s.urgency) ? s.urgency : 'medium',
      suggestedAction: typeof s.suggestedAction === 'string' ? s.suggestedAction.slice(0, 200) : '',
    }));
}

// ---------- aiExtractAttendeesFromTranscript ----------

export async function aiExtractAttendeesFromTranscript(rawText, myCard) {
  if (!rawText?.trim()) return [];

  const userName = displayNameOf(myCard);
  const userCompany = (myCard?.company || '').trim();
  const userRole = (myCard?.role || '').trim();

  const userIdLine = userName
    ? `The user (the person USING this CRM, who is one of the speakers in ` +
      `the transcript) is ${userName}` +
      (userRole ? `, ${userRole}` : '') +
      (userCompany ? ` at ${userCompany}` : '') + '. ' +
      `The user is NOT a candidate for the output, exclude them entirely.`
    : `The user is one of the speakers. Try to infer which speaker they ` +
      `aren't, and exclude them from the output.`;

  const system =
    `You read a meeting/conversation transcript and identify the OTHER ` +
    `people who participated (besides the user). The transcript was ` +
    `recorded by the user from a separate device, so the transcript ` +
    `service only labeled the user as an attendee. Your job is to find ` +
    `the rest from the transcript content.

${userIdLine}

WHAT TO RETURN:
For each OTHER speaker in the transcript, return:
  - name: the speaker's full name if mentioned, or first name if that's ` +
    `all the transcript reveals. Empty string only if the speaker is ` +
    `referenced but never named.
  - email: their email if mentioned in the transcript. Empty string ` +
    `otherwise.
  - identifyingContext: one short sentence (under 25 words) with ` +
    `whatever helps identify this person: company, role, where they ` +
    `live, what they're working on, how they know the user. Used as ` +
    `the "suggestion reason" when the user reviews these.

RULES:
- Return ONLY speakers who are NOT the user.
- A speaker must be referenced or identified clearly enough that the ` +
    `user could recognize who they mean. If someone just appears as ` +
    `"Speaker B" with no clues, skip them.
- If the user mentions someone by name who is NOT a speaker (e.g. ` +
    `"my friend Sarah back in Denver"), do NOT include them. Only ` +
    `actual participants in the conversation.
- Better to return fewer high-quality identifications than many guesses.
- If you cannot identify any other speakers with reasonable confidence, ` +
    `return an empty array. Do not invent.
- Never include the user.`;

  const prompt = `Transcript:\n\n${rawText}`;

  const tool = {
    name: 'extract_other_attendees',
    description:
      'Identify the speakers in a transcript who are NOT the user.',
    input_schema: {
      type: 'object',
      properties: {
        attendees: {
          type: 'array',
          description: 'Other speakers identified. Empty array if none.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              identifyingContext: { type: 'string' },
            },
            required: ['name', 'email', 'identifyingContext'],
          },
        },
      },
      required: ['attendees'],
    },
  };

  let result;
  try {
    result = await callClaudeWithTool({ system, prompt, tool, max_tokens: 800 });
  } catch (e) {
    console.error('aiExtractAttendeesFromTranscript failed:', e?.message);
    return [];
  }

  const list = Array.isArray(result?.attendees) ? result.attendees : [];
  const myNameLower = userName.toLowerCase();
  const myEmailsLower = new Set();
  if (myCard?.email) myEmailsLower.add(myCard.email.toLowerCase());
  if (Array.isArray(myCard?.emails)) {
    for (const e of myCard.emails) {
      if (e?.value) myEmailsLower.add(e.value.toLowerCase());
    }
  }

  const seen = new Set();
  const out = [];
  for (const a of list) {
    const name = (a?.name || '').trim();
    const email = (a?.email || '').trim();
    const context = (a?.identifyingContext || '').trim();
    if (!name && !email) continue;
    if (name && myNameLower && name.toLowerCase() === myNameLower) continue;
    if (email && myEmailsLower.has(email.toLowerCase())) continue;
    const key = (email || name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      email,
      identifyingContext: context.slice(0, 200),
    });
  }
  return out;
}