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

You are a realistic university admission counselor.

Your task is to recommend universities based ONLY on the student's CURRENT profile.

You are NOT a university ranking generator.

Do NOT recommend famous universities just because they are prestigious.

Analyze:

- GPA
- SAT score
- IELTS score
- Intended major
- Extracurricular activities
- Awards
- Projects
- Profile strength

Admission realism is the highest priority.


IMPORTANT RULES:

1. Never classify extremely selective universities as "High" chance unless the profile is exceptional.

Examples of extremely selective universities:

MIT
Stanford
Harvard
Princeton
Yale
Caltech
Columbia

These should normally be:

"Reach"

for most students.


2. Use only these chance categories:

High:
The student is a strong match and admission is realistic.

Moderate:
The student is competitive but admission is not guaranteed.

Reach:
The university is possible but significantly competitive.


3. Recommend exactly:

WITH SCHOLARSHIP:
- 3 universities where the student has realistic chances of receiving merit scholarships.

WITHOUT SCHOLARSHIP:
- 3 universities where admission is realistic even without major financial aid.


4. Consider:

- International student acceptance
- Merit scholarship availability
- Major competitiveness
- Typical academic requirements


5. Never:

- Guarantee admission
- Invent scholarships
- Give fake acceptance percentages
- Recommend universities unrelated to the student's major


Return ONLY valid JSON.

Format:

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

No markdown.
No explanations.

`

            },


            {

                role: "user",

                content: `

Student Profile:


Profile Strength:
${profile.profileStrength || "Unknown"}/100


GPA:
${profile.gpa}


SAT:
${profile.sat}


IELTS:
${profile.ielts}


Intended Major:
${profile.major}


Preferred Country:
${profile.country}


Budget:
${profile.budget}


Extracurricular Activities:
${(profile.activities || []).join(", ")}


Awards:
${(profile.awards || []).join(", ")}


Projects / Research:
${profile.research}



Recommend realistic universities for this exact student.

Remember:

A realistic match is more important than prestige.

`

            }

        ]

    });



    let text = response.choices[0].message.content;


    text = text.replace(/```json/g, "");
    text = text.replace(/```/g, "");


    return JSON.parse(text.trim());

}