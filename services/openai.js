import Groq from "groq-sdk";


// ============================================================
// GROQ CLIENT
// ============================================================

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


// ============================================================
// OPPORTUNITY ANALYZER
// ============================================================

export async function analyzeOpportunities(
    results = [],
    userInfo = {}
) {

    // --------------------------------------------------------
    // SAFE INPUTS
    // --------------------------------------------------------

    const safeInterests =
        Array.isArray(userInfo?.interests)
            ? userInfo.interests.filter(Boolean)
            : [];

    const safeWorkStyles =
        Array.isArray(userInfo?.workStyles)
            ? userInfo.workStyles.filter(Boolean)
            : [];

    const safeResults =
        Array.isArray(results)
            ? results.filter(
                result =>
                    result &&
                    result.url
            )
            : [];


    console.log(
        "Opportunity AI received:",
        safeResults.length,
        "search results"
    );


    // --------------------------------------------------------
    // NO RESULTS
    // --------------------------------------------------------

    if (safeResults.length === 0) {

        return JSON.stringify({
            opportunities: []
        });
    }


    // --------------------------------------------------------
    // PREPARE SEARCH RESULTS
    // --------------------------------------------------------

    const formattedResults =
        safeResults
            .map((result, index) => {

                return `
RESULT ${index + 1}

Title:
${result.title || "Unknown"}

URL:
${result.url}

Description:
${result.content || "No description available"}

Verified URL:
${result.verified ? "Yes" : "No"}
`;
            })
            .join("\n-------------------------\n");


    // --------------------------------------------------------
    // GROQ REQUEST
    // --------------------------------------------------------

    const response =
        await groq.chat.completions.create({

            model:
                "openai/gpt-oss-20b",

            messages: [

                // =================================================
                // SYSTEM PROMPT
                // =================================================

                {
                    role: "system",

                    content: `
You are an AI extracurricular opportunity advisor for high school students.

Your ONLY job is to select real extracurricular opportunities from the supplied search results.

DO NOT recommend:

- Universities
- Colleges
- Schools
- Degree programs
- Scholarships
- University admissions
- Academic degrees

Recommend activities that a high school student can actually participate in, apply to, join, or volunteer for.

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
- Youth programs


IMPORTANT RULES:

1. ONLY use opportunities that appear in the supplied search results.

2. NEVER invent an organization.

3. NEVER invent a URL.

4. The "source" field MUST contain one of the exact URLs supplied in the search results.

5. Do NOT change or create URLs.

6. Prefer opportunities located in the student's city.

7. If there are not enough city opportunities, use opportunities from the student's country.

8. Use international opportunities only when appropriate.

9. The opportunity must be realistically relevant to a high school student.

10. Do not reject a good opportunity simply because its contact information is missing.

11. If the search result contains a real contact method, include it.

12. If no contact method is available, set the contact type and value to "Not provided".

13. NEVER invent contact information.

14. Prefer results with contact information when choosing between otherwise similar opportunities.

15. Return up to 6 of the BEST opportunities.

16. If there are relevant search results, return them. Do NOT return an empty array merely because some information is missing.


CONTACT RULES:

Accepted contact methods:

- Email
- Phone
- Telegram
- Instagram
- Facebook
- LinkedIn

A website URL is NOT a contact method.

Only use contact information that actually appears in the supplied search result.

If no contact information is present:

"type": "Not provided"
"value": "Not provided"


RELEVANCE:

Prioritize opportunities based on:

1. Student's city
2. Student's country
3. Student's interests
4. Student's major
5. Student's preferred work style
6. Whether the opportunity is suitable for a high school student


RETURN ONLY VALID JSON.

Use EXACTLY this structure:

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


                // =================================================
                // USER PROMPT
                // =================================================

                {
                    role: "user",

                    content: `
STUDENT PROFILE

Major:
${userInfo?.major || "Not provided"}

Academic Interests:
${safeInterests.length
    ? safeInterests.join(", ")
    : "Not provided"}

Preferred Work Styles:
${safeWorkStyles.length
    ? safeWorkStyles.join(", ")
    : "Not provided"}

City:
${userInfo?.city || "Not provided"}

Country:
${userInfo?.country || "Not provided"}


SEARCH RESULTS

${formattedResults}


TASK

Select the best extracurricular opportunities from the search results.

Remember:

- Use ONLY the supplied search results.
- Use ONLY the supplied URLs.
- Never invent URLs.
- Never invent organizations.
- Never invent contact information.
- Prefer opportunities in the student's city.
- Then prefer opportunities in the student's country.
- Use international opportunities only when necessary.
- Do not return an empty list if relevant opportunities exist.
- Missing contact information is NOT a reason to reject an otherwise relevant opportunity.

Return the JSON now.
`
                }

            ],

            temperature: 0.1,

            max_tokens: 3000,

            response_format: {
                type: "json_object"
            }

        });


    // ============================================================
    // CHECK GROQ RESPONSE
    // ============================================================

    if (
        !response ||
        !response.choices ||
        !response.choices[0] ||
        !response.choices[0].message
    ) {

        throw new Error(
            "Groq returned an empty opportunity response"
        );
    }


    // ============================================================
    // GET AI RESPONSE
    // ============================================================

    let text =
        response.choices[0].message.content || "";


    text = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();


    if (!text) {

        throw new Error(
            "Groq returned empty content"
        );
    }


    console.log(
        "Raw opportunity AI response:",
        text
    );


    // ============================================================
    // PARSE JSON
    // ============================================================

    let parsed;

    try {

        parsed =
            JSON.parse(text);

    } catch (error) {

        console.error(
            "Opportunity AI returned invalid JSON:"
        );

        console.error(text);

        throw new Error(
            "AI returned invalid opportunity JSON"
        );
    }


    // ============================================================
    // VALIDATE STRUCTURE
    // ============================================================

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


    // ============================================================
    // ONLY ALLOW ORIGINAL TAVILY URLS
    // ============================================================

    const allowedUrls =
        new Set(
            safeResults.map(
                result => result.url
            )
        );


    const opportunities =
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


    // ============================================================
    // REMOVE DUPLICATES
    // ============================================================

    const uniqueOpportunities = [];

    const seenUrls = new Set();


    for (
        const opportunity
        of opportunities
    ) {

        if (
            seenUrls.has(
                opportunity.source
            )
        ) {
            continue;
        }

        seenUrls.add(
            opportunity.source
        );

        uniqueOpportunities.push(
            opportunity
        );
    }


    // ============================================================
    // IMPORTANT FALLBACK
    // ============================================================
    //
    // If Groq returns 0 even though Tavily found results,
    // return the Tavily results rather than showing
    // "No opportunities found".
    //
    // ============================================================

    if (
        uniqueOpportunities.length === 0 &&
        safeResults.length > 0
    ) {

        console.log(
            "AI returned zero opportunities."
        );

        console.log(
            "Using Tavily fallback results."
        );


        const fallback =
            safeResults
                .slice(0, 6)
                .map(result => ({

                    name:
                        result.title ||
                        "Opportunity",

                    description:
                        result.content ||
                        "See the source for more information.",

                    category:
                        "Extracurricular Opportunity",

                    location:
                        userInfo?.city ||
                        userInfo?.country ||
                        "Unknown",

                    whyRecommended:
                        "This opportunity was found through the extracurricular search.",

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


        return JSON.stringify({
            opportunities: fallback
        });
    }


    // ============================================================
    // FINAL RESULT
    // ============================================================

    console.log(
        "Final AI opportunities:",
        uniqueOpportunities.length
    );


    return JSON.stringify({

        opportunities:
            uniqueOpportunities

    });
}