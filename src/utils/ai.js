// AI service. Calls the `claude` Supabase Edge Function which proxies
// to the Anthropic API. The Edge Function holds the API key.

import { supabase } from '../lib/supabase';

// ---------- Core caller ----------

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

// ---------- Date helpers ----------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function summarizeContact(c) {
  if (!c) return '';
  const lines = [];
  const today = todayISO();
  lines.push(`Today's date: ${today}`);
  lines.push('');

  lines.push(`Name: ${c.name || '(unknown)'}`);
  if (c.role || c.company) {
    lines.push(`Role: ${[c.role, c.company].filter(Boolean).join(' at ')}`);
  }

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

// ---------- aiExtractMeetingNote ----------
//
// Take pasted raw meeting content (Granola export, Otter transcript,
// Zoom AI summary, generic notes, etc.) and produce a clean, focused
// log entry from the perspective of one specific contact.
//
// The output is the body text of a single conversation log entry.
// Returns a string. The caller wraps it in a convLog entry with date
// and type.

export async function aiExtractMeetingNote(contact, rawText) {
  if (!rawText?.trim()) {
    throw new Error('No text provided');
  }
  const summary = summarizeContact(contact);
  const system =
    `You extract a clean, focused meeting log entry from raw meeting ` +
    `notes. The notes might come from Granola, Otter, Fireflies, Zoom ` +
    `AI Companion, an email summary, or just typed text. They might ` +
    `cover a 1-on-1 or a multi-person meeting. Your job is to capture ` +
    `what's relevant ABOUT THIS SPECIFIC CONTACT.

WHO THIS IS FOR:
The user is logging this conversation against ONE contact in their ` +
    `personal CRM. The contact is named in the summary. If the meeting ` +
    `had multiple people, focus on this contact's contributions, ` +
    `requests, life details mentioned, etc. Filter out anything ` +
    `irrelevant to this contact.

WHAT TO CAPTURE:
- What was discussed that involves this contact
- Anything THEY said about their life, family, work, health, ` +
    `interests, plans, vacations, food preferences, etc.
- Open threads or follow-ups: things they want from you, things you ` +
    `said you'd send, things either of you mentioned would happen ` +
    `next ("we'll close on the deal next month", "I'll introduce you ` +
    `to my friend in Denver")
- Decisions made, opinions expressed, news shared

WHAT TO LEAVE OUT:
- Filler, small talk, "how are you" pleasantries
- Stuff said by other meeting attendees that doesn't involve this contact
- Verbatim transcript style. Compress everything into prose.

STYLE:
- Plain prose. NOT bullets. Run-on log style is fine.
- 3-8 sentences. Tight.
- Past tense. Third person about the contact ("Marcus mentioned...", "He said...").
- Pull out specific concrete details when they exist. If they ` +
    `mentioned their daughter starting at Brown next year, write ` +
    `that. If they mentioned closing on a deal next month, write that.
- Don't interpret or coach. Don't add follow-up suggestions. Just ` +
    `record what happened.

NO PREAMBLE. NO HEADERS. Just the log body text.

${HONESTY_RULES}`;
  const prompt =
    `Contact this log entry is for:\n\n${summary}\n\n` +
    `Raw meeting content:\n\n${rawText}\n\n` +
    `Extract a clean log entry focused on what's relevant to this contact.`;
  return callClaude({ system, prompt, max_tokens: 600 });
}

// ---------- aiSuggestContactsForAttendee ----------
//
// Given an unmatched Granola attendee + meeting context + the user's
// contact list, ask Claude to guess which contact (if any) this
// attendee might be. Returns up to 3 ranked suggestions.
//
// Returns an array: [{ contactId, confidence: 'high'|'medium'|'low', reason }]
// May return [] if Claude can't make any reasonable guess.
//
// Trimmed contact format: only id/name/company/role/recent-topic to
// keep token cost down. Even with 500 contacts this stays cheap.

