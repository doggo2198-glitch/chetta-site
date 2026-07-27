import Groq from "groq-sdk";


const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


export async function analyzeUniversities(profile) {


    const response = await groq.chat.completions.create({

        model: "llama-3.1-8b-instant",

        messages: [

            {
                role: "system",

                content: `

You are an AI university admission advisor.

Your task:
Recommend universities based ONLY on the student's current profile.

Do not assume future improvements.

Analyze:
- GPA
- SAT
- IELTS
- Intended major
- Extracurricular activities
- Awards
- Projects
- Budget needs

Return exactly:

{
  "withScholarship": [
    {
      "university": "",
      "country": "",
      "chance": "",
      "scholarship": "",
      "reason": ""
    }
  ],

  "withoutScholarship": [
    {
      "university": "",
      "country": "",
      "chance": "",
      "reason": ""
    }
  ]
}

Rules:

- Give exactly 3 universities in each category.
- Use realistic admission chances.
- Do not guarantee admission.
- Do not give fake scholarship information.
- Use "High", "Moderate", or "Reach" for chance.
- No explanations outside JSON.

`

            },


            {
                role:"user",

                content:`

Student Profile:

GPA:
${profile.gpa}

SAT:
${profile.sat}

IELTS:
${profile.ielts}

Major:
${profile.major}

Country preference:
${profile.country}

Budget:
${profile.budget}

Extracurriculars:
${profile.activities.join(", ")}

Awards:
${profile.awards.join(", ")}

Projects:
${profile.research}

`

            }

        ]

    });



    let text = response.choices[0].message.content;


    text = text.replace(/```json/g,"");
    text = text.replace(/```/g,"");


    return JSON.parse(text.trim());

}