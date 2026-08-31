
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function analyzeOpportunities(results, userInfo) {

    const safeInterests =
        Array.isArray(userInfo?.interests)
            ? userInfo.interests
            : [];

    const safeWorkStyles =
        Array.isArray(userInfo?.workStyles)
            ? userInfo.workStyles
            : [];

    const safeResults =
        Array.isArray(results)
            ? results
            : [];

    const response =
        await groq.chat.completions.create({

            // This model is available to your Groq API key
            model: "openai/gpt-oss-20b",

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
3. International only if necessary

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
${userInfo?.major || "Not provided"}

Academic Interests:
${safeInterests.join(", ") || "Not provided"}

Preferred Work Styles:
${safeWorkStyles.join(", ") || "Not provided"}

Location:
${userInfo?.city || "Not provided"}, ${userInfo?.country || "Not provided"}

Search Results:

${JSON.stringify(safeResults)}

Requirements:

- Recommend ONLY extracurricular opportunities.
- Use ONLY the provided search results.
- Prefer opportunities in ${userInfo?.city || "the student's city"}.
- Otherwise recommend opportunities elsewhere in ${userInfo?.country || "the student's country"}.
- Recommend international opportunities ONLY if no local ones exist.
- Exclude any opportunity that lacks BOTH:
  - a source URL
  - a verified contact method (Email, Phone, Telegram, Instagram, Facebook, or LinkedIn).
`
                }

            ],

            temperature: 0.2,

            // Force the model to return JSON
            response_format: {
                type: "json_object"
            }

        });


    // ===============================
    // CHECK RESPONSE
    // ===============================

    if (
        !response.choices ||
        !response.choices[0] ||
        !response.choices[0].message
    ) {
        throw new Error(
            "Groq returned an empty response"
        );
    }


    // ===============================
    // GET AI RESPONSE
    // ===============================

    let text =
        response.choices[0].message.content || "";


    text = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();


    if (!text) {
        throw new Error(
            "Groq returned empty content"
        );
    }


    // ===============================
    // VERIFY JSON
    // ===============================

    try {

        const parsed =
            JSON.parse(text);

        if (
            !parsed ||
            !Array.isArray(parsed.opportunities)
        ) {
            throw new Error(
                "Invalid opportunities structure"
            );
        }

    } catch (error) {

        console.error(
            "Opportunity AI returned invalid JSON:",
            text
        );

        throw new Error(
            "AI returned invalid opportunity JSON"
        );
    }


    return text;
}
