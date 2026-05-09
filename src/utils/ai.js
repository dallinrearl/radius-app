// AI service. Calls the `claude` Supabase Edge Function which proxies
// to the Anthropic API. The Edge Function holds the API key.

import { supabase } from '../lib/supabase';

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
// already parsed — no JSON.parse, no markdown stripping, no fallbacks.
//
// `tool` shape:
//   {
//     name: 'extract_contact',
//     description: 'Extract structured contact info',
//     input_schema: {
//       type: 'object',
//       properties: { name: { type: 'string' }, ... },
//       required: ['name']
//     }
//   }
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
    // Should not happen when tool_choice forces a tool, but guard anyway.
    console.warn('callClaudeWithTool: no tool_input in response, falling back', data);
    throw new Error('AI did not return structured data');
  }
  return data.tool_input;
}

// ---------- Date helpers ----------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Returns an ISO date string for N days before today. Used internally.
function todayMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Returns a US-style MM/DD/YYYY string for N days before today.
// Used in prompts where Claude generates human-facing copy. Reading "last
// week (5/2/2026)" feels natural; "last week (2026-05-02)" reads like a log.
function todayMinusDaysUS(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  return m + '/' + day + '/' + y;
}

// Today as MM/DD/YYYY.
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
- Use ONLY the contactId values exactly as listed in the candidates. ` +
    `Do not invent IDs.
- If no contact is a plausible match, return an empty suggestions array.
- "reason" should be ONE short sentence (under 15 words) that names ` +
    `the specific evidence. e.g. "First name matches, both work in ` +
    `commercial real estate." or "Mentioned by name in transcript."
- Confidence: "high" = name + corroborating context (industry, ` +
    `mutual topic, prior log entry). "medium" = name match alone or ` +
    `weak corroboration. "low" = thin guess.
- Do NOT include the user themselves. Do NOT include archived contacts ` +
    `(they aren't in the candidates list).
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

  // Tool schema forces Claude to return data in this exact shape.
  // No JSON.parse, no markdown stripping, no fallback prose handling.
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
              contactId: {
                type: 'string',
                description: 'Exact contactId from the candidates list. Do not invent.',
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'How confident this match is.',
              },
              reason: {
                type: 'string',
                description: 'One short sentence (under 15 words) naming specific evidence.',
              },
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
  // Validate against known IDs and clamp.
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
//
// For the review queue. Generates a summary focused on the OTHER attendees
// (not the user) so the user can decide which of their CRM contacts the
// unmatched attendees correspond to.
//
// Truncates input to ~3000 chars before sending. Real meeting transcripts
// can be 10K-30K tokens, but the first chunk + a tail slice is enough to
// identify speakers. Main cost lever — without truncation each call is
// ~$0.03; with it, ~$0.005.

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

export async function aiSummarizeMeetingForReview(rawText, userInfo = {}) {
  if (!rawText?.trim()) {
    throw new Error('No text provided');
  }
  const trimmed = trimForMeetingSummary(rawText);

  const userName = (userInfo.name || '').trim();
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
- For each non-user speaker: name + company + role/context + anything ` +
    `identifying (location, what they do, who they know, what they're ` +
    `working on).
- Skip: anything about the user, biographical histories, career arcs ` +
    `going back years, who introduced whom, relationship dynamics.
- If a non-user speaker has no name (just "Speaker B" etc), say so. ` +
    `Don't invent.

EXAMPLE GOOD OUTPUT:
"Lane: Bank of Utah, commercial lending, ~1 year tenure. Interested in ` +
    `lending partnership for extended-stay hotel deals."

EXAMPLE BAD OUTPUT (mentions the user):
"Dallin (West 77 Partners) met with Lane (Bank of Utah, commercial ` +
    `lending) to explore a lending partnership..." (this is wrong — ` +
    `the user is Dallin, his info is irrelevant to him)

EXAMPLE BAD OUTPUT (too long, biographical):
"Lane has been at Bank of Utah for about a year, prior to which he ` +
    `worked at Wells Fargo. He grew up in Idaho..." (this is wrong — ` +
    `extra biographical fluff that doesn't help identify them)

NO HEADERS. NO BULLETS. NO PREAMBLE. Just the focused identification.

${HONESTY_RULES}`;
  const prompt =
    `Meeting transcript:\n\n${trimmed}\n\n` +
    `Summarize the OTHER attendees in 1-3 sentences. Skip the user. ` +
    `Names + identifying details only.`;
  return callClaude({ system, prompt, max_tokens: 150 });
}

// ---------- aiExtractFromVoice ----------

export async function aiExtractFromVoice(transcript) {
  if (!transcript?.trim()) {
    return { name: '', company: '', role: '', email: '', phone: '', howMet: '', notes: '' };
  }

  const today = todayUS();
  const system =
    `You extract structured contact information from voice transcripts ` +
    `where the user is dictating a new contact. Pull out every field the ` +
    `transcript mentions. Use an empty string "" for any field the ` +
    `transcript does not specify. The 'notes' field should be the ` +
    `original transcript verbatim, since the user may want to keep the ` +
    `full source for reference.

DATE HANDLING:
- Today's date is ${today} (US format MM/DD/YYYY).
- If the transcript uses relative phrases like "yesterday", "last week", ` +
    `"a few months ago", "this morning", resolve them in the howMet ` +
    `field to an approximate absolute date in MM/DD/YYYY format. ` +
    `Examples: "last week" → "around ${todayMinusDaysUS(7)}", ` +
    `"yesterday" → "yesterday (${todayMinusDaysUS(1)})", ` +
    `"a few months ago" → "around ${todayMinusDaysUS(90)}".
- ALWAYS use MM/DD/YYYY format. Never use YYYY-MM-DD or any other ` +
    `format. Do not lead with the year.
- Keep the natural wording but anchor it with the date so the note ` +
    `still reads naturally six months from now.
- If no time reference is given, just describe the location/context.`;
  const prompt = `Transcript:\n${transcript}`;

  const tool = {
    name: 'extract_contact',
    description: 'Extract structured contact information from a voice transcript.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "The contact's full name. Empty string if not mentioned." },
        company: { type: 'string', description: "The company name. Empty string if not mentioned." },
        role: { type: 'string', description: "Job title or role. Empty string if not mentioned." },
        email: { type: 'string', description: "Email address. Empty string if not mentioned." },
        phone: { type: 'string', description: "Phone number. Empty string if not mentioned." },
        howMet: { type: 'string', description: "Where/how the user met this person. Empty string if not mentioned." },
        notes: { type: 'string', description: "The original transcript verbatim." },
      },
      required: ['name', 'company', 'role', 'email', 'phone', 'howMet', 'notes'],
    },
  };

  let result;
  try {
    result = await callClaudeWithTool({ system, prompt, tool, max_tokens: 600 });
  } catch (e) {
    console.error('aiExtractFromVoice tool call failed:', e?.message);
    return { name: '', company: '', role: '', email: '', phone: '', howMet: '', notes: transcript };
  }

  return {
    name: result.name || '',
    company: result.company || '',
    role: result.role || '',
    email: result.email || '',
    phone: result.phone || '',
    howMet: result.howMet || '',
    notes: result.notes || transcript,
  };
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