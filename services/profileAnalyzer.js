import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


export async function analyzeProfile(profile) {

    const response = await groq.chat.completions.create({

        model: "llama-3.1-8b-instant",

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

Return ONLY valid JSON.

Format:

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
No explanations.
`
            },

            {
                role: "user",
                content: `
Student Profile:

GPA:
${profile.gpa}

SAT:
${profile.sat}

IELTS:
${profile.ielts}

Major:
${profile.major}

Activities:
${profile.activities.join(", ")}

Awards:
${profile.awards.join(", ")}

Research/Projects:
${profile.research}
`
            }

        ],

        temperature: 0.3

    });


    let text = response.choices[0].message.content;

    text = text.replace(/```json/g, "");
    text = text.replace(/```/g, "");

    return text.trim();

}