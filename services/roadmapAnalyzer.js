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
            "whatToDo": [
                ""
            ]
        }
    ],

    "monthlyPlan": [
        {
            "month": "",
            "focus": "",
            "priority": "high",
            "reason": "",
            "tasks": [
                {
                    "id": "",
                    "title": "",
                    "priority": "high"
                }
            ]
        }
    ]
}

RULES:

- Scores must be integers from 0 to 100.
- competitiveTarget must be between 70 and 95.
- Give 2-5 main gaps.
- Give a realistic monthly plan covering the student's realistic application timeline.
- Use the student's application year to determine the timeline whenever possible.
- Each month should contain 2-5 specific actionable tasks.
- Each task must have a unique ID.
- Task priority must be exactly "high", "medium", or "low".
- Monthly priority must be exactly "high", "medium", or "low".
- Prioritize the highest-impact improvements first.
- Do not recommend impossible or unrealistic achievements.
- Do not guarantee admission.
- If the student has not written an essay, give the essay category a low or neutral score rather than treating it as a permanent weakness.
- Consider the student's intended major when evaluating activities and projects.
- Make extracurricular recommendations relevant to the intended major.
- Do not give generic advice when a more specific action is possible.
- If the student has already completed something, do not tell them to repeat it.
- Tasks should be realistic for a high school student.
- Tasks should be concrete actions the student can actually complete.
- Avoid vague tasks such as "improve your profile" or "work harder".
- Use short, clear task titles.
- Give each month a clear focus.
- The reason should briefly explain why that month's focus is important.
- Do not create tasks for things the student has already completed unless further improvement is genuinely needed.
- The "whatToDo" field must contain simple strings, NOT objects.
- Do not use markdown.
- Return ONLY valid JSON.
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

        temperature: 0.15

    });

    let text = response.choices[0].message.content;

    text = text.replace(/```json/g, "");
    text = text.replace(/```/g, "");

    return text.trim();
}