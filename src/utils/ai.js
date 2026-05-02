// AI service stubs - wire these up to your backend later

export async function aiBrief(contact) {
  await new Promise((r) => setTimeout(r, 800));
  return (
    `${contact.name} is a ${contact.role || 'professional'} at ${contact.company || 'their company'}. ` +
    `${contact.howMet ? `You met them at: ${contact.howMet}. ` : ''}` +
    `${contact.tags?.length ? `Categorized as: ${contact.tags.join(', ')}.` : ''}\n\n` +
    `[AI brief generation will appear here once the backend is wired up.]`
  );
}

export async function aiMeetingPrep(contact) {
  await new Promise((r) => setTimeout(r, 1000));
  return (
    `MEETING PREP: ${contact.name}\n\n` +
    `1) RELATIONSHIP CONTEXT\n${contact.howMet || 'Initial contact'}. ` +
    `Last touched: ${contact.lastContacted || 'not yet'}.\n\n` +
    `2) OPEN FOLLOW-UPS\n${contact.notes || 'No open notes.'}\n\n` +
    `3) TALKING POINTS\n- Recent industry news\n- Their current priorities\n- How you can help\n\n` +
    `4) PERSONAL\n${contact.kids?.length ? `Kids: ${contact.kids.map((k) => k.name).join(', ')}.` : ''}` +
    `${contact.interests?.length ? ` Interests: ${contact.interests.join(', ')}.` : ''}\n\n` +
    `[AI prep generation will appear here once the backend is wired up.]`
  );
}

export async function aiBackground(contact) {
  await new Promise((r) => setTimeout(r, 1200));
  return (
    `BACKGROUND BRIEF: ${contact.name}\n\n` +
    `1) PROFESSIONAL BACKGROUND\nTypical career path for a ${contact.role || 'professional'}.\n\n` +
    `2) COMPANY OVERVIEW\n${contact.company || 'Their company'}: research pending.\n\n` +
    `3) INDUSTRY CONTEXT\nRelevant trends in their sector.\n\n` +
    `4) CONVERSATION ANGLES\n- Industry-specific topics\n- Company news\n- Mutual interests\n\n` +
    `5) POTENTIAL SYNERGIES\nLook for overlap with your work.\n\n` +
    `[AI research will appear here once the backend is wired up.]`
  );
}

export async function aiTemplate(contact, type) {
  await new Promise((r) => setTimeout(r, 800));
  const templates = {
    cold: `Subject: Quick question about ${contact.company || 'your work'}\n\nHi ${contact.name?.split(' ')[0] || 'there'},\n\n[Cold outreach template will be generated here.]`,
    followup: `Subject: Following up\n\nHi ${contact.name?.split(' ')[0] || 'there'},\n\nThanks for the conversation. [Follow-up template will be generated here.]`,
    checkin: `Subject: Quick hello\n\nHi ${contact.name?.split(' ')[0] || 'there'},\n\n[Check-in template will be generated here.]`,
    intro_req: `Subject: A quick favor\n\nHi ${contact.name?.split(' ')[0] || 'there'},\n\n[Intro request template will be generated here.]`,
    share: `Subject: Thought you'd find this interesting\n\nHi ${contact.name?.split(' ')[0] || 'there'},\n\n[Value share template will be generated here.]`,
  };
  return templates[type] || 'Template generation pending backend setup.';
}

export async function aiExtractFromVoice(transcript) {
  await new Promise((r) => setTimeout(r, 1000));
  // Very simple heuristic stub - real version uses LLM extraction
  const result = { name: '', company: '', role: '', email: '', phone: '', howMet: '', notes: transcript };
  const emailMatch = transcript.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) result.email = emailMatch[0];
  const phoneMatch = transcript.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (phoneMatch) result.phone = phoneMatch[0];
  // Try to grab "Met X at Y"
  const metMatch = transcript.match(/met\s+([\w\s]+?)\s+at\s+(.+?)(?:[.,]|$)/i);
  if (metMatch) {
    result.name = metMatch[1].trim();
    result.howMet = metMatch[2].trim();
  }
  return result;
}

export async function aiExtractFromImage(base64) {
  await new Promise((r) => setTimeout(r, 1200));
  return {
    name: '',
    company: '',
    role: '',
    email: '',
    phone: '',
    notes: '[Card scan extraction will be wired up to a vision model.]',
  };
}
