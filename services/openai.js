import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


// ============================================================
// HELPER
// ============================================================

function safeArray(value) {

    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if (
        typeof value === "string" &&
        value.trim()
    ) {
        return [value.trim()];
    }

    return [];
}


function cleanJSON(text) {

    if (typeof text !== "string") {
        return text;
    }

    let cleaned =
        text.trim();

    cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const first =
        cleaned.indexOf("{");

    const last =
        cleaned.lastIndexOf("}");

    if (
        first !== -1 &&
        last !== -1 &&
        last > first
    ) {
        cleaned =
            cleaned.slice(
                first,
                last + 1
            );
    }

    return cleaned;
}


// ============================================================
// OPPORTUNITY ANALYZER
// ============================================================

export async function analyzeOpportunities(
    results = [],
    userInfo = {}
) {

    if (!process.env.GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY is missing"
        );
    }


    const safeResults =
        Array.isArray(results)
            ? results.filter(
                result =>
                    result &&
                    result.url
            )
            : [];


    const interests =
        safeArray(
            userInfo?.interests
        );

    const workStyles =
        safeArray(
            userInfo?.workStyles
        );


    console.log(
        "Opportunity AI received:",
        safeResults.length
    );


    if (safeResults.length === 0) {

        return JSON.stringify({
            opportunities: []
        });
    }


    // --------------------------------------------------------
    // FORMAT TAVILY RESULTS
    // --------------------------------------------------------

    const formattedResults =
        safeResults
            .map((result, index) => `
RESULT ${index + 1}

Title:
${result.title || "Unknown"}

URL:
${result.url}

Description:
${result.content || "No description"}

Verified URL:
${result.verified ? "Yes" : "No"}
`)
            .join(
                "\n-----------------------\n"
            );


    // --------------------------------------------------------
    // GROQ
    // --------------------------------------------------------

    const response =
        await groq.chat.completions.create({

            model:
                "openai/gpt-oss-20b",

            messages: [

                {
                    role: "system",

                    content: `
You are an extracurricular opportunity advisor for high school students.

Select REAL extracurricular opportunities from the provided search results.

ONLY recommend:

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
- Youth programs

NEVER recommend:

- Universities
- Colleges
- Schools
- Degree programs
- Scholarships
- University admissions

CRITICAL RULES:

1. ONLY use the supplied search results.

2. NEVER invent an organization.

3. NEVER invent a URL.

4. The "source" MUST exactly match one of the supplied URLs.

5. Do NOT modify URLs.

6. Prefer opportunities in the student's city.

7. Then prefer opportunities in the student's country.

8. International opportunities are allowed when local opportunities are insufficient.

9. Do NOT reject a relevant opportunity just because contact information is missing.

10. If contact information exists in the supplied result, include it.

11. If contact information does not exist, use:
"type": "Not provided"
"value": "Not provided"

12. NEVER invent contact information.

13. Return up to 6 opportunities.

14. If relevant opportunities exist, DO NOT return an empty array.

Return ONLY valid JSON.

EXACT FORMAT:

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

No markdown.
No explanations.
No extra text.
`
                },


                {
                    role: "user",

                    content: `
STUDENT PROFILE

Major:
${userInfo?.major || "Not provided"}

Interests:
${
    interests.length
        ? interests.join(", ")
        : "Not provided"
}

Preferred Work Styles:
${
    workStyles.length
        ? workStyles.join(", ")
        : "Not provided"
}

City:
${userInfo?.city || "Not provided"}

Country:
${userInfo?.country || "Not provided"}


SEARCH RESULTS

${formattedResults}


TASK

Choose the best real extracurricular opportunities.

Prefer:
1. Student's city
2. Student's country
3. International opportunities

Use ONLY the supplied URLs.

Do NOT invent contact information.

Missing contact information is NOT a reason to reject an opportunity.

If there are relevant results, return them.
`
                }

            ],

            temperature: 0.1,

            max_tokens: 3000,

            response_format: {
                type: "json_object"
            }

        });


    if (
        !response?.choices?.[0]?.message
    ) {

        throw new Error(
            "Groq returned an empty opportunity response"
        );
    }


    let text =
        response
            .choices[0]
            .message
            .content || "";


    text =
        cleanJSON(text);


    if (!text) {

        throw new Error(
            "Groq returned empty opportunity content"
        );
    }


    console.log(
        "Raw opportunity AI response:",
        text
    );


    // --------------------------------------------------------
    // PARSE
    // --------------------------------------------------------

    let parsed;

    try {

        parsed =
            JSON.parse(text);

    } catch {

        console.error(
            "Invalid opportunity JSON:",
            text
        );

        throw new Error(
            "AI returned invalid opportunity JSON"
        );
    }


    if (
        !parsed ||
        !Array.isArray(
            parsed.opportunities
        )
    ) {

        throw new Error(
            "Invalid opportunities structure"
        );
    }


    // --------------------------------------------------------
    // ONLY ACCEPT ORIGINAL TAVILY URLS
    // --------------------------------------------------------

    const allowedUrls =
        new Set(
            safeResults.map(
                result => result.url
            )
        );


    let opportunities =
        parsed.opportunities
            .filter(
                opportunity =>
                    opportunity &&
                    opportunity.source &&
                    allowedUrls.has(
                        opportunity.source
                    )
            )
            .map(opportunity => ({

                name:
                    opportunity.name ||
                    "Opportunity",

                description:
                    opportunity.description ||
                    "",

                category:
                    opportunity.category ||
                    "Other",

                location:
                    opportunity.location ||
                    "Not specified",

                whyRecommended:
                    opportunity.whyRecommended ||
                    "",

                skills:
                    Array.isArray(
                        opportunity.skills
                    )
                        ? opportunity.skills
                        : [],

                contact: {

                    type:
                        opportunity.contact?.type ||
                        "Not provided",

                    value:
                        opportunity.contact?.value ||
                        "Not provided"
                },

                source:
                    opportunity.source
            }));


    // --------------------------------------------------------
    // REMOVE DUPLICATES
    // --------------------------------------------------------

    const seen =
        new Set();

    opportunities =
        opportunities.filter(
            opportunity => {

                if (
                    seen.has(
                        opportunity.source
                    )
                ) {
                    return false;
                }

                seen.add(
                    opportunity.source
                );

                return true;
            }
        );


    // --------------------------------------------------------
    // FALLBACK
    // --------------------------------------------------------

    if (
        opportunities.length === 0 &&
        safeResults.length > 0
    ) {

        console.log(
            "AI selected 0 opportunities."
        );

        console.log(
            "Returning Tavily fallback."
        );


        opportunities =
            safeResults
                .slice(0, 6)
                .map(result => ({

                    name:
                        result.title ||
                        "Opportunity",

                    description:
                        result.content ||
                        "",

                    category:
                        "Extracurricular",

                    location:
                        userInfo?.city ||
                        userInfo?.country ||
                        "Unknown",

                    whyRecommended:
                        "Found through the extracurricular opportunity search.",

                    skills: [],

                    contact: {

                        type:
                            "Not provided",

                        value:
                            "Not provided"
                    },

                    source:
                        result.url
                }));
    }


    console.log(
        "Final AI opportunities:",
        opportunities.length
    );


    return JSON.stringify({

        opportunities

    });
}