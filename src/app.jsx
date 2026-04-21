const { useState, useMemo, useEffect, useCallback } = React;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION: Paste your Google Apps Script URL and API key here
// See Google_Apps_Script_Backend.js for setup instructions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BACKEND_URL = 'https://script.google.com/a/macros/animalcharityevaluators.org/s/AKfycbyC2zpOSmnHckOtoGhf8PF0jvbFDB7laFEAj_AikozyzBFfWOfCPQhTusN9fZtM9nSqUw/exec';
const API_KEY = '__API_KEY__';  // Must match the API_KEY in your Apps Script
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Input validation limits (matches backend)
const MAX_LENGTHS = {title:200, author:100, description:500, content:20000, tips:2000, whatWorked:2000, whatDidnt:2000, colleagueNotes:5000};

function escapeHtml(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function inlineMd(t){t=escapeHtml(t);t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");t=t.replace(/\*([^*]+?)\*/g,"<em>$1</em>");t=t.replace(/`([^`]+?)`/g,"<code class=\"md-code\">$1</code>");return t;}
function parseTags(t) {
  function clean(arr) {
    return arr.map(function(x){ return String(x).replace(/[\[\]"]/g, "").trim(); }).filter(Boolean);
  }
  if (Array.isArray(t)) {
    var joined = t.map(String).join(",").trim();
    if (joined.charAt(0) === "[") {
      try { var p = JSON.parse(joined); if (Array.isArray(p)) return p.map(String); } catch(e) {}
    }
    return clean(t);
  }
  if (typeof t === "string") {
    var s = t.trim();
    if (!s) return [];
    if (s.charAt(0) === "[") {
      try { var p2 = JSON.parse(s); if (Array.isArray(p2)) return p2.map(String); } catch(e) {}
    }
    return clean(s.split(","));
  }
  return [];
}
if (typeof window !== "undefined" && typeof document !== "undefined" && !window.__aceKbCopyInit) {
  window.__aceKbCopyInit = true;
  document.addEventListener("click", function(e) {
    var btn = e.target;
    if (!btn || !btn.classList || !btn.classList.contains("md-copy-btn")) return;
    var wrap = btn.parentElement;
    var code = wrap && wrap.querySelector("code");
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function() {
      var orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function() { btn.textContent = orig; }, 1500);
    });
  });
}
function isTableSep(s) {
  var t = s.trim();
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(t);
}
function splitRow(s) {
  var t = s.trim();
  if (t.charAt(0) === "|") t = t.slice(1);
  if (t.charAt(t.length-1) === "|") t = t.slice(0,-1);
  return t.split("|").map(function(c){return c.trim();});
}
function renderMd(text){
  if(!text) return "";
  var lines = text.split("\n"), out = [], ul = false, ol = false, inCode = false, codeLines = [];
  function close() { if(ul){out.push("</ul>");ul=false;} if(ol){out.push("</ol>");ol=false;} }
  function flushCode() {
    var body = codeLines.join("\n").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    out.push('<div class="md-codeblock-wrap"><pre class="md-codeblock"><code>' + body + '</code></pre><button class="md-copy-btn">Copy</button></div>');
    codeLines = [];
  }
  for(var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var r = raw.trim();
    if(/^```/.test(r)) {
      if(inCode) { flushCode(); inCode = false; }
      else { close(); inCode = true; }
      continue;
    }
    if(inCode) { codeLines.push(raw); continue; }
    // Table: header row starting with | followed by a separator row of dashes
    if (/^\|.+\|/.test(r) && i+1 < lines.length && isTableSep(lines[i+1])) {
      close();
      var headers = splitRow(r);
      var rows = [];
      i += 2;
      while (i < lines.length && /^\|.+\|/.test(lines[i].trim())) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      var tbl = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
      headers.forEach(function(h){ tbl += "<th>" + inlineMd(h) + "</th>"; });
      tbl += "</tr></thead><tbody>";
      rows.forEach(function(row){
        tbl += "<tr>";
        row.forEach(function(c){ tbl += "<td>" + inlineMd(c) + "</td>"; });
        tbl += "</tr>";
      });
      tbl += "</tbody></table></div>";
      out.push(tbl);
      continue;
    }
    if(/^---+$/.test(r)){close();out.push("<hr class=\"md-hr\">");continue;}
    if(/^### /.test(r)){close();out.push("<h3 class=\"md-h3\">"+inlineMd(r.slice(4))+"</h3>");continue;}
    if(/^## /.test(r)){close();out.push("<h2 class=\"md-h2\">"+inlineMd(r.slice(3))+"</h2>");continue;}
    if(/^# /.test(r)){close();out.push("<h2 class=\"md-h2\">"+inlineMd(r.slice(2))+"</h2>");continue;}
    if(/^[-*] /.test(r)){if(ol){out.push("</ol>");ol=false;}if(!ul){out.push("<ul class=\"md-ul\">");ul=true;}out.push("<li>"+inlineMd(r.slice(2))+"</li>");continue;}
    if(/^\d+\.\s/.test(r)){if(ul){out.push("</ul>");ul=false;}if(!ol){out.push("<ol class=\"md-ol\">");ol=true;}out.push("<li>"+inlineMd(r.replace(/^\d+\.\s/,""))+"</li>");continue;}
    close();
    if(r===""){out.push("<div class=\"md-gap\"></div>");continue;}
    out.push("<p class=\"md-p\">"+inlineMd(r)+"</p>");
  }
  if(inCode) flushCode();
  close();
  return out.join("");
}

const CATEGORIES = {
  "start-here":          { label: "Start Here",          desc: "New to AI at ACE? Begin here for setup and essentials",  bg: "var(--cat-guide-bg)",  color: "var(--cat-guide-text)",  icon: "🚀" },
  "quick-prompts":       { label: "Quick Prompts",       desc: "A template — copy and paste into Claude",                     bg: "var(--cat-prompt-bg)", color: "var(--cat-prompt-text)", icon: "💬" },
  "automated-workflows": { label: "Automated Workflows", desc: "A multi-step workflow or automation to set up in Claude",     bg: "var(--cat-skill-bg)",  color: "var(--cat-skill-text)",  icon: "⚡" },
  "examples":            { label: "Real ACE Examples",   desc: "A real example of Claude output from ACE's work",             bg: "var(--cat-example-bg)",color: "var(--cat-example-text)",icon: "🔍" },
};

const TAGS = [
  "Advanced","Automation","Communications","Email","Getting Started","Operations","Research","Scheduled Tasks","Writing"
];

const INITIAL_ENTRIES = [
  {id:1,title:"Getting Started with Cowork at ACE",category:"guide",tags:["Getting Started","Operations"],author:"Ethan E.",date:"2026-04-06",votes:0,description:"Everything you need to hit the ground running — setup, connecting Asana/Slack/Gmail, Projects, safety basics, and prompting tips all in one place.",content:"## Quick Start\n\nCowork is Claude's desktop mode. It reads your files, creates documents, connects to your apps, and runs code — all from a chat interface.\n\n### Setup\n1. **Download Claude Desktop** from claude.ai/download (requires Pro, Max, Team, or Enterprise plan)\n2. **Select a folder** when you start a session — Claude can read and create files there\n3. **Upload files** by dragging them into the chat\n4. **Be specific**: Instead of 'summarize this,' try 'summarize this report in 3 paragraphs for our internal review, noting key uncertainties'\n\n### Connect Your Tools\nGo to **Settings > Customize** or just ask Claude: 'Can you connect to Asana?'\n\n- **Asana** — Pull your tasks, create new ones from meeting notes, track project status, get daily planning help\n- **Slack** — Post summaries to channels, catch up on what you missed, share digests with the team\n- **Gmail** — Read newsletters, draft emails for review, process labeled emails into digests\n\nConnectors use your existing permissions — Claude can only access what your account can access.\n\n### Projects\nProjects keep related work together with persistent memory and custom instructions. You set context once instead of repeating it every session. Suggested ACE projects:\n- **Communications**: Style guidelines, 'do not fabricate statistics', sample blog posts\n- **Evaluations**: Three criteria (Impact, RFMF, Org Health), rubric, evidence standards\n\n### Prompting Tips\n- **Show, don't tell** — Paste an example of good output instead of describing what you want\n- **Say what NOT to do** — 'Do not fabricate statistics or outcomes' belongs in every prompt that produces external-facing content\n- **Break big tasks into steps** — 'First extract the claims, then fact-check each one, then give me the corrected version'\n- **Close the loop** — When a prompt creates actionable output, route it: 'Create these as Asana tasks' or 'Post this to Slack in #channel'\n- **Iterate** — If the output is 70% right, tell Claude what to fix rather than starting over\n\n### Safety Basics\n- Files stay on your local machine\n- For Slack and Gmail: have Claude create drafts or DM you first before posting to shared channels or sending\n- Add 'Do NOT fabricate any statistics or outcomes' as a custom instruction in every Project\n- Review outputs before sharing externally, especially donor communications",tips:"Share this with new team members on day one. Connecting Asana first is recommended — the Daily Planner prompt alone makes it worth the quick setup.",whatWorked:"Consolidates what used to be five separate guides. Covers the essentials without overwhelming new users.",whatDidnt:"Cowork is different from regular Claude chat — some people may need a walkthrough of the desktop app to understand the distinction."},
  {id:2,title:"Daily Asana Planner",category:"skill",tags:["Operations","Automation","Getting Started"],author:"Ethan E.",date:"2026-04-06",votes:0,description:"Claude pulls your Asana tasks, scans your projects, and builds a prioritized daily plan — with risk flags and overload recommendations. Set it up as a scheduled task to have it waiting for you each morning.",content:"You are my daily planning assistant. Connect to my Asana workspace and help me organize my day. Work through these steps:\n\n1. **Pull my tasks.** Get all tasks assigned to me. Focus on:\n   - Tasks due today\n   - Tasks due this week\n   - Overdue tasks (past due date, still incomplete)\n   - Tasks with no due date that are marked high priority\n\n2. **Scan my projects.** For each project I'm a member of:\n   - Note any tasks due today or this week\n   - Flag anything that looks blocked or stalled (no updates, past due)\n   - Summarize the overall status in one sentence\n\n3. **Build my daily plan.** Based on what you found, create a prioritized plan for today:\n   - Start with anything overdue — those need attention first\n   - Then today's deadlines\n   - Then high-priority items due later this week\n   - Suggest 1-2 quick wins I could knock out between bigger tasks\n   - If my day looks overloaded, recommend what to defer or delegate and explain why\n\n4. **Flag risks.** Call out:\n   - Tasks due soon with no recent activity\n   - Projects where multiple tasks are slipping\n   - Anything that might need me to follow up with someone else\n\n5. **Present the plan:**\n   - OVERDUE (must address today)\n   - DUE TODAY\n   - THIS WEEK priorities\n   - QUICK WINS\n   - RISKS & FOLLOW-UPS\n   - PROJECT STATUS (one line per project)\n\nKeep it concise — focus on what actually needs my attention. Skip low-priority items that aren't due soon.\n\nAsk me if I have any meetings or time blocks today that would affect scheduling, then adjust the plan accordingly.\n\n---\n\n**Optional next steps after reviewing the plan:**\n- 'Update [task name] in Asana — set due date to [new date]' to defer something\n- 'Post my priorities for today to Slack in #standups' to share your plan with the team\n- 'Create an Asana task for [thing I realized I need to do] due [date]' for anything new that came up\n\n**To make this automatic:** Say 'Set this up as a scheduled task that runs every weekday at 8am' and Claude will have your daily plan ready when you start work.",tips:"Try setting this up as a scheduled task so the plan is ready when you open Claude each morning. You can also post your priorities to a Slack channel to keep your team in the loop.",whatWorked:"Designed to surface what actually matters rather than listing every task. The risk flags should help catch slipping deadlines early.",whatDidnt:"Only as good as your Asana hygiene — tasks without due dates or that live in your inbox won't surface well. Consider cleaning up your Asana before your first run."},
  {id:3,title:"Meeting Notes to Action Items + Asana Tasks",category:"prompt",tags:["Operations","Automation","Getting Started"],author:"Team",date:"2026-04-06",votes:0,description:"Turn messy meeting notes into a structured summary, then create Asana tasks for every action item and post the recap to Slack — all in one flow.",content:"Here are notes from our team meeting. Please organize them into:\n\n## Meeting Summary\n2-3 sentences: what was discussed and any important context.\n\n## Key Decisions\nBullet each decision made. Note who made or approved it.\n\n## Action Items\nTable with columns: Action Item | Owner | Deadline | Priority (High/Med/Low)\n\nFor deadlines: Use specific dates mentioned. Convert 'next week' or 'soon' to actual dates. If no deadline was discussed, suggest one based on priority.\n\n## Open Questions\nAnything unresolved. Note who should follow up on each.\n\n## Follow-ups for Next Meeting\nTopics to revisit, with any prep needed.\n\n---\n\n**After I confirm the summary looks right:**\n- Say **'Create these as Asana tasks'** — I'll create a task for each action item with the owner, deadline, and a note referencing this meeting date\n- Say **'Post to Slack in #[channel]'** — I'll post the summary and action items to the team\n- Say **'Both'** — I'll do both at once\n\nMeeting notes:\n[PASTE NOTES OR TRANSCRIPT HERE]",tips:"Works with rough notes, bullet points, or recorded transcripts. For recurring meetings, add team members' full names and Asana usernames to your Project's custom instructions so Claude matches them automatically.",whatWorked:"Designed to close the gap between 'we discussed it' and 'someone is actually tracking it.' The Asana and Slack integration means action items get assigned and the team gets a recap without extra manual steps.",whatDidnt:"Nicknames and initials may cause misassignment. Use full names in your notes, or add a name mapping in your Project instructions (e.g., 'JD = Jane Doe')."},
  {id:4,title:"Slack Catch-Up Summarizer",category:"prompt",tags:["Operations","Communications","Getting Started"],author:"Ethan E.",date:"2026-04-06",votes:0,description:"Back from PTO, out sick, or just behind on Slack? Claude reads the channels you care about and gives you a focused summary of what you missed — with action items flagged.",content:"I need to catch up on what I missed in Slack. Please read the following channels from the last [NUMBER] days and give me a focused summary:\n\n**Channels to read**: [#channel-1, #channel-2, #channel-3]\n\nFor each channel, provide:\n\n### #channel-name\n- **Key decisions or announcements**: Anything I need to know about — policy changes, deadlines, new initiatives\n- **Discussions that need my input**: Threads where I was mentioned or where my area of work came up\n- **Action items for me**: Anything assigned to me or that I should follow up on\n- **FYI items**: Important context but no action needed from me (keep brief)\n\nSkip: casual conversation, emoji reactions, simple acknowledgments, anything that doesn't affect my work.\n\nAfter the summary:\n- **Top 3 things I should respond to first** (with links to the threads if possible)\n- **Anything time-sensitive** that I may have already missed the window on\n\n---\n\n**After reviewing:**\n- 'Create Asana tasks for the action items' — to make sure nothing falls through the cracks\n- 'Draft replies for the threads that need my input' — Claude will draft responses I can review before posting\n- 'Post to my Slack DM: here's what I'm catching up on today' — so my team knows what I'm prioritizing",tips:"Useful for Monday mornings, returning from PTO, or any day the scroll feels overwhelming. Specify a time window ('last 2 days' rather than 'recent'). For high-traffic channels, try adding: 'focus on threads with 3+ replies.'",whatWorked:"Designed to replace the morning Slack scroll with a focused summary that surfaces what actually needs your attention — decisions, mentions, and action items.",whatDidnt:"DMs and private channels may not be accessible depending on your Slack connector permissions. Very long threads (50+ messages) may get summarized aggressively — ask Claude to expand on specific ones."},
  {id:5,title:"Gmail Newsletter Digest",category:"skill",tags:["Email","Automation","Scheduled Tasks"],author:"Ethan E.",date:"2026-04-06",votes:0,description:"Claude reads your labeled Gmail newsletters on a schedule and delivers a themed digest — with the best items posted to Slack so the whole team benefits.",content:"## Setup (one-time, ~5 minutes)\n\n### 1. Label Your Emails\nIn Gmail, create a label called 'digest'. Filter relevant newsletters to get this label automatically:\n- Animal welfare research alerts\n- EA Forum digests\n- Charity sector newsletters\n- Funder/foundation updates\n- Policy and legislation trackers\n- Journal table-of-contents alerts\n\n### 2. Connect Gmail\nSettings > Customize > Connect Gmail, or ask: 'Can you connect to my Gmail?'\n\n### 3. Create the Scheduled Task\nAsk Claude:\n\n'Create a scheduled task that runs every Monday and Thursday morning:\n1. Read all emails labeled \"digest\" from the past few days\n2. Extract key points from each in 2-3 sentences\n3. Group by theme: Research, Policy/Legislation, Charity News, Fundraising/Grants, Other\n4. Rank items by relevance to ACE's work\n5. Create a \"Worth Reading in Full\" section for the 1-2 best items with links\n6. Note any action items — deadlines, events, opportunities\n7. Save as a markdown file\n8. Post the top 5 highlights to Slack in #research-updates'\n\n### 4. Refine Over Time\nAfter a few runs, tell Claude what to adjust:\n- 'Spend more time on research papers, less on general news'\n- 'Always flag anything mentioning [charity we're evaluating]'\n- 'Deprioritize items from [low-value source]'\n- 'Track themes across weeks — what keeps coming up?'\n\n**Recommended frequency**: Twice-weekly (Mon/Thu). Daily if you get 5+ relevant emails per day.",tips:"Consider adding a 'digest-priority' label for must-read sources. Posting highlights to Slack means the whole team can benefit from one person's subscriptions.",whatWorked:"Designed to turn a pile of newsletter emails into a short, themed summary. The Slack posting option lets the team stay informed without everyone subscribing to the same lists.",whatDidnt:"Heavily formatted HTML emails may not parse as cleanly as plain text ones. You'll likely need to refine the task after the first couple of runs to calibrate what's useful vs. noise."},
  {id:6,title:"Quick Document Briefing",category:"prompt",tags:["Research","Getting Started","Operations"],author:"Team",date:"2026-04-06",votes:0,description:"Upload any document — report, article, policy paper, grant RFP — and get a structured briefing you can act on or share with the team in seconds.",content:"I need a briefing on the attached document. Please provide:\n\n## At a Glance\n- **What this is**: Type of document, who published it, when\n- **One-sentence summary**: The single most important takeaway\n- **Relevance to ACE**: Why this matters for our work (if applicable — skip if not relevant)\n\n## Key Points\nThe 3-5 most important findings, arguments, or takeaways. Use specific numbers and data where available.\n\n## Action Items\nAnything in this document that requires follow-up from our team — deadlines, opportunities, requests, decisions needed. If none, say 'No action items identified.'\n\n## Questions It Raises\nWhat should we be thinking about or investigating further based on this?\n\n## Notable Quotes\n2-3 direct quotes worth highlighting (with page numbers if available).\n\n---\n\n**After reviewing:**\n- 'Post this briefing to Slack in #[channel]' — share the summary with the team\n- 'Create an Asana task for [action item]' — track any follow-ups\n- 'Give me a deeper analysis of [specific section]' — drill into something that caught your eye\n- 'Compare this with [other document]' — if you have a related doc to cross-reference\n\n[UPLOAD DOCUMENT OR PASTE LINK]",tips:"Works with PDFs, Word docs, spreadsheets, web links, or pasted text. Great for grant RFPs, research papers, policy updates, or any document the team needs to digest quickly. If you need a specific angle, add it: 'Focus on implications for our evaluation methodology.'",whatWorked:"Designed to be the most universally useful prompt in the knowledge base — everyone reads documents and needs to extract the key points quickly. The Slack sharing option means one person can brief the whole team.",whatDidnt:"Very long documents (100+ pages) may need to be broken into sections. Scanned PDFs with poor quality may have OCR issues — check any specific numbers Claude extracts."},
  {id:7,title:"Blog Post Writer (ACE Voice)",category:"prompt",tags:["Writing","Communications"],author:"Team",date:"2026-04-06",votes:0,description:"Draft blog posts in ACE's evidence-based voice with headlines, social media copy, and a fact-check list — then share to Slack for team review.",content:"I need to write a blog post for Animal Charity Evaluators.\n\n**Publication**: [ACE Blog / Better for Animals]\n**Topic**: [TOPIC]\n**Audience**: [donors / advocates / charity professionals / researchers / general public]\n**Length**: [word count]\n**Key points**: [LIST]\n**Call to action**: [What should the reader do?]\n\n## ACE Voice\n- Lead with evidence and data, not emotion\n- Acknowledge uncertainty openly ('suggests,' 'indicates,' not 'proves')\n- 'animal welfare' / 'animal advocacy' — not 'animal rights' unless discussing rights-based approaches\n- 'farmed animals' not 'farm animals'\n- Concrete examples and specific data points\n- Tone: professional, accessible, evidence-based, compassionate without being preachy\n- Oxford comma: always\n\n## Also provide:\n1. Three headline options (specific and intriguing, not generic)\n2. Meta description (under 155 characters)\n3. Social blurb for X/Twitter (under 280 characters)\n4. LinkedIn post (under 500 characters)\n5. Claims needing fact-checking — quote each one\n6. Suggested internal links to ACE content\n\n**Do NOT fabricate statistics, study results, or quotes.** Use [NEED CITATION] for anything that needs a source.\n\n---\n\n**After drafting:**\n- 'Post a summary to Slack in #communications for team review'\n- 'Create an Asana task to publish by [DATE]'",tips:"Paste a recent ACE blog post as a style example so Claude can match the exact voice. Adding the style guidelines to a Communications Project means you won't need to repeat them each time.",whatWorked:"Includes social media blurbs and a fact-check list alongside the draft, so you get everything in one pass rather than making separate requests.",whatDidnt:"First drafts may sound generically nonprofit-ish without a sample post to match against. The 'do not fabricate' instruction is essential — without it, Claude may invent plausible-sounding statistics."},
  {id:8,title:"Pre-Publication Checker",category:"prompt",tags:["Writing","Research","Communications"],author:"Team",date:"2026-04-06",votes:0,description:"One prompt that catches everything before you publish — copyediting, ACE terminology, fact-checking, and citation finding combined. Run this on every external-facing document.",content:"I need a thorough pre-publication review of this [blog post / report / grant application / donor email / social media post] for ACE. Check everything:\n\n## 1. Copy Edit\n- Fix all spelling, grammar, and punctuation errors (Oxford comma: always)\n- Flag sentences over 35 words or paragraphs over 5 sentences\n- Check formatting consistency (headings, bullets, numbers)\n\n## 2. ACE Terminology & Tone\n- 'animal welfare' / 'animal advocacy' not 'animal rights'\n- 'farmed animals' not 'farm animals'\n- 'charity' or 'organization' not 'nonprofit'\n- Hedging for uncertain claims: 'suggests,' 'indicates,' not 'proves'\n- ACE's three criteria: Impact, Room for More Funding (RFMF), Organizational Health — named consistently?\n- Acronyms spelled out on first use?\n- Tone: evidence-based, professional, not preachy or absolutist?\n\n## 3. Fact-Check\nFor every factual claim, statistic, or assertion, categorize as:\n| # | Claim | Status | Notes |\n\nStatuses:\n- **Verified**: Confirmed via search or well-established\n- **Needs citation**: Plausible but must have a source before publishing\n- **Possibly wrong**: May be incorrect or outdated\n- **Fabrication risk**: Sounds AI-generated — verify before using\n\nFor claims needing citations: search the web and provide source URL, supporting quote, and publication date. Flag anything older than 2 years.\n\n## 4. Date Sensitivity\nFlag anything that could go stale: staff counts, budget numbers, recommendation counts, research findings.\n\n## Output\n1. **Overall assessment**: Ready to publish / Needs minor edits / Needs significant revision\n2. **Edits table**: Original text | Issue | Fix | Severity (Minor/Moderate/Major)\n3. **Claim audit table**: # | Claim | Status | Source or concern\n4. **Clean corrected version**: With all copyedits applied, ready to paste\n\n**Do not mark something 'verified' based on plausibility alone. If you can't confirm it, say so.**\n\nDraft:\n[PASTE OR UPLOAD]",tips:"Consider running this on everything before it goes external — blog posts, grant applications, donor emails, reports, social media. It combines editing and fact-checking into one pass.",whatWorked:"Combines what would otherwise be separate copyediting and fact-checking steps into a single prompt, making it more likely people will actually run it consistently.",whatDidnt:"Cannot access paywalled academic papers for citation verification — those will need manual checking. May over-edit intentionally casual writing. For social media, add: 'this is casual, focus on errors and terminology only.'"},
  {id:9,title:"Quick Email Drafter",category:"prompt",tags:["Email","Operations","Getting Started"],author:"Team",date:"2026-04-06",votes:0,description:"Describe what you need to communicate, and Claude drafts the email using context from Asana tasks or Slack threads — saved as a Gmail draft for your review.",content:"I need to draft an email. Here's the context:\n\n**To**: [recipient name/role — or 'pull from Asana task [task name]' if the context is there]\n**Purpose**: [what you need to communicate — e.g., 'follow up on the grant deadline,' 'update the board on evaluation progress,' 'ask a charity for missing financial data']\n**Tone**: [professional / warm / direct / formal]\n**Length**: [brief (2-3 sentences) / standard (1-2 paragraphs) / detailed]\n\n**Background context** (provide one or more):\n- 'Check Asana task [task name or project] for context'\n- 'Read the Slack thread in #[channel] about [topic] from [timeframe]'\n- [Or just paste/describe the context yourself]\n\n## Guidelines\n- Get to the point in the first sentence — no 'I hope this email finds you well'\n- Be specific about what you need from the recipient and by when\n- Match ACE's professional, evidence-based tone for external emails\n- For internal emails: be direct and conversational\n- Do NOT fabricate any facts, figures, or commitments\n\n## After Drafting\nProvide:\n1. The draft email\n2. A suggested subject line\n3. Any questions or gaps ('I assumed X — is that right?')\n\n**Then I'll say 'Create as Gmail draft' to save it for my review before sending.**\n\n---\n\n**Batch mode**: 'I have 5 follow-up emails to send based on this week's Asana tasks that are overdue. Draft a short follow-up for each one asking for a status update.'",tips:"The Asana and Slack context-pulling is the key feature — instead of re-explaining the background, just point Claude at the relevant task or thread. Always create as Gmail draft, never send directly.",whatWorked:"Designed to eliminate the overhead of context-switching: Claude pulls the background from Asana or Slack so you can focus on what to say rather than gathering the details. Batch mode is especially useful for follow-up emails.",whatDidnt:"For emails to external stakeholders (funders, charities), always review the full draft carefully — Claude may make assumptions about timelines or commitments. The 'questions or gaps' section is designed to flag these."},
  {id:10,title:"Prompting Tips for Better Results",category:"guide",tags:["Getting Started","Advanced"],author:"Ethan E.",date:"2026-04-06",votes:0,description:"Quick-reference card for writing prompts that work on the first try, with ACE-specific examples and integration patterns.",content:"## Write Better Prompts\n\n**Be specific about what you want**\nBad: 'Summarize this report'\nGood: 'Summarize this charity's theory of change in 3 paragraphs for internal review, noting uncertainties'\n\n**Provide context** — Who is the audience? What format? What tone? What length?\n\n**Show, don't tell** — Paste an example of good output. One sample beats a paragraph of description.\n\n**Say what NOT to do** — 'Do not fabricate statistics' and 'Do not use emotional language' matter as much as positive instructions.\n\n**Break big tasks into steps** — 'First extract claims, then fact-check each, then give corrected version'\n\n**Iterate, don't restart** — If 70% right, say what to fix: 'Paragraphs 2-3 are too formal. Make conversational but keep the evidence.'\n\n## Close the Loop\nThe biggest efficiency gain is routing outputs somewhere useful:\n- 'Create these as Asana tasks assigned to [person] due [date]'\n- 'Post this summary to Slack in #[channel]'\n- 'Save as Gmail draft to [recipient]'\n- 'Create an Asana task to follow up on this by [date]'\n\n## ACE-Specific Defaults\nInclude in any ACE-related prompt:\n- 'Do not fabricate statistics, citations, or outcomes'\n- Reference our criteria: Impact, Room for More Funding (RFMF), Organizational Health\n- 'farmed animals' not 'farm animals'; 'animal welfare' not 'animal rights'\n- Evidence-based tone: 'suggests' not 'proves'\n\n## Set It and Forget It\nAdd your most-used instructions to a **Project's custom instructions** so they apply automatically. You shouldn't have to type 'do not fabricate' every time — set it once in the Project and Claude remembers.",tips:"The single biggest improvement for most prompts: add 'do not fabricate statistics.' The second: route outputs to Asana or Slack so they don't just sit in a file.",whatWorked:"Designed as a quick reference rather than a long tutorial. The 'close the loop' pattern — routing outputs to Asana, Slack, or Gmail — is the key concept that ties the other prompts in this knowledge base together.",whatDidnt:"Reading tips is no substitute for practice. Consider pairing new users with someone experienced for their first few Cowork sessions."}
];

// ━━━━ Backend sync helpers ━━━━
async function fetchEntries() {
  if (!BACKEND_URL) return { connected: false, data: null };
  try {
    var res = await fetch(BACKEND_URL);
    var data = await res.json();
    if (Array.isArray(data)) data.forEach(function(e) { e.tags = parseTags(e.tags); });
    return { connected: true, data: data.length > 0 ? data : null };
  } catch(e) { console.log('Backend fetch failed, using local data:', e); return { connected: false, data: null }; }
}
async function seedBackend(entries) {
  if (!BACKEND_URL) return;
  for (var i = 0; i < entries.length; i++) {
    try { await fetch(BACKEND_URL, { method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({action:'add', key:API_KEY, entry:entries[i]}) }); } catch(e) {}
  }
}
async function postAction(action, payload) {
  if (!BACKEND_URL) return true;
  try {
    const res = await fetch(BACKEND_URL, { method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({action, key:API_KEY, ...payload}) });
    return res.ok;
  } catch(e) { console.log('Backend post failed', e); return false; }
}

function formatDate(d) {
  if (!d) return '';
  try {
    var date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'});
  } catch(e) { return String(d); }
}

function VoteButtons({ votes, onVote, userVote }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
      <button onClick={(e) => {e.stopPropagation();onVote(1)}} style={{background:userVote===1?"var(--vote-active)":"var(--vote-bg)",border:"none",borderRadius:"4px",padding:"2px 8px",fontSize:"16px",color:userVote===1?"white":"var(--text2)",lineHeight:1.4,transition:"background .15s,color .15s"}} title="Helpful">{"\u25B2"}</button>
      <span style={{fontSize:"13px",fontWeight:600,color:votes>0?"var(--vote-active)":votes<0?"var(--red-text)":"var(--text3)",minWidth:"20px",textAlign:"center"}}>{votes}</span>
      <button onClick={(e) => {e.stopPropagation();onVote(-1)}} style={{background:userVote===-1?"var(--red-text)":"var(--vote-bg)",border:"none",borderRadius:"4px",padding:"2px 8px",fontSize:"16px",color:userVote===-1?"white":"var(--text2)",lineHeight:1.4,transition:"background .15s,color .15s"}} title="Not helpful">{"\u25BC"}</button>
    </div>
  );
}

function EntryCard({ entry, onClick, onVote, userVotes }) {
  var cat = CATEGORIES[entry.category] || { label: entry.category || "Uncategorized", desc: "", bg: "var(--surface2)", color: "var(--text2)", icon: "📄" };
  return (
    <div onClick={() => onClick(entry)}
      style={{background:"var(--surface)",borderRadius:"12px",border:"1px solid var(--border)",padding:"20px",cursor:"pointer",display:"flex",flexDirection:"column",gap:"12px",transition:"all .2s",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}
      onMouseOver={(e) => {e.currentTarget.style.boxShadow="var(--card-hover-shadow)";e.currentTarget.style.borderColor="var(--accent)"}}
      onMouseOut={(e) => {e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)";e.currentTarget.style.borderColor="var(--border)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"20px"}}>{cat.icon}</span>
          <span style={{fontSize:"12px",fontWeight:600,padding:"4px 10px",borderRadius:"20px",background:cat.bg,color:cat.color,cursor:"default"}}>{cat.label}</span>
        </div>
        <VoteButtons votes={entry.votes} onVote={(d) => onVote(entry.id,d)} userVote={userVotes[entry.id]||0} />
      </div>
      <h3 style={{fontWeight:700,color:"var(--text)",fontSize:"17px",lineHeight:1.3}}>{entry.title}</h3>
      <p className="line-clamp-2" style={{color:"var(--text2)",fontSize:"14px",lineHeight:1.5}}>{entry.description}</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginTop:"auto"}}>
        {entry.tags.slice(0,3).map((tag) => <span key={tag} style={{fontSize:"11px",background:"var(--surface2)",color:"var(--text2)",padding:"2px 8px",borderRadius:"20px"}}>{tag}</span>)}
        {entry.tags.length > 3 && <span style={{fontSize:"11px",color:"var(--text3)"}}>{"+" + (entry.tags.length - 3)}</span>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:"12px",color:"var(--text3)",paddingTop:"8px",borderTop:"1px solid var(--border)"}}>
        <span>{entry.author}</span><span>{formatDate(entry.date)}</span>
      </div>
    </div>
  );
}

function EntryDetail({ entry, onBack, onVote, onEdit, onDelete, userVotes }) {
  var cat = CATEGORIES[entry.category] || { label: entry.category || "Uncategorized", desc: "", bg: "var(--surface2)", color: "var(--text2)", icon: "📄" };
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div style={{maxWidth:"900px",margin:"0 auto"}}>
      <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:"8px",color:"var(--accent)",background:"none",border:"none",fontWeight:500,fontSize:"15px",marginBottom:"24px",padding:0}}>{"\u2190 Back to all entries"}</button>
      <div style={{background:"var(--surface)",borderRadius:"12px",border:"1px solid var(--border)",overflow:"hidden"}}>
        <div style={{background:"var(--header-grad)",padding:"28px",color:"white"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
            <span style={{fontSize:"28px"}}>{cat.icon}</span>
            <span style={{fontSize:"13px",fontWeight:600,background:"rgba(255,255,255,0.2)",padding:"4px 14px",borderRadius:"20px"}}>{cat.label}</span>
            <VoteButtons votes={entry.votes} onVote={(d) => onVote(entry.id,d)} userVote={userVotes[entry.id]||0} />
          </div>
          <h2 style={{fontSize:"26px",fontWeight:700,margin:"0 0 8px 0"}}>{entry.title}</h2>
          <p style={{color:"rgba(255,255,255,0.7)",margin:"0 0 16px 0",fontSize:"15px"}}>{entry.description}</p>
          <div style={{display:"flex",gap:"16px",fontSize:"14px",color:"rgba(255,255,255,0.5)"}}>
            <span>{"By " + entry.author}</span><span>{"\u2022"}</span><span>{formatDate(entry.date)}</span>
          </div>
        </div>
        <div style={{padding:"28px",display:"flex",flexDirection:"column",gap:"24px"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
            {entry.tags.map((tag) => <span key={tag} style={{fontSize:"13px",background:"var(--accent-light)",color:"var(--accent-text)",padding:"4px 14px",borderRadius:"20px",fontWeight:500}}>{tag}</span>)}
          </div>
          <div>
            <h3 style={{fontWeight:700,color:"var(--text)",fontSize:"18px",marginBottom:"12px"}}>{cat.label}</h3>
            <div style={{lineHeight:1.6,overflowX:"auto"}} dangerouslySetInnerHTML={{__html: renderMd(entry.content)}} />
          </div>
          {entry.tips && (
            <div style={{background:"var(--blue-bg)",border:"1px solid var(--blue-border)",borderRadius:"8px",padding:"16px"}}>
              <h4 style={{fontWeight:700,color:"var(--blue-head)",margin:"0 0 4px 0",fontSize:"14px"}}>{"\uD83D\uDCA1 Tips"}</h4>
              <p style={{color:"var(--blue-text)",fontSize:"14px",margin:0}}>{entry.tips}</p>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:entry.whatWorked && entry.whatDidnt ? "1fr 1fr" : "1fr",gap:"16px"}}>
            {entry.whatWorked && (
              <div style={{background:"var(--green-bg)",border:"1px solid var(--green-border)",borderRadius:"8px",padding:"16px"}}>
                <h4 style={{fontWeight:700,color:"var(--green-head)",margin:"0 0 4px 0",fontSize:"14px"}}>{"\u2705 What Worked"}</h4>
                <p style={{color:"var(--green-text)",fontSize:"14px",margin:0}}>{entry.whatWorked}</p>
              </div>
            )}
            {entry.whatDidnt && (
              <div style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",borderRadius:"8px",padding:"16px"}}>
                <h4 style={{fontWeight:700,color:"var(--red-head)",margin:"0 0 4px 0",fontSize:"14px"}}>{"\u26A0\uFE0F What Didn't Work"}</h4>
                <p style={{color:"var(--red-text)",fontSize:"14px",margin:0}}>{entry.whatDidnt}</p>
              </div>
            )}
          </div>
          {entry.colleagueNotes && entry.colleagueNotes.trim() && (
            <div>
              <h3 style={{fontWeight:700,color:"var(--text)",fontSize:"18px",marginBottom:"12px"}}>What colleagues said</h3>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {entry.colleagueNotes.split("|").map((note, i) => {
                  var t = note.trim();
                  if (!t) return null;
                  var idx = t.indexOf(":");
                  var name = idx > -1 ? t.slice(0, idx).trim() : "";
                  var comment = idx > -1 ? t.slice(idx + 1).trim() : t;
                  return (
                    <blockquote key={i} style={{margin:0,padding:"12px 16px",background:"var(--surface2)",borderLeft:"3px solid var(--accent)",borderRadius:"6px",fontSize:"14px",lineHeight:1.5,color:"var(--text)"}}>
                      {name && <strong style={{color:"var(--accent-text)"}}>{name}: </strong>}{comment}
                    </blockquote>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:"12px",paddingTop:"16px",borderTop:"1px solid var(--border)"}}>
            <button onClick={() => onEdit(entry)} style={{flex:1,padding:"10px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontWeight:500,fontSize:"14px"}}>{"\u270F\uFE0F Edit Entry"}</button>
            {!confirmDel ?
              <button onClick={() => setConfirmDel(true)} style={{flex:1,padding:"10px",borderRadius:"8px",border:"1px solid var(--red-border)",background:"var(--red-bg)",color:"var(--red-text)",fontWeight:500,fontSize:"14px"}}>{"\uD83D\uDDD1\uFE0F Delete"}</button> :
              <button onClick={() => onDelete(entry.id)} style={{flex:1,padding:"10px",borderRadius:"8px",border:"1px solid var(--red-border)",background:"var(--red-head)",color:"white",fontWeight:600,fontSize:"14px"}}>{"Confirm Delete"}</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryForm({ onSubmit, onCancel, existing, saving }) {
  var isEdit = !!existing;
  const [form, setForm] = useState(existing || {title:"",category:"quick-prompts",description:"",content:"",tips:"",whatWorked:"",whatDidnt:"",colleagueNotes:"",tags:[],author:"",votes:0});
  const [tagInput, setTagInput] = useState("");
  function addTag(){if(tagInput.trim() && form.tags.indexOf(tagInput.trim()) === -1){setForm({...form,tags:[...form.tags,tagInput.trim()]});setTagInput("")}}
  function removeTag(tag){setForm({...form,tags:form.tags.filter((t) => t !== tag)})}
  const [formError, setFormError] = useState("");
  function handleSubmit(e){
    e.preventDefault();
    setFormError("");
    if(!form.title.trim() || !form.content.trim()){setFormError("Title and content are required.");return}
    if(form.title.length > MAX_LENGTHS.title){setFormError("Title is too long (max " + MAX_LENGTHS.title + " characters).");return}
    if(form.content.length > MAX_LENGTHS.content){setFormError("Content is too long (max " + MAX_LENGTHS.content + " characters).");return}
    if(form.description.length > MAX_LENGTHS.description){setFormError("Description is too long (max " + MAX_LENGTHS.description + " characters).");return}
    if(form.tips.length > MAX_LENGTHS.tips){setFormError("Tips field is too long (max " + MAX_LENGTHS.tips + " characters).");return}
    if(form.tags.length > 20){setFormError("Too many tags (max 20).");return}
    onSubmit({...form,...(isEdit ? {} : {id:Date.now(),date:new Date().toISOString().split("T")[0],votes:0})})
  }
  var inp = {width:"100%",border:"1px solid var(--border2)",borderRadius:"8px",padding:"10px 16px",fontSize:"14px",outline:"none",background:"var(--surface)",color:"var(--text)",boxSizing:"border-box"};
  var lbl = {display:"block",fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"4px"};
  return (
    <div style={{maxWidth:"700px",margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
        <h2 style={{fontSize:"24px",fontWeight:700,color:"var(--text)"}}>{isEdit ? "Edit Entry" : "Add New Entry"}</h2>
        <button onClick={onCancel} style={{color:"var(--text2)",background:"none",border:"none",fontWeight:500,fontSize:"14px"}}>Cancel</button>
      </div>
      <form onSubmit={handleSubmit} style={{background:"var(--surface)",borderRadius:"12px",border:"1px solid var(--border)",padding:"28px",display:"flex",flexDirection:"column",gap:"20px"}}>
        <div><label style={lbl}>Title *</label><input type="text" value={form.title} onChange={(e) => setForm({...form,title:e.target.value})} style={inp} placeholder="Give your entry a descriptive title" /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
          <div><label style={lbl}>Category *</label><select value={form.category} onChange={(e) => setForm({...form,category:e.target.value})} style={inp}>{Object.entries(CATEGORIES).map(([key,val]) => <option key={key} value={key}>{val.icon + " " + val.label}</option>)}</select></div>
          <div><label style={lbl}>Your Name</label><input type="text" value={form.author} onChange={(e) => setForm({...form,author:e.target.value})} style={inp} placeholder="e.g., Jane D." /></div>
        </div>
        <div><label style={lbl}>Short Description *</label><input type="text" value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} style={inp} placeholder="One-line summary" /></div>
        <div><label style={lbl}>Content / Prompt Template *</label><textarea value={form.content} onChange={(e) => setForm({...form,content:e.target.value})} rows={8} style={{...inp,fontFamily:"monospace"}} placeholder="Paste your prompt or write-up here..." /></div>
        <div>
          <label style={lbl}>Tags</label>
          <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}><input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => {if(e.key==="Enter"){e.preventDefault();addTag()}}} style={{...inp,flex:1}} placeholder="Type a tag and press Enter" /><button type="button" onClick={addTag} style={{background:"var(--accent)",color:"white",padding:"10px 16px",borderRadius:"8px",fontSize:"13px",fontWeight:500,border:"none",whiteSpace:"nowrap"}}>Add</button></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"8px"}}>{TAGS.filter((t) => form.tags.indexOf(t) === -1).slice(0,8).map((tag) => <button key={tag} type="button" onClick={() => setForm({...form,tags:[...form.tags,tag]})} style={{fontSize:"12px",background:"var(--surface2)",color:"var(--text2)",padding:"4px 10px",borderRadius:"20px",border:"none"}}>{"+ " + tag}</button>)}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{form.tags.map((tag) => <span key={tag} style={{fontSize:"12px",background:"var(--accent-light)",color:"var(--accent-text)",padding:"4px 10px",borderRadius:"20px",display:"flex",alignItems:"center",gap:"4px"}}>{tag}<button type="button" onClick={() => removeTag(tag)} style={{background:"none",border:"none",color:"var(--accent-text)",fontSize:"14px",padding:0}}>{"\u00D7"}</button></span>)}</div>
        </div>
        <div><label style={lbl}>Tips for Others</label><textarea value={form.tips} onChange={(e) => setForm({...form,tips:e.target.value})} rows={2} style={inp} placeholder="Any tips for getting better results?" /></div>
        <div><label style={lbl}>Colleague Notes (optional)</label><textarea value={form.colleagueNotes||""} onChange={(e) => setForm({...form,colleagueNotes:e.target.value})} rows={3} style={inp} placeholder="Name: comment | Name: comment" /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
          <div><label style={lbl}>What Worked Well</label><textarea value={form.whatWorked} onChange={(e) => setForm({...form,whatWorked:e.target.value})} rows={2} style={inp} placeholder="What results did you get?" /></div>
          <div><label style={lbl}>What Didn't Work</label><textarea value={form.whatDidnt} onChange={(e) => setForm({...form,whatDidnt:e.target.value})} rows={2} style={inp} placeholder="Any gotchas or limitations?" /></div>
        </div>
        {formError && <div style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",borderRadius:"8px",padding:"12px 16px",color:"var(--red-text)",fontSize:"14px"}}>{formError}</div>}
        <button type="submit" disabled={saving} style={{opacity:saving?0.6:1,width:"100%",background:"var(--accent)",color:"white",padding:"14px",borderRadius:"8px",fontWeight:600,fontSize:"14px",border:"none"}}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Add Entry to Knowledge Base"}</button>
      </form>
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  var bg = toast.type === "error" ? "var(--red-head)" : "var(--accent-dark)";
  return (
    <div style={{position:"fixed",bottom:"24px",right:"24px",zIndex:1000,background:bg,color:"white",padding:"12px 16px",borderRadius:"8px",maxWidth:"360px",fontSize:"14px",lineHeight:1.4,boxShadow:"0 4px 12px rgba(0,0,0,0.25)",display:"flex",alignItems:"flex-start",gap:"10px"}}>
      <span style={{flex:1}}>{toast.msg}</span>
      <button onClick={onClose} style={{background:"none",border:"none",color:"white",fontSize:"20px",padding:0,lineHeight:1,cursor:"pointer",flexShrink:0,marginTop:"-2px"}}>�</button>
    </div>
  );
}

function App() {
  const [dark, setDark] = useState(() => {
    const s = localStorage.getItem("aceKbDark");
    return s !== null ? s === "true" : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("list");
  const [editEntry, setEditEntry] = useState(null);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("aceKbSortBy") || "date");
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(!!BACKEND_URL);
  const [toast, setToast] = React.useState(null);
  function showToast(msg, type) {
    setToast({msg, type: type || "error"});
    setTimeout(() => setToast(null), 5000);
  }
  const [saving, setSaving] = useState(false);
  const [userVotes, setUserVotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aceKbUserVotes') || '{}'); }
    catch(e) { return {}; }
  });

  useEffect(() => {document.body.className = dark ? "dark" : ""},[dark]);
  useEffect(() => {
    if(BACKEND_URL){
      fetchEntries().then((result) => {
        setSynced(result.connected);
        if(result.data){
          setEntries(result.data);
        } else if(result.connected) {
          // Sheet is connected but empty — seed it with starter entries
          if (!localStorage.getItem("aceKbSeeded")) {
            localStorage.setItem("aceKbSeeded", "true");
            seedBackend(INITIAL_ENTRIES);
          }
        }
        setLoading(false);
      });
    }
  },[]);

  function handleVote(id, direction) {
    const prev = userVotes[id] || 0;
    if (prev === direction) {
      const newUV = {...userVotes};
      delete newUV[id];
      setUserVotes(newUV);
      localStorage.setItem("aceKbUserVotes", JSON.stringify(newUV));
      const delta = -direction;
      setEntries(entries.map((e) => e.id === id ? {...e, votes: e.votes + delta} : e));
      if(selected && selected.id === id) setSelected({...selected, votes: selected.votes + delta});
      postAction("vote", {id, delta}).then(ok => { if (!ok) showToast("Vote saved locally but could not sync to team."); });
    } else {
      const newUV = {...userVotes, [id]: direction};
      setUserVotes(newUV);
      localStorage.setItem("aceKbUserVotes", JSON.stringify(newUV));
      const delta = direction - prev;
      setEntries(entries.map((e) => e.id === id ? {...e, votes: e.votes + delta} : e));
      if(selected && selected.id === id) setSelected({...selected, votes: selected.votes + delta});
      postAction("vote", {id, delta}).then(ok => { if (!ok) showToast("Vote saved locally but could not sync to team."); });
    }
  }
  async function handleAdd(entry){
    setSaving(true);
    setEntries([entry, ...entries]);
    const ok = await postAction("add",{entry});
    setSaving(false);
    setView("list");
    if (!ok) showToast("Entry saved for this session but could not sync to team database.");
  }
  function handleEdit(entry){setEditEntry(entry);setView("edit");setSelected(null)}
  async function handleEditSubmit(updated){
    setSaving(true);
    setEntries(entries.map((e) => e.id === updated.id ? updated : e));
    setEditEntry(null);
    const ok = await postAction("edit",{entry:updated});
    setSaving(false);
    setView("list");
    if (!ok) showToast("Edit saved for this session but could not sync to team database.");
  }
  async function handleDelete(id){
    setEntries(entries.filter((e) => e.id !== id));
    setSelected(null);
    const ok = await postAction("delete",{id});
    if (!ok) showToast("Could not delete from team database. Refresh to see current state.");
  }

  const filtered = useMemo(() => {
    var result = entries.filter((e) => {
      var ms = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase());
      var mc = catFilter === "all" || e.category === catFilter;
      var mt = tagFilter === "all" || e.tags.includes(tagFilter);
      return ms && mc && mt;
    });
    if(sortBy === "date") result.sort((a,b) => { if (a.category === "start-here" && b.category !== "start-here") return -1; if (b.category === "start-here" && a.category !== "start-here") return 1; return b.date.localeCompare(a.date); });
    else if(sortBy === "votes") result.sort((a,b) => b.votes - a.votes);
    else if(sortBy === "title") result.sort((a,b) => a.title.localeCompare(b.title));
    return result;
  },[entries,search,catFilter,tagFilter,sortBy]);

  const usedTags = useMemo(() => [...new Set(entries.flatMap((e) => e.tags))].sort(),[entries]);
  const stats = useMemo(() => ({total:entries.length,startHere:entries.filter((e) => e.category==="start-here").length,quickPrompts:entries.filter((e) => e.category==="quick-prompts").length,automatedWorkflows:entries.filter((e) => e.category==="automated-workflows").length,examples:entries.filter((e) => e.category==="examples").length}),[entries]);
  const lastUpdated = useMemo(() => {
    if (!entries.length) return "";
    const latest = entries.reduce((max, e) => e.date > max ? e.date : max, entries[0].date);
    return formatDate(latest);
  }, [entries]);
  var selStyle = {flex:"1 1 130px",border:"1px solid var(--border2)",borderRadius:"8px",padding:"10px 12px",fontSize:"14px",background:"var(--surface)",color:"var(--text)",outline:"none"};

  if(loading) return (<div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center"}}><Toast toast={toast} onClose={() => setToast(null)} /><p style={{color:"var(--text2)",fontSize:"16px"}}>Loading knowledge base...</p></div>);
  if(selected) return (<div style={{minHeight:"100vh",background:"var(--bg)",padding:"24px"}}><Toast toast={toast} onClose={() => setToast(null)} /><EntryDetail entry={selected} onBack={() => setSelected(null)} onVote={handleVote} onEdit={handleEdit} onDelete={handleDelete} userVotes={userVotes} /></div>);
  if(view === "add") return (<div style={{minHeight:"100vh",background:"var(--bg)",padding:"24px"}}><Toast toast={toast} onClose={() => setToast(null)} /><EntryForm onSubmit={handleAdd} onCancel={() => setView("list")} saving={saving} /></div>);
  if(view === "edit") return (<div style={{minHeight:"100vh",background:"var(--bg)",padding:"24px"}}><Toast toast={toast} onClose={() => setToast(null)} /><EntryForm onSubmit={handleEditSubmit} onCancel={() => {setView("list");setEditEntry(null)}} existing={editEntry} saving={saving} /></div>);

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <div style={{background:"var(--header-grad)",color:"white"}}>
        <div style={{maxWidth:"1200px",margin:"0 auto",padding:"32px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"16px"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px"}}>
                <div style={{width:"42px",height:"42px",background:"rgba(255,255,255,0.2)",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px"}}>{"\uD83E\uDDE0"}</div>
                <h1 style={{fontSize:"28px",fontWeight:700}}>ACE AI Knowledge Base</h1>
              </div>
              <p style={{color:"rgba(255,255,255,0.7)",fontSize:"16px"}}>Shared prompts, workflows, guides and examples for AI tools at ACE</p>
            </div>
            <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
              <div style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center"}}>
                <span className={"sync-dot " + (synced ? "connected" : "local")}></span>
                {synced ? "Synced" : "Local only"}
              </div>
              <button onClick={() => { const nd = !dark; setDark(nd); localStorage.setItem("aceKbDark", nd); }} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"8px",padding:"8px 14px",color:"white",fontSize:"18px",display:"flex",alignItems:"center"}} title="Toggle dark mode">{dark ? "\u2600\uFE0F" : "\uD83C\uDF19"}</button>
              <button onClick={() => setView("add")} style={{background:"white",color:"#00695C",padding:"10px 20px",borderRadius:"8px",fontWeight:600,border:"none",fontSize:"14px",boxShadow:"0 2px 4px rgba(0,0,0,0.1)"}}>+ Add Entry</button>
            </div>
          </div>
          <div style={{display:"flex",gap:"20px",marginTop:"24px",flexWrap:"wrap"}}>
            {[{l:"Total",c:stats.total,b:"rgba(255,255,255,0.2)"},{l:"Start Here",c:stats.startHere,b:"rgba(255,255,255,0.1)"},{l:"Quick Prompts",c:stats.quickPrompts,b:"rgba(255,255,255,0.1)"},{l:"Automated",c:stats.automatedWorkflows,b:"rgba(255,255,255,0.1)"},{l:"Examples",c:stats.examples,b:"rgba(255,255,255,0.1)"}].map((s) => (
              <div key={s.l} style={{background:s.b,borderRadius:"8px",padding:"8px 18px",textAlign:"center"}}>
                <div style={{fontSize:"24px",fontWeight:700}}>{s.c}</div>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.5)"}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {!BACKEND_URL && (
        <div style={{maxWidth:"1200px",margin:"0 auto",padding:"12px 24px 0"}}>
          <div style={{background:"var(--banner-bg)",border:"1px solid var(--banner-border)",borderRadius:"8px",padding:"12px 16px",fontSize:"13px",color:"var(--banner-text)"}}>
            {"\uD83D\uDCE1"}{" Running in local mode \u2014 changes only persist in this browser session. To enable team sync, connect a Google Sheet backend. See the setup guide entry below."}
          </div>
        </div>
      )}
      <div style={{maxWidth:"1200px",margin:"0 auto",padding:"20px 24px"}}>
        <div style={{background:"var(--surface)",borderRadius:"12px",border:"1px solid var(--border)",padding:"16px",display:"flex",flexWrap:"wrap",gap:"12px",alignItems:"center"}}>
          <div style={{flex:1,minWidth:"250px"}}><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prompts, skills, guides..." style={{width:"100%",border:"1px solid var(--border2)",borderRadius:"8px",padding:"10px 16px",fontSize:"14px",outline:"none",background:"var(--surface)",color:"var(--text)",boxSizing:"border-box"}} /></div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={selStyle}><option value="all">All Categories</option>{Object.entries(CATEGORIES).map(([key,val]) => <option key={key} value={key}>{val.icon + " " + val.label + " — " + val.desc}</option>)}</select>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={selStyle}><option value="all">All Tags</option>{usedTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); localStorage.setItem("aceKbSortBy", e.target.value); }} style={selStyle}><option value="date">Newest First</option><option value="votes">Most Helpful</option><option value="title">{"A\u2013Z"}</option></select>
        </div>
      </div>
      <div style={{maxWidth:"1200px",margin:"0 auto",padding:"0 24px 48px"}}>
        <div style={{fontSize:"14px",color:"var(--text2)",marginBottom:"16px"}}>{filtered.length + " " + (filtered.length === 1 ? "entry" : "entries") + " found"}</div>
        {filtered.length === 0 ? (
          <div style={{textAlign:"center",padding:"64px 0",color:"var(--text3)"}}>
            <div style={{fontSize:"48px",marginBottom:"16px"}}>{"\uD83D\uDD0D"}</div>
            <p style={{fontSize:"18px",fontWeight:500}}>No entries match your filters</p>
            <p style={{fontSize:"14px",marginTop:"4px"}}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:"20px"}}>
            {filtered.map((entry) => <EntryCard key={entry.id} entry={entry} onClick={setSelected} onVote={handleVote} userVotes={userVotes} />)}
          </div>
        )}
      </div>
      <div style={{borderTop:"1px solid var(--border)",background:"var(--surface)",padding:"16px 0"}}>
        <div style={{maxWidth:"1200px",margin:"0 auto",padding:"0 24px",textAlign:"center",fontSize:"13px",color:"var(--text3)"}}>{"Animal Charity Evaluators \u2014 AI Knowledge Base \u00B7 Updated " + lastUpdated}</div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
