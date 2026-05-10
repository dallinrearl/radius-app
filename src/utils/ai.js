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
//
// Extract every field a user might mention in a voice transcript. The schema
// matches the contact form's data model exactly (see ContactForm.js):
//   - phones/emails as arrays of {label, value}
//   - addresses as full objects with label/line1/line2/city/state/zip/country
//   - birthday/anniversary as {month, day, year} objects
//   - kids as full objects matching the form's KidRow shape
//
// Anything the form has, the AI knows to look for. Empty values (string ""
// or array []) are returned for anything not mentioned. The caller spreads
// the result into EMPTY_CONTACT, so missing keys won't clobber form defaults.

const EMPTY_VOICE_RESULT = {
  name: '',
  company: '',
  role: '',
  priority: false,
  phones: [],
  emails: [],
  linkedin: '',
  addresses: [],
  recipientName: '',
  howMet: '',
  howHelp: '',
  topics: '',
  notes: '',
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
  // Touchpoint: only set if the transcript describes an actual interaction
  // (met, called, emailed, etc). Null for pure background-info dictations.
  touchpoint: null,
};

export async function aiExtractFromVoice(transcript) {
  if (!transcript?.trim()) {
    return { ...EMPTY_VOICE_RESULT };
  }

  const today = todayUS();
  const system =
    `You extract structured contact information from voice transcripts where ` +
    `the user is dictating notes about a person they know. Pull EVERY field ` +
    `the transcript mentions. Use empty string "", empty array [], false, ` +
    `or null for fields the transcript does not specify. Do not invent or ` +
    `infer details not clearly stated. The 'notes' field MUST be the original ` +
    `transcript verbatim so the user keeps the full source for reference.

WHAT TO LOOK FOR:

Basic: name, company name, job title (role), LinkedIn handle/URL.
Priority: set priority=true ONLY if user explicitly calls them VIP, ` +
    `important, top priority, etc.

Contact info:
- phones: array of {label, value}. Labels: "Cell", "Work", "Home", or any ` +
    `phrase the user says ("his cell", "office line"). Format value as ` +
    `(XXX) XXX-XXXX if possible.
- emails: array of {label, value}. Labels: "Personal", "Work", or what ` +
    `user says.
- addresses: array of full address objects with {label, line1, line2, city, ` +
    `state, zip, country}. Label like "Home", "Work", "Beach House".
- recipientName: only if user specifies a different name for mail (e.g. ` +
    `"send mail to The Smith Family").

Context:
- howMet: where/how they met. Resolve relative dates ("yesterday", ` +
    `"last week") to MM/DD/YYYY. Today is ${today}.
  Examples: "last week" → "around ${todayMinusDaysUS(7)}", ` +
    `"yesterday" → "yesterday (${todayMinusDaysUS(1)})", ` +
    `"a few months ago" → "around ${todayMinusDaysUS(90)}".
  ALWAYS use MM/DD/YYYY. Never lead with year.
- howHelp: things the user can do for this person.
- topics: subjects they care about discussing, comma-separated.
- tags: relationship category like Friend, Colleague, Mentor, Client, ` +
    `Vendor, Advisor. Title case. Pick what fits.

Background & Experience:
- experience: notable career background, education, achievements.
- pastCompanies: array of {company, role} for previous jobs.

Personal:
- hometown: where they grew up / are from.
- location: where they live now.
- timezone: ET, CT, MT, PT if explicitly stated.
- birthday: {month, day, year} object. Use null for unknown components. ` +
    `Examples: "born March 15" → {month: 3, day: 15, year: null}. ` +
    `"born 1985" → {month: null, day: null, year: 1985}.
- married: "married", "single", "divorced", "widowed". Lowercase. Empty ` +
    `string if unknown.
- spouseName: spouse/partner first name (or full name) if mentioned.
- anniversary: same {month, day, year} format as birthday.
- kids: array of full kid objects (see KIDS FORMAT below).
- interests: hobbies, sports, things they like to do. Title case where ` +
    `natural ("Rock Climbing", "Cooking").

KIDS FORMAT:
Each kid is { name, gender, age, ageMode, ageAsOf, birthday, notes }:
- name: child's name if mentioned, "" otherwise
- gender: "boy" or "girl" if mentioned, "boy" as default if unspecified
- age: numeric age as string ("5", "2.5"), "" if not mentioned
- ageMode: "age" if user said an age number, "birthday" if user gave a date
- ageAsOf: if age is set, use { age: <number>, asOf: "${todayUS()}" }; else null
- birthday: same {month,day,year} object as parent's birthday, or null
- notes: any specific details about the child, "" otherwise

IMPORTANT EXAMPLES:
- "his wife Sarah and their two kids, Tommy who's 5 and a baby girl" →
  married="married", spouseName="Sarah",
  kids=[
    {name:"Tommy", gender:"boy", age:"5", ageMode:"age", ageAsOf:{age:5,asOf:"${todayUS()}"}, birthday:null, notes:""},
    {name:"", gender:"girl", age:"", ageMode:"age", ageAsOf:null, birthday:null, notes:"baby"}
  ]
- "from Chicago, lives in Denver" → hometown="Chicago", location="Denver"
- "she's a VIP" → priority=true
- "loves rock climbing and Italian food" → interests=["Rock Climbing", "Italian Food"]

QUALITY BAR: Better to leave a field empty than guess. Do not fabricate.

TOUCHPOINT (separate from notes):
A "touchpoint" is a logged interaction with this person. Set the touchpoint ` +
    `field ONLY IF the transcript describes an actual interaction the user ` +
    `had with them. Background descriptions ("she's a VP at Blackrock, lives ` +
    `in Austin, has two kids") are NOT touchpoints — return null.

If a touchpoint exists, return:
  { date, type, text }
- date: YYYY-MM-DD format. Today is ${todayISO()}. Resolve relative ` +
    `phrases ("yesterday", "last Tuesday", "two weeks ago") to absolute dates.
- type: one of "call", "email", "text", "meeting", "linkedin", "other".
  Detect from the verb in the transcript:
    - "met", "saw", "ran into", "had coffee", "lunch", "in person" → "meeting"
    - "called", "spoke with", "phone call" → "call"
    - "emailed", "sent an email", "got an email from" → "email"
    - "texted", "DM'd via SMS" → "text"
    - "messaged on LinkedIn", "LinkedIn DM" → "linkedin"
    - anything else (DM on other platform, voice memo, etc.) → "other"
- text: a clean ~1-2 sentence summary of WHAT was discussed or what happened. ` +
    `NOT the full transcript. Just the substance of the interaction. Strip ` +
    `the background facts (which go to other fields) and keep only what ` +
    `would be useful for the user to remember about this specific touchpoint.

EXAMPLES:
- "Met John yesterday at the conference. He's a VP at Blackrock and lives ` +
    `in Austin." →
  touchpoint = { date: "${todayMinusDays(1)}", type: "meeting", ` +
    `text: "Met at the conference." }
  (and company/role/location go to their respective fields)
- "John is a VP at Blackrock, lives in Austin, married to Sarah." → 
  touchpoint = null (no interaction described)
- "Called Maria last Tuesday about the Q3 deck. She wants more detail on ` +
    `the assumptions." →
  touchpoint = { date: <last Tuesday>, type: "call", text: "Discussed the ` +
    `Q3 deck. She wants more detail on the assumptions." }`;

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
    description: 'Extract structured contact information from a voice transcript.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        company: { type: 'string' },
        role: { type: 'string' },
        priority: { type: 'boolean', description: 'True only if user marks them VIP/priority.' },
        phones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['label', 'value'],
          },
        },
        emails: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['label', 'value'],
          },
        },
        linkedin: { type: 'string' },
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
        howMet: { type: 'string' },
        howHelp: { type: 'string' },
        topics: { type: 'string' },
        notes: { type: 'string', description: 'Original transcript verbatim.' },
        tags: { type: 'array', items: { type: 'string' } },
        experience: { type: 'string' },
        pastCompanies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              company: { type: 'string' },
              role: { type: 'string' },
            },
            required: ['company', 'role'],
          },
        },
        hometown: { type: 'string' },
        location: { type: 'string' },
        timezone: { type: 'string' },
        birthday: dateObjectSchema,
        married: { type: 'string' },
        spouseName: { type: 'string' },
        anniversary: dateObjectSchema,
        kids: {
          type: 'array',
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
                  asOf: { type: 'string', description: 'YYYY-MM-DD' },
                },
              },
              birthday: dateObjectSchema,
              notes: { type: 'string' },
            },
            required: ['name', 'gender', 'age', 'ageMode', 'birthday', 'notes'],
          },
        },
        interests: { type: 'array', items: { type: 'string' } },
        touchpoint: {
          type: ['object', 'null'],
          description:
            'Set ONLY if transcript describes an actual interaction (met, called, etc). Null for pure background-info dictations.',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD format.' },
            type: {
              type: 'string',
              enum: ['call', 'email', 'text', 'meeting', 'linkedin', 'other'],
            },
            text: {
              type: 'string',
              description: 'Brief 1-2 sentence summary of the interaction.',
            },
          },
        },
      },
      required: ['name', 'notes'],
    },
  };

  let result;
  try {
    result = await callClaudeWithTool({ system, prompt, tool, max_tokens: 2500 });
  } catch (e) {
    console.error('aiExtractFromVoice tool call failed:', e?.message);
    return { ...EMPTY_VOICE_RESULT, notes: transcript };
  }

  // Normalize the result against the empty template — anything Claude
  // didn't return falls back to the empty default. Arrays/objects are
  // checked for shape before being passed through so the form doesn't
  // choke on missing fields.
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

  return {
    name: safeStr(result.name),
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
    linkedin: safeStr(result.linkedin),
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
    howMet: safeStr(result.howMet),
    howHelp: safeStr(result.howHelp),
    topics: safeStr(result.topics),
    notes: safeStr(result.notes) || transcript,
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
    // Touchpoint: only kept if Claude returned all three required fields
    // and type is a valid TOUCH_TYPES value. Otherwise null. The caller
    // checks for null before adding to convLog.
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

// ---------- aiSuggestOutreaches ----------
//
// Looks at the user's whole contact list and surfaces 2-5 people the user
// should reach out to right now, each with a strong "why now" reason.
// Used by Next Up's AI mode.
//
// Quality bar: better to return 2 strong picks than 5 mediocre ones. The
// prompt explicitly tells Claude to skip rather than fill quota.
//
// Returns an array of:
//   { contactId, reason, urgency: 'high'|'medium'|'low', suggestedAction }

export async function aiSuggestOutreaches({ contacts, myCard }) {
  // Filter out archived and contacts with no useful signal
  const candidates = (contacts || []).filter((c) => !c.archived);
  if (candidates.length === 0) return [];

  const today = todayUS();

  // Build a compact representation of each contact. Send only signals
  // relevant to "should I reach out": last contact date, frequency, tags,
  // priority, recent log topics, upcoming dates.
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

    return {
      id: c.id,
      name: c.name,
      role: c.role,
      company: c.company,
      tags,
      priority: !!c.priority,
      lastContact,
      freq: c.freq && c.freq !== 'never' ? c.freq : '',
      birthday: bday,
      anniversary: anniv,
      recentLog,
      howMet: c.howMet || '',
      howHelp: c.howHelp || '',
    };
  });

  // To stay under token limits and keep costs down, cap the candidate list
  // at 80 contacts. If user has more, prioritize by signal.
  let trimmed = contactSummaries;
  if (trimmed.length > 80) {
    trimmed.sort((a, b) => {
      // Priority contacts first, then those with frequency set, then by
      // last contact date (oldest first as those need more attention).
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (!!a.freq !== !!b.freq) return (b.freq ? 1 : 0) - (a.freq ? 1 : 0);
      return 0;
    });
    trimmed = trimmed.slice(0, 80);
  }

  const userInfo = myCard?.name ? `The user is ${myCard.name}` +
    (myCard.role ? `, ${myCard.role}` : '') +
    (myCard.company ? ` at ${myCard.company}` : '') + '.' : '';

  const system =
    `You are a relationship intelligence assistant helping the user decide ` +
    `who to reach out to in their professional/personal network right now. ` +
    `${userInfo}

Today's date: ${today}.

CRITICAL QUALITY BAR:
- Return between 2 and 5 suggestions. NEVER pad to hit a quota.
- 2 strong suggestions > 5 weak ones. Prefer fewer if signals are thin.
- Each suggestion needs a SPECIFIC, COMPELLING reason — not generic ("haven't talked in a while").
- Look for genuinely actionable triggers:
  * Stagnation on a high-priority relationship (priority + long gap)
  * Upcoming birthday/anniversary within ~10 days
  * Recent log entry mentioning a future follow-up ("send slides", "circle back next week")
  * Frequency overdue by 50%+ for someone marked priority
  * Patterns that suggest the relationship is slipping
- DO NOT suggest someone just because the frequency clock says they're due — that's covered by the manual mode already.
- DO NOT suggest someone with very thin context (no log, no priority, no upcoming dates).

For each suggestion provide:
- contactId: exact id from the candidates list
- reason: ONE sentence (under 25 words) naming the specific evidence and why now matters. Cite specifics from their data.
- urgency: 'high' (act this week), 'medium' (next 1-2 weeks), 'low' (when convenient)
- suggestedAction: ONE short sentence with a concrete next step (e.g. "Send a quick congratulations on the new role" or "Share the article you mentioned in your last call")

Tone for reason and suggestedAction: warm, specific, like advice from a thoughtful friend who knows the relationship. Not salesy, not generic.`;

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
          c.howMet && `howMet=${c.howMet}`,
          c.howHelp && `howHelp=${c.howHelp}`,
          c.recentLog && `recentLog=${c.recentLog}`,
        ].filter(Boolean);
        return parts.join(' | ');
      })
      .join('\n');

  const tool = {
    name: 'suggest_outreaches',
    description: 'Recommend 2-5 contacts to reach out to with specific, evidence-based reasons.',
    input_schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          description: '2-5 ranked outreach suggestions. Empty acceptable only if zero compelling triggers.',
          items: {
            type: 'object',
            properties: {
              contactId: {
                type: 'string',
                description: 'Exact id from the candidates list. Do not invent.',
              },
              reason: {
                type: 'string',
                description: 'One specific sentence (under 25 words) citing evidence and why now.',
              },
              urgency: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
              },
              suggestedAction: {
                type: 'string',
                description: 'One short sentence with a concrete next step.',
              },
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