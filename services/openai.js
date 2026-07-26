import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function analyzeOpportunities(results, userInfo) {

    const response = await groq.chat.completions.create({

        model: "llama-3.1-8b-instant",

        messages: [

            {
                role: "system",
                content: `
You are an AI extracurricular opportunity advisor for high school students.

Your ONLY task is to recommend extracurricular opportunities.

Never recommend:
- Universities
- Colleges
- Schools
- Degree programs
- Scholarships
- Academic courses

Recommend ONLY activities that students can JOIN or APPLY TO.

Examples:
- Research programs
- Research internships
- Internships
- Hackathons
- Programming competitions
- Robotics competitions
- Science fairs
- Math competitions
- Olympiads
- Volunteering
- NGOs
- Student clubs
- Leadership programs
- Community projects
- Workshops
- Conferences
- Summer programs

Prioritize:
1. Same city
2. Same country
3. International (only if necessary)

Each opportunity MUST have BOTH:

1. A valid source URL.
2. At least ONE verified contact method.

Accepted contact methods:
- Email
- Phone
- Telegram
- Instagram
- Facebook
- LinkedIn

DO NOT use a website as the contact.

If an opportunity has NO verified contact method,
DO NOT include it.

If an opportunity has NO source URL,
DO NOT include it.

Never invent:
- organizations
- contact information
- source URLs

Only use information that exists in the provided search results.

Return ONLY valid JSON.

Return EXACTLY this format:

{
  "opportunities": [
    {
      "name": "",
      "description": "",
      "category": "",
      "location": "",
      "whyRecommended": "",
      "skills": [],
      "contact": {
        "type": "",
        "value": ""
      },
      "source": ""
    }
  ]
}

Maximum 6 opportunities.

No markdown.
No explanations.
No extra text.
`
            },

            {
                role: "user",
                content: `
Student Profile

Major:
${userInfo.major}

Academic Interests:
${userInfo.interests.join(", ")}

Preferred Work Styles:
${(userInfo.workStyles || []).join(", ")}

Location:
${userInfo.city}, ${userInfo.country}

Search Results:

${JSON.stringify(results)}

Requirements:

- Recommend ONLY extracurricular opportunities.
- Use ONLY the provided search results.
- Prefer opportunities in ${userInfo.city}.
- Otherwise recommend opportunities elsewhere in ${userInfo.country}.
- Recommend international opportunities ONLY if no local ones exist.
- Exclude any opportunity that lacks BOTH:
  - a source URL
  - a verified contact method (Email, Phone, Telegram, Instagram, Facebook, or LinkedIn).
`
            }

        ]

    });

    let text = response.choices[0].message.content;

    text = text.replace(/```json/g, "");
    text = text.replace(/```/g, "");

    return text.trim();
}