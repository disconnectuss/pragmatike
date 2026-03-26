export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { sectionKey, kickoffData, retryOutreach, previousOutreach, feedback } = req.body;

  if (!kickoffData) {
    return res.status(400).json({ error: 'kickoffData is required' });
  }

  // ── Prompt building ──

  const JOB_POST_SCHEMA = `"job_post": string — follow this EXACT Pragmatike format:

Location: [location/setting]
Start date: [start date]
Languages: [language requirements]
Industry: [industry tags]

About the Company

Pragmatike is recruiting on behalf of [describe company TYPE, STAGE, INDUSTRY — NEVER the actual name]. [2-3 sentences about what they do, product, traction — no company name, no team names].

Your Responsibilities

[6-8 bullet responsibilities starting with action verbs]

What You Bring

[6-8 bullet hard requirements]

Nice to Have

[3-5 bullet nice-to-haves]

Why This Role Will Pivot Your Career

[3-4 bullets on growth, impact, career trajectory]

RULES: NEVER include client company name, team names, or salary figures.`;

  const SCHEMA = {
    company_summary:     `"company_summary": string (INTERNAL — 2-3 paragraphs: company overview, funding, team, culture, tech stack, POC names if mentioned. You CAN name the company here.)`,
    job_post:            JOB_POST_SCHEMA,
    outreach:            `"outreach": {"email":[{label,subject,body}×3],"linkedin":[{label,body}×2]} — 3 emails (Initial + Follow-up 1 + Follow-up 2) + 2 LinkedIn DMs. Written by a Pragmatike recruiter to a candidate. NEVER name the client. Mention Pragmatike as the agency. Human, direct, not spammy. LinkedIn max 5 lines.`,
    screener:            `"screener": [{question, options:[4 strings], correct_answer_hint, why_it_matters}×5] — multiple choice technical knockout questions`,
    interview_questions: `"interview_questions": {"technical":[8 strings],"culture_fit":[6 strings]}`,
    salary_study:        `"salary_study": string — market rates in target zone by seniority level, equity norms, total comp benchmarks, contractor vs employee delta. Be specific with ranges.`,
    best_cities:         `"best_cities": [{city, country, why, talent_pool_notes}×8]`,
    competitors:         `"competitors": [{name, type:"direct"|"adjacent"|"talent_competitor", one_liner}×20]`,
    hot_topics:          `"hot_topics": [{topic, why_it_matters, talking_point}×6]`,
  };

  let prompt;

  if (retryOutreach) {
    // Retry outreach with feedback
    prompt = `You are a senior recruiter at Pragmatike.

ORIGINAL KICKOFF DATA:
${kickoffData}

PREVIOUS OUTREACH:
${JSON.stringify(previousOutreach || {}, null, 2)}

RECRUITER FEEDBACK: ${feedback || 'Please regenerate with fresh approach.'}

Regenerate the outreach sequences. NEVER name the client company. Always mention Pragmatike as the agency.

Respond ONLY with valid JSON: { "outreach": { "email": [{label,subject,body}×3], "linkedin": [{label,body}×2] } }`;
  } else {
    // Normal section generation
    if (!sectionKey || !SCHEMA[sectionKey]) {
      return res.status(400).json({ error: 'Invalid sectionKey' });
    }

    prompt = `You are a senior recruitment analyst at Pragmatike, a remote tech recruitment agency.

KICKOFF DATA:
${kickoffData}

CRITICAL CONFIDENTIALITY: In job posts and outreach, NEVER reveal the client company name. In internal sections (company_summary, salary_study, competitors, etc.) you can name the company freely.

Generate ONLY this section: ${sectionKey}

Respond with ONLY a valid JSON object. No markdown, no backticks, no preamble.
Format: { "company_name": string, "role_title": string, ${SCHEMA[sectionKey]} }`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return res.status(response.status).json({ error: 'API error', details: error });
    }

    // Stream the response back
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.end();
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
