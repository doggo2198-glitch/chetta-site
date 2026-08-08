import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function generateRoadmap(data) {

    const response = await groq.chat.completions.create({

        model: "llama-3.1-8b-instant",

        messages: [

            {
                role: "system",

                content: `
You are an expert university admissions advisor.

Your task is to create a personalized application roadmap for a student applying to a specific university and major.

You must evaluate the student's current profile and determine:

1. Overall application readiness from 0 to 100.
2. How competitive the student's current profile is.
3. A reasonable competitive readiness target.
4. Category scores.
5. The biggest gaps preventing the student from reaching a stronger profile.
6. A practical month-by-month roadmap.
7. Specific actions the student should take.

IMPORTANT:

The readiness score is NOT an admission probability.

Do not say that a certain score guarantees admission.

Do not invent acceptance rates.

The roadmap should focus on improving the student's application.

Evaluate:

- Academics
- Extracurriculars
- Leadership
- Awards and honors
- Research and projects
- Essays

Return ONLY valid JSON.

Use exactly this structure:

{
  "readinessScore": 0,
  "competitiveTarget": 0,

  "categoryScores": {
    "academics": 0,
    "extracurriculars": 0,
    "leadership": 0,
    "awards": 0,
    "research": 0,
    "essay": 0
  },

  "summary": "",

  "mainGaps": [
    {
      "category": "",
      "severity": "high",
      "currentSituation": "",
      "whyItMatters": "",
      "whatToDo": []
    }
  ],

  "monthlyPlan": [
    {
      "month": "",
      "focus": "",
      "tasks": [],
      "reason": ""
    }
  ]
}

Rules:

- Scores must be integers from 0 to 100.
- competitiveTarget must be between 70 and 95.
- Give 2-5 main gaps.
- Give a realistic monthly plan.
- Prioritize the highest-impact improvements first.
- Do not recommend impossible or unrealistic achievements.
- Do not guarantee admission.
- If the student has not written an essay, give the essay category a low or neutral score rather than treating it as a permanent weakness.
- Consider the student's intended major when evaluating activities and projects.
- Do not use markdown.
`
            },

            {
                role: "user",

                content: `
University:
${data.university}

Intended Major:
${data.major}

Student Profile:

GPA:
${data.gpa}

SAT / ACT:
${data.satAct}

IELTS / TOEFL:
${data.english}

AP / IB / A-Level / Other Courses:
${data.courses}

Class Rank:
${data.classRank}

Extracurriculars:
${data.extracurriculars}

Awards & Honors:
${data.awards}

Leadership:
${data.leadership}

Research / Projects:
${data.research}

Essay:
${data.essay}

Application Year:
${data.applicationYear}
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