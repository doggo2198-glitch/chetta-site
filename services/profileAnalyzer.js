import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


// ============================================================
// HELPERS
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
// PROFILE ANALYZER
// ============================================================

export async function analyzeProfile(
    profile = {}
) {

    if (!process.env.GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY is missing"
        );
    }


    const activities =
        safeArray(
            profile.activities
        );

    const awards =
        safeArray(
            profile.awards
        );


    const response =
        await groq.chat.completions.create({

            // IMPORTANT:
            // Do NOT change this back to llama-3.1-8b-instant
            model:
                "openai/gpt-oss-20b",

            messages: [

                {
                    role: "system",

                    content: `
You are an expert university admissions advisor.

Analyze the student's profile and evaluate their competitiveness.

Evaluate:

- Academic strength
- Extracurricular impact
- Leadership
- Awards
- Projects/research
- Overall admission strength
- Uniqueness

Rules:

- Only use information provided by the student.
- Never invent achievements.
- Missing information should be treated as missing.
- Give realistic scores.
- Scores must be from 0 to 100.
- Recommendations must be specific and actionable.

Return ONLY valid JSON.

Use exactly this structure:

{
  "overallScore": 0,
  "categories": {
    "academics": 0,
    "extracurriculars": 0,
    "leadership": 0,
    "achievements": 0,
    "uniqueness": 0
  },
  "strengths": [],
  "weaknesses": [],
  "recommendations": []
}

No markdown.
No explanations outside JSON.
`
                },

                {
                    role: "user",

                    content: `
STUDENT PROFILE

GPA:
${profile.gpa ?? "Not provided"}

SAT:
${profile.sat ?? "Not provided"}

IELTS:
${profile.ielts ?? "Not provided"}

Major:
${profile.major ?? "Not provided"}

Activities:
${
    activities.length
        ? activities.join(", ")
        : "None provided"
}

Awards:
${
    awards.length
        ? awards.join(", ")
        : "None provided"
}

Research / Projects:
${profile.research ?? "Not provided"}

Analyze this profile.
`
                }

            ],

            temperature: 0.2,

            max_tokens: 1500,

            response_format: {
                type: "json_object"
            }

        });


    if (
        !response?.choices?.[0]?.message
    ) {

        throw new Error(
            "Groq returned an empty profile response"
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
            "Groq returned empty profile content"
        );
    }


    let parsed;

    try {

        parsed =
            JSON.parse(text);

    } catch {

        console.error(
            "Invalid profile JSON:",
            text
        );

        throw new Error(
            "AI returned invalid profile JSON"
        );
    }


    const result = {

        overallScore:
            Number(
                parsed.overallScore
            ) || 0,

        categories: {

            academics:
                Number(
                    parsed.categories?.academics
                ) || 0,

            extracurriculars:
                Number(
                    parsed.categories?.extracurriculars
                ) || 0,

            leadership:
                Number(
                    parsed.categories?.leadership
                ) || 0,

            achievements:
                Number(
                    parsed.categories?.achievements
                ) || 0,

            uniqueness:
                Number(
                    parsed.categories?.uniqueness
                ) || 0
        },

        strengths:
            safeArray(
                parsed.strengths
            ),

        weaknesses:
            safeArray(
                parsed.weaknesses
            ),

        recommendations:
            safeArray(
                parsed.recommendations
            )
    };


    // Keep scores between 0 and 100

    result.overallScore =
        Math.max(
            0,
            Math.min(
                100,
                result.overallScore
            )
        );


    for (
        const key
        of Object.keys(
            result.categories
        )
    ) {

        result.categories[key] =
            Math.max(
                0,
                Math.min(
                    100,
                    result.categories[key]
                )
            );
    }


    console.log(
        "Profile analysis completed."
    );


    return JSON.stringify(
        result
    );
}