export async function aiSuggestContactsForAttendee({ attendee, meetingTitle, meetingDate, transcriptSnippet, contacts }) {
  if (!attendee) return [];
  const candidates = (contacts || []).filter((c) => !c.archived);
  if (candidates.length === 0) return [];

  // Build a compact contact roster. Keep it under ~100 candidates to
  // control token usage; Claude can still narrow even from a small set.
  const trimmed = candidates.slice(0, 200).map((c) => {
    const lastTopic = c.convLog?.[0]?.text
      ? c.convLog[0].text.slice(0, 100).replace(/\s+/g, ' ')
      : '';
    return {
      id: c.id,
      name: c.name || '',
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
- Output ONLY valid JSON. No commentary, no markdown fences.
- Format: an array of up to 3 objects, ranked best first. Each ` +
    `object: { "contactId": "...", "confidence": "high"|"medium"|"low", "reason": "..." }
- If no contact is a plausible match, return an empty array: []
- "reason" should be ONE short sentence (under 15 words) that names ` +
    `the specific evidence. e.g. "First name matches, both work in ` +
    `commercial real estate." or "Mentioned by name in transcript."
- Use ONLY the contactId values exactly as listed in the candidates. ` +
    `Do not invent IDs.
- Confidence: "high" = name + corroborating context (industry, ` +
    `mutual topic, prior log entry). "medium" = name match alone or ` +
    `weak corroboration. "low" = thin guess.
- Do NOT include the user themselves. Do NOT include archived contacts ` +
    `(they aren't in the candidates list).
- A bare first-name match alone is "medium" at best, never "high".`;

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
      .join('\n') +
    `\n\nReturn JSON only, an array of up to 3 ranked guesses (or [] if none).`;

  const text = await callClaude({ system, prompt, max_tokens: 500 });
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    // Validate each entry; drop anything pointing at an unknown contact.
    const knownIds = new Set(candidates.map((c) => c.id));
    return parsed
      .filter((s) => s && knownIds.has(s.contactId))
      .slice(0, 3)
      .map((s) => ({
        contactId: s.contactId,
        confidence: ['high', 'medium', 'low'].includes(s.confidence)
          ? s.confidence
          : 'low',
        reason: typeof s.reason === 'string' ? s.reason.slice(0, 200) : '',
      }));
  } catch (e) {
    console.error('aiSuggestContactsForAttendee parse error:', e, 'raw:', text);
    return [];
  }
}

// ---------- aiSummarizeMeetingForReview ----------
//
// For the review queue. Generates a contact-agnostic summary of a meeting
// transcript so the user can decide which of their contacts (if any) the
// unmatched attendees correspond to. Different from aiExtractMeetingNote
// which is targeted at one specific contact.
//
// Truncates input to ~3000 chars before sending. Real meeting transcripts
// can be 10K-30K tokens, but the first chunk + a middle slice is enough to
// identify speakers. This is the main cost lever — without it, each call
// costs ~$0.03; with it, ~$0.005.

function trimForMeetingSummary(rawText) {
  if (!rawText) return '';
  const max = 3000; // chars, roughly 750 tokens
  if (rawText.length <= max) return rawText;
  const headLen = Math.floor(max * 0.7);
  const tailLen = max - headLen;
  const head = rawText.slice(0, headLen);
  const tail = rawText.slice(rawText.length - tailLen);
  return head + '\n\n[...transcript truncated...]\n\n' + tail;
}

export async function aiSummarizeMeetingForReview(rawText) {
  if (!rawText?.trim()) {
    throw new Error('No text provided');
  }
  const trimmed = trimForMeetingSummary(rawText);
  const system =
    `You write a 2-3 sentence summary of a meeting transcript so someone ` +
    `can identify which of their CRM contacts is in it.

HARD RULES:
- Maximum 3 sentences. Never more.
- Around 50-70 words total. Tight.
- Lead with: who's in the meeting (names + key identifying detail like ` +
    `company or role).
- Then: what they discussed in one short clause.
- Skip: biographical history, life backgrounds, deep career arcs, ` +
    `relationship dynamics, what either party "is seeking", future plans, ` +
    `inferences about networks or alma maters unless it's the single most ` +
    `defining fact.
- Names and companies only. No fluff.
- If a speaker has no name (just "Speaker A"), say so. Don't invent.

EXAMPLE GOOD OUTPUT:
"Lucas (Utah Housing Preservation Fund) and Dallin (West 77 Partners, ` +
    `extended-stay hotels) caught up after both moving to Lehi. Discussed ` +
    `their respective work in affordable housing and hotel development."

EXAMPLE BAD OUTPUT (too long, too biographical):
"Two BYU finance alumni connected after relocating to Lehi. Lucas grew ` +
    `up in Houston, served an LDS mission in Rome, and currently runs the ` +
    `Utah Housing Preservation Fund where he focuses on multifamily ` +
    `acquisitions of affordable housing..." (this is wrong — too much ` +
    `backstory)

NO HEADERS. NO BULLETS. NO PREAMBLE like "This meeting was about". ` +
    `Just the summary.

${HONESTY_RULES}`;
  const prompt =
    `Meeting transcript:\n\n${trimmed}\n\n` +
    `Write a 2-3 sentence summary. Names + companies + one-clause topic. Stop.`;
  return callClaude({ system, prompt, max_tokens: 150 });
}

// ---------- aiExtractFromVoice ----------

export async function aiExtractFromVoice(transcript) {
  if (!transcript?.trim()) {
    return { name: '', company: '', role: '', email: '', phone: '', howMet: '', notes: '' };
  }
  const system =
    `You extract structured contact information from voice transcripts. ` +
    `Output only valid JSON. No commentary, no markdown fences. Keys: ` +
    `name, company, role, email, phone, howMet, notes. Use empty ` +
    `string "" for any field that cannot be inferred. The notes field ` +
    `should hold the original transcript verbatim.`;
  const prompt = `Transcript:\n${transcript}\n\nReturn JSON only.`;
  const text = await callClaude({ system, prompt, max_tokens: 600 });

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      name: parsed.name || '',
      company: parsed.company || '',
      role: parsed.role || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      howMet: parsed.howMet || '',
      notes: parsed.notes || transcript,
    };
  } catch (e) {
    console.error('aiExtractFromVoice parse error:', e, 'raw:', text);
    return { name: '', company: '', role: '', email: '', phone: '', howMet: '', notes: transcript };
  }
}

// ---------- aiExtractFromImage ----------

export async function aiExtractFromImage(_base64) {
  return {
    name: '',
    company: '',
    role: '',
    email: '',
    phone: '',
    notes: '[Card scan extraction not yet wired up.]',
  };
}