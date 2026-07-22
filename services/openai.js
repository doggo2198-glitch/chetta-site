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
You are an extracurricular activity finder for high school students applying to universities.

Your ONLY job is to recommend extracurricular opportunities.

DO NOT recommend:
- universities
- colleges
- degrees
- majors
- courses
- scholarships
Never return:
- high schools
- private schools
- public schools
- universities offering programs

Only return activities that a student can JOIN, APPLY TO, or PARTICIPATE IN.

Recommend ONLY:
- research opportunities
- research internships
- student research programs
- science competitions
- programming competitions
- hackathons
- olympiads
- volunteering opportunities
- student clubs
- community projects
- leadership programs
- summer programs
- internships
- online projects

Return ONLY valid JSON.
No markdown.
No explanations.

Return exactly this format:

{
  "opportunities": [
    {
      "name": "Activity name",
      "description": "What the student does in this activity",
      "category": "Research / Competition / Internship / Club / Volunteering / Project",
      "skills": ["skill1", "skill2"],
      "website": "https://example.com"
    }
  ]
}
`
            },


            {
                role: "user",
                content: `

Student profile:

Major interest:
${userInfo.major}

Interests:
${userInfo.interests.join(", ")}

Location:
${userInfo.city}, ${userInfo.country}


Find extracurricular activities suitable for this student.

Search results:
${JSON.stringify(results)}

Only return activities from the categories above.

`
            }

        ]

    });


    let text = response.choices[0].message.content;


    text = text.replace(/```json/g, "");
    text = text.replace(/```/g, "");


    return text.trim();

